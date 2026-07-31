CREATE TABLE IF NOT EXISTS timetables (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  classroom_id BIGINT UNSIGNED NOT NULL,
  school_year VARCHAR(20) NOT NULL,
  semester VARCHAR(50) NULL,
  title VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_timetables_classroom
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  INDEX idx_timetables_classroom_active (classroom_id, is_active)
);

SET @database_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = 'timetables' AND COLUMN_NAME = 'classroom_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE timetables ADD COLUMN classroom_id BIGINT UNSIGNED NULL AFTER id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = 'timetables' AND COLUMN_NAME = 'is_active'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE timetables ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER title',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = 'timetables' AND COLUMN_NAME = 'class_name'
);
SET @statement = IF(
  @column_exists = 1,
  'ALTER TABLE timetables MODIFY COLUMN class_name VARCHAR(80) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE timetables
  MODIFY COLUMN semester VARCHAR(50) NULL;

CREATE TABLE IF NOT EXISTS timetable_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  timetable_id BIGINT UNSIGNED NOT NULL,
  day_of_week INT NOT NULL,
  lesson_index INT NOT NULL,
  subject_name VARCHAR(255) NOT NULL,
  teacher_name VARCHAR(255) NULL,
  room VARCHAR(100) NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_timetable_items_timetable
    FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE,
  UNIQUE KEY uq_timetable_item_slot (timetable_id, day_of_week, lesson_index),
  INDEX idx_timetable_items_day_lesson (day_of_week, lesson_index)
);
