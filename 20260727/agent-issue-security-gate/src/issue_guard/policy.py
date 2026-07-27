"""Validated loading of deterministic intake-security policies."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Pattern

from .models import Decision


class PolicyValidationError(ValueError):
    """Raised when a policy cannot be safely loaded."""


@dataclass(frozen=True)
class PolicyRule:
    id: str
    category: str
    category_label_zh: str
    action: Decision
    score: int
    summary: str
    requested_capabilities: tuple[str, ...]
    patterns: tuple[Pattern[str], ...]


@dataclass(frozen=True)
class Policy:
    name: str
    review_threshold: int
    block_threshold: int
    rules: tuple[PolicyRule, ...]


def _require_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value:
        raise PolicyValidationError(f"{field} must be a non-empty string")
    return value


def _require_score(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 100:
        raise PolicyValidationError(f"{field} must be an integer from 0 to 100")
    return value


def _compile_rule(raw_rule: Any, index: int) -> PolicyRule:
    if not isinstance(raw_rule, dict):
        raise PolicyValidationError(f"rules[{index}] must be an object")

    action = _require_string(raw_rule.get("action"), f"rules[{index}].action")
    if action not in {"allow", "review", "block"}:
        raise PolicyValidationError(f"rules[{index}].action must be allow, review, or block")

    raw_capabilities = raw_rule.get("requested_capabilities")
    if not isinstance(raw_capabilities, list) or not all(
        isinstance(capability, str) and capability for capability in raw_capabilities
    ):
        raise PolicyValidationError(f"rules[{index}].requested_capabilities must be a list of strings")

    raw_patterns = raw_rule.get("patterns")
    if not isinstance(raw_patterns, list) or not raw_patterns:
        raise PolicyValidationError(f"rules[{index}].patterns must be a non-empty list")

    patterns: list[Pattern[str]] = []
    for pattern_index, pattern in enumerate(raw_patterns):
        if not isinstance(pattern, str) or not pattern:
            raise PolicyValidationError(f"rules[{index}].patterns[{pattern_index}] must be a string")
        try:
            patterns.append(re.compile(pattern))
        except re.error as error:
            raise PolicyValidationError(
                f"rules[{index}].patterns[{pattern_index}] is invalid: {error}"
            ) from error

    return PolicyRule(
        id=_require_string(raw_rule.get("id"), f"rules[{index}].id"),
        category=_require_string(raw_rule.get("category"), f"rules[{index}].category"),
        category_label_zh=_require_string(
            raw_rule.get("category_label_zh"), f"rules[{index}].category_label_zh"
        ),
        action=action,
        score=_require_score(raw_rule.get("score"), f"rules[{index}].score"),
        summary=_require_string(raw_rule.get("summary"), f"rules[{index}].summary"),
        requested_capabilities=tuple(raw_capabilities),
        patterns=tuple(patterns),
    )


def load_policy(path: Path) -> Policy:
    """Load a JSON policy and reject malformed or unsafe rule definitions."""

    try:
        raw_policy = json.loads(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise PolicyValidationError(f"unable to read policy: {path}") from error
    except json.JSONDecodeError as error:
        raise PolicyValidationError(f"invalid JSON in {path}: {error.msg}") from error

    if not isinstance(raw_policy, dict):
        raise PolicyValidationError("policy document must be a JSON object")
    raw_thresholds = raw_policy.get("score_thresholds")
    if not isinstance(raw_thresholds, dict):
        raise PolicyValidationError("score_thresholds must be an object")

    review_threshold = _require_score(raw_thresholds.get("review"), "score_thresholds.review")
    block_threshold = _require_score(raw_thresholds.get("block"), "score_thresholds.block")
    if review_threshold > block_threshold:
        raise PolicyValidationError("review threshold cannot exceed block threshold")

    raw_rules = raw_policy.get("rules")
    if not isinstance(raw_rules, list) or not raw_rules:
        raise PolicyValidationError("rules must be a non-empty list")
    rules = tuple(_compile_rule(raw_rule, index) for index, raw_rule in enumerate(raw_rules))

    rule_ids = [rule.id for rule in rules]
    if len(rule_ids) != len(set(rule_ids)):
        raise PolicyValidationError("rule IDs must be unique")

    return Policy(
        name=_require_string(raw_policy.get("name"), "name"),
        review_threshold=review_threshold,
        block_threshold=block_threshold,
        rules=rules,
    )
