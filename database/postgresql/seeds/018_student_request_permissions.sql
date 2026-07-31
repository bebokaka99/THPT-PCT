INSERT INTO permissions (name, display_name, module, description)
VALUES
  (
    'student_requests.read',
    'Xem đơn học sinh',
    'student_requests',
    'Xem đơn và yêu cầu học sinh trong phạm vi được cấp'
  ),
  (
    'student_requests.create',
    'Tạo đơn học sinh',
    'student_requests',
    'Tạo và quản lý đơn của chính học sinh'
  ),
  (
    'student_requests.review',
    'Xét duyệt đơn học sinh',
    'student_requests',
    'Tiếp nhận và xét duyệt đơn học sinh'
  ),
  (
    'student_request_types.manage',
    'Quản lý loại đơn',
    'student_requests',
    'Quản lý loại đơn, biểu mẫu và SLA'
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
  AND p.name IN (
    'student_requests.read',
    'student_requests.create',
    'student_requests.review',
    'student_request_types.manage'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'teacher'
  AND p.name IN ('student_requests.read', 'student_requests.review')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'student'
  AND p.name IN ('student_requests.read', 'student_requests.create')
ON CONFLICT DO NOTHING;

INSERT INTO student_request_types (
  code,
  name,
  description,
  instructions,
  reviewer_scope,
  requires_attachment,
  sla_days,
  form_schema,
  is_active
)
VALUES
  (
    'LEAVE_REQUEST',
    'Đơn xin nghỉ học',
    'Đề nghị giáo viên chủ nhiệm xác nhận thời gian nghỉ học.',
    'Nêu rõ thời gian và lý do xin nghỉ.',
    'homeroom',
    FALSE,
    2,
    '{"fields":[{"name":"leave_date","label":"Ngày nghỉ","type":"date","required":true}]}'::jsonb,
    TRUE
  ),
  (
    'STUDENT_CONFIRMATION',
    'Giấy xác nhận học sinh',
    'Đề nghị nhà trường cấp giấy xác nhận đang theo học.',
    'Ghi rõ mục đích sử dụng giấy xác nhận.',
    'admin',
    FALSE,
    5,
    '{"fields":[{"name":"purpose","label":"Mục đích","type":"textarea","required":true}]}'::jsonb,
    TRUE
  ),
  (
    'PROFILE_CORRECTION',
    'Đề nghị điều chỉnh thông tin',
    'Đề nghị kiểm tra và điều chỉnh thông tin hồ sơ học sinh.',
    'Đính kèm giấy tờ minh chứng cho thông tin đề nghị điều chỉnh.',
    'admin',
    TRUE,
    7,
    '{"fields":[{"name":"field_name","label":"Thông tin cần điều chỉnh","type":"text","required":true},{"name":"expected_value","label":"Thông tin đúng","type":"text","required":true}]}'::jsonb,
    TRUE
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instructions = EXCLUDED.instructions,
  reviewer_scope = EXCLUDED.reviewer_scope,
  requires_attachment = EXCLUDED.requires_attachment,
  sla_days = EXCLUDED.sla_days,
  form_schema = EXCLUDED.form_schema;
