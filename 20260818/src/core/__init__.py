"""Core modules for transformation, metrics, and verification abstraction."""
from .models import BaselineSample, TransformSpec, TransformationResult, VerificationReport
from .diff_analyzer import DiffAnalyzer
from .transformer import TextTransformer
from .verification_adapter import VerificationAdapterRegistry, ClaudeOfficialWatermarkAdapter

__all__ = [
    "BaselineSample",
    "TransformSpec",
    "TransformationResult",
    "VerificationReport",
    "DiffAnalyzer",
    "TextTransformer",
    "VerificationAdapterRegistry",
    "ClaudeOfficialWatermarkAdapter",
]
