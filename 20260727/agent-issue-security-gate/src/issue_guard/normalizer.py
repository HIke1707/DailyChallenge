"""Load and normalize untrusted task-intake JSON without executing its content."""

from __future__ import annotations

import html
import json
import unicodedata
from base64 import b64decode
from binascii import Error as BinasciiError
from pathlib import Path
from typing import Any
import re

from .models import NormalizedInput, TextSegment


class InputValidationError(ValueError):
    """Raised when an intake document does not follow the supported JSON schema."""


_INVISIBLE_CHARACTERS = {
    "\u00ad",  # soft hyphen
    "\u034f",  # combining grapheme joiner
    "\u061c",  # Arabic letter mark
    "\u200b",  # zero-width space
    "\u200c",  # zero-width non-joiner
    "\u200d",  # zero-width joiner
    "\u200e",  # left-to-right mark
    "\u200f",  # right-to-left mark
    "\u2060",  # word joiner
    "\ufeff",  # zero-width no-break space
}

_MAX_INPUT_CHARACTERS = 100_000
_MAX_BASE64_CANDIDATES_PER_SEGMENT = 5
_BASE64_MIN_LENGTH = 24
_BASE64_MAX_LENGTH = 8192
_BASE64_CANDIDATE = re.compile(r"(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{20,}(?:={1,2})?(?![A-Za-z0-9+/=])")


def normalize_text(value: str) -> str:
    """Canonicalize text so visually hidden or HTML-encoded instructions are scanned."""

    decoded = html.unescape(value)
    normalized = unicodedata.normalize("NFKC", decoded)
    without_invisible = "".join(
        character for character in normalized if character not in _INVISIBLE_CHARACTERS
    )
    return without_invisible.replace("\r\n", "\n").replace("\r", "\n")


def _require_string(value: Any, field: str) -> str:
    if not isinstance(value, str):
        raise InputValidationError(f"{field} must be a string")
    return value


def _decode_base64_candidates(segment: TextSegment) -> list[TextSegment]:
    """Return at most one decoded layer of printable Base64 text for rescanning."""

    decoded_segments: list[TextSegment] = []
    for candidate_match in _BASE64_CANDIDATE.finditer(segment.text):
        if len(decoded_segments) >= _MAX_BASE64_CANDIDATES_PER_SEGMENT:
            break
        candidate = candidate_match.group(0)
        if not _BASE64_MIN_LENGTH <= len(candidate) <= _BASE64_MAX_LENGTH or len(candidate) % 4:
            continue
        try:
            decoded = b64decode(candidate, validate=True).decode("utf-8")
        except (BinasciiError, UnicodeDecodeError, ValueError):
            continue
        if not decoded:
            continue
        printable_ratio = sum(character.isprintable() or character in "\n\r\t" for character in decoded) / len(decoded)
        if printable_ratio < 0.85:
            continue
        decoded_segments.append(
            TextSegment(
                source=segment.source,
                source_name=segment.source_name,
                text=normalize_text(decoded),
                transformation="base64_decode",
                decoded_content_redacted=True,
            )
        )
    return decoded_segments


def normalize_payload(payload: dict[str, Any]) -> NormalizedInput:
    """Validate an intake payload and return independent normalized text segments."""

    if not isinstance(payload, dict):
        raise InputValidationError("input document must be a JSON object")

    source_type = _require_string(payload.get("source_type", "issue"), "source_type")
    segments: list[TextSegment] = []

    for key, source in (("title", "issue_title"), ("body", "issue_body")):
        value = _require_string(payload.get(key, ""), key)
        if value:
            segments.append(TextSegment(source=source, text=normalize_text(value)))

    comments = payload.get("comments", [])
    if not isinstance(comments, list) or not all(isinstance(item, str) for item in comments):
        raise InputValidationError("comments must be a list of strings")
    for index, comment in enumerate(comments, start=1):
        segments.append(
            TextSegment(
                source="comment",
                source_name=f"comment[{index}]",
                text=normalize_text(comment),
            )
        )

    attachments = payload.get("attachments", [])
    if not isinstance(attachments, list):
        raise InputValidationError("attachments must be a list")
    for index, attachment in enumerate(attachments, start=1):
        if not isinstance(attachment, dict):
            raise InputValidationError(f"attachments[{index}] must be an object")
        name = _require_string(attachment.get("name", f"attachment[{index}]"), f"attachments[{index}].name")
        text = _require_string(attachment.get("text", ""), f"attachments[{index}].text")
        segments.append(
            TextSegment(source="attachment", source_name=name, text=normalize_text(text))
        )

    if sum(len(segment.text) for segment in segments) > _MAX_INPUT_CHARACTERS:
        raise InputValidationError(f"input exceeds {_MAX_INPUT_CHARACTERS} character limit")

    decoded_segments = [
        decoded_segment
        for segment in segments
        for decoded_segment in _decode_base64_candidates(segment)
    ]
    return NormalizedInput(source_type=source_type, segments=tuple([*segments, *decoded_segments]))


def load_and_normalize(path: Path) -> NormalizedInput:
    """Read a UTF-8 JSON fixture from disk and normalize it as untrusted text."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except OSError as error:
        raise InputValidationError(f"unable to read input: {path}") from error
    except json.JSONDecodeError as error:
        raise InputValidationError(f"invalid JSON in {path}: {error.msg}") from error
    return normalize_payload(payload)
