"""Diff and similarity analysis engine using Python standard library."""
import hashlib
import difflib
import re
from typing import Dict, Any, Set, Tuple


class DiffAnalyzer:
    """Calculates text modification metrics, character/word deltas, and cryptographic hashes."""

    @staticmethod
    def compute_sha256(text: str) -> str:
        """Compute SHA-256 hash of UTF-8 encoded text."""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    @staticmethod
    def tokenize_words(text: str):
        """Tokenize text into words/tokens for Chinese and English mixed text."""
        # Normalize whitespace
        clean_text = re.sub(r"\s+", " ", text.strip())
        # Tokenize by Latin words, numbers, and individual CJK characters
        tokens = []
        pattern = re.compile(r"[\u4e00-\u9fff]|[a-zA-Z0-9_\-]+|[^\s\w]")
        for match in pattern.finditer(clean_text):
            tok = match.group(0).strip()
            if tok:
                tokens.append(tok)
        return tokens

    @staticmethod
    def levenshtein_distance(s1: str, s2: str) -> int:
        """Calculates Levenshtein edit distance between two strings with O(min(N, M)) memory."""
        if s1 == s2:
            return 0
        if len(s1) == 0:
            return len(s2)
        if len(s2) == 0:
            return len(s1)

        # Optimize memory: allocate single previous row
        if len(s1) > len(s2):
            s1, s2 = s2, s1

        previous_row = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            current_row = [i + 1] + [0] * len(s2)
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (0 if c1 == c2 else 1)
                current_row[j + 1] = min(insertions, deletions, substitutions)
            previous_row = current_row

        return previous_row[-1]

    @classmethod
    def analyze(cls, original_text: str, modified_text: str) -> Dict[str, Any]:
        """Performs comprehensive diff, distance, and similarity analysis."""
        orig_sha = cls.compute_sha256(original_text)
        mod_sha = cls.compute_sha256(modified_text)

        orig_char_count = len(original_text)
        mod_char_count = len(modified_text)
        char_delta = mod_char_count - orig_char_count

        orig_tokens = cls.tokenize_words(original_text)
        mod_tokens = cls.tokenize_words(modified_text)

        orig_word_count = len(orig_tokens)
        mod_word_count = len(mod_tokens)
        word_delta = mod_word_count - orig_word_count

        # Levenshtein Distance
        lev_dist = cls.levenshtein_distance(original_text, modified_text)
        max_len = max(orig_char_count, mod_char_count)
        normalized_edit_sim = 1.0 if max_len == 0 else round(max(0.0, 1.0 - (lev_dist / max_len)), 4)

        # SequenceMatcher Ratio
        seq_matcher = difflib.SequenceMatcher(None, original_text, modified_text)
        seq_sim = round(seq_matcher.ratio(), 4)

        # Token Jaccard Similarity
        orig_set: Set[str] = set(orig_tokens)
        mod_set: Set[str] = set(mod_tokens)
        union_set = orig_set.union(mod_set)
        intersection_set = orig_set.intersection(mod_set)
        jaccard_sim = 1.0 if not union_set else round(len(intersection_set) / len(union_set), 4)

        return {
            "baseline_sha256": orig_sha,
            "transformed_sha256": mod_sha,
            "baseline_char_count": orig_char_count,
            "transformed_char_count": mod_char_count,
            "char_count_delta": char_delta,
            "baseline_word_count": orig_word_count,
            "transformed_word_count": mod_word_count,
            "word_count_delta": word_delta,
            "levenshtein_distance": lev_dist,
            "normalized_edit_similarity": normalized_edit_sim,
            "sequence_matcher_similarity": seq_sim,
            "jaccard_token_similarity": jaccard_sim,
        }
