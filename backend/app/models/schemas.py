from typing import List, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from backend.app.models.enums import (
    ActionType,
    AnalysisStatus,
    FeedbackCategory,
    OffsetEncoding,
    SuggestionKind,
)


class BaseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


# --- Suggestions ---
class SuggestionEdit(BaseSchema):
    start: int
    end: int
    original: str
    replacement: str


class SuggestionExplanation(BaseSchema):
    title: str
    message: str


class SuggestionResponse(BaseSchema):
    id: str
    analysisId: str = Field(
        ..., validation_alias=AliasChoices("analysisId", "analysis_id")
    )
    category: FeedbackCategory
    ruleCode: str = Field(
        ..., validation_alias=AliasChoices("ruleCode", "rule_code")
    )
    kind: SuggestionKind
    edit: SuggestionEdit
    explanation: SuggestionExplanation


class SuggestionCreateInput(BaseSchema):
    id: Optional[str] = None
    category: FeedbackCategory
    ruleCode: str = Field(
        ..., validation_alias=AliasChoices("ruleCode", "rule_code")
    )
    kind: SuggestionKind
    startOffset: int = Field(
        ..., validation_alias=AliasChoices("startOffset", "start_offset")
    )
    endOffset: int = Field(
        ..., validation_alias=AliasChoices("endOffset", "end_offset")
    )
    originalText: str = Field(
        ..., validation_alias=AliasChoices("originalText", "original_text")
    )
    replacementText: str = Field(
        ..., validation_alias=AliasChoices("replacementText", "replacement_text")
    )
    explanationTitle: str = Field(
        ..., validation_alias=AliasChoices("explanationTitle", "explanation_title")
    )
    explanationMessage: str = Field(
        ..., validation_alias=AliasChoices("explanationMessage", "explanation_message")
    )


# --- Journal Entries ---
class JournalEntryCreateOrUpdate(BaseSchema):
    id: Optional[str] = None
    title: Optional[str] = "Journal Entry"
    targetLanguage: str = Field(
        ..., validation_alias=AliasChoices("targetLanguage", "target_language")
    )
    explanationLanguage: Optional[str] = Field(
        "en",
        validation_alias=AliasChoices("explanationLanguage", "explanation_language"),
    )
    content: str
    revision: Optional[int] = 1
    expectedRevision: Optional[int] = Field(
        None, validation_alias=AliasChoices("expectedRevision", "expected_revision")
    )


class JournalEntryResponse(BaseSchema):
    id: str
    userId: str = Field(
        ..., validation_alias=AliasChoices("userId", "user_id")
    )
    title: str
    targetLanguage: str = Field(
        ..., validation_alias=AliasChoices("targetLanguage", "target_language")
    )
    explanationLanguage: str = Field(
        "en",
        validation_alias=AliasChoices("explanationLanguage", "explanation_language"),
    )
    content: str
    revision: int
    createdAt: str = Field(
        ..., validation_alias=AliasChoices("createdAt", "created_at")
    )
    updatedAt: str = Field(
        ..., validation_alias=AliasChoices("updatedAt", "updated_at")
    )
    deletedAt: Optional[str] = Field(
        None, validation_alias=AliasChoices("deletedAt", "deleted_at")
    )


class EntryDeleteResponse(BaseSchema):
    success: bool = True
    id: str
    deletedAt: str = Field(
        ..., validation_alias=AliasChoices("deletedAt", "deleted_at")
    )


# --- Analysis ---
class AnalysisCreateInput(BaseSchema):
    id: Optional[str] = None
    entryId: str = Field(
        ..., validation_alias=AliasChoices("entryId", "entry_id")
    )
    entryRevision: int = Field(
        ..., validation_alias=AliasChoices("entryRevision", "entry_revision")
    )
    sourceText: str = Field(
        ..., validation_alias=AliasChoices("sourceText", "source_text")
    )
    suggestions: List[SuggestionCreateInput] = []
    taxonomyVersion: Optional[str] = Field(
        "1.0.0",
        validation_alias=AliasChoices("taxonomyVersion", "taxonomy_version"),
    )
    modelVersion: Optional[str] = Field(
        "manual-v1",
        validation_alias=AliasChoices("modelVersion", "model_version"),
    )
    promptVersion: Optional[str] = Field(
        "v1", validation_alias=AliasChoices("promptVersion", "prompt_version")
    )


