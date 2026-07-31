INSERT INTO categories (name, slug, description)
VALUES
  ('Tin nhà trường', 'tin-nha-truong', 'Tin tức và thông báo chung'),
  ('Văn bản', 'van-ban', 'Văn bản và tài liệu công khai')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT INTO posts (category_id, author_id, title, slug, excerpt, content, status, published_at)
SELECT c.id, u.id, 'Chào mừng đến với cổng thông tin THPT Phan Chu Trinh', 'chao-mung-den-voi-cong-thong-tin', 'Bài viết mẫu cho scaffold ban đầu.', 'Nội dung mẫu sẽ được thay thế trong các bước phát triển tiếp theo.', 'published', NOW()
FROM categories c
LEFT JOIN users u ON u.email = 'admin@pct.local'
WHERE c.slug = 'tin-nha-truong'
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  excerpt = VALUES(excerpt),
  content = VALUES(content),
  status = VALUES(status);
