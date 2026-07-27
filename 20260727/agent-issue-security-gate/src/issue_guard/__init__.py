"""Security gate for untrusted issue, comment, and attachment text."""

from .normalizer import load_and_normalize

__all__ = ["load_and_normalize"]
