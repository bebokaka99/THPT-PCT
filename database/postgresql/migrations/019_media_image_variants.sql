ALTER TABLE media_files
  ADD COLUMN IF NOT EXISTS width INTEGER CHECK (width IS NULL OR width > 0),
  ADD COLUMN IF NOT EXISTS height INTEGER CHECK (height IS NULL OR height > 0),
  ADD COLUMN IF NOT EXISTS optimized_size BIGINT CHECK (optimized_size IS NULL OR optimized_size >= 0),
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_media_files_image_variants
  ON media_files(type, created_at DESC)
  WHERE type = 'image';
