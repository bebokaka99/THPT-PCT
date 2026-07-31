INSERT INTO permissions (name, display_name, module, description)
VALUES (
  'gradebooks.review',
  'Duyet va khoa so diem',
  'academic',
  'Approve, reject, lock and reopen gradebooks'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record
  ON permission_record.name = 'gradebooks.review'
WHERE role_record.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;
