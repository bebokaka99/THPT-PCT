# PCT Crawler Import Tool

Tool Python dùng để crawl website cũ và import dữ liệu vào PostgreSQL của
project THPT-PCT-PT. Frontend/backend không gọi trực tiếp website cũ.

Crawler chỉ ghi dữ liệu vào `imported_contents`. Admin kiểm tra rồi mới convert
sang bài viết.

## Cài đặt

```powershell
cd tools\pct_crawler
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Database local dùng PostgreSQL, không cần XAMPP:

```powershell
docker compose up -d postgres
cd ..\..\backend
npm run db:setup
cd ..\tools\pct_crawler
```

## Dry run

```powershell
$env:DRY_RUN="true"
$env:IMPORT_TO_DB="false"
python crawl_pct.py
```

Preview được ghi vào:

```text
tools/pct_crawler/output/pct_import_preview.json
```

Report fetch được ghi vào:

```text
tools/pct_crawler/output/crawl_report.json
```

## Import từ local HTML/JSON

Đặt file vào `tools/pct_crawler/input/`, sau đó:

```powershell
$env:LOCAL_INPUT_PATH="sample-post.html"
$env:DRY_RUN="true"
$env:IMPORT_TO_DB="false"
python crawl_pct.py
```

Local HTML được đọc best-effort bằng nhiều encoding và có fallback từ `body`.

## Import vào PostgreSQL

Đảm bảo PostgreSQL đã chạy và migrations đã hoàn tất:

```powershell
$env:LOCAL_INPUT_PATH="sample-post.html"
$env:DRY_RUN="false"
$env:IMPORT_TO_DB="true"
python crawl_pct.py
```

Có thể dùng `DATABASE_URL` hoặc các biến `PGHOST`, `PGPORT`, `PGUSER`,
`PGPASSWORD`, `PGDATABASE` trong `.env`.

## Giới hạn

- Không tự publish hàng loạt.
- Không download ảnh/file nguồn ở phiên bản hiện tại.
- Có retry/backoff, timeout connect/read và giới hạn số trang.
- Nếu website thật timeout hoặc bị chặn, crawler vẫn ghi report và có thể chạy
  bằng local sample.
