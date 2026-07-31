INSERT INTO permissions (name, display_name, module, description)
VALUES (
  'dashboard.read',
  'Xem dashboard quản trị',
  'dashboard',
  'Xem số liệu vận hành tổng hợp của hệ thống'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'dashboard.read'
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;
