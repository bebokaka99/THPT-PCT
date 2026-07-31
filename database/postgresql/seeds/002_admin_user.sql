INSERT INTO users (full_name, email, password_hash, status)
VALUES (
  'System Admin',
  'admin@pct.local',
  '$2b$10$VIYsdomoQbmlVirZAwQhVO2wVzX1mfLP.KvVJky7tf5qWUuWVFyQi',
  'active'
)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash,
  status = EXCLUDED.status;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.email = 'admin@pct.local'
ON CONFLICT DO NOTHING;