class AnalysisResponse(BaseSchema):
    id: str
    entryId: str = Field(
        ..., validation_alias=AliasChoices("entryId", "entry_id")
    )
    entryRevision: int = Field(
        ..., validation_alias=AliasChoices("entryRevision", "entry_revision")
    )
    sourceText: str = Field(
        ..., validation_alias=AliasChoices("sourceText", "source_text")
    )
    status: AnalysisStatus
    offsetEncoding: OffsetEncoding = Field(
        OffsetEncoding.UTF_16,
        validation_alias=AliasChoices("offsetEncoding", "offset_encoding"),
    )
    taxonomyVersion: str = Field(
        "1.0.0",
        validation_alias=AliasChoices("taxonomyVersion", "taxonomy_version"),
    )
    modelVersion: str = Field(
        "manual-v1",
        validation_alias=AliasChoices("modelVersion", "model_version"),
    )
    promptVersion: str = Field(
        "v1", validation_alias=AliasChoices("promptVersion", "prompt_version")
    )
    errorCode: Optional[str] = Field(
        None, validation_alias=AliasChoices("errorCode", "error_code")
    )
    createdAt: str = Field(
        ..., validation_alias=AliasChoices("createdAt", "created_at")
    )
    completedAt: Optional[str] = Field(
        None, validation_alias=AliasChoices("completedAt", "completed_at")
    )
    suggestions: List[SuggestionResponse] = []


# --- Decisions ---
class DecisionItem(BaseSchema):
    suggestionId: str = Field(
        ..., validation_alias=AliasChoices("suggestionId", "suggestion_id")
    )
    action: ActionType


class DecisionsRequest(BaseSchema):
    expectedRevision: int = Field(
        ..., validation_alias=AliasChoices("expectedRevision", "expected_revision")
    )
    requestId: str = Field(
        ..., validation_alias=AliasChoices("requestId", "request_id")
    )
    decisions: List[DecisionItem]


class ActionRecord(BaseSchema):
    id: str
    suggestionId: str = Field(
        ..., validation_alias=AliasChoices("suggestionId", "suggestion_id")
    )
    action: ActionType
    resultingEntryRevision: int = Field(
        ...,
        validation_alias=AliasChoices(
            "resultingEntryRevision", "resulting_entry_revision"
        ),
    )
    createdAt: str = Field(
        ..., validation_alias=AliasChoices("createdAt", "created_at")
    )


class DecisionsResponse(BaseSchema):
    entry: JournalEntryResponse
    actions: List[ActionRecord]


# --- Analyze Request ---
class EntryAnalyzeRequest(BaseSchema):
    entry_id: Optional[str] = Field(
        None, validation_alias=AliasChoices("entry_id", "entryId")
    )
    content: str
    target_language: str = Field(
        ..., validation_alias=AliasChoices("target_language", "targetLanguage")
    )
    revision: Optional[int] = 1
    title: Optional[str] = "Journal Entry"
    explanation_language: Optional[str] = Field(
        "en", validation_alias=AliasChoices("explanation_language", "explanationLanguage")
    )


# --- Insights (Stage 2) ---
class CategoryStat(BaseSchema):
    category: FeedbackCategory
    count: int
    percentage: float


class MistakePattern(BaseSchema):
    ruleCode: str = Field(..., validation_alias=AliasChoices("ruleCode", "rule_code"))
    category: FeedbackCategory
    count: int
    sampleExplanation: str = Field(
        ..., validation_alias=AliasChoices("sampleExplanation", "sample_explanation")
    )


class TrendPoint(BaseSchema):
    date: str
    entriesCount: int = Field(
        ..., validation_alias=AliasChoices("entriesCount", "entries_count")
    )
    mistakesCount: int = Field(
        ..., validation_alias=AliasChoices("mistakesCount", "mistakes_count")
    )


class InsightsResponse(BaseSchema):
    totalEntries: int = Field(
        ..., validation_alias=AliasChoices("totalEntries", "total_entries")
    )
    totalWords: int = Field(
        ..., validation_alias=AliasChoices("totalWords", "total_words")
    )
    totalSuggestions: int = Field(
        ..., validation_alias=AliasChoices("totalSuggestions", "total_suggestions")
    )
    acceptedDecisions: int = Field(
        ..., validation_alias=AliasChoices("acceptedDecisions", "accepted_decisions")
    )
    dismissedDecisions: int = Field(
        ..., validation_alias=AliasChoices("dismissedDecisions", "dismissed_decisions")
    )
    pendingDecisions: int = Field(
        ..., validation_alias=AliasChoices("pendingDecisions", "pending_decisions")
    )
    categoryBreakdown: List[CategoryStat] = Field(
        ..., validation_alias=AliasChoices("categoryBreakdown", "category_breakdown")
    )
    topMistakes: List[MistakePattern] = Field(
        ..., validation_alias=AliasChoices("topMistakes", "top_mistakes")
    )
    recentTrends: List[TrendPoint] = Field(
        ..., validation_alias=AliasChoices("recentTrends", "recent_trends")
    )
