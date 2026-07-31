INSERT INTO permissions (name, display_name, module, description)
VALUES
  ('timetable_overrides.manage', 'Manage daily schedule overrides', 'timetable', 'Create, publish, archive and audit daily timetable overrides'),
  ('timetable_overrides.propose', 'Propose daily schedule overrides', 'timetable', 'Propose a substitution, reschedule or room change for assigned lessons'),
  ('timetable_overrides.read', 'Read daily schedule overrides', 'timetable', 'Read the effective daily schedule after overrides')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name IN (
  'timetable_overrides.manage', 'timetable_overrides.propose', 'timetable_overrides.read'
)
WHERE role.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name IN (
  'timetable_overrides.propose', 'timetable_overrides.read'
)
WHERE role.name = 'teacher'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM roles role
JOIN permissions permission ON permission.name = 'timetable_overrides.read'
WHERE role.name IN ('student', 'guardian')
ON CONFLICT DO NOTHING;
