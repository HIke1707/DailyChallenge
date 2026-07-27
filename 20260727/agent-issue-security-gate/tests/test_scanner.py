from __future__ import annotations

import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from issue_guard.normalizer import load_and_normalize
from issue_guard.policy import load_policy
from issue_guard.scanner import scan


class ScannerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.policy = load_policy(PROJECT_ROOT / "policies" / "default-policy.json")

    def scan_fixture(self, relative_path: str):
        return scan(load_and_normalize(PROJECT_ROOT / relative_path), self.policy)

    def test_safe_fixtures_are_allowed(self) -> None:
        for fixture in ("fixtures/safe/bug-fix.json", "fixtures/safe/documentation.json"):
            with self.subTest(fixture=fixture):
                result = self.scan_fixture(fixture)
                self.assertEqual(result.decision, "allow")
                self.assertEqual(result.risk_score, 0)
                self.assertEqual(result.evidence, ())

    def test_suspicious_fixtures_require_review(self) -> None:
        cases = {
            "fixtures/suspicious/encoded-command.json": "encoded_command",
            "fixtures/suspicious/external-download.json": "external_download",
            "fixtures/suspicious/production-deployment.json": "production_operation",
            "fixtures/suspicious/disable-protection.json": "security_control_disablement",
        }
        for fixture, category in cases.items():
            with self.subTest(fixture=fixture):
                result = self.scan_fixture(fixture)
                self.assertEqual(result.decision, "review")
                self.assertIn(category, result.categories)
                self.assertTrue(result.requires_human_approval)

    def test_malicious_fixtures_are_blocked(self) -> None:
        cases = {
            "fixtures/malicious/secret-exfiltration.json": "secret_exfiltration",
            "fixtures/malicious/destructive-command.json": "destructive_operation",
            "fixtures/malicious/hidden-instruction.json": "instruction_override",
            "fixtures/malicious/fake-security-request.json": "privilege_escalation",
        }
        for fixture, category in cases.items():
            with self.subTest(fixture=fixture):
                result = self.scan_fixture(fixture)
                self.assertEqual(result.decision, "block")
                self.assertIn(category, result.categories)
                self.assertTrue(result.requires_human_approval)

    def test_attachment_match_records_source_and_line(self) -> None:
        result = self.scan_fixture("fixtures/malicious/hidden-instruction.json")

        self.assertEqual(len(result.evidence), 1)
        evidence = result.evidence[0]
        self.assertEqual(evidence.source, "attachment")
        self.assertEqual(evidence.source_name, "design-notes.txt")
        self.assertEqual(evidence.line, 1)
        self.assertEqual(evidence.rule_id, "SEC-003")

