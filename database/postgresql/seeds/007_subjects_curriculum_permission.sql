INSERT INTO permissions (name, display_name, module, description)
VALUES (
  'subjects.manage',
  'Quản lý môn học và chương trình',
  'subjects',
  'Tạo, cập nhật, import môn học và cấu hình chương trình theo năm/khối'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name = 'subjects.manage'
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;
