from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = PROJECT_ROOT / "scripts" / "merge_translation_rescan_poc.py"
SPEC = importlib.util.spec_from_file_location("translation_rescan_poc", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class TranslationRescanPocTests(unittest.TestCase):
    def report(self, decision: str) -> dict[str, object]:
        return {
            "decision": decision,
            "risk_score": 20,
            "categories": ["test_category"],
            "requires_human_approval": decision != "allow",
        }

    def test_merge_keeps_the_more_restrictive_raw_block(self) -> None:
        result = MODULE.merge_reports(self.report("block"), self.report("allow"))

        self.assertEqual(result["decision"], "block")
        self.assertTrue(result["requires_human_approval"])

    def test_merge_escalates_to_review_from_translation(self) -> None:
        result = MODULE.merge_reports(self.report("allow"), self.report("review"))

        self.assertEqual(result["decision"], "review")
        self.assertTrue(result["requires_human_approval"])

    def test_missing_scan_report_fails_closed(self) -> None:
        result = MODULE.merge_reports(self.report("allow"), None)

        self.assertEqual(result["decision"], "error")
        self.assertTrue(result["requires_human_approval"])

