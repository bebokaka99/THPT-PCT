CREATE OR REPLACE FUNCTION validate_academic_calendar_publish_conflicts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'published'
    OR NEW.entry_type IN ('no_school', 'deadline')
  THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM academic_calendar_entries other_entry
    WHERE other_entry.status = 'published'
      AND other_entry.id <> NEW.id
      AND tstzrange(other_entry.starts_at, other_entry.ends_at, '[)')
        && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
      AND (
        other_entry.classroom_id = NEW.classroom_id
        OR other_entry.teacher_user_id = NEW.teacher_user_id
        OR (
          NULLIF(lower(btrim(NEW.room)), '') IS NOT NULL
          AND lower(btrim(other_entry.room)) = lower(btrim(NEW.room))
        )
      )
  ) THEN
    RAISE EXCEPTION 'ACADEMIC_CALENDAR_CONFLICT: overlapping published academic schedule';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM timetables timetable
    JOIN timetable_items item ON item.timetable_id = timetable.id
    JOIN bell_periods period ON period.shift_id = item.shift_id
      AND period.period_index = item.lesson_index
    WHERE timetable.status = 'published'
      AND timetable.semester_id = NEW.semester_id
      AND item.day_of_week = EXTRACT(
        ISODOW FROM (NEW.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')
      )
      AND period.starts_at < (NEW.ends_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time
      AND period.ends_at > (NEW.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::time
      AND (
        timetable.classroom_id = NEW.classroom_id
        OR item.teacher_user_id = NEW.teacher_user_id
        OR (
          NULLIF(lower(btrim(NEW.room)), '') IS NOT NULL
          AND lower(btrim(item.room)) = lower(btrim(NEW.room))
        )
      )
      AND NOT (
        NEW.entry_type IN ('test', 'exam')
        AND item.teaching_assignment_id = NEW.teaching_assignment_id
      )
  ) THEN
    RAISE EXCEPTION 'ACADEMIC_CALENDAR_CONFLICT: overlaps published timetable';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_academic_calendar_publish_conflicts_insert
BEFORE INSERT ON academic_calendar_entries
FOR EACH ROW EXECUTE FUNCTION validate_academic_calendar_publish_conflicts();

CREATE TRIGGER trg_academic_calendar_publish_conflicts_update
BEFORE UPDATE OF status, entry_type, classroom_id, teacher_user_id, room,
  starts_at, ends_at, semester_id, teaching_assignment_id
ON academic_calendar_entries
FOR EACH ROW EXECUTE FUNCTION validate_academic_calendar_publish_conflicts();
