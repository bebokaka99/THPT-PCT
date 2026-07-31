ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(100);

ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx
  ON users (LOWER(username))
  WHERE username IS NOT NULL;

ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

CREATE INDEX IF NOT EXISTS student_profiles_class_name_idx
  ON student_profiles (class_name);
