SET @database_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'categories'
    AND COLUMN_NAME = 'sort_order'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER description',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'categories'
    AND COLUMN_NAME = 'is_active'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE categories ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'cover_image_url'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE posts ADD COLUMN cover_image_url VARCHAR(255) NULL AFTER content',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
