import os
import re
import sys
import json
import argparse
from pathlib import Path

# Supported target extensions / file patterns
TARGET_EXTENSIONS = {'.cs', '.ts', '.js', '.json', '.yml', '.yaml', '.env', '.example', '.md'}

# Default reference path relative to this script
DEFAULT_DEPRECATIONS_PATH = Path(__file__).resolve().parent.parent / "references" / "openai-deprecations.json"

DEFAULT_IGNORE_DIRS = {'.git', 'node_modules', '__pycache__', '.venv', 'venv', 'bin', 'obj'}

SECRET_PATTERNS = [
    # 1. Any sk- prefixed API keys (sk-..., sk-proj-..., sk-svcacct-..., etc.)
    (re.compile(r'sk-(?:proj-|svcacct-|admin-)?[a-zA-Z0-9_\-]{3,}'), 'sk-***REDACTED***'),
    # 2. JSON key-value pairs e.g. "OPENAI_API_KEY": "secret_val"
    (re.compile(r'(?i)(["\'](?:[a-z0-9_-]*key|[a-z0-9_-]*secret|[a-z0-9_-]*token|password|passwd|auth)["\']\s*:\s*["\'])([^"\'\s]+)(["\'])'), r'\1***REDACTED***\3'),
    # 3. Key-Value assignment e.g. OPENAI_API_KEY=secret_val or apiKey = "secret_val"
    (re.compile(r'(?i)([a-z0-9_-]*key|[a-z0-9_-]*secret|[a-z0-9_-]*token|password|passwd|auth)\s*([:=])\s*(["\']?)([^"\'\s,;{}]+)(["\']?)'), r'\1 \2 \3***REDACTED***\5'),
    # 4. Bearer authorization headers
    (re.compile(r'(?i)(Bearer)\s+[a-zA-Z0-9_\-\.=]+'), r'\1 ***REDACTED***')
]

def sanitize_snippet(text: str) -> str:
    """Mask sensitive keys, tokens, and secrets in code snippets to prevent credential leaks."""
    if not text:
        return text
    sanitized = text
    for pattern, replacement in SECRET_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized

def is_comment_line(line: str, file_path: Path) -> bool:
    """Check if line is a comment in source code or part of documentation."""
    ext = file_path.suffix.lower()
    stripped = line.strip()

    if ext == '.md':
        return True

    # C-style comments (.cs, .ts, .js)
    if ext in {'.cs', '.ts', '.js'}:
        if stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
            return True

    # Python / Shell / Yaml comments
    if ext in {'.yml', '.yaml', '.py', '.sh'}:
        if stripped.startswith('#'):
            return True

    # HTML / XML comments
    if stripped.startswith('<!--'):
        return True

    return False

def is_target_file(file_path: Path) -> bool:
    """Check if the file matches target extensions or naming patterns."""
    name = file_path.name.lower()
    ext = file_path.suffix.lower()
    if ext in TARGET_EXTENSIONS:
        return True
    if '.env' in name or name.endswith('.example'):
        return True
    return False

