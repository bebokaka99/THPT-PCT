# Phát hành production, domain và TLS

## Kiến trúc public

Production dùng `docker-compose.yml` cùng `docker-compose.production.yml`.
Chỉ service `edge` (Caddy) mở cổng 80/443 ra ngoài. Caddy tự cấp, gia hạn chứng
chỉ TLS và chuyển HTTP sang HTTPS; frontend tiếp tục proxy `/api` và `/uploads`
qua mạng Docker nội bộ. Backend, frontend origin và PostgreSQL vẫn bind loopback
trên host để phục vụ vận hành, không được mở trực tiếp qua firewall.

Production override đặt `TRUST_PROXY_HOPS=2` vì request đi qua Caddy và Nginx
trước Express. Không đổi số hop nếu chưa thay network topology và chưa kiểm tra
lại IP dùng cho rate limit/audit log.

`deploy/Caddyfile` đặt HSTS cho đúng hostname portal nhưng chưa bật
`includeSubDomains`/preload. Chỉ bật hai tuỳ chọn này sau khi nhà trường xác nhận
mọi subdomain đều hỗ trợ HTTPS lâu dài.

Deploy script snapshot Caddyfile theo release vào persistent
`DEPLOY_STATE_ROOT/<environment>/releases`. Container không phụ thuộc vào Actions
checkout sau khi job kết thúc và rollback dùng lại đúng snapshot của release.

## Điều kiện hạ tầng

1. Tạo bản ghi DNS A/AAAA của hostname portal trỏ về edge host.
2. Mở inbound TCP 80/443 và UDP 443; chặn public access tới 4000, 5432/55432 và
   8080.
3. Docker Compose v2 và runner production phải dùng persistent disk cho
   PostgreSQL, uploads, Caddy data và release state.
4. GitHub Environment `production` phải có required reviewers và không cho
   deployment song song.
5. Chốt maintenance window, release owner, database owner và người có quyền
   quyết định rollback.

Không đổi nameserver hoặc bật proxy CDN ngay trong maintenance window. Nếu dùng
CDN, chạy TLS/DNS smoke trực tiếp với origin trước, sau đó mới bật proxy và chạy
lại toàn bộ readiness check.

## Production environment

Dùng `.env.production.example` làm danh sách khóa, không dùng giá trị mẫu làm
secret. File thật được mã hóa/base64 vào GitHub secret `DEPLOY_ENV_B64` và phải
có ít nhất:

- `APP_ENV=production`
- `APP_ORIGIN=https://<canonical-host>`
- `APP_DOMAIN=<canonical-host>`
- `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=strict`
- PostgreSQL password ngẫu nhiên từ 16 ký tự
- JWT secret ngẫu nhiên từ 32 ký tự
- immutable PostgreSQL image và exact Caddy image tag

Kiểm tra trước khi đưa vào GitHub:

```bash
node tools/check-production-config.mjs --env-file /secure/path/production.env
docker compose \
  --env-file /secure/path/production.env \
  -f docker-compose.yml \
  -f docker-compose.production.yml \
  config --quiet
```

CI còn gọi `tools/deploy-release.sh` với `DEPLOY_VALIDATE_ONLY=true` và state tạm
để kiểm tra chính production command assembly/Caddy snapshot mà không pull hoặc
khởi động service.

GitHub Environment variables:

- `APP_URL`: canonical HTTPS origin.
- `DEPLOY_STATE_ROOT`: absolute persistent release-state directory.
- `BACKUP_ROOT`: absolute encrypted backup directory trên persistent/offsite
  synchronized storage.

GitHub Environment secrets:

- `DEPLOY_ENV_B64`
- `BACKUP_ENCRYPTION_KEY`: base64 của đúng 32 random bytes
- `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD`
- `SMOKE_TEACHER_EMAIL`, `SMOKE_TEACHER_PASSWORD`
- `SMOKE_STUDENT_EMAIL`, `SMOKE_STUDENT_PASSWORD`

Ba smoke account phải là account production riêng, active, không dùng account cá
nhân. Teacher/student chỉ cần lớp test tối thiểu và không chứa dữ liệu học sinh
thật. Đổi password sau sự cố hoặc khi người vận hành rời dự án.

