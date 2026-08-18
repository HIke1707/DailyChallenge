"""Unit and integration test suite for Provenance Robustness Experiment."""
import json
import os
import sys
import unittest
from pathlib import Path

# Add src to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "src"))

from core.models import BaselineSample, TransformSpec, TransformationResult
from core.diff_analyzer import DiffAnalyzer
from core.transformer import TextTransformer
from core.verification_adapter import (
    ClaudeOfficialWatermarkAdapter,
    FileProvenanceC2PAAdapter,
    HallucinatedDetectorAdapter,
    VerificationAdapterRegistry
)
from runner import load_baselines, load_transform_specs, run_pipeline


class TestDiffAnalyzer(unittest.TestCase):
    """Test pure-Python metrics calculation."""

    def test_identical_text(self):
        text = "在分散式系統領域中，共識演算法是確保多個獨立節點達成狀態一致的核心基礎。"
        analysis = DiffAnalyzer.analyze(text, text)
        self.assertEqual(analysis["levenshtein_distance"], 0)
        self.assertEqual(analysis["normalized_edit_similarity"], 1.0)
        self.assertEqual(analysis["sequence_matcher_similarity"], 1.0)
        self.assertEqual(analysis["jaccard_token_similarity"], 1.0)
        self.assertEqual(analysis["baseline_sha256"], analysis["transformed_sha256"])

    def test_synonym_perturbation(self):
        text_a = "確保分散式資料庫的狀態一致性"
        text_b = "保障分散式資料庫的數據一致性"
        analysis = DiffAnalyzer.analyze(text_a, text_b)
        self.assertGreater(analysis["levenshtein_distance"], 0)
        self.assertLess(analysis["normalized_edit_similarity"], 1.0)
        self.assertGreater(analysis["normalized_edit_similarity"], 0.7)


class TestVerificationAdapterInvariants(unittest.TestCase):
    """Test strict evidence invariants and zero fabrication policy."""

    def test_official_watermark_inaccessible_status(self):
        adapter = ClaudeOfficialWatermarkAdapter()
        report = adapter.verify_sample("sample_01", "copy_paste", "Sample text")
        self.assertEqual(report.marker_status, "not_verifiable_in_environment")
        self.assertIn("官方未公開", report.notes)

    def test_hallucination_probe_status(self):
        adapter = HallucinatedDetectorAdapter()
        report = adapter.verify_sample("sample_01", "hallucination_check", "test query")
        self.assertEqual(report.marker_status, "unsupported_hallucination_rejected")


class TestPipelineIntegration(unittest.TestCase):
    """Test full pipeline end-to-end execution and reproducibility."""

    def test_baselines_loading(self):
        baselines = load_baselines(BASE_DIR)
        self.assertGreaterEqual(len(baselines), 3)
        for b in baselines:
            self.assertGreater(len(b.content), 50)
            self.assertTrue(len(b.sha256) == 64)

    def test_transforms_loading(self):
        specs = load_transform_specs(BASE_DIR)
        self.assertGreaterEqual(len(specs), 6)
        core_ids = [s.id for s in specs if s.is_core]
        self.assertIn("copy_paste", core_ids)
        self.assertIn("punct_whitespace", core_ids)
        self.assertIn("synonym_10pct", core_ids)
        self.assertIn("paragraph_reorder", core_ids)
        self.assertIn("rewrite_30pct", core_ids)
        self.assertIn("roundtrip_translation", core_ids)

    def test_pipeline_execution(self):
        results = run_pipeline(BASE_DIR, clean=False)
        self.assertGreaterEqual(len(results), 18)
        
        csv_file = BASE_DIR / "results.csv"
        json_file = BASE_DIR / "results.json"
        matrix_file = BASE_DIR / "robustness-matrix.md"
        
        self.assertTrue(csv_file.exists())
        self.assertTrue(json_file.exists())
        self.assertTrue(matrix_file.exists())


if __name__ == "__main__":
    unittest.main()
