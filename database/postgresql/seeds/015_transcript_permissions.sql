INSERT INTO permissions (name, display_name, module, description)
VALUES
  (
    'transcripts.read',
    'Xem phiếu kết quả học tập',
    'academic',
    'View report cards within the authorized academic scope'
  ),
  (
    'transcripts.manage',
    'Quản lý snapshot phiếu điểm',
    'academic',
    'Generate and manage report card snapshots'
  )
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record
  ON permission_record.name IN ('transcripts.read', 'transcripts.manage')
WHERE role_record.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record
  ON permission_record.name = 'transcripts.read'
WHERE role_record.name IN ('teacher', 'student')
ON CONFLICT DO NOTHING;
