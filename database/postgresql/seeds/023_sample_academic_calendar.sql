WITH period AS (
  SELECT year_record.id AS academic_year_id, semester.id AS semester_id,
    semester.start_date, semester.end_date
  FROM academic_years year_record
  JOIN semesters semester ON semester.academic_year_id = year_record.id
  ORDER BY semester.end_date DESC, semester.id DESC
  LIMIT 1
), actor AS (
  SELECT user_account.id
  FROM users user_account
  JOIN user_roles user_role ON user_role.user_id = user_account.id
  JOIN roles role ON role.id = user_role.role_id AND role.name = 'admin'
  WHERE user_account.status = 'active'
  ORDER BY user_account.id LIMIT 1
), fixtures(entry_type, title, description, starts_at, ends_at) AS (
  SELECT 'deadline'::academic_calendar_entry_type,
    'Hạn hoàn thành hồ sơ học kỳ',
    'Mốc học vụ mẫu để kiểm tra lịch toàn trường trên các portal.',
    (period.end_date - 14 + TIME '17:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
    (period.end_date - 14 + TIME '18:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'
  FROM period
  UNION ALL
  SELECT 'no_school'::academic_calendar_entry_type,
    'Nghỉ học theo kế hoạch nhà trường',
    'Lịch nghỉ mẫu; admin có thể lưu trữ sau khi kiểm tra giao diện.',
    (period.end_date - 7 + TIME '00:00') AT TIME ZONE 'Asia/Ho_Chi_Minh',
    (period.end_date - 6 + TIME '00:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'
  FROM period
), inserted AS (
  INSERT INTO academic_calendar_entries (
    academic_year_id, semester_id, entry_type, title, description,
    starts_at, ends_at, all_day, status, revision,
    created_by_user_id, published_by_user_id, published_at
  )
  SELECT period.academic_year_id, period.semester_id, fixture.entry_type,
    fixture.title, fixture.description, fixture.starts_at, fixture.ends_at,
    fixture.entry_type = 'no_school', 'published', 1,
    actor.id, actor.id, CURRENT_TIMESTAMP
  FROM fixtures fixture
  CROSS JOIN period
  CROSS JOIN actor
  WHERE NOT EXISTS (
    SELECT 1 FROM academic_calendar_entries existing
    WHERE existing.title = fixture.title
      AND existing.academic_year_id = period.academic_year_id
  )
  RETURNING *
)
INSERT INTO academic_calendar_entry_audits (
  entry_id, actor_user_id, action, revision, new_data
)
SELECT inserted.id, inserted.created_by_user_id, 'publish', inserted.revision,
  to_jsonb(inserted)
FROM inserted;
