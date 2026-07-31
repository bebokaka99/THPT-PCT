# THPT-PCT-PT

School portal cho THPT Phan Chu Trinh - Phan Thiết, gồm public website và portal
theo vai trò admin, giáo viên, học sinh và phụ huynh.

## Tech stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Backend: Node.js 22, Express, TypeScript
- Database: PostgreSQL 18
- Auth: JWT access token và rotating refresh cookie
- Runtime production: Docker Compose, Nginx unprivileged

PostgreSQL là database canonical. Project không phụ thuộc MySQL hoặc XAMPP.

## Cấu trúc

```text
THPT-PCT-PT/
├─ frontend/
├─ backend/
├─ database/postgresql/
├─ docs/
├─ tools/
├─ docker-compose.yml
└─ README.md
```

## Chạy development

Database:

```powershell
Copy-Item .env.docker.example .env.docker
# Điền POSTGRES_PASSWORD và JWT_SECRET trong .env.docker
docker compose --env-file .env.docker up -d postgres
```

Hoặc dùng PostgreSQL native và cấu hình `backend/.env`.

Backend:

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run db:setup
npm run dev
```

Frontend:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Mặc định:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health: `http://localhost:4000/api/health`

## Chạy toàn bộ bằng Docker

```powershell
Copy-Item .env.docker.example .env.docker
# Điền POSTGRES_PASSWORD và JWT_SECRET trong .env.docker
docker compose --env-file .env.docker build --pull
docker compose --env-file .env.docker up -d
```

Portal chạy tại `http://localhost:8080`. Hướng dẫn và verification script:
[`docs/docker-deployment.md`](docs/docker-deployment.md).

## Quality gate

```powershell
cd backend
npm run quality

cd ..\frontend
npm run build
```

Workflow phát triển nằm tại [`docs/workflow/WORKFLOW.md`](docs/workflow/WORKFLOW.md).