def load_deprecations(deprecations_path: Path) -> tuple:
    """Load deprecated models list and catalog metadata from JSON reference file."""
    if not deprecations_path.exists():
        raise FileNotFoundError(f"Deprecations file not found: {deprecations_path}")
    with open(deprecations_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if isinstance(data, dict):
        metadata = {
            'version': data.get('version', 'unknown'),
            'checked_at': data.get('checked_at', 'unknown'),
            'coverage_statement': data.get('coverage_statement', '本稽核僅涵蓋記錄於此 Catalog 內之 OpenAI 模型與 API 棄用項目，未包含於本 Catalog 內之模型不在此自動稽核判定範圍內。')
        }
        deprecations = data.get('deprecations', [])
    else:
        metadata = {
            'version': 'unknown',
            'checked_at': 'unknown',
            'coverage_statement': '本稽核僅涵蓋記錄於此 Catalog 內之 OpenAI 模型與 API 棄用項目，未包含於本 Catalog 內之模型不在此自動稽核判定範圍內。'
        }
        deprecations = data

    return deprecations, metadata

def build_model_regex(model_id: str) -> re.Pattern:
    """
    Build a regex pattern to match model_id with strict boundaries.
    Prevents false positives (e.g. matching 'gpt-4o' inside 'gpt-4o.5-2025-04-09').
    """
    pattern = r'(?<![a-zA-Z0-9_.-])' + re.escape(model_id) + r'(?![a-zA-Z0-9_.-])'
    return re.compile(pattern)

def audit_directory(root_dir: Path, deprecations_path: Path = DEFAULT_DEPRECATIONS_PATH, ignore_dirs=None) -> list:
    """
    Scan target directory for deprecated OpenAI model IDs in filenames and file contents.
    """
    if ignore_dirs is None:
        ignore_dirs = DEFAULT_IGNORE_DIRS

    root_dir = Path(root_dir).resolve()
    deprecations_path = Path(deprecations_path).resolve()
    deprecations, catalog_meta = load_deprecations(deprecations_path)

    model_patterns = []
    for item in deprecations:
        model_id = item['model']
        pattern = build_model_regex(model_id)
        model_patterns.append({
            'model_id': model_id,
            'pattern': pattern,
            'info': item
        })

    findings = []

    for path in root_dir.rglob('*'):
        if not path.is_file():
            continue

        resolved_path = path.resolve()

        # Skip the deprecations reference file itself
        if resolved_path == deprecations_path:
            continue

        # Skip ignored directories
        if any(part in ignore_dirs for part in path.parts):
            continue

        if not is_target_file(path):
            continue

        try:
            rel_path = str(path.relative_to(root_dir))
        except ValueError:
            rel_path = str(path)

        # 1. Scan filename (stem) to avoid trailing extension dot blocking lookahead
        for mp in model_patterns:
            if mp['pattern'].search(path.stem):
                findings.append({
                    'file': rel_path,
                    'line': 0,
                    'type': 'filename',
                    'classification': 'deprecated',
                    'matched_text': path.name,
                    'model': mp['model_id'],
                    'announced_at': mp['info'].get('announced_at', '2026-07-20'),
                    'shutdown_date': mp['info'].get('shutdown_date', 'N/A'),
                    'recommended_replacement': mp['info'].get('recommended_replacement', 'N/A'),
                    'risk_level': mp['info'].get('risk_level', 'High'),
                    'requires_manual_verification': mp['info'].get('requires_manual_verification', False),
                    'confidence': mp['info'].get('confidence', 'High'),
                    'catalog_version': catalog_meta['version'],
                    'catalog_coverage_statement': catalog_meta['coverage_statement']
                })

        # 2. Scan file content
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                for line_num, line in enumerate(f, 1):
                    for mp in model_patterns:
                        if mp['pattern'].search(line):
                            is_doc = (path.suffix.lower() == '.md') or is_comment_line(line, path)
                            classification = "documentation_reference" if is_doc else "deprecated"
                            finding_type = "documentation" if path.suffix.lower() == '.md' else ("comment" if is_doc else "content")
                            findings.append({
                                'file': rel_path,
                                'line': line_num,
                                'type': finding_type,
                                'classification': classification,
                                'matched_text': sanitize_snippet(line.strip()),
                                'model': mp['model_id'],
                                'announced_at': mp['info'].get('announced_at', '2026-07-20'),
                                'shutdown_date': mp['info'].get('shutdown_date', 'N/A'),
                                'recommended_replacement': mp['info'].get('recommended_replacement', 'N/A'),
                                'risk_level': mp['info'].get('risk_level', 'High'),
                                'requires_manual_verification': mp['info'].get('requires_manual_verification', False),
                                'confidence': mp['info'].get('confidence', 'High'),
                                'catalog_version': catalog_meta['version'],
                                'catalog_coverage_statement': catalog_meta['coverage_statement']
                            })
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to read file {rel_path}: {e}\n")
            findings.append({
                'file': rel_path,
                'line': 0,
                'type': 'read_error',
                'classification': 'informational',
                'matched_text': '',
                'model': 'N/A',
                'announced_at': 'N/A',
                'shutdown_date': 'N/A',
                'recommended_replacement': 'N/A',
                'risk_level': 'N/A',
                'requires_manual_verification': True,
                'confidence': 'Low',
                'catalog_version': catalog_meta['version'],
                'catalog_coverage_statement': catalog_meta['coverage_statement'],
                'error': str(e)
            })

    return findings

def main():
    parser = argparse.ArgumentParser(description="Audit codebase for deprecated OpenAI models.")
    parser.add_argument("target_dir", nargs="?", default=".", help="Directory to scan (default: current directory)")
    parser.add_argument("--deprecations-path", default=str(DEFAULT_DEPRECATIONS_PATH), help="Path to openai-deprecations.json")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")

    args = parser.parse_args()

    target_dir = Path(args.target_dir)
    deprecations_path = Path(args.deprecations_path)

    findings = audit_directory(target_dir, deprecations_path)

    if args.json:
        print(json.dumps(findings, indent=2, ensure_ascii=False))
    else:
        if not findings:
            print("✅ No deprecated OpenAI models found.")
            return

        print(f"⚠️  Found {len(findings)} occurrence(s) of deprecated OpenAI models or scan issues:\n")
        for f in findings:
            if f.get('type') == 'read_error':
                print(f"- Location: {f['file']} (read error)")
                print(f"  Error: {f.get('error')}")
                print()
                continue
            location = f"{f['file']}:{f['line']}" if f['line'] > 0 else f"{f['file']} (filename)"
            print(f"- Location: {location}")
            print(f"  Model: {f['model']} (Shutdown: {f['shutdown_date']}) -> Replace with: {f['recommended_replacement']}")
            if f['line'] > 0:
                print(f"  Snippet: {f['matched_text']}")
            print()

if __name__ == "__main__":
    main()
