CREATE INDEX IF NOT EXISTS idx_posts_search_tsv_active
  ON posts
  USING GIN (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' || coalesce(content, '')
    )
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_search_tsv_active
  ON documents
  USING GIN (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '')
    )
  )
  WHERE deleted_at IS NULL;
