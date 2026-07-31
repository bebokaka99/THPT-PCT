INSERT INTO permissions (name, display_name, module, description)
VALUES (
  'enrollments.manage',
  'Quản lý xếp lớp và lịch sử học sinh',
  'enrollments',
  'Assign students, transfer classrooms, and manage enrollment history'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
CROSS JOIN permissions permission
WHERE role.name = 'admin'
  AND permission.name = 'enrollments.manage'
ON CONFLICT (role_id, permission_id) DO NOTHING;
