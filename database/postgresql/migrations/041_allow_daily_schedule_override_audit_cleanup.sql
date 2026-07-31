CREATE OR REPLACE FUNCTION prevent_daily_schedule_override_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_daily_schedule_override_audit_cleanup', TRUE) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'DAILY_SCHEDULE_OVERRIDE_AUDIT_IMMUTABLE';
END;
$$;
