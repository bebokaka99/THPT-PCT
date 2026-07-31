INSERT INTO users (full_name, email, password_hash, status)
VALUES ('System Admin', 'admin@pct.local', '$2b$10$VIYsdomoQbmlVirZAwQhVO2wVzX1mfLP.KvVJky7tf5qWUuWVFyQi', 'active')
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  status = VALUES(status);

INSERT IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'admin'
WHERE u.email = 'admin@pct.local';
