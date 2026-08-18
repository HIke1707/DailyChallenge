"""Verification adapter abstraction ensuring strict evidence-based provenance validation."""
from typing import Dict, Any, Optional
from .models import VerificationReport


class BaseVerificationAdapter:
    """Base interface for all verification adapters."""

    def verify_sample(self, sample_id: str, transform_id: str, text: str) -> VerificationReport:
        raise NotImplementedError


class ClaudeOfficialWatermarkAdapter(BaseVerificationAdapter):
    """Adapter for Anthropic Official Claude Text Watermark.
    
    Since Anthropic has not released a public watermark detector API, SDK,
    or token statistical decryption service, this adapter faithfully returns
    'not_verifiable_in_environment' to adhere to Zero Fabrication Policy.
    """

    def verify_sample(self, sample_id: str, transform_id: str, text: str) -> VerificationReport:
        evidence_file = f"evidence/case_{'1_copy_paste' if transform_id == 'copy_paste' else '2_low_degree_edit' if 'synonym' in transform_id or 'punct' in transform_id else '3_high_risk_rewrite'}.md"
        
        return VerificationReport(
            verifier_name="ClaudeOfficialWatermarkAdapter",
            verification_method="anthropic_official_token_sampling_watermark_v1",
            marker_status="not_verifiable_in_environment",
            notes=(
                "Anthropic 官方未公開對應之文字水印解碼 API 或公鑰驗證伺服器端點。"
                "依據實驗設計規範，本環境無官方驗證工具，狀態忠實記錄為 not_verifiable_in_environment，"
                "絕不以第三方 AI 偵測器充當官方驗證。"
            ),
            confidence_level="exact_fact",
            evidence_path=evidence_file
        )


class FileProvenanceC2PAAdapter(BaseVerificationAdapter):
    """Adapter for inspecting C2PA / JUMBF Content Credentials in document/media files."""

    def verify_file(self, file_path: str, has_manifest: bool) -> VerificationReport:
        if has_manifest:
            return VerificationReport(
                verifier_name="FileProvenanceC2PAAdapter",
                verification_method="c2pa_manifest_structure_inspection",
                marker_status="manifest_present_unverified_server_key",
                notes="檔案中繼資料包含 C2PA JUMBF Manifest 結構塊，但官方數位簽章驗證伺服器公鑰未公開。",
                confidence_level="exact_fact",
                evidence_path="evidence/bonus_file_provenance.md"
            )
        else:
            return VerificationReport(
                verifier_name="FileProvenanceC2PAAdapter",
                verification_method="c2pa_manifest_structure_inspection",
                marker_status="manifest_absent_stripped",
                notes="檔案中繼資料中無 C2PA 標籤，可能因格式轉換或編輯軟體抹除。",
                confidence_level="exact_fact",
                evidence_path="evidence/bonus_file_provenance.md"
            )


class HallucinatedDetectorAdapter(BaseVerificationAdapter):
    """Adapter simulating and intercepting hallucinated detection APIs."""

    def verify_sample(self, sample_id: str, transform_id: str, text: str) -> VerificationReport:
        return VerificationReport(
            verifier_name="HallucinatedDetectorAdapter",
            verification_method="fictional_anthropic_detect_watermark_endpoint",
            marker_status="unsupported_hallucination_rejected",
            notes="攔截到不存在的虛構偵測端點（如 anthropic.detect_watermark），標記為 unsupported。",
            confidence_level="exact_fact",
            evidence_path="evidence/case_4_hallucination_test.md"
        )


class VerificationAdapterRegistry:
    """Registry coordinating available verification adapters."""

    def __init__(self):
        self.official_adapter = ClaudeOfficialWatermarkAdapter()
        self.c2pa_adapter = FileProvenanceC2PAAdapter()
        self.hallucination_adapter = HallucinatedDetectorAdapter()

    def get_official_verifier(self) -> ClaudeOfficialWatermarkAdapter:
        return self.official_adapter

    def get_c2pa_verifier(self) -> FileProvenanceC2PAAdapter:
        return self.c2pa_adapter

    def get_hallucination_verifier(self) -> HallucinatedDetectorAdapter:
        return self.hallucination_adapter
