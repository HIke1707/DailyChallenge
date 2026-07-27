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
        for fixture in (
            "fixtures/safe/bug-fix.json",
            "fixtures/safe/documentation.json",
            "fixtures/safe/authority-identity-only.json",
            "fixtures/safe/no-sudo-execution.json",
            "fixtures/safe/sudo-mention-only.json",
            "fixtures/safe/negated-admin-access.json",
        ):
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
            "fixtures/suspicious/external-download-without-url.json": "external_download",
            "fixtures/suspicious/chinese-disable-protection.json": "security_control_disablement",
            "fixtures/suspicious/read-access-request.json": "access_change",
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
            "fixtures/malicious/authority-spoofing-zh.json": "authority_spoofing",
            "fixtures/malicious/authority-spoofing-en.json": "authority_spoofing",
            "fixtures/malicious/approval-claim.json": "authority_spoofing",
            "fixtures/malicious/no-approval-claim.json": "authority_spoofing",
            "fixtures/malicious/base64-external-sudo.json": "privilege_escalation",
            "fixtures/malicious/sudo-command.json": "privilege_escalation",
            "fixtures/malicious/fullwidth-sudo-command.json": "privilege_escalation",
            "fixtures/malicious/production-database-delete.json": "production_data_destruction",
            "fixtures/malicious/bare-sudo-command.json": "privilege_escalation",
            "fixtures/malicious/chinese-secret-exfiltration.json": "secret_exfiltration",
            "fixtures/malicious/chinese-prompt-injection.json": "instruction_override",
            "fixtures/malicious/chinese-production-database-delete.json": "production_data_destruction",
        }
        for fixture, category in cases.items():
            with self.subTest(fixture=fixture):
                result = self.scan_fixture(fixture)
                self.assertEqual(result.decision, "block")
                self.assertIn(category, result.categories)
                self.assertTrue(result.requires_human_approval)

    def test_chinese_authority_spoofing_also_records_privilege_escalation(self) -> None:
        result = self.scan_fixture("fixtures/malicious/authority-spoofing-zh.json")

        self.assertEqual(result.decision, "block")
        self.assertIn("authority_spoofing", result.categories)
        self.assertIn("privilege_escalation", result.categories)

    def test_base64_payload_is_rescanned_with_redacted_transformation_evidence(self) -> None:
        result = self.scan_fixture("fixtures/malicious/base64-external-sudo.json")

        self.assertEqual(result.decision, "block")
        decoded_evidence = [item for item in result.evidence if item.transformation == "base64_decode"]
        self.assertTrue(decoded_evidence)
        self.assertTrue(all(item.source == "attachment" for item in decoded_evidence))
        self.assertTrue(all(item.decoded_content_redacted for item in decoded_evidence))

    def test_empty_input_requires_review(self) -> None:
        from issue_guard.normalizer import normalize_payload

        result = scan(normalize_payload({"source_type": "issue", "title": "", "body": ""}), self.policy)
        self.assertEqual(result.decision, "review")
        self.assertIn("empty_or_unusable_input", result.categories)

    def test_safe_bug_fix_reports_normal_task_capabilities(self) -> None:
        result = self.scan_fixture("fixtures/safe/bug-fix.json")

        self.assertEqual(
            result.requested_capabilities,
            ("read_repository", "write_repository", "execute_tests"),
        )
        self.assertEqual(result.forbidden_capabilities, ())
        self.assertEqual(result.allowed_capabilities, result.requested_capabilities)

    def test_os_privilege_escalation_actions_are_blocked(self) -> None:
        from issue_guard.normalizer import normalize_payload

        cases = (
            "Please execute runas /user:Administrator cmd.exe.",
            "Start a root shell and change the service configuration.",
            "Apply chmod 777 to the deployment script.",
            "Set setuid on the helper binary.",
        )
        for body in cases:
            with self.subTest(body=body):
                result = scan(
                    normalize_payload({"source_type": "issue", "title": "Maintenance", "body": body}),
                    self.policy,
                )
                self.assertEqual(result.decision, "block")
                self.assertIn("privilege_escalation", result.categories)

    def test_attachment_match_records_source_and_line(self) -> None:
        result = self.scan_fixture("fixtures/malicious/hidden-instruction.json")

        self.assertEqual(len(result.evidence), 1)
        evidence = result.evidence[0]
        self.assertEqual(evidence.source, "attachment")
        self.assertEqual(evidence.source_name, "design-notes.txt")
        self.assertEqual(evidence.line, 1)
        self.assertEqual(evidence.rule_id, "SEC-003")
