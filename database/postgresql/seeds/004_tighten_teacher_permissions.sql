DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'teacher'
  AND p.name IN (
    'posts.manage',
    'documents.manage',
    'timetables.manage',
    'events.manage',
    'notifications.manage',
    'classrooms.manage'
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'posts.read',
  'classroom_posts.manage',
  'classroom_documents.manage',
  'classroom_posts.read',
  'classroom_documents.read'
)
WHERE r.name = 'teacher'
ON CONFLICT DO NOTHING;

