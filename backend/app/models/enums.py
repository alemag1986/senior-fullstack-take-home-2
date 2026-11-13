from enum import Enum


class FeedbackCategory(str, Enum):
    GRAMMAR_SYNTAX = "grammar_syntax"
    VOCABULARY_PHRASING = "vocabulary_phrasing"
    SPELLING_ACCENTS = "spelling_accents"


class SuggestionKind(str, Enum):
    CORRECTION = "correction"
    IMPROVEMENT = "improvement"


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ActionType(str, Enum):
    ACCEPTED = "accepted"
    DISMISSED = "dismissed"


class OffsetEncoding(str, Enum):
    UTF_16 = "utf-16"
