DO $$
BEGIN
  CREATE TYPE student_request_status AS ENUM (
    'draft',
    'pending',
    'in_review',
    'approved',
    'rejected',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE student_request_reviewer_scope AS ENUM ('homeroom', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS student_request_types (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  instructions TEXT NULL,
  reviewer_scope student_request_reviewer_scope NOT NULL DEFAULT 'admin',
  requires_attachment BOOLEAN NOT NULL DEFAULT FALSE,
  sla_days INTEGER NOT NULL DEFAULT 5 CHECK (sla_days BETWEEN 1 AND 90),
  form_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_requests (
  id BIGSERIAL PRIMARY KEY,
  request_type_id BIGINT NOT NULL REFERENCES student_request_types(id) ON DELETE RESTRICT,
  student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status student_request_status NOT NULL DEFAULT 'draft',
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  due_at TIMESTAMPTZ NULL,
  submitted_at TIMESTAMPTZ NULL,
  reviewed_at TIMESTAMPTZ NULL,
  reviewed_by_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  decision_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_request_attachments (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES student_requests(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL UNIQUE,
  storage_path VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  uploaded_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_request_status_history (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES student_requests(id) ON DELETE CASCADE,
  actor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL CHECK (
    action IN ('create', 'submit', 'start_review', 'approve', 'reject', 'cancel')
  ),
  old_status student_request_status NULL,
  new_status student_request_status NOT NULL,
  reason TEXT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_request_types_active
  ON student_request_types(is_active);
CREATE INDEX IF NOT EXISTS idx_student_requests_student_status
  ON student_requests(student_user_id, status);
CREATE INDEX IF NOT EXISTS idx_student_requests_type_status
  ON student_requests(request_type_id, status);
CREATE INDEX IF NOT EXISTS idx_student_requests_created_at
  ON student_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_request_attachments_request
  ON student_request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_student_request_history_request
  ON student_request_status_history(request_id, created_at);

DROP TRIGGER IF EXISTS set_student_request_types_updated_at ON student_request_types;
CREATE TRIGGER set_student_request_types_updated_at
BEFORE UPDATE ON student_request_types
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_student_requests_updated_at ON student_requests;
CREATE TRIGGER set_student_requests_updated_at
BEFORE UPDATE ON student_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION enforce_student_request_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    IF NOT (
      (OLD.status = 'draft' AND NEW.status IN ('pending', 'cancelled')) OR
      (OLD.status = 'pending' AND NEW.status IN ('in_review', 'approved', 'rejected', 'cancelled')) OR
      (OLD.status = 'in_review' AND NEW.status IN ('approved', 'rejected'))
    ) THEN
      RAISE EXCEPTION 'Invalid student request transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  IF OLD.status <> 'draft' AND (
    NEW.request_type_id IS DISTINCT FROM OLD.request_type_id OR
    NEW.student_user_id IS DISTINCT FROM OLD.student_user_id OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.form_data IS DISTINCT FROM OLD.form_data
  ) THEN
    RAISE EXCEPTION 'Submitted student request details are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_request_transition_guard ON student_requests;
CREATE TRIGGER student_request_transition_guard
BEFORE UPDATE ON student_requests
FOR EACH ROW EXECUTE FUNCTION enforce_student_request_transition();

CREATE OR REPLACE FUNCTION protect_student_request_history()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_student_request_cleanup', TRUE) = 'on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Student request history is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS student_request_history_immutable ON student_request_status_history;
CREATE TRIGGER student_request_history_immutable
BEFORE UPDATE OR DELETE ON student_request_status_history
FOR EACH ROW EXECUTE FUNCTION protect_student_request_history();
