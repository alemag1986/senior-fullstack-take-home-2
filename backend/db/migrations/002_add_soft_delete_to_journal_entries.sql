-- 002_add_soft_delete_to_journal_entries.sql: Add soft delete support
ALTER TABLE journal_entries ADD COLUMN deleted_at TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_user_deleted ON journal_entries(user_id, deleted_at, updated_at DESC);
