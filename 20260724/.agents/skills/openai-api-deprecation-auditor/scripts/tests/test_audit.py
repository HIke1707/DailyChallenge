import json
import tempfile
import unittest
import sys
from pathlib import Path

# Add scripts directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from audit import (
    audit_directory,
    build_model_regex,
    is_target_file,
)

class TestOpenAIAudit(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root_path = Path(self.temp_dir.name)

        # Create dummy deprecations reference
        self.deprecations_path = self.root_path / "deprecations.json"
        self.deprecations_data = [
            {
                "shutdown_date": "2027-01-20",
                "model": "gpt-realtime",
                "recommended_replacement": "gpt-realtime-2.1"
            },
            {
                "shutdown_date": "2027-01-20",
                "model": "gpt-4o",
                "recommended_replacement": "gpt-4o-mini"
            }
        ]
        with open(self.deprecations_path, "w", encoding="utf-8") as f:
            json.dump(self.deprecations_data, f)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_build_model_regex_exact_match(self):
        pattern = build_model_regex("gpt-4o")
        self.assertTrue(bool(pattern.search('model = "gpt-4o"')))
        self.assertTrue(bool(pattern.search('gpt-4o')))
        self.assertTrue(bool(pattern.search('OPENAI_MODEL=gpt-4o')))

    def test_build_model_regex_no_false_positive_for_extended_version(self):
        pattern = build_model_regex("gpt-4o")
        # Must NOT match gpt-4o.5-2025-04-09
        self.assertFalse(bool(pattern.search('model = "gpt-4o.5-2025-04-09"')))
        # Must NOT match gpt-4o-2024-05-13
        self.assertFalse(bool(pattern.search('model = "gpt-4o-2024-05-13"')))

    def test_build_model_regex_no_false_positive_for_hyphenated_suffix(self):
        pattern = build_model_regex("gpt-realtime")
        self.assertTrue(bool(pattern.search('model = "gpt-realtime"')))
        self.assertFalse(bool(pattern.search('model = "gpt-realtime-2.1"')))
        self.assertFalse(bool(pattern.search('model = "gpt-realtime-mini"')))

    def test_is_target_file(self):
        self.assertTrue(is_target_file(Path("app.cs")))
        self.assertTrue(is_target_file(Path("index.ts")))
        self.assertTrue(is_target_file(Path("server.js")))
        self.assertTrue(is_target_file(Path("config.json")))
        self.assertTrue(is_target_file(Path("deploy.yml")))
        self.assertTrue(is_target_file(Path("docker.yaml")))
        self.assertTrue(is_target_file(Path(".env")))
        self.assertTrue(is_target_file(Path(".env.local")))
        self.assertTrue(is_target_file(Path("settings.example")))
        self.assertTrue(is_target_file(Path("README.md")))
        self.assertFalse(is_target_file(Path("image.png")))
        self.assertFalse(is_target_file(Path("binary.dll")))

    def test_audit_directory_findings(self):
        # 1. Target file with deprecated model
        code_file = self.root_path / "app.js"
        code_file.write_text('const model = "gpt-realtime";\nconst newModel = "gpt-4o.5-2025-04-09";', encoding="utf-8")

        # 2. File with deprecated model in filename
        fn_file = self.root_path / "gpt-4o.ts"
        fn_file.write_text('console.log("hello");', encoding="utf-8")

        # 3. File with extended model string (should NOT trigger deprecated gpt-4o match)
        valid_file = self.root_path / "config.json"
        valid_file.write_text('{"model": "gpt-4o.5-2025-04-09"}', encoding="utf-8")

        findings = audit_directory(self.root_path, self.deprecations_path)

        models_found = [f["model"] for f in findings]
        files_found = [f["file"] for f in findings]

        self.assertIn("gpt-realtime", models_found)
        self.assertIn("gpt-4o", models_found)
        self.assertIn("app.js", files_found)
        self.assertIn("gpt-4o.ts", files_found)
        self.assertNotIn("config.json", files_found)

if __name__ == "__main__":
    unittest.main()
