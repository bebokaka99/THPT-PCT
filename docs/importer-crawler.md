# Importer và Python Crawler

## Kiến trúc

- Crawler chạy độc lập bằng CLI Python.
- Frontend/backend không gọi trực tiếp website cũ.
- Dữ liệu crawl được lưu vào `imported_contents`.
- Admin kiểm tra và convert thủ công sang `posts`.
- Nội dung import mặc định không được auto publish hàng loạt.

## Cài Python environment

```powershell
cd tools\pct_crawler
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Dependencies chính:

- `requests`
- `beautifulsoup4`
- `lxml`
- `psycopg[binary]`
- `python-dotenv`

## Cấu hình database

Project dùng PostgreSQL, không phụ thuộc XAMPP:

```env
DATABASE_URL=postgresql://thpt_pct_pt:thpt_pct_pt_dev@localhost:55432/thpt_pct_pt
PGHOST=localhost
PGPORT=55432
PGUSER=thpt_pct_pt
PGPASSWORD=thpt_pct_pt_dev
PGDATABASE=thpt_pct_pt
```

Khởi động database và migration:

```powershell
docker compose up -d postgres
cd backend
npm run db:setup
npm run db:status
```

## Crawl website thật

```powershell
cd tools\pct_crawler
python crawl_pct.py
```

Crawler hỗ trợ nhiều entry URL, retry/backoff, timeout connect/read, user-agent
riêng và giới hạn số trang.

Khi `DRY_RUN=true`, preview nằm tại:

```text
tools/pct_crawler/output/pct_import_preview.json
```

Report fetch nằm tại:

```text
tools/pct_crawler/output/crawl_report.json
```

Nếu fetch được homepage, HTML debug nằm tại:

```text
tools/pct_crawler/output/debug_homepage.html
```

## Import local HTML/JSON

Đặt file vào `tools/pct_crawler/input/`:

```powershell
$env:LOCAL_INPUT_PATH="sample-post.html"
$env:DRY_RUN="true"
$env:IMPORT_TO_DB="false"
python crawl_pct.py
```

Local HTML được đọc bằng nhiều encoding, ưu tiên selector title/content và có
fallback từ `body`. Parser không đưa local Chrome path vào database.

## Import vào database

```powershell
$env:LOCAL_INPUT_PATH="sample-post.html"
$env:DRY_RUN="false"
$env:IMPORT_TO_DB="true"
python crawl_pct.py
```

Crawler upsert theo `source_url`, không ghi thẳng vào `posts`.

## Mở admin importer

1. Chạy backend và frontend.
2. Đăng nhập tài khoản admin.
3. Mở `/admin/importer`.
4. Xem chi tiết nội dung.
5. Chọn `Convert to post draft`.
6. Sửa nội dung tại admin posts rồi mới publish.

## Giới hạn hiện tại

- Chưa download ảnh/file từ website nguồn.
- Relative path hoặc Chrome-saved path không được dùng làm cover.
- Rate limit crawler là delay theo process, chưa có distributed scheduler.
- Crawler không có nút chạy từ admin UI.
