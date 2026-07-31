CREATE OR REPLACE FUNCTION protect_assessment_configuration_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subject_id <> OLD.subject_id
    OR NEW.semester_id <> OLD.semester_id
    OR NEW.grade_level <> OLD.grade_level
    OR NEW.version <> OLD.version
  THEN
    RAISE EXCEPTION
      'Assessment configuration identity is immutable; create a new version';
  END IF;

  IF OLD.status <> 'draft' AND (
    NEW.title <> OLD.title
    OR NEW.score_scale <> OLD.score_scale
    OR NEW.decimal_places <> OLD.decimal_places
    OR NEW.rounding_mode <> OLD.rounding_mode
  ) THEN
    RAISE EXCEPTION
      'Published assessment configuration content is immutable';
  END IF;

  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION
      'Draft assessment configuration can only be activated';
  END IF;
  IF OLD.status = 'active' AND NEW.status NOT IN ('active', 'archived') THEN
    RAISE EXCEPTION
      'Active assessment configuration can only be archived';
  END IF;
  IF OLD.status = 'archived' AND NEW.status <> 'archived' THEN
    RAISE EXCEPTION
      'Archived assessment configuration cannot be reactivated';
  END IF;

  RETURN NEW;
END;
$$;
