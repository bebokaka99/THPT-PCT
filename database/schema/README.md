# Legacy SQL notice

Các file trong thư mục này là SQL MySQL lịch sử từ giai đoạn XAMPP. Backend hiện tại
không đọc thư mục này.

Schema canonical dùng PostgreSQL 18 tại:

- `database/postgresql/migrations`
- `database/postgresql/seeds`

Không chạy trực tiếp các file MySQL cũ trên database PostgreSQL hoặc dùng chúng cho
deployment mới. Dùng `cd backend; npm run db:setup`.
