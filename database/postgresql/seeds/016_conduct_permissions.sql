INSERT INTO permissions (name, display_name, module, description)
VALUES
  (
    'conduct.read',
    'Xem ket qua ren luyen',
    'academic',
    'Read conduct results within student, homeroom or admin scope'
  ),
  (
    'conduct.manage',
    'Nhap ket qua ren luyen',
    'academic',
    'Create, edit and submit homeroom conduct records'
  ),
  (
    'conduct.review',
    'Duyet ket qua ren luyen',
    'academic',
    'Approve, reject and lock conduct records'
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record ON permission_record.name IN (
  'conduct.read', 'conduct.manage', 'conduct.review'
)
WHERE role_record.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record ON permission_record.name IN (
  'conduct.read', 'conduct.manage'
)
WHERE role_record.name = 'teacher'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record ON permission_record.name = 'conduct.read'
WHERE role_record.name = 'student'
ON CONFLICT (role_id, permission_id) DO NOTHING;
