from __future__ import annotations

import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from issue_guard.policy import load_policy


class DefaultPolicyTests(unittest.TestCase):
    def test_default_policy_has_unique_machine_readable_categories(self) -> None:
        policy = load_policy(PROJECT_ROOT / "policies" / "default-policy.json")

        self.assertEqual(len(policy.rules), 8)
        self.assertEqual(len({rule.id for rule in policy.rules}), 8)
        self.assertEqual(len({rule.category for rule in policy.rules}), 8)
        self.assertTrue(all(rule.category_label_zh for rule in policy.rules))
        self.assertEqual(policy.review_threshold, 1)
        self.assertEqual(policy.block_threshold, 60)

