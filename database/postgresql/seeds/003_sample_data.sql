INSERT INTO categories (name, slug, description)
VALUES
  ('Tin nhà trường', 'tin-nha-truong', 'Tin tức và thông báo chung'),
  ('Văn bản', 'van-ban', 'Văn bản và tài liệu công khai')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO classrooms (name, school_year, grade_level, description, is_active)
VALUES ('12A1', '2025-2026', 12, 'Lớp mẫu cho portal v1', TRUE)
ON CONFLICT (name, school_year) DO NOTHING;

INSERT INTO posts (category_id, author_id, title, slug, excerpt, content, status, published_at)
SELECT
  c.id,
  u.id,
  'Chào mừng đến với cổng thông tin THPT Phan Chu Trinh',
  'chao-mung-den-voi-cong-thong-tin',
  'Bài viết mẫu cho hệ thống.',
  'Nội dung mẫu để kiểm tra hệ thống.',
  'published',
  CURRENT_TIMESTAMP
FROM categories c
LEFT JOIN users u ON u.email = 'admin@pct.local'
WHERE c.slug = 'tin-nha-truong'
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at;
