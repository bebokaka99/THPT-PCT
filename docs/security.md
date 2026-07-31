# Security baseline

Tài liệu này mô tả baseline bảo mật đang được áp dụng cho backend
THPT-PCT-PT. Báo cáo audit chi tiết nằm tại
[`security-privacy-audit.md`](security-privacy-audit.md).

## HTTP và network

- Helmet được bật toàn cục; `X-Powered-By` bị tắt.
- CORS chỉ chấp nhận origin trong `CORS_ORIGINS`.
- JSON body mặc định giới hạn `1mb`.
- API, login và upload có rate limit riêng.
- Request có `X-Request-Id`; log chỉ ghi path, không ghi query string.
- Static upload từ chối dotfile, directory index và gửi
  `X-Content-Type-Options: nosniff`.
- Khi dùng PostgreSQL TLS, mặc định production xác minh certificate.
  Chỉ đặt `PGSSL_REJECT_UNAUTHORIZED=false` khi hạ tầng có ngoại lệ được phê
  duyệt.

Rate limiter hiện dùng memory store. Trước khi chạy nhiều backend instance,
Task 6.6 phải chuyển sang shared store như Redis.

## Authentication và session

- Access token JWT mặc định sống `15m`.
- Refresh token là chuỗi ngẫu nhiên, chỉ lưu hash trong database.
- Refresh cookie dùng `HttpOnly`, `SameSite=Strict`; production bật `Secure`.
- Login, refresh và logout trả `Cache-Control: no-store`.
- Refresh token được rotation sau mỗi lần refresh và bị revoke khi logout.
- Tất cả refresh session của user bị revoke khi password, role hoặc status đổi.
- `inactive` và `locked` user không thể login hoặc tiếp tục dùng access token.
- Production từ chối JWT secret mẫu hoặc secret ngắn hơn 32 ký tự.

## Password

- Tài khoản tạo thủ công yêu cầu tối thiểu 10 ký tự, có chữ và số.
- Password luôn được hash bằng bcrypt, không trả `password_hash` qua API.
- Tài khoản học sinh tạo hàng loạt là ngoại lệ nghiệp vụ hiện tại: mật khẩu số
  được sinh theo quy tắc nhà trường và phải đổi khi triển khai luồng first
  login ở task tương lai.

## Input, SQL và XSS

- Validation chạy trước service/repository.
- Query nghiệp vụ dùng placeholder parameterized trong repository.
- DDL và seed chỉ nằm trong `database/postgresql`.
- HTML bài viết/importer được sanitize ở backend.
- Frontend sanitize lại trước khi dùng `dangerouslySetInnerHTML`.
- Không log request body, Authorization header, cookie hoặc token.

## Upload

- Multer dùng memory storage, giới hạn 10 MB cho media và 5 MB cho avatar.
- Chỉ nhận JPG/JPEG/PNG/WebP/PDF/DOC/DOCX/XLS/XLSX.
- Ảnh được `sharp` đọc thật trước khi ghi file.
- PDF và Office được kiểm tra magic bytes, không chỉ tin MIME/extension.
- Tên file lưu được tạo lại bằng UUID; đường dẫn xóa phải nằm trong
  `backend/uploads`.

Object storage, antivirus/malware scanning và private signed URL chưa có. Đây
là điều kiện phải giải quyết trước khi cho nguồn không tin cậy upload trực tiếp
ở production.

## Logging và lỗi

- Pino tự redact password, token, Authorization và cookie.
- Query string không xuất hiện trong request/error log.
- Production không trả hoặc log raw message của lỗi 500 không xác định.
- Client nhận `requestId` để đối chiếu sự cố.

## Environment production tối thiểu

```env
NODE_ENV=production
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_DAYS=7
CORS_ORIGINS=https://school.example.vn
TRUST_PROXY_HOPS=1
PGSSLMODE=require
PGSSL_REJECT_UNAUTHORIZED=true
```

Không dùng secret trong `.env.example`. Secret production phải được cấp từ
secret manager và rotation theo Task 6.4.

## Kiểm tra

```powershell
cd D:\THPT-PCT-PT\backend
npm run test:security-privacy
npm run quality
npm audit --omit=dev

cd D:\THPT-PCT-PT\frontend
npm run build
npm audit --omit=dev
```

Frontend hiện là SPA, không dùng React Server Components hay server actions.
Advisory RSC còn được npm gắn cho React Router phải tiếp tục được theo dõi và
không được bật RSC cho tới khi upstream có bản vá phù hợp.
