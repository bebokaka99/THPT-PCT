INSERT INTO permissions (name, display_name, module, description)
VALUES
  ('notifications.send', 'Gửi thông báo', 'notifications', 'Gửi thông báo theo phạm vi được phân công'),
  ('notifications.report', 'Xem báo cáo thông báo', 'notifications', 'Xem tỷ lệ đã đọc và đã xác nhận')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name IN ('notifications.send', 'notifications.report')
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name IN ('notifications.send', 'notifications.report')
WHERE role.name = 'teacher'
ON CONFLICT DO NOTHING;
