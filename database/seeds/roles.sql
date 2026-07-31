INSERT INTO roles (name, display_name, description)
VALUES
  ('admin', 'Quản trị viên', 'Toàn quyền quản trị hệ thống'),
  ('teacher', 'Giáo viên', 'Quản lý nội dung và thông tin liên quan giảng dạy'),
  ('student', 'Học sinh', 'Truy cập nội dung học tập và thông báo cá nhân')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description);

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p
WHERE r.name = 'admin';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'posts.read',
  'posts.manage',
  'documents.manage',
  'timetables.manage',
  'events.manage',
  'notifications.manage'
)
WHERE r.name = 'teacher';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name = 'posts.read'
WHERE r.name = 'student';

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.email = 'admin@pct.local';
