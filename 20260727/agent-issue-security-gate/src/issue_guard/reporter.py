"""JSON and Markdown rendering for deterministic scan results."""

from __future__ import annotations

import json
from pathlib import Path

from .models import NormalizedInput, ScanResult


_LIMITATIONS = [
    "Deterministic rules can miss novel phrasing and cannot determine author intent.",
    "Only supplied text is scanned; binary files and linked external content are not fetched or executed.",
]


def _safe_task_summary(result: ScanResult, normalized_input: NormalizedInput) -> str:
    del normalized_input
    if result.decision == "allow":
        capabilities = ", ".join(result.allowed_capabilities) or "read_repository"
        return f"此任務僅可使用已核准的安全能力：{capabilities}。"
    categories = ", ".join(result.categories)
    return (
        "不可信任輸入中的 URL、Shell 指令、秘密與編碼內容均未被轉述。"
        f"偵測到的風險類別：{categories}；不得執行相關操作。"
    )


def report_data(result: ScanResult, normalized_input: NormalizedInput) -> dict[str, object]:
    """Return the documented machine-readable result shape."""

    return {
        "decision": result.decision,
        "risk_score": result.risk_score,
        "categories": list(result.categories),
        "evidence": [
            {
                "source": item.source,
                "source_name": item.source_name,
                "line": item.line,
                "rule_id": item.rule_id,
                "category": item.category,
                "category_label_zh": item.category_label_zh,
                "summary": item.summary,
                "transformation": item.transformation,
                "decoded_content_redacted": item.decoded_content_redacted,
            }
            for item in result.evidence
        ],
        "requested_capabilities": list(result.requested_capabilities),
        "forbidden_capabilities": list(result.forbidden_capabilities),
        "allowed_capabilities": list(result.allowed_capabilities),
        "requires_human_approval": result.requires_human_approval,
        "safe_task_summary": _safe_task_summary(result, normalized_input),
        "limitations": _LIMITATIONS,
    }


def markdown_report(data: dict[str, object]) -> str:
    """Render a concise human-review report without reproducing unsafe input text."""

    categories = data["categories"] or ["None"]
    capabilities = data["requested_capabilities"] or ["None"]
    forbidden_capabilities = data["forbidden_capabilities"] or ["None"]
    allowed_capabilities = data["allowed_capabilities"] or ["None"]
    evidence = data["evidence"]
    limitations = data["limitations"]

    lines = [
        "# Agent Issue Intake Security Gate Report",
        "",
        f"- Decision: **{data['decision']}**",
        f"- Risk score: **{data['risk_score']} / 100**",
        f"- Human approval required: **{'yes' if data['requires_human_approval'] else 'no'}**",
        "",
        "## Safe task summary",
        "",
        str(data["safe_task_summary"]),
        "",
        "## Categories",
        "",
        *[f"- `{category}`" for category in categories],
        "",
        "## Requested capabilities",
        "",
        *[f"- `{capability}`" for capability in capabilities],
        "",
        "## Forbidden capabilities",
        "",
        *[f"- `{capability}`" for capability in forbidden_capabilities],
        "",
        "## Allowed capabilities",
        "",
        *[f"- `{capability}`" for capability in allowed_capabilities],
        "",
        "## Evidence",
        "",
    ]
    if evidence:
        lines.extend(
            [
                "| Rule | Category | Source | Line | Summary |",
                "| --- | --- | --- | ---: | --- |",
            ]
        )
        for item in evidence:
            source = str(item["source"])
            if item["source_name"]:
                source = f"{source} ({item['source_name']})"
            lines.append(
                "| {rule_id} | {category} | {source} | {line} | {summary} |".format(
                    rule_id=item["rule_id"],
                    category=item["category_label_zh"],
                    source=source,
                    line=item["line"],
                    summary=item["summary"],
                )
            )
    else:
        lines.append("No deterministic rule matches were found.")

    lines.extend(["", "## Limitations", "", *[f"- {item}" for item in limitations], ""])
    return "\n".join(lines)


def write_reports(
    output_directory: Path, result: ScanResult, normalized_input: NormalizedInput, name: str = "sample-result"
) -> tuple[Path, Path]:
    """Write matching JSON and Markdown report files, returning their paths."""

    output_directory.mkdir(parents=True, exist_ok=True)
    data = report_data(result, normalized_input)
    json_path = output_directory / f"{name}.json"
    markdown_path = output_directory / f"{name}.md"
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    markdown_path.write_text(markdown_report(data), encoding="utf-8")
    return json_path, markdown_path
