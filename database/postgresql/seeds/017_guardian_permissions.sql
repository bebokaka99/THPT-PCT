INSERT INTO roles (name, display_name, description)
VALUES (
  'guardian',
  'Phụ huynh',
  'Xem thông tin đã công bố của học sinh được liên kết và xác minh'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

INSERT INTO permissions (name, display_name, module, description)
VALUES
  (
    'guardians.manage',
    'Quản lý liên kết phụ huynh',
    'guardians',
    'Mời, xác minh và thu hồi liên kết phụ huynh-học sinh'
  ),
  (
    'guardian.children.read',
    'Xem thông tin con em',
    'guardians',
    'Xem dữ liệu đã công bố của học sinh có liên kết được xác minh'
  ),
  (
    'guardian.preferences.manage',
    'Quản lý tùy chọn phụ huynh',
    'guardians',
    'Cập nhật tùy chọn thông báo của chính tài khoản phụ huynh'
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
CROSS JOIN permissions permission
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name IN (
  'guardian.children.read',
  'guardian.preferences.manage'
)
WHERE role.name = 'guardian'
ON CONFLICT DO NOTHING;
