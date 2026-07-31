INSERT INTO permissions (name, display_name, module, description)
VALUES
  (
    'attendance.manage',
    'Quản lý chuyên cần',
    'attendance',
    'Tạo phiên, điểm danh và chỉnh lý dữ liệu chuyên cần theo phạm vi được giao'
  ),
  (
    'attendance.read',
    'Xem chuyên cần',
    'attendance',
    'Xem dữ liệu chuyên cần trong phạm vi được phép'
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record
  ON permission_record.name IN ('attendance.manage', 'attendance.read')
WHERE role_record.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record
  ON permission_record.name IN ('attendance.manage', 'attendance.read')
WHERE role_record.name = 'teacher'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record
  ON permission_record.name = 'attendance.read'
WHERE role_record.name = 'student'
ON CONFLICT DO NOTHING;

