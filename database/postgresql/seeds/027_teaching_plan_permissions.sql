INSERT INTO permissions (name, display_name, module, description)
VALUES
  ('teaching_plans.manage', 'Quản lý kế hoạch giảng dạy', 'teaching_plans', 'Tạo, sửa và gửi kế hoạch giảng dạy trong assignment được phân công'),
  ('teaching_plans.review', 'Duyệt kế hoạch giảng dạy', 'teaching_plans', 'Xem và duyệt/từ chối kế hoạch giảng dạy')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name IN ('teaching_plans.manage', 'teaching_plans.review')
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name = 'teaching_plans.manage'
WHERE role.name = 'teacher'
ON CONFLICT DO NOTHING;
