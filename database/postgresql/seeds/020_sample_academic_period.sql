INSERT INTO academic_years (
  name,
  start_date,
  end_date,
  status,
  is_locked
)
SELECT
  '2025-2026',
  DATE '2025-09-01',
  DATE '2026-08-31',
  'planned',
  FALSE
WHERE NOT EXISTS (
  SELECT 1
  FROM academic_years
  WHERE daterange(start_date, end_date, '[]')
    && daterange(DATE '2025-09-01', DATE '2026-08-31', '[]')
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO semesters (
  academic_year_id,
  name,
  code,
  start_date,
  end_date,
  status,
  is_locked
)
SELECT
  academic_year.id,
  semester.name,
  semester.code,
  semester.start_date,
  semester.end_date,
  'planned',
  FALSE
FROM academic_years academic_year
CROSS JOIN LATERAL (
  VALUES
    ('Hoc ky 1', 'HK1', DATE '2025-09-01', DATE '2026-01-15'),
    ('Hoc ky 2', 'HK2', DATE '2026-01-16', DATE '2026-05-31')
) AS semester(name, code, start_date, end_date)
WHERE academic_year.name = '2025-2026'
ON CONFLICT (academic_year_id, code) DO NOTHING;

UPDATE classrooms classroom
SET academic_year_id = academic_year.id
FROM academic_years academic_year
WHERE classroom.academic_year_id IS NULL
  AND classroom.school_year = academic_year.name;

UPDATE timetables timetable
SET academic_year_id = academic_year.id
FROM academic_years academic_year
WHERE timetable.academic_year_id IS NULL
  AND timetable.school_year = academic_year.name;
