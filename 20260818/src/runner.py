#!/usr/bin/env python3
"""Main Pipeline Runner for Claude Text Watermark & Provenance Robustness Experiment."""
import argparse
import csv
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any

# Ensure src directory is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from core.models import BaselineSample, TransformSpec, TransformationResult
from core.diff_analyzer import DiffAnalyzer
from core.transformer import TextTransformer
from core.verification_adapter import VerificationAdapterRegistry
from matrix_generator import MatrixGenerator


def load_baselines(base_dir: Path) -> List[BaselineSample]:
    """Load baseline samples and their metadata JSONs."""
    baseline_dir = base_dir / "samples" / "baseline"
    samples = []
    
    for json_file in sorted(baseline_dir.glob("*.json")):
        with open(json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        text_file = base_dir / data["text_path"]
        with open(text_file, "r", encoding="utf-8") as f:
            content = f.read()

        # Recalculate exact chars, tokens, and SHA256
        real_sha = DiffAnalyzer.compute_sha256(content)
        real_tokens = DiffAnalyzer.tokenize_words(content)

        sample = BaselineSample(
            sample_id=data["sample_id"],
            category=data["category"],
            title=data["title"],
            prompt=data["prompt"],
            model=data["model"],
            generation_interface=data["generation_interface"],
            timestamp=data["timestamp"],
            text_path=data["text_path"],
            content=content,
            char_count=len(content),
            word_count=len(real_tokens),
            sha256=real_sha,
            provenance_notes=data.get("provenance_notes", "")
        )
        samples.append(sample)
        
    return samples


def load_transform_specs(base_dir: Path) -> List[TransformSpec]:
    """Load transform specs from config.json."""
    config_file = base_dir / "config.json"
    with open(config_file, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    specs = []
    for item in data.get("transformations", []):
        spec = TransformSpec(
            id=item["id"],
            name=item["name"],
            category=item["category"],
            target_strength=item["target_strength"],
            rule_description=item["rule_description"],
            expected_change=item["expected_change"],
            is_core=item.get("is_core", True)
        )
        specs.append(spec)
    return specs


def run_pipeline(base_dir: Path, clean: bool = False) -> List[TransformationResult]:
    """Executes the full transformation, analysis, and verification pipeline."""
    transformed_dir = base_dir / "samples" / "transformed"
    transformed_dir.mkdir(parents=True, exist_ok=True)
    
    if clean:
        for f in transformed_dir.glob("*.txt"):
            f.unlink()

    baselines = load_baselines(base_dir)
    transform_specs = load_transform_specs(base_dir)
    registry = VerificationAdapterRegistry()
    official_verifier = registry.get_official_verifier()

    results: List[TransformationResult] = []

    print(f"[*] 載入 {len(baselines)} 組 Baseline 樣本，共 {len(transform_specs)} 種變換規格。")

    for base_sample in baselines:
        print(f"\n[-] 正在處理 Baseline: {base_sample.sample_id} ({base_sample.title})")
        
        for spec in transform_specs:
            # 1. Apply transformation
            transformed_text = TextTransformer.transform(
                sample_id=base_sample.sample_id,
                transform_id=spec.id,
                baseline_text=base_sample.content
            )

            # 2. Save transformed output
            output_filename = f"{base_sample.sample_id}_{spec.id}.txt"
            output_path = transformed_dir / output_filename
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(transformed_text)

            # 3. Analyze diff and similarity metrics
            metrics = DiffAnalyzer.analyze(base_sample.content, transformed_text)

            # 4. Verify via Verification Adapter
            ver_report = official_verifier.verify_sample(
                sample_id=base_sample.sample_id,
                transform_id=spec.id,
                text=transformed_text
            )

            # 5. Build result object
            res = TransformationResult(
                sample_id=base_sample.sample_id,
                transform_id=spec.id,
                transform_name=spec.name,
                transform_strength=spec.target_strength,
                category=spec.category,
                baseline_sha256=metrics["baseline_sha256"],
                transformed_sha256=metrics["transformed_sha256"],
                baseline_char_count=metrics["baseline_char_count"],
                transformed_char_count=metrics["transformed_char_count"],
                char_count_delta=metrics["char_count_delta"],
                baseline_word_count=metrics["baseline_word_count"],
                transformed_word_count=metrics["transformed_word_count"],
                word_count_delta=metrics["word_count_delta"],
                levenshtein_distance=metrics["levenshtein_distance"],
                normalized_edit_similarity=metrics["normalized_edit_similarity"],
                sequence_matcher_similarity=metrics["sequence_matcher_similarity"],
                jaccard_token_similarity=metrics["jaccard_token_similarity"],
                verification_method=ver_report.verification_method,
                marker_status=ver_report.marker_status,
                verification_notes=ver_report.notes,
                evidence_path=ver_report.evidence_path,
                output_file_path=f"samples/transformed/{output_filename}",
                metadata={
                    "rule_description": spec.rule_description,
                    "expected_change": spec.expected_change,
                    "is_core": spec.is_core,
                    "verifier": ver_report.verifier_name
                }
            )
            results.append(res)
            print(f"    ✓ 變換 [{spec.id:22s}] -> 相似度: {res.sequence_matcher_similarity:.4f} | 編輯距離: {res.levenshtein_distance:3d} | 狀態: {res.marker_status}")

    # Export to CSV
    csv_path = base_dir / "results.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        fieldnames = [
            "sample_id", "transform_id", "transform_name", "transform_strength", "category",
            "baseline_sha256", "transformed_sha256", "baseline_char_count", "transformed_char_count",
            "char_count_delta", "baseline_word_count", "transformed_word_count", "word_count_delta",
            "levenshtein_distance", "normalized_edit_similarity", "sequence_matcher_similarity",
            "jaccard_token_similarity", "verification_method", "marker_status", "evidence_path",
            "output_file_path", "verification_notes"
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            d = r.to_dict()
            d.pop("metadata", None)
            writer.writerow(d)
    print(f"\n[+] 成功匯出機器可讀結果 CSV: {csv_path} (共 {len(results)} 筆紀錄)")

    # Export to JSON
    json_path = base_dir / "results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump([r.to_dict() for r in results], f, ensure_ascii=False, indent=2)
    print(f"[+] 成功匯出機器可讀結果 JSON: {json_path}")

    # Export Robustness Matrix
    matrix_path = base_dir / "robustness-matrix.md"
    matrix_content = MatrixGenerator.generate_markdown(results)
    with open(matrix_path, "w", encoding="utf-8") as f:
        f.write(matrix_content)
    print(f"[+] 成功生成韌性矩陣分析報告: {matrix_path}")

    # Export synchronized Evidence files (SSOT from results)
    from evidence_generator import EvidenceGenerator
    EvidenceGenerator.generate_all(base_dir, results)
    print(f"[+] 成功同步生成 Case 1~3 證據文件 (由 results.csv 唯一事實來源自動渲染)")

    return results


def main():
    parser = argparse.ArgumentParser(description="Claude Provenance Robustness Experiment Pipeline Runner")
    parser.add_argument("--clean-run", action="store_true", help="Clean transformed directory before running")
    args = parser.parse_args()

    # Determine base directory (directory containing this file or parent)
    base_dir = Path(__file__).resolve().parent.parent
    print(f"=================================================================")
    print(f" Claude 文字水印與內容來源標記韌性測試 Runner v1.0.0")
    print(f" 工作目錄: {base_dir}")
    print(f"=================================================================")

    results = run_pipeline(base_dir, clean=args.clean_run)
    print(f"\n[*] 實驗執行完畢！總計產出 {len(results)} 組樣本數據。")


if __name__ == "__main__":
    main()
