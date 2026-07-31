# Docker Deployment

## Thành phần

Stack gồm:

- `frontend`: React build tĩnh, phục vụ bằng Nginx unprivileged tại cổng 8080.
- `backend`: Node.js production, non-root, migration trước khi start.
- `postgres`: PostgreSQL 18.4 hardened từ official Alpine image, dùng named
  volume. Image chạy security upgrade và thay `gosu` bằng `su-exec` để loại
  binary Go không cần thiết khỏi runtime.

Nginx proxy `/api` và `/uploads` sang backend. Trình duyệt chỉ cần dùng cùng
origin với frontend nên không hardcode host backend trong bundle.

## Chuẩn bị

Yêu cầu Docker Desktop hoặc Docker Engine có Compose v2.

```powershell
cd D:\THPT-PCT-PT
Copy-Item .env.docker.example .env.docker
```

Mở `.env.docker` và bắt buộc điền:

```env
POSTGRES_PASSWORD=<strong-random-password>
JWT_SECRET=<random-secret-at-least-32-characters>
```

Có thể sinh JWT secret bằng PowerShell:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Không commit `.env.docker`.

## Khởi chạy local

```powershell
docker compose --env-file .env.docker config
docker compose --env-file .env.docker build --pull
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
```

Địa chỉ mặc định:

- Portal: `http://localhost:8080`
- Backend trực tiếp: `http://localhost:4000/api/health`
- PostgreSQL host: `localhost:55432`
- API qua Nginx: `http://localhost:8080/api/health`

`FRONTEND_BIND_ADDRESS` mặc định là `127.0.0.1` để stack local không tự mở
portal ra toàn mạng. Khi đặt sau reverse proxy production, cấu hình địa chỉ bind
theo network topology thực tế; không đổi thành `0.0.0.0` nếu chưa có firewall
và TLS termination.

Backend entrypoint chạy migration và seed có ledger/checksum trước khi start.
Nhiều lần restart sẽ skip file đã áp dụng.

## Kiểm tra tự động

```powershell
powershell -ExecutionPolicy Bypass -File tools/verify-docker.ps1
```

Script kiểm tra:

- Compose config và clean image build.
- Migrate/start/health frontend, backend và proxy.
- Backend chạy non-root.
- Migration ledger tồn tại.
- Upload volume còn dữ liệu sau restart.
- Trivy scan image nếu Trivy đã cài.

Local chưa cài Trivy có thể kiểm tra tạm:

```powershell
powershell -ExecutionPolicy Bypass -File tools/verify-docker.ps1 -SkipImageScan
```

Không được dùng `-SkipImageScan` cho release production.

## Volume

| Volume | Mount | Nội dung |
|---|---|---|
| `postgres_data` | `/var/lib/postgresql` | PostgreSQL 18 data root |
| `public_uploads` | `/app/backend/uploads` | Media public |
| `private_uploads` | `/app/backend/private-uploads` | Attachment riêng tư |

Không dùng `docker compose down -v` trên môi trường có dữ liệu cần giữ.

Backup/restore chính thức được thực hiện ở Task 6.5, không dùng việc copy trực
tiếp thư mục volume như một chiến lược backup.

## Logs và vận hành

```powershell
docker compose --env-file .env.docker logs -f backend
docker compose --env-file .env.docker logs -f frontend
docker compose --env-file .env.docker restart backend
docker compose --env-file .env.docker down
```

Backend nhận `SIGTERM`, dừng nhận request và đóng PostgreSQL pool trong tối đa
10 giây.

## Staging/production

- Đặt `APP_ORIGIN` thành HTTPS origin thật trước khi build.
- Chỉ expose frontend qua load balancer/reverse proxy.
- Backend và PostgreSQL hiện bind host loopback; không mở public.
- Secret phải lấy từ secret manager hoặc deployment environment.
- Pin image theo digest sau khi CI scan ở Task 6.3.
- Khi chạy nhiều backend instance, chuyển rate-limit store sang shared Redis
  theo finding SEC-008.
- Upload local named volume phù hợp single-host. Multi-host phải chuyển object
  storage trước khi scale ngang.

## Giới hạn xác minh hiện tại

Host audit ngày 2026-07-30 chưa cài Docker, Podman, Trivy hoặc công cụ container
khác. Source build đã pass nhưng clean image build, runtime compose, volume
restart và image scan phải được chạy lại trên host có Docker trước khi đánh dấu
Task 6.2 hoàn thành.
