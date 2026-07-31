ALTER TABLE events
  ADD COLUMN IF NOT EXISTS slug VARCHAR(280),
  ADD COLUMN IF NOT EXISTS category VARCHAR(120),
  ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE events
SET slug = 'event-' || id
WHERE slug IS NULL OR btrim(slug) = '';

ALTER TABLE events
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_public_start
  ON events(is_public, start_time);
CREATE INDEX IF NOT EXISTS idx_events_status_start
  ON events(status, start_time);
