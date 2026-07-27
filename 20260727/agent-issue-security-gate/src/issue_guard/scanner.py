"""Deterministic, non-executing scanner for untrusted task-intake content."""

from __future__ import annotations

from .models import Evidence, NormalizedInput, ScanResult, line_number
from .policy import Policy


def scan(normalized_input: NormalizedInput, policy: Policy) -> ScanResult:
    """Apply each policy rule to each segment and return a deterministic decision."""

    evidence: list[Evidence] = []
    requested_capabilities: list[str] = []
    categories: list[str] = []
    risk_score = 0
    has_explicit_block = False

    for rule in policy.rules:
        rule_matched = False
        for segment in normalized_input.segments:
            match = None
            for pattern in rule.patterns:
                match = pattern.search(segment.text)
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
                )
            )

        if not rule_matched:
            continue
        categories.append(rule.category)
        risk_score = min(100, risk_score + rule.score)
        requested_capabilities.extend(rule.requested_capabilities)
        has_explicit_block = has_explicit_block or rule.action == "block"

    if has_explicit_block or risk_score >= policy.block_threshold:
        decision = "block"
    elif risk_score >= policy.review_threshold:
        decision = "review"
    else:
        decision = "allow"

    return ScanResult(
        decision=decision,
        risk_score=risk_score,
        categories=tuple(dict.fromkeys(categories)),
        evidence=tuple(evidence),
        requested_capabilities=tuple(dict.fromkeys(requested_capabilities)),
        requires_human_approval=decision != "allow",
    )
