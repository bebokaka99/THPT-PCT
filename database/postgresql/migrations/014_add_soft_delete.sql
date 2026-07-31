ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_posts_deleted_at
  ON posts (deleted_at);

CREATE INDEX IF NOT EXISTS idx_documents_deleted_at
  ON documents (deleted_at);
