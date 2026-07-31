INSERT INTO permissions (name, display_name, module, description)
VALUES
  ('class_journals.manage', 'Ghi sổ đầu bài', 'class_journals', 'Tạo và cập nhật sổ đầu bài trong tiết được phân công'),
  ('class_journals.review', 'Theo dõi sổ đầu bài', 'class_journals', 'Xem và theo dõi sổ đầu bài toàn trường'),
  ('class_journals.correct', 'Chỉnh lý sổ đầu bài', 'class_journals', 'Chỉnh lý sổ đầu bài đã ghi với lý do bắt buộc')
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name IN ('class_journals.manage', 'class_journals.review', 'class_journals.correct')
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name = 'class_journals.manage'
WHERE role.name = 'teacher'
ON CONFLICT DO NOTHING;