## Release sequence

1. Quality Gate và image scan pass trên đúng full commit SHA.
2. Deploy SHA đó lên staging; chạy smoke và performance evidence.
3. Xác nhận migration backward-compatible với app release trước.
4. Hạ TTL DNS trước release nếu đây là lần cutover đầu tiên.
5. Mở manual `Deploy Release`, chọn production/deploy và full SHA đã qua staging.
6. Workflow validate env, tạo encrypted backup rồi mới deploy.
7. Workflow chạy public health, TLS/header readiness và read-only role smoke.
8. Ghi release SHA, backup directory, người duyệt và kết quả vào change record.

Deploy script giả định production PostgreSQL/backend stack đã được bootstrap và
healthy, vì workflow phải backup dữ liệu trước khi đổi app release. Lần go-live
đầu tiên cần provisioning database, import dữ liệu được duyệt và tạo baseline
backup trước khi bấm production deploy; không bỏ qua backup chỉ vì chưa có release
state cũ.

Không chạy seed demo trên production. Backend entrypoint chỉ chạy migration/seed
đã thuộc contract hiện tại; trước go-live phải xác nhận production seed không tạo
demo user hoặc demo dữ liệu. Migration destructive phải tách sang release sau khi
app cũ không còn phụ thuộc schema cũ.

## Readiness và role smoke

Kiểm tra domain sau deploy:

```bash
node tools/check-production-readiness.mjs \
  --url https://portal.example.edu.vn \
  --report tools/release-reports/production-readiness.json
```

Checker xác minh DNS, certificate còn ít nhất 14 ngày, HTTP redirect, HSTS/CSP,
liveness, readiness và database. Role smoke chỉ đọc dữ liệu:

```bash
SMOKE_ADMIN_EMAIL=... SMOKE_ADMIN_PASSWORD=... \
SMOKE_TEACHER_EMAIL=... SMOKE_TEACHER_PASSWORD=... \
SMOKE_STUDENT_EMAIL=... SMOKE_STUDENT_PASSWORD=... \
node tools/smoke-role-access.mjs --base-url https://portal.example.edu.vn
```

Role smoke xác minh login/me, portal shell, API được phép và teacher/student nhận
403 từ users admin API. Nó không tạo/sửa dữ liệu nghiệp vụ; mỗi login tạo auth
session và tool bắt buộc logout để thu hồi session trong `finally`.

## Rollback

Workflow tự rollback app khi một gate sau deployment thất bại. Cờ
`DEPLOY_COMPLETED` ngăn rollback nhầm nếu config hoặc backup lỗi trước deploy.
Rollback thủ công:

```bash
bash tools/rollback-release.sh production /secure/path/production.env
```

Rollback chỉ đổi backend/frontend image và giữ Caddy edge. Nó không rollback
database. Nếu migration không backward-compatible, dừng release và dùng restore
runbook riêng; không tự ý chạy `down -v`, drop schema hoặc sửa migration cũ.

## Theo dõi sau release

Trong 24 giờ đầu, release owner phải theo dõi tối thiểu:

- readiness, 5xx, p95 latency, login 401/429 bất thường;
- PostgreSQL pool waiting, CPU/memory/disk và backup synchronization;
- Caddy certificate/renewal log và HTTP redirect;
- lỗi upload/download, notification và các workflow điểm/chuyên cần;
- phản hồi admin, giáo viên và học sinh theo kênh hỗ trợ đã công bố.

Chỉ đóng release sau khi có 24 giờ evidence, không có P0/P1 mở và backup mới được
xác minh. Nếu có P0, rollback app ngay khi schema còn tương thích; nếu không,
chuyển maintenance mode và kích hoạt incident runbook.

## Giới hạn hiện tại

Repository cung cấp cấu hình và automated gates nhưng không thể tự tạo DNS, mở
firewall, cấu hình GitHub Environment, cấp account production hay xác nhận 24 giờ
theo dõi. Các phần này cần bằng chứng từ hạ tầng thật trước khi Task 6.8 được đánh
dấu hoàn thành production.
