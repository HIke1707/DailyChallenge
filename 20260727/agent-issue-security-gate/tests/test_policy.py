from __future__ import annotations

import sys
import json
import tempfile
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from issue_guard.policy import load_policy


class DefaultPolicyTests(unittest.TestCase):
    def test_default_policy_has_unique_machine_readable_categories(self) -> None:
        policy = load_policy(PROJECT_ROOT / "policies" / "default-policy.json")

        self.assertEqual(len(policy.rules), 15)
        self.assertEqual(len({rule.id for rule in policy.rules}), 15)
        self.assertEqual(
            {rule.category for rule in policy.rules},
            {
                "access_change",
                "authority_spoofing",
                "destructive_operation",
                "encoded_command",
                "external_download",
                "instruction_override",
                "privilege_escalation",
                "production_data_destruction",
                "production_operation",
                "secret_exfiltration",
                "security_control_disablement",
            },
        )
        self.assertTrue(all(rule.category_label_zh for rule in policy.rules))
        self.assertEqual(policy.review_threshold, 1)
        self.assertEqual(policy.block_threshold, 60)

    def test_invalid_regex_is_rejected(self) -> None:
        invalid_policy = {
            "name": "invalid-policy",
            "score_thresholds": {"review": 1, "block": 60},
            "rules": [
                {
                    "id": "BAD-001",
                    "category": "bad",
                    "category_label_zh": "錯誤",
                    "action": "review",
                    "score": 1,
                    "summary": "Invalid regex fixture.",
                    "requested_capabilities": [],
                    "patterns": ["["],
                }
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "invalid-policy.json"
            path.write_text(json.dumps(invalid_policy), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "invalid"):
                load_policy(path)
