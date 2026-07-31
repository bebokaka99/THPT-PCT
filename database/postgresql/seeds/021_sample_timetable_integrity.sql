-- Rebuild the three local demo timetables with conflict-free teaching slots.
-- The seed resolves teachers exclusively through active teaching assignments.
UPDATE school_shifts SET name = 'Ca sáng' WHERE code = 'morning';
UPDATE school_shifts SET name = 'Ca chiều' WHERE code = 'afternoon';

CREATE TEMP TABLE demo_timetable_slots (
  classroom_name VARCHAR(100),
  subject_code VARCHAR(80),
  day_of_week INTEGER,
  shift_code VARCHAR(50),
  lesson_index INTEGER
) ON COMMIT DROP;

INSERT INTO demo_timetable_slots (
  classroom_name, subject_code, day_of_week, shift_code, lesson_index
)
VALUES
  ('12A1', 'LICH_SU', 1, 'morning', 1),
  ('12A1', 'DIA_LY', 2, 'morning', 2),
  ('12A1', 'TOAN', 3, 'morning', 1),
  ('12A1', 'NGU_VAN', 4, 'morning', 2),
  ('12A1', 'TIENG_ANH', 5, 'morning', 1),
  ('11A2', 'LICH_SU', 1, 'morning', 2),
  ('11A2', 'DIA_LY', 2, 'morning', 3),
  ('11A2', 'TOAN', 3, 'morning', 2),
  ('11A2', 'NGU_VAN', 4, 'morning', 3),
  ('11A2', 'TIENG_ANH', 5, 'morning', 2),
  ('10A3', 'LICH_SU', 1, 'afternoon', 1),
  ('10A3', 'DIA_LY', 2, 'afternoon', 2),
  ('10A3', 'TOAN', 3, 'afternoon', 1),
  ('10A3', 'VAT_LY', 4, 'afternoon', 2),
  ('10A3', 'TIN_HOC', 5, 'afternoon', 1);

CREATE TEMP TABLE demo_timetables ON COMMIT DROP AS
SELECT DISTINCT ON (classroom.id)
  classroom.id AS classroom_id,
  classroom.name AS classroom_name,
  timetable.id AS timetable_id
FROM classrooms classroom
JOIN timetables timetable ON timetable.classroom_id = classroom.id
WHERE classroom.name IN ('12A1', '11A2', '10A3')
  AND classroom.school_year = '2025-2026'
ORDER BY classroom.id, timetable.version_number DESC, timetable.id DESC;

UPDATE timetables timetable
SET status = 'draft', is_active = FALSE
FROM demo_timetables demo
WHERE timetable.id = demo.timetable_id;

DELETE FROM timetable_items item
USING demo_timetables demo
WHERE item.timetable_id = demo.timetable_id;

INSERT INTO timetable_items (
  timetable_id,
  day_of_week,
  shift_id,
  lesson_index,
  subject_id,
  teaching_assignment_id,
  teacher_user_id,
  subject_name,
  teacher_name,
  room,
  note
)
SELECT
  demo.timetable_id,
  slot.day_of_week,
  shift.id,
  slot.lesson_index,
  subject.id,
  assignment.id,
  assignment.teacher_user_id,
  subject.name,
  teacher.full_name,
  demo.classroom_name,
  'Dữ liệu demo không trùng lịch'
FROM demo_timetable_slots slot
JOIN demo_timetables demo ON demo.classroom_name = slot.classroom_name
JOIN school_shifts shift ON shift.code = slot.shift_code
JOIN subjects subject ON subject.code = slot.subject_code
JOIN timetables timetable ON timetable.id = demo.timetable_id
JOIN teaching_assignments assignment
  ON assignment.classroom_id = demo.classroom_id
  AND assignment.subject_id = subject.id
  AND assignment.semester_id = timetable.semester_id
  AND assignment.status = 'active'
JOIN users teacher ON teacher.id = assignment.teacher_user_id;

UPDATE timetables timetable
SET status = 'published',
  title = 'Thời khóa biểu ' || demo.classroom_name || ' - Học kỳ 2'
FROM demo_timetables demo
WHERE timetable.id = demo.timetable_id;
