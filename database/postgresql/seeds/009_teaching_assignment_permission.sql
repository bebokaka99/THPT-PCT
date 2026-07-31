INSERT INTO permissions (name, display_name, module, description)
VALUES (
  'teaching_assignments.manage',
  'Quản lý phân công giảng dạy',
  'academic',
  'Tạo, cập nhật và kết thúc phân công giáo viên theo lớp, môn và học kỳ'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission.id
FROM roles role_record
JOIN permissions permission
  ON permission.name = 'teaching_assignments.manage'
WHERE role_record.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
