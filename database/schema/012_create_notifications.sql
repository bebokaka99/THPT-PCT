CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type ENUM('system','school','classroom','post','document','event','timetable') NOT NULL DEFAULT 'system',
  target_role ENUM('all','admin','teacher','student') NOT NULL DEFAULT 'all',
  classroom_id BIGINT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  related_url VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_classroom
    FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_notifications_target_role (target_role),
  INDEX idx_notifications_classroom (classroom_id),
  INDEX idx_notifications_created_at (created_at)
);

SET @database_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'target_role'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE notifications ADD COLUMN target_role ENUM(''all'',''admin'',''teacher'',''student'') NOT NULL DEFAULT ''all'' AFTER type',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'classroom_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE notifications ADD COLUMN classroom_id BIGINT NULL AFTER target_role',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'created_by_user_id'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE notifications ADD COLUMN created_by_user_id BIGINT UNSIGNED NULL AFTER classroom_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'related_url'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE notifications ADD COLUMN related_url VARCHAR(500) NULL AFTER created_by_user_id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE notifications
  MODIFY COLUMN type ENUM('system','school','classroom','post','document','event','timetable') NOT NULL DEFAULT 'system';

CREATE TABLE IF NOT EXISTS user_notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_notifications_user_notification (notification_id, user_id),
  CONSTRAINT fk_user_notifications_notification
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_notifications_user_read (user_id, read_at),
  INDEX idx_user_notifications_created_at (created_at)
);
