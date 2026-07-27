"""Command-line entry point for the agent issue intake security gate."""

from __future__ import annotations

import argparse
from pathlib import Path

from .normalizer import InputValidationError, load_and_normalize
from .policy import PolicyValidationError, load_policy
from .reporter import write_reports
from .scanner import scan


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Screen untrusted issue, comment, and attachment text before agent intake."
    )
    parser.add_argument("--input", required=True, type=Path, help="Path to an intake JSON document")
    parser.add_argument("--policy", required=True, type=Path, help="Path to a security policy JSON file")
    parser.add_argument("--output", required=True, type=Path, help="Directory for JSON and Markdown reports")
    parser.add_argument(
        "--report-name",
        default="sample-result",
        help="Base filename for reports, without an extension (default: sample-result)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        normalized_input = load_and_normalize(args.input)
        policy = load_policy(args.policy)
        result = scan(normalized_input, policy)
        json_path, markdown_path = write_reports(
            args.output, result, normalized_input, args.report_name
        )
    except (InputValidationError, PolicyValidationError) as error:
        parser.error(str(error))

    print(f"decision={result.decision} risk_score={result.risk_score}")
    print(f"json_report={json_path}")
    print(f"markdown_report={markdown_path}")
    return 2 if result.decision == "block" else 0


if __name__ == "__main__":
    raise SystemExit(main())
