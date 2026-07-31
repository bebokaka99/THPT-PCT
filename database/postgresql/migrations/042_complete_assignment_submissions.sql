DO $$
BEGIN
  ALTER TYPE assignment_submission_status ADD VALUE IF NOT EXISTS 'returned';
  ALTER TYPE assignment_submission_status ADD VALUE IF NOT EXISTS 'graded';
END $$;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS max_score NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS guardian_can_view_feedback BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE assignments
  ADD CONSTRAINT assignments_max_score_check
  CHECK (max_score IS NULL OR (max_score >= 0 AND max_score <= 100));

ALTER TABLE assignment_submissions
  ADD COLUMN IF NOT EXISTS content_text TEXT,
  ADD COLUMN IF NOT EXISTS link_url VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS score NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE assignment_submissions
  ADD CONSTRAINT assignment_submission_score_check
  CHECK (score IS NULL OR (score >= 0 AND score <= 100));

ALTER TABLE assignment_submission_files
  ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);

ALTER TABLE assignment_submission_audits
  DROP CONSTRAINT IF EXISTS assignment_submission_audits_action_check;

ALTER TABLE assignment_submission_audits
  ADD CONSTRAINT assignment_submission_audits_action_check
  CHECK (action IN ('submit', 'replace', 'withdraw', 'return', 'grade'));

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_review
  ON assignment_submissions(assignment_id, status, last_submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_submission_files_storage
  ON assignment_submission_files(storage_path)
  WHERE storage_path IS NOT NULL;
