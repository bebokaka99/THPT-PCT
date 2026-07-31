INSERT INTO permissions (name, display_name, module, description)
VALUES
  (
    'gradebooks.manage',
    'Quan ly so diem',
    'academic',
    'Create gradebooks and enter scores in assigned classes'
  ),
  (
    'gradebooks.read',
    'Xem bang diem',
    'academic',
    'Read gradebooks available to the current role'
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
CROSS JOIN permissions permission_record
WHERE role_record.name IN ('admin', 'teacher')
  AND permission_record.name = 'gradebooks.manage'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
CROSS JOIN permissions permission_record
WHERE role_record.name IN ('admin', 'teacher', 'student')
  AND permission_record.name = 'gradebooks.read'
ON CONFLICT DO NOTHING;
