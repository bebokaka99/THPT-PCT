INSERT INTO permissions (name, display_name, module, description)
VALUES
  ('academic_calendar.manage', 'Quản lý lịch học vụ', 'academic_calendar', 'Quản lý và công bố lịch học vụ'),
  ('academic_calendar.propose', 'Đề xuất lịch học vụ', 'academic_calendar', 'Đề xuất lịch học vụ trong phạm vi giảng dạy'),
  ('academic_calendar.read', 'Xem lịch học vụ', 'academic_calendar', 'Xem lịch học vụ theo phạm vi được cấp')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name IN (
  'academic_calendar.manage', 'academic_calendar.propose', 'academic_calendar.read'
)
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name IN (
  'academic_calendar.propose', 'academic_calendar.read'
)
WHERE role.name = 'teacher'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name = 'academic_calendar.read'
WHERE role.name IN ('student', 'guardian')
ON CONFLICT DO NOTHING;
