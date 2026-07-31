CREATE TABLE IF NOT EXISTS academic_import_jobs (
  id BIGSERIAL PRIMARY KEY,
  import_type VARCHAR(30) NOT NULL CHECK (
    import_type IN ('enrollments', 'assignments', 'attendance', 'grades')
  ),
  status VARCHAR(30) NOT NULL DEFAULT 'preview_ready' CHECK (
    status IN ('preview_ready', 'committing', 'completed', 'failed')
  ),
  idempotency_key VARCHAR(120) NOT NULL,
  template_version VARCHAR(20) NOT NULL DEFAULT 'v1',
  original_file_name VARCHAR(255) NOT NULL,
  file_sha256 CHAR(64) NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
  valid_rows INTEGER NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  invalid_rows INTEGER NOT NULL DEFAULT 0 CHECK (invalid_rows >= 0),
  preview_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT NULL,
  created_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  committed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(created_by_user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS academic_import_audits (
  id BIGSERIAL PRIMARY KEY,
  import_job_id BIGINT NOT NULL REFERENCES academic_import_jobs(id) ON DELETE CASCADE,
  actor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL CHECK (
    action IN ('preview', 'commit_started', 'commit_completed', 'commit_failed')
  ),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_academic_import_jobs_creator
  ON academic_import_jobs(created_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academic_import_jobs_status
  ON academic_import_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academic_import_audits_job
  ON academic_import_audits(import_job_id, created_at);

DROP TRIGGER IF EXISTS set_academic_import_jobs_updated_at ON academic_import_jobs;
CREATE TRIGGER set_academic_import_jobs_updated_at
BEFORE UPDATE ON academic_import_jobs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION protect_academic_import_audits()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_academic_import_cleanup', TRUE) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Academic import audit is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS academic_import_audit_immutable ON academic_import_audits;
CREATE TRIGGER academic_import_audit_immutable
BEFORE UPDATE OR DELETE ON academic_import_audits
FOR EACH ROW EXECUTE FUNCTION protect_academic_import_audits();
