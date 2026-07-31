# CI/CD và release deployment

## Quality gate

Workflow `.github/workflows/ci.yml` chạy khi push `main`/`develop`, pull request
và manual dispatch:

1. Cài dependency đúng lockfile bằng `npm ci`.
2. Audit production dependencies.
3. Dựng PostgreSQL 18.4 và chạy toàn bộ migration/seed.
4. Chạy backend `npm run quality`.
5. Build frontend với API base `/api`.
6. Build backend, frontend và hardened PostgreSQL images.
7. Chặn image có vulnerability HIGH/CRITICAL bằng Trivy.
8. Khi push `main`, push image gắn full commit SHA lên GHCR.
9. Lưu `release-manifest.json` làm artifact 30 ngày.

GitHub branch protection phải yêu cầu hai checks:

- `Backend quality and migration contract`
- `Frontend build and dependency audit`

Không bật tùy chọn bỏ qua checks cho administrator.

## Image naming

Với repository `OWNER/REPOSITORY` và commit `SHA`:

```text
ghcr.io/owner/repository-backend:SHA
ghcr.io/owner/repository-frontend:SHA
ghcr.io/owner/repository-postgres:SHA
```

Tag SHA là immutable release identifier. Không deploy bằng `latest`.

## Runner và GitHub environments

Workflow `.github/workflows/deploy.yml` yêu cầu hai self-hosted Linux runners:

- labels `self-hosted`, `linux`, `staging`
- labels `self-hosted`, `linux`, `production`

Mỗi GitHub Environment cần:

- secret `DEPLOY_ENV_FILE`: absolute path tới env file nằm ngoài repository;
- variable `APP_URL`: HTTPS origin của environment.
- variable `DEPLOY_STATE_ROOT`: absolute path nằm ngoài Actions checkout, ví dụ
  `/var/lib/thpt-pct-pt/deploy-state`.

Environment `production` phải có required reviewers. Staging tự deploy sau khi
Quality Gate của `main` pass; production chỉ deploy bằng manual dispatch.

Runner cần Docker Compose v2, quyền đọc GHCR package và quyền ghi thư mục
`DEPLOY_STATE_ROOT`. Env file chứa database/JWT secrets và `POSTGRES_IMAGE` đã
được phê duyệt. App deployment chỉ đổi backend/frontend images.

Self-hosted runner phải dùng GitHub Actions Runner `2.327.1` trở lên vì các
official actions trong workflow chạy trên Node.js 24.

## Deploy và rollback

`tools/deploy-release.sh`:

- xác thực full 40-character commit SHA;
- tạo release env chỉ chứa immutable backend/frontend image refs;
- pull images, chạy Compose với `--no-build`;
- backend entrypoint chạy migration dưới PostgreSQL advisory lock;
- ghi current/previous release state.

Release state không nằm trong checkout. Nếu `DEPLOY_STATE_ROOT` không được cấu
hình, script dùng `${XDG_STATE_HOME:-$HOME/.local/state}/thpt-pct-pt`. Thư mục
này phải nằm trên persistent disk và được backup cùng deployment metadata;
`actions/checkout` có thể dọn toàn bộ file không được Git theo dõi trong
workspace ở mỗi run.

`tools/smoke-deployment.sh` kiểm tra portal, `/api/health` và
`/api/health/db`.

`tools/rollback-release.sh` đổi về backend/frontend release trước. Script không
rollback database. Mọi migration production phải backward-compatible ít nhất
một app release; destructive schema cleanup chỉ được làm ở release sau khi bản
cũ không còn khả năng rollback.

## Manual dispatch

Trong workflow `Deploy Release`:

- `target=staging`, `action=deploy`, nhập full commit SHA để redeploy;
- `target=production`, `action=deploy`, nhập SHA đã smoke ở staging;
- chọn `action=rollback` để quay về release trước, không cần SHA.

Nếu smoke sau deploy thất bại, workflow tự gọi rollback. Lần deploy đầu tiên
chưa có previous release nên không thể rollback tự động.

## Phần cấu hình ngoài repository

Source code không thể tự bật branch protection, đăng ký self-hosted runner hoặc
gán production reviewers. Các bước này phải được cấu hình trong GitHub
repository/environment trước khi coi staging/production gate là hoàn thành.
