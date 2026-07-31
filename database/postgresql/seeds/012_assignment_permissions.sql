INSERT INTO permissions (name, display_name, module, description)
VALUES
  ('assignments.manage', 'Quan ly bai tap', 'assignments',
   'Tao va quan ly bai tap trong pham vi giang day'),
  ('assignments.read', 'Xem bai tap', 'assignments',
   'Xem bai tap va bai nop trong pham vi duoc phep')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record
  ON permission_record.name IN ('assignments.manage', 'assignments.read')
WHERE role_record.name IN ('admin', 'teacher')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record
  ON permission_record.name = 'assignments.read'
WHERE role_record.name = 'student'
ON CONFLICT DO NOTHING;
