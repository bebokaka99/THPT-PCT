SET @database_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'slug'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE documents ADD COLUMN slug VARCHAR(255) NULL AFTER title',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'category'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE documents ADD COLUMN category VARCHAR(120) NULL AFTER description',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'document_url'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE documents ADD COLUMN document_url VARCHAR(500) NULL AFTER category',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'file_type'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE documents ADD COLUMN file_type VARCHAR(80) NULL AFTER document_url',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'file_size'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE documents ADD COLUMN file_size BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER file_type',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'documents'
    AND COLUMN_NAME = 'published_at'
);
SET @statement = IF(
  @column_exists = 0,
  'ALTER TABLE documents ADD COLUMN published_at DATETIME NULL AFTER status',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE documents
SET
  slug = COALESCE(slug, CONCAT('document-', id)),
  category = COALESCE(category, 'van-ban'),
  document_url = COALESCE(document_url, file_url),
  file_type = COALESCE(file_type, ''),
  published_at = IF(status = 'published' AND published_at IS NULL, created_at, published_at)
WHERE id > 0;

SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = 'documents'
    AND INDEX_NAME = 'uq_documents_slug'
);
SET @statement = IF(
  @index_exists = 0,
  'ALTER TABLE documents ADD UNIQUE KEY uq_documents_slug (slug)',
  'SELECT 1'
);
PREPARE stmt FROM @statement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
