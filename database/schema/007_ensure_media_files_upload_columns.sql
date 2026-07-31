SET @database_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'media_files'
    AND COLUMN_NAME = 'original_name'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE media_files ADD COLUMN original_name VARCHAR(255) NOT NULL DEFAULT '''' AFTER id',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'media_files'
    AND COLUMN_NAME = 'storage_path'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE media_files ADD COLUMN storage_path VARCHAR(500) NULL AFTER file_path',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'media_files'
    AND COLUMN_NAME = 'size'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE media_files ADD COLUMN size BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER file_size',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'media_files'
    AND COLUMN_NAME = 'type'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE media_files ADD COLUMN type ENUM(''image'', ''document'', ''other'') NOT NULL DEFAULT ''other'' AFTER size',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'media_files'
    AND COLUMN_NAME = 'url'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE media_files ADD COLUMN url VARCHAR(500) NULL AFTER type',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE media_files
SET
  original_name = IF(original_name = '', file_name, original_name),
  storage_path = COALESCE(storage_path, file_path),
  size = IF(size = 0, file_size, size),
  url = COALESCE(url, file_path)
WHERE id > 0;
