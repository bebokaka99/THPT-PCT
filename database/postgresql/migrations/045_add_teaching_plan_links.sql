ALTER TABLE teaching_plans
  ADD COLUMN IF NOT EXISTS week_number INTEGER CHECK (week_number BETWEEN 1 AND 53),
  ADD COLUMN IF NOT EXISTS timetable_item_id BIGINT REFERENCES timetable_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_id BIGINT REFERENCES assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS media_file_id BIGINT REFERENCES media_files(id) ON DELETE SET NULL;

ALTER TABLE teaching_plan_versions
  ADD COLUMN IF NOT EXISTS week_number INTEGER,
  ADD COLUMN IF NOT EXISTS timetable_item_id BIGINT,
  ADD COLUMN IF NOT EXISTS assignment_id BIGINT,
  ADD COLUMN IF NOT EXISTS media_file_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_teaching_plans_timetable_item
  ON teaching_plans(timetable_item_id) WHERE timetable_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teaching_plans_assignment
  ON teaching_plans(assignment_id) WHERE assignment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_teaching_plans_media
  ON teaching_plans(media_file_id) WHERE media_file_id IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_teaching_plan_approved_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'approved' AND (
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.objectives IS DISTINCT FROM OLD.objectives OR
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.resources IS DISTINCT FROM OLD.resources OR
    NEW.week_number IS DISTINCT FROM OLD.week_number OR
    NEW.timetable_item_id IS DISTINCT FROM OLD.timetable_item_id OR
    NEW.assignment_id IS DISTINCT FROM OLD.assignment_id OR
    NEW.media_file_id IS DISTINCT FROM OLD.media_file_id OR
    NEW.version_number IS DISTINCT FROM OLD.version_number
  ) THEN
    RAISE EXCEPTION 'APPROVED_TEACHING_PLAN_VERSION_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;
