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

    def test_ignore_bin_and_obj_directories(self):
        bin_dir = self.root_path / "bin"
        bin_dir.mkdir()
        (bin_dir / "app.cs").write_text('const string model = "gpt-4o";', encoding="utf-8")

        obj_dir = self.root_path / "obj"
        obj_dir.mkdir()
        (obj_dir / "app.cs").write_text('const string model = "gpt-4o";', encoding="utf-8")

        findings = audit_directory(self.root_path, self.deprecations_path)
        files_found = [f["file"] for f in findings]

        self.assertNotIn("bin/app.cs", files_found)
        self.assertNotIn("obj/app.cs", files_found)

    def test_ts_yaml_env_scanning(self):
        (self.root_path / "service.ts").write_text('const model = "gpt-4o";', encoding="utf-8")
        (self.root_path / "config.yaml").write_text('openai:\n  model: "gpt-4o"', encoding="utf-8")
        (self.root_path / ".env").write_text('OPENAI_MODEL=gpt-4o\nOPENAI_API_KEY=sk-placeholder', encoding="utf-8")
        (self.root_path / "settings.example").write_text('OPENAI_MODEL=gpt-4o', encoding="utf-8")

        findings = audit_directory(self.root_path, self.deprecations_path)
        files_found = [f["file"] for f in findings]

        self.assertIn("service.ts", files_found)
        self.assertIn("config.yaml", files_found)
        self.assertIn(".env", files_found)
        self.assertIn("settings.example", files_found)

    def test_read_error_handling(self):
        unreadable_file = self.root_path / "unreadable.cs"
        unreadable_file.write_text('const model = "gpt-4o";', encoding="utf-8")
        # Make file unreadable
        unreadable_file.chmod(0000)

        try:
            findings = audit_directory(self.root_path, self.deprecations_path)
            error_findings = [f for f in findings if f.get("type") == "read_error"]
            self.assertTrue(len(error_findings) > 0)
            self.assertEqual(error_findings[0]["file"], "unreadable.cs")
        finally:
            unreadable_file.chmod(0o644)

    def test_secret_redaction_in_matched_text(self):
        # Test JSON containing API key and deprecated model
        json_file = self.root_path / "secret.json"
        json_file.write_text('{"OPENAI_API_KEY":"sk-secret-test-key-12345","model":"gpt-realtime"}', encoding="utf-8")

        # Test .env containing API key and deprecated model
        env_file = self.root_path / ".env"
        env_file.write_text('OPENAI_API_KEY=sk-proj-myrealapikey98765\nOPENAI_MODEL=gpt-realtime', encoding="utf-8")

        findings = audit_directory(self.root_path, self.deprecations_path)
        
        json_finding = [f for f in findings if f["file"] == "secret.json"][0]
        env_finding = [f for f in findings if f["file"] == ".env"][0]

        # Verify secrets are masked and not exposed in matched_text
        self.assertNotIn("sk-secret-test-key-12345", json_finding["matched_text"])
        self.assertNotIn("sk-proj-myrealapikey98765", env_finding["matched_text"])
        self.assertIn("***REDACTED***", json_finding["matched_text"])

if __name__ == "__main__":
    unittest.main()

