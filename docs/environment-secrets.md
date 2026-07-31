# Environment và secrets management

## Nguyên tắc

- Không commit `.env`, credential, private key hoặc token. Chỉ commit file
  `.env.example` không có giá trị thật.
- Backend đọc cấu hình qua `backend/src/config/env.ts`; staging/production
  fail-fast trước khi mở HTTP server nếu thiếu secret hoặc dùng placeholder.
- Public URL/CORS từ xa phải dùng HTTPS; PostgreSQL từ xa phải bật SSL. Chỉ
  loopback và Compose service `postgres` được miễn để phục vụ local development.
- Frontend chỉ được dùng `VITE_API_BASE_URL` và `VITE_PUBLIC_SITE_URL` vì mọi
  biến `VITE_*` đều được đóng vào bundle và là dữ liệu public.
- Secret staging/production nằm trong GitHub Environment hoặc secret manager
  của nền tảng, không nằm trong image, release manifest hay Actions artifact.
- Không ghi giá trị secret vào log, command line, issue hoặc tài liệu.

## Phân loại cấu hình

| Nhóm | Ví dụ | Nơi lưu |
| --- | --- | --- |
| Public frontend | `VITE_API_BASE_URL`, `VITE_PUBLIC_SITE_URL` | build args/variables |
| Backend config | `APP_ENV`, `LOG_LEVEL`, pool/rate limits | environment variables |
| Backend secret | `JWT_SECRET`, `JWT_PREVIOUS_SECRETS`, database password | environment secrets |
| Deploy config | `APP_URL`, `DEPLOY_STATE_ROOT` | GitHub Environment variables |
| Deploy secret | toàn bộ env runtime đã base64 | `DEPLOY_ENV_B64` environment secret |

Base64 chỉ là định dạng vận chuyển, không phải mã hóa. GitHub Environment
protection và quyền repository mới là ranh giới bảo mật.

## Development

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Thay `JWT_SECRET` bằng chuỗi ngẫu nhiên tối thiểu 32 ký tự và cấu hình PostgreSQL
local. Kiểm tra contract mà không in secret:

```powershell
cd backend
npm run config:check
```

Docker local dùng `.env.docker.example` làm mẫu. `.env.docker` bị Git ignore.

## Staging và production

Mỗi GitHub Environment cần:

- secret `DEPLOY_ENV_B64`;
- variable `APP_URL` là HTTPS origin;
- variable `DEPLOY_STATE_ROOT` là absolute path trên persistent disk.

Tạo env runtime ở máy quản trị, đặt quyền chỉ owner đọc, rồi chuyển thẳng vào
GitHub CLI mà không in nội dung:

```bash
chmod 600 /secure/thpt-pct-pt/staging.env
base64 -w0 /secure/thpt-pct-pt/staging.env |
  gh secret set DEPLOY_ENV_B64 --env staging
```

Workflow giải mã secret vào `$RUNNER_TEMP`, đặt umask `077`, truyền path cho
Compose và xóa file ở bước `always()`. Production Environment phải có required
reviewer trước khi secret được cấp cho job.

## Rotation JWT không downtime

1. Tạo secret mới bằng CSPRNG, tối thiểu 32 byte; không tái sử dụng secret cũ.
2. Đặt secret mới vào `JWT_SECRET`, đặt secret hiện tại vào
   `JWT_PREVIOUS_SECRETS`, rồi rolling deploy. Token mới ký bằng khóa mới; token
   access cũ vẫn verify bằng danh sách khóa cũ.
3. Chờ ít nhất `JWT_EXPIRES_IN` cộng clock skew và xác nhận error rate auth ổn.
4. Xóa khóa cũ khỏi `JWT_PREVIOUS_SECRETS`, cập nhật Environment secret và
   rolling deploy lần hai.

Refresh token là chuỗi opaque được hash trong database nên không phụ thuộc JWT
signing key. Nếu nghi ngờ lộ secret, bỏ qua giai đoạn tương thích, xóa khóa cũ và
revoke toàn bộ refresh sessions; việc này chủ động đăng xuất user.

## Rotation PostgreSQL

Không đổi password của cùng một role trước khi app mới nhận secret. Quy trình an
toàn là tạo role đăng nhập mới, cấp đúng quyền schema/database, cập nhật runtime
secret và rolling deploy, kiểm tra connection/error rate, sau đó revoke và xóa
role cũ. Với managed PostgreSQL, dùng cơ chế dual credential của nhà cung cấp nếu
có. Không ghi connection URL vào log.

## Kiểm tra và incident

- `npm run test:env-security`: unsafe/missing config phải fail và JWT rotation
  phải verify được token cũ.
- `node tools/check-secret-leaks.mjs`: scan file Git theo dõi, không in giá trị.
- Frontend CI scan bundle để chặn marker secret backend.
- CI inspect image metadata để chặn secret runtime bị đóng vào image.
- Khi lộ secret: revoke/rotate ngay, kiểm tra audit log và Git history; xóa khỏi
  commit không đủ vì secret đã phải được xem là compromised.
