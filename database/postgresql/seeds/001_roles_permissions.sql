INSERT INTO roles (name, display_name, description)
VALUES
  ('admin', 'Quản trị viên', 'Toàn quyền quản trị hệ thống'),
  ('teacher', 'Giáo viên', 'Quản lý nội dung và portal lớp học'),
  ('student', 'Học sinh', 'Truy cập nội dung công khai và lớp học')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

INSERT INTO permissions (name, display_name, module, description)
VALUES
  ('posts.read', 'Xem bài viết', 'posts', 'Xem danh sách và chi tiết bài viết'),
  ('posts.manage', 'Quản lý bài viết', 'posts', 'Tạo, cập nhật, xuất bản và xóa bài viết'),
  ('users.manage', 'Quản lý người dùng', 'users', 'Quản lý tài khoản và trạng thái người dùng'),
  ('roles.manage', 'Quản lý vai trò', 'roles', 'Quản lý vai trò và quyền'),
  ('documents.manage', 'Quản lý tài liệu', 'documents', 'Tạo và quản lý tài liệu'),
  ('timetables.manage', 'Quản lý thời khóa biểu', 'timetables', 'Quản lý thời khóa biểu'),
  ('events.manage', 'Quản lý sự kiện', 'events', 'Quản lý sự kiện'),
  ('notifications.manage', 'Quản lý thông báo', 'notifications', 'Gửi và quản lý thông báo'),
  ('classrooms.manage', 'Quản lý lớp học', 'classrooms', 'Tạo, cập nhật và phân công lớp học'),
  ('classroom_posts.manage', 'Quản lý thông báo lớp', 'classrooms', 'Tạo và quản lý thông báo lớp'),
  ('classroom_documents.manage', 'Quản lý tài liệu lớp', 'classrooms', 'Tạo và quản lý tài liệu lớp'),
  ('classroom_posts.read', 'Xem thông báo lớp', 'classrooms', 'Xem thông báo lớp'),
  ('classroom_documents.read', 'Xem tài liệu lớp', 'classrooms', 'Xem tài liệu lớp')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'posts.read',
  'posts.manage',
  'documents.manage',
  'timetables.manage',
  'events.manage',
  'notifications.manage',
  'classrooms.manage',
  'classroom_posts.manage',
  'classroom_documents.manage',
  'classroom_posts.read',
  'classroom_documents.read'
)
WHERE r.name = 'teacher'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('posts.read', 'classroom_posts.read', 'classroom_documents.read')
WHERE r.name = 'student'
ON CONFLICT DO NOTHING;
