INSERT INTO permissions (name, display_name, module, description)
VALUES (
  'assessment_configurations.manage',
  'Quản lý cấu hình đầu điểm',
  'academic',
  'Create, version, and activate assessment configurations'
)
ON CONFLICT (name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record
  ON permission_record.name = 'assessment_configurations.manage'
WHERE role_record.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
