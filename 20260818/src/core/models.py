"""Data models for Provenance Robustness Experiment."""
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any, List


@dataclass
class BaselineSample:
    sample_id: str
    category: str
    title: str
    prompt: str
    model: str
    generation_interface: str
    timestamp: str
    text_path: str
    content: str
    char_count: int
    word_count: int
    sha256: str
    provenance_notes: str = ""


@dataclass
class TransformSpec:
    id: str
    name: str
    category: str
    target_strength: str
    rule_description: str
    expected_change: str
    is_core: bool = True


@dataclass
class VerificationReport:
    verification_method: str
    marker_status: str  # e.g., 'not_verifiable_in_environment', 'verified_present', 'verified_absent', 'unsupported'
    notes: str
    confidence_level: str  # 'exact_fact', 'theoretical_inference', 'unsupported'
    evidence_path: str
    verifier_name: str = "ClaudeOfficialWatermarkAdapter"


@dataclass
class TransformationResult:
    sample_id: str
    transform_id: str
    transform_name: str
    transform_strength: str
    category: str
    baseline_sha256: str
    transformed_sha256: str
    baseline_char_count: int
    transformed_char_count: int
    char_count_delta: int
    baseline_word_count: int
    transformed_word_count: int
    word_count_delta: int
    levenshtein_distance: int
    normalized_edit_similarity: float
    sequence_matcher_similarity: float
    jaccard_token_similarity: float
    verification_method: str
    marker_status: str
    verification_notes: str
    evidence_path: str
    output_file_path: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
