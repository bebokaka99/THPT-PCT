INSERT INTO permissions (name, display_name, module, description)
VALUES
  ('posts.read', 'Xem bài viết', 'posts', 'Xem danh sách và chi tiết bài viết'),
  ('posts.manage', 'Quản lý bài viết', 'posts', 'Tạo, cập nhật, xuất bản bài viết'),
  ('users.manage', 'Quản lý người dùng', 'users', 'Quản lý tài khoản và trạng thái người dùng'),
  ('roles.manage', 'Quản lý vai trò', 'roles', 'Cấu hình vai trò và quyền'),
  ('documents.manage', 'Quản lý văn bản', 'documents', 'Tải lên và xuất bản tài liệu'),
  ('timetables.manage', 'Quản lý thời khóa biểu', 'timetables', 'Cập nhật thời khóa biểu'),
  ('events.manage', 'Quản lý sự kiện', 'events', 'Cập nhật lịch sự kiện'),
  ('notifications.manage', 'Quản lý thông báo', 'notifications', 'Gửi thông báo hệ thống')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  module = VALUES(module),
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

INSERT INTO permissions (name, display_name, module, description)
VALUES
  ('classrooms.manage', 'Quan ly lop hoc', 'classrooms', 'Tao, cap nhat va phan cong lop hoc'),
  ('classroom_posts.manage', 'Quan ly thong bao lop', 'classrooms', 'Tao va quan ly thong bao lop hoc'),
  ('classroom_documents.manage', 'Quan ly tai lieu lop', 'classrooms', 'Tao va quan ly tai lieu lop hoc'),
  ('classroom_posts.read', 'Xem thong bao lop', 'classrooms', 'Xem thong bao lop hoc'),
  ('classroom_documents.read', 'Xem tai lieu lop', 'classrooms', 'Xem tai lieu lop hoc')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  module = VALUES(module),
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
  'classroom_posts.manage',
  'classroom_documents.manage',
  'classroom_posts.read',
  'classroom_documents.read'
)
WHERE r.name = 'teacher';

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('classroom_posts.read', 'classroom_documents.read')
WHERE r.name = 'student';
