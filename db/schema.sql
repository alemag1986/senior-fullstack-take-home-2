-- Schema for AI-Assisted Language Journaling

-- 1. Journal Entries
CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

-- 2. AI Feedback (Overall entry analysis)
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    corrected_text TEXT NOT NULL,
    overall_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES entries (id) ON DELETE CASCADE
);

-- 3. Granular Mistakes & Learning Items (Stage 2 support)
CREATE TABLE IF NOT EXISTS mistakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL,
    feedback_id INTEGER NOT NULL,
    category TEXT NOT NULL, -- e.g., 'grammar', 'vocabulary', 'spelling', 'syntax', 'style'
    original_fragment TEXT NOT NULL,
    replacement TEXT NOT NULL,
    explanation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES entries (id) ON DELETE CASCADE,
    FOREIGN KEY (feedback_id) REFERENCES feedback (id) ON DELETE CASCADE
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_entry_id ON feedback(entry_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_entry_id ON mistakes(entry_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_category ON mistakes(category);
