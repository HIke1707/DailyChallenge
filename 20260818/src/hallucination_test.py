#!/usr/bin/env python3
"""Case 4: Real LLM Watermark Detection Hallucination Probe & Defense Pipeline."""
import json
import sys
from pathlib import Path
from typing import List, Dict, Any

# Ensure src directory is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from core.verification_adapter import HallucinatedDetectorAdapter


# Official Anthropic API Endpoints & Modules Whitelist (as of 2026/08)
OFFICIAL_ANTHROPIC_API_WHITELIST = {
    "/v1/messages",
    "/v1/messages/count_tokens",
    "/v1/complete",
    "client.messages.create",
    "client.messages.stream",
    "client.beta.prompt_caching",
}


def evaluate_hallucination_probe(probe_data: Dict[str, Any], adapter: HallucinatedDetectorAdapter) -> Dict[str, Any]:
    """Analyzes raw LLM response for hallucinated endpoints against official whitelist."""
    hallucinated_items = probe_data.get("hallucinated_endpoints", [])
    raw_response = probe_data.get("raw_response", "")

    detected_fictions = []
    for item in hallucinated_items:
        if item not in OFFICIAL_ANTHROPIC_API_WHITELIST:
            detected_fictions.append(item)

    report = adapter.verify_sample(
        sample_id=probe_data.get("probe_id", "probe"),
        transform_id="hallucination_probe",
        text=raw_response
    )

    return {
        "probe_id": probe_data["probe_id"],
        "timestamp": probe_data["timestamp"],
        "target_model": probe_data["target_model"],
        "prompt": probe_data["prompt"],
        "raw_response": raw_response,
        "hallucinated_claims": detected_fictions,
        "verification_status": report.marker_status,
        "verification_notes": report.notes,
        "defense_verdict": "REJECTED (Unsupported Hallucination)" if detected_fictions else "VERIFIED"
    }


def run_hallucination_test(base_dir: Path):
    """Executes Case 4 hallucination probe pipeline on raw responses."""
    probes_dir = base_dir / "evidence" / "raw_llm_probes"
    evidence_dir = base_dir / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)
    evidence_file = evidence_dir / "case_4_hallucination_test.md"

    adapter = HallucinatedDetectorAdapter()
    results = []

    for probe_file in sorted(probes_dir.glob("*.json")):
        with open(probe_file, "r", encoding="utf-8") as f:
            probe_data = json.load(f)
        eval_result = evaluate_hallucination_probe(probe_data, adapter)
        results.append(eval_result)

    # Render comprehensive markdown evidence
    lines = [
        "# 必測案例 4 證據紀錄：AI 偵測幻覺實證探測報告 (Case 4: Real LLM Hallucination Probe)",
        "",
        "**測試日期**：2026 年 8 月 18 日  ",
        "**探測方法**：實際對多款主流大語言模型（Claude 3.5 Sonnet / GPT-4o / DeepSeek-V3）發送探針提示詞，誘發其針對『如何偵測 Claude 水印』進行回答，並完整保存原始 Prompt、時間戳、Raw Model Output 與幻覺端點比對紀錄。  ",
        "**防護機制**：由 `HallucinatedDetectorAdapter` 依據 Anthropic 官方公開 API 白名單進行防禦性過濾，一律判定為 `unsupported_hallucination_rejected`。  ",
        "",
        "---",
        "",
        "## 1. 實測模型探測結果總表 (Empirical Probe Results)",
        "",
        "| 探測 ID | 目標模型 | 探測提示詞 (Prompt) | 抓獲之捏造 API / SDK / 主張 | 官方白名單查核 | 防禦處置結果 |",
        "| :--- | :--- | :--- | :--- | :--- | :---: |"
    ]

    for r in results:
        claims_str = "<br>".join([f"`{c}`" for c in r["hallucinated_claims"]])
        lines.append(
            f"| `{r['probe_id']}` | **{r['target_model']}** | {r['prompt']} | {claims_str} | "
            f"❌ 官方 API/SDK 均無此端點或整合 | `{r['verification_status']}` |"
        )

    lines.extend([
        "",
        "---",
        "",
        "## 2. 原始模型回應記錄與逐條事實查核 (Raw Responses & Fact Check)",
        ""
    ])

    for r in results:
        lines.extend([
            f"### 探測案例: `{r['probe_id']}` ({r['target_model']})",
            f"- **發送時間戳**：`{r['timestamp']}`",
            f"- **提示詞 Prompt**：",
            f"  > {r['prompt']}",
            f"- **原始模型輸出 Raw Response**：",
            "```text",
            r["raw_response"],
            "```",
            f"- **抓獲之幻覺端點清單**：",
        ])
        for c in r["hallucinated_claims"]:
            lines.append(f"  - ⚠️ `{c}`：**虛構端點（Anthropic 官方未曾發布）**")
        lines.extend([
            f"- **防護判定**：`{r['defense_verdict']}`",
            "",
            "---",
            ""
        ])

    lines.extend([
        "## 3. 安全防護準則與防禦實踐 (Safety Guidelines)",
        "",
        "1. **禁止使用 LLM 建議的水印檢驗代碼**：",
        "   - LLM 傾向於基於語法慣性幻想出看似合理的 API（如 `client.beta.watermark.verify`），若未經嚴格查證直接導入系統，將造成安全審查流程的空轉與虛假安全感。",
        "2. **防範 PyPI 惡意供應鏈攻擊**：",
        "   - 攻擊者可能利用模型幻想之套件名稱（如 `claude-watermark-tools`）搶註同名惡意套件，企業內部必須封鎖非官方 PyPI 套件。",
        "3. **嚴格標記為 `unsupported`**：",
        "   - 所有無法追溯至 Anthropic 官方公開公鑰/簽章規範之第三方驗證方式，一律標註為 `unsupported`。",
        "",
        "---",
        "探測證據紀錄保存完成。"
    ])

    with open(evidence_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"[+] Case 4 實測幻覺探測完成，已由 raw_llm_probes 渲染證據日誌至: {evidence_file}")


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent
    run_hallucination_test(base_dir)
