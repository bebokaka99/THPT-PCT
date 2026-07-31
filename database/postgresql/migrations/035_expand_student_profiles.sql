ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS parent_name VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS permanent_address TEXT NULL;

