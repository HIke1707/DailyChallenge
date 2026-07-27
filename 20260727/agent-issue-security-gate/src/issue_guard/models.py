"""Typed data structures shared by the security-gate pipeline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


SourceType = Literal["issue_title", "issue_body", "comment", "attachment"]
Decision = Literal["allow", "review", "block"]


@dataclass(frozen=True)
class TextSegment:
    """A normalized untrusted text fragment with enough context for evidence."""

    source: SourceType
    text: str
    source_name: str | None = None


@dataclass(frozen=True)
class NormalizedInput:
    """Untrusted intake content represented as independent text segments."""

    source_type: str
    segments: tuple[TextSegment, ...]


@dataclass(frozen=True)
class Evidence:
    """One deterministic rule match, suitable for JSON and Markdown reports."""

    source: SourceType
    line: int
    rule_id: str
    category: str
    category_label_zh: str
    summary: str
    source_name: str | None = None


@dataclass(frozen=True)
class ScanResult:
    """The deterministic screening result before report rendering."""

    decision: Decision
    risk_score: int
    categories: tuple[str, ...]
    evidence: tuple[Evidence, ...]
    requested_capabilities: tuple[str, ...]
    requires_human_approval: bool


def line_number(text: str, offset: int) -> int:
    """Return the 1-based line number containing *offset* in *text*."""

    return text.count("\n", 0, offset) + 1
