"""Fail-closed decision merger for the manual translation-and-rescan POC."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


EXIT_CODES = {"allow": 0, "review": 2, "block": 3, "error": 4}
DECISION_RANK = {"allow": 0, "review": 1, "block": 2}


def _scan_view(report: dict[str, Any]) -> dict[str, Any]:
    """Return only safe metadata needed to explain one deterministic scan."""

    return {
        "decision": report["decision"],
        "risk_score": report.get("risk_score", 0),
        "categories": report.get("categories", []),
        "requires_human_approval": report.get("requires_human_approval", False),
    }


def merge_reports(
    raw_report: dict[str, Any] | None, translated_report: dict[str, Any] | None
) -> dict[str, Any]:
    """Merge two scan reports without allowing translation to lower a decision."""

    invalid_sources: list[str] = []
    reports = {"raw": raw_report, "translated": translated_report}
    for source, report in reports.items():
        if not isinstance(report, dict) or report.get("decision") not in DECISION_RANK:
            invalid_sources.append(source)

    if invalid_sources:
        return {
            "decision": "error",
            "requires_human_approval": True,
            "decision_rule": "fail_closed_on_missing_or_invalid_scan_report",
            "invalid_or_missing_reports": invalid_sources,
            "safe_task_summary": "Translation-and-rescan POC could not produce two valid scan reports. Do not start an Agent.",
        }

    assert raw_report is not None
    assert translated_report is not None
    final_decision = max(
        (raw_report["decision"], translated_report["decision"]),
        key=DECISION_RANK.__getitem__,
    )
    return {
        "decision": final_decision,
        "requires_human_approval": final_decision != "allow",
        "decision_rule": "most_restrictive_of_raw_and_english_translation",
        "raw_scan": _scan_view(raw_report),
        "translated_scan": _scan_view(translated_report),
        "safe_task_summary": "The original Issue and its English translation were scanned independently. No Agent is started by this POC.",
    }


def _load_report(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _markdown(data: dict[str, Any]) -> str:
    lines = [
        "# Copilot Translation and Rescan POC",
        "",
        f"- Final decision: **{data['decision']}**",
        f"- Human approval required: **{'yes' if data['requires_human_approval'] else 'no'}**",
        f"- Merge rule: `{data['decision_rule']}`",
        "",
        "## Safe summary",
        "",
        str(data["safe_task_summary"]),
        "",
    ]
    if data["decision"] == "error":
        lines.extend(["## Invalid or missing reports", "", *[f"- `{item}`" for item in data["invalid_or_missing_reports"]], ""])
    else:
        lines.extend(
            [
                "## Independent scans",
                "",
                "| Source | Decision | Risk score | Categories |",
                "| --- | --- | ---: | --- |",
            ]
        )
        for source_key, source_label in (("raw_scan", "Original Issue"), ("translated_scan", "English translation")):
            report = data[source_key]
            categories = ", ".join(report["categories"]) or "None"
            lines.append(f"| {source_label} | {report['decision']} | {report['risk_score']} | {categories} |")
        lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Merge raw and translated POC scan reports.")
    parser.add_argument("--raw-report", type=Path, required=True)
    parser.add_argument("--translated-report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)

    merged = merge_reports(_load_report(args.raw_report), _load_report(args.translated_report))
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "translation-rescan-result.json").write_text(
        json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (args.output / "translation-rescan-result.md").write_text(_markdown(merged), encoding="utf-8")
    print(f"decision={merged['decision']}")
    return EXIT_CODES[merged["decision"]]


if __name__ == "__main__":
    raise SystemExit(main())
