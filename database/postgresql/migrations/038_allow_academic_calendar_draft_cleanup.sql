CREATE OR REPLACE FUNCTION protect_academic_calendar_audits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_academic_calendar_audit_cleanup', TRUE) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Academic calendar audit records are immutable';
END;
$$;
