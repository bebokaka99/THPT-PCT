# Database vận hành

## Quyết định

Project dùng **PostgreSQL 18** thay cho MySQL/XAMPP.

- Backend driver: `pg`.
- Query layer: repository pattern, không dùng Prisma.
- JSON metadata: `JSONB`.
- Local: Docker Compose hoặc PostgreSQL native.
- Production: managed PostgreSQL hoặc PostgreSQL container có backup riêng.

## Khởi động local

```powershell
docker compose up -d postgres
cd backend
copy .env.example .env
npm run db:setup
npm run db:status
npm run dev
```

Nếu dùng PostgreSQL native, tạo database/user tương ứng với `.env` rồi chạy
`npm run db:setup`. Không cần cài hoặc bật XAMPP.

## Environment

Ưu tiên dùng connection string:

```env
DATABASE_URL=postgresql://thpt_pct_pt:thpt_pct_pt_dev@localhost:55432/thpt_pct_pt
```

Hoặc dùng từng biến:

```env
PGHOST=localhost
PGPORT=55432
PGUSER=thpt_pct_pt
PGPASSWORD=thpt_pct_pt_dev
PGDATABASE=thpt_pct_pt
PGSSLMODE=disable
```

Docker Compose dùng host port `55432` mặc định; PostgreSQL native có thể dùng
`5432` nếu không bị xung đột. Production nên dùng `DATABASE_URL` của managed
PostgreSQL và bật SSL theo chính sách nhà cung cấp.

## Migration policy

- `database/postgresql/migrations` chạy theo thứ tự filename.
- `database/postgresql/seeds` cũng chạy theo thứ tự filename.
- Mỗi file được ghi vào `schema_migrations` với SHA-256 checksum.
- Không sửa file đã chạy; tạo migration mới.
- Mỗi file chạy trong transaction.
- Có advisory lock để chặn hai process migrate đồng thời.
- `npm run db:status` dùng để kiểm tra ledger.

Các file tại `database/schema` và `database/seeds` là migration MySQL legacy,
không được dùng cho PostgreSQL.
