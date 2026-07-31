INSERT INTO permissions (name, display_name, module, description)
VALUES (
  'academic_periods.manage',
  'Quản lý năm học và học kỳ',
  'academic_periods',
  'Tạo, cập nhật, kích hoạt, khóa và đóng năm học hoặc học kỳ'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name = 'academic_periods.manage'
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;
