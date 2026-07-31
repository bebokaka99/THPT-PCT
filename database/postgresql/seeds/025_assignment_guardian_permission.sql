INSERT INTO role_permissions (role_id, permission_id)
SELECT role_record.id, permission_record.id
FROM roles role_record
JOIN permissions permission_record ON permission_record.name = 'assignments.read'
WHERE role_record.name = 'guardian'
ON CONFLICT (role_id, permission_id) DO NOTHING;
