from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from issue_guard.cli import main


class CliTests(unittest.TestCase):
    def run_cli(self, fixture: str) -> tuple[int, dict[str, object]]:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_directory = Path(temporary_directory)
            exit_code = main(
                [
                    "--input",
                    str(PROJECT_ROOT / fixture),
                    "--policy",
                    str(PROJECT_ROOT / "policies" / "default-policy.json"),
                    "--output",
                    str(output_directory),
                ]
            )
            report = json.loads((output_directory / "sample-result.json").read_text(encoding="utf-8"))
            self.assertTrue((output_directory / "sample-result.md").is_file())
            return exit_code, report

    def test_safe_input_returns_zero_and_writes_allow_report(self) -> None:
        exit_code, report = self.run_cli("fixtures/safe/bug-fix.json")

        self.assertEqual(exit_code, 0)
        self.assertEqual(report["decision"], "allow")
        self.assertFalse(report["requires_human_approval"])

    def test_blocked_input_returns_two_and_writes_evidence(self) -> None:
        exit_code, report = self.run_cli("fixtures/malicious/secret-exfiltration.json")

        self.assertEqual(exit_code, 2)
        self.assertEqual(report["decision"], "block")
        self.assertEqual(report["evidence"][0]["rule_id"], "SEC-001")

