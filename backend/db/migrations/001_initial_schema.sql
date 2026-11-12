-- 001_initial_schema.sql: Initial Database Schema for AI Language Journal

PRAGMA foreign_keys = ON;

-- 1. Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    target_language TEXT NOT NULL,
    explanation_language TEXT NOT NULL DEFAULT 'en',
    content TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    active_analysis_id TEXT,
    active_review_revision INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_user_updated ON journal_entries(user_id, updated_at DESC);

-- 2. Analyses (Immutable snapshots)
CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    entry_revision INTEGER NOT NULL,
    source_text TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
    offset_encoding TEXT NOT NULL DEFAULT 'utf-16',
    taxonomy_version TEXT NOT NULL,
    model_version TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    error_code TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_analyses_entry_rev ON analyses(entry_id, entry_revision);

-- 3. Suggestions (Immutable suggestions tied to an analysis)
CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    rule_code TEXT NOT NULL,
    kind TEXT NOT NULL,
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    original_text TEXT NOT NULL,
    replacement_text TEXT NOT NULL,
    explanation_title TEXT NOT NULL,
    explanation_message TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suggestions_analysis ON suggestions(analysis_id);

-- 4. Suggestion Actions (Terminal user decision per suggestion: accepted or dismissed)
CREATE TABLE IF NOT EXISTS suggestion_actions (
    id TEXT PRIMARY KEY,
    suggestion_id TEXT NOT NULL UNIQUE REFERENCES suggestions(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'accepted', 'dismissed'
    resulting_entry_revision INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_actions_suggestion ON suggestion_actions(suggestion_id);

-- 5. Idempotent Requests (For safe replay of POST decisions)
CREATE TABLE IF NOT EXISTS idempotent_requests (
    request_id TEXT PRIMARY KEY,
    entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    response_payload TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotent_entry ON idempotent_requests(entry_id);
