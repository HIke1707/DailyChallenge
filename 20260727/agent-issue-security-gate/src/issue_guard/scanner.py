"""Deterministic, non-executing scanner for untrusted task-intake content."""

from __future__ import annotations

import re

from .models import Evidence, NormalizedInput, ScanResult, line_number
from .policy import Policy


_NEGATED_ACTION = re.compile(
    r"(?:\bdo not\b|\bdon't\b|\bnever\b|\bavoid\b|\bcannot\b|\bcan't\b|\bmust not\b|\bshould not\b|不要|禁止|勿|不可|無法|不允許)[^.。！？!\n]{0,60}$",
    re.IGNORECASE,
)
_WRITE_TASK = re.compile(r"\b(fix|implement|update|change|add|remove|refactor|correct)\b|修正|修復|實作|更新|修改|新增|移除|重構")
_DOCUMENTATION_ONLY = re.compile(r"\b(documentation|docs?|guide)\b|文件|說明")


def _is_negated(text: str, match_start: int) -> bool:
    return bool(_NEGATED_ACTION.search(text[max(0, match_start - 80) : match_start]))


def _task_capabilities(normalized_input: NormalizedInput) -> list[str]:
    text = "\n".join(segment.text for segment in normalized_input.segments if not segment.transformation)
    if not text.strip():
        return []
    capabilities = ["read_repository"]
    if _WRITE_TASK.search(text):
        capabilities.append("write_repository")
        if not _DOCUMENTATION_ONLY.fullmatch(text.strip()):
            capabilities.append("execute_tests")
    return capabilities


def scan(normalized_input: NormalizedInput, policy: Policy) -> ScanResult:
    """Apply each policy rule to each segment and return a deterministic decision."""

    evidence: list[Evidence] = []
    forbidden_capabilities: list[str] = []
    categories: list[str] = []
    risk_score = 0
    has_explicit_block = False

    for rule in policy.rules:
        rule_matched = False
        for segment in normalized_input.segments:
            match = None
            for pattern in rule.patterns:
                for candidate in pattern.finditer(segment.text):
                    if not _is_negated(segment.text, candidate.start()):
                        match = candidate
                        break
                if match is not None:
                    break
            if match is None:
                continue
            rule_matched = True
            evidence.append(
                Evidence(
                    source=segment.source,
                    source_name=segment.source_name,
                    line=line_number(segment.text, match.start()),
                    rule_id=rule.id,
                    category=rule.category,
                    category_label_zh=rule.category_label_zh,
                    summary=rule.summary,
                    transformation=segment.transformation,
                    decoded_content_redacted=segment.decoded_content_redacted,
                )
            )

        if not rule_matched:
            continue
        categories.append(rule.category)
        risk_score = min(100, risk_score + rule.score)
        forbidden_capabilities.extend(rule.requested_capabilities)
        has_explicit_block = has_explicit_block or rule.action == "block"

    task_capabilities = _task_capabilities(normalized_input)
    if not normalized_input.segments or not any(segment.text.strip() for segment in normalized_input.segments):
        decision = "review"
        categories.append("empty_or_unusable_input")
        risk_score = max(risk_score, policy.review_threshold)
    elif has_explicit_block or risk_score >= policy.block_threshold:
        decision = "block"
    elif risk_score >= policy.review_threshold:
        decision = "review"
    else:
        decision = "allow"

    requested_capabilities = list(dict.fromkeys([*task_capabilities, *forbidden_capabilities]))
    allowed_capabilities = task_capabilities if decision == "allow" else []
    return ScanResult(
        decision=decision,
        risk_score=risk_score,
        categories=tuple(dict.fromkeys(categories)),
        evidence=tuple(evidence),
        requested_capabilities=tuple(requested_capabilities),
        forbidden_capabilities=tuple(dict.fromkeys(forbidden_capabilities)),
        allowed_capabilities=tuple(allowed_capabilities),
        requires_human_approval=decision != "allow",
    )
