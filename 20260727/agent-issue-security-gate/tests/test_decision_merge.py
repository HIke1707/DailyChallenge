from __future__ import annotations

import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from issue_guard.decision_merge import merge_decisions


class DecisionMergeTests(unittest.TestCase):
    def test_all_decision_combinations_are_monotonic(self) -> None:
        expected = {
            ("allow", None): "allow",
            ("allow", "allow"): "allow",
            ("allow", "review"): "review",
            ("allow", "block"): "block",
            ("review", "allow"): "review",
            ("review", "review"): "review",
            ("review", "block"): "block",
            ("block", "allow"): "block",
            ("block", "review"): "block",
            ("block", "block"): "block",
        }
        for decisions, final_decision in expected.items():
            with self.subTest(decisions=decisions):
                self.assertEqual(merge_decisions(*decisions), final_decision)

    def test_invalid_semantic_decision_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            merge_decisions("review", "unknown")  # type: ignore[arg-type]
