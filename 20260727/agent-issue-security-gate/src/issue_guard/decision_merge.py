"""Monotonic merging for deterministic and optional semantic security decisions."""

from __future__ import annotations

from .models import Decision


_RANK: dict[Decision, int] = {"allow": 0, "review": 1, "block": 2}


def merge_decisions(deterministic: Decision, semantic: Decision | None) -> Decision:
    """Return the stricter decision; semantic review can escalate but never downgrade."""

    if deterministic not in _RANK:
        raise ValueError(f"unsupported deterministic decision: {deterministic}")
    if semantic is not None and semantic not in _RANK:
        raise ValueError(f"unsupported semantic decision: {semantic}")
    if semantic is None or _RANK[semantic] <= _RANK[deterministic]:
        return deterministic
    return semantic
