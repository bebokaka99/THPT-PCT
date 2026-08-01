# Observability va Operations

## Muc tieu

Task 6.6 cung cap logging co cau truc, request trace, health checks, metrics API
khong PII va mot trang admin de xem tinh trang runtime. Du lieu metrics trong
process chi phuc vu troubleshooting ngan han; production van can log/alert
backend ben ngoai.

## Health checks

- `GET /api/health/live`: liveness, khong truy cap database. Dung cho container
  restart/orchestrator.
- `GET /api/health/ready`: readiness, kiem tra database voi timeout 3 giay. Tra
  `200` khi san sang va `503` khi database khong san sang.
- `GET /api/health/db`: endpoint tuong thich legacy, van tra
  `{ "status": "ok", "database": "connected" }` khi pass.
- Moi response co `X-Request-Id`; co the gui request ID hop le de trace qua
  proxy/backend.

Uptime monitor nen goi `/api/health/live` moi 30 giay va `/api/health/ready` moi
60 giay. Canh bao sau 3 lan fail lien tiep, khong can alert cho mot lan fail
don le.

## Admin operations

Admin dang nhap mo `/admin/system-health`, hoac goi:

```text
GET /api/operations/health
```

Endpoint can role `admin` va khong tra password, token, email, ten, noi dung
nghiep vu hay environment secret. No tra process uptime/memory, PostgreSQL pool,
upload file count/size, request status count, average/max va p95 latency trong
5 phut, cung toi da 25 loi ky thuat gan day. Loi ky thuat chi gom request ID,
route, HTTP status va error name.

## Alert contract

Owner van hanh phai tao alert ben ngoai theo cac tin hieu sau:

- readiness fail 3 lan lien tiep hoac database disconnected: critical;
- p95 latency tren 1,000 ms trong 5 phut: warning, tren 3,000 ms: critical;
- 5xx tang lien tuc trong 5 phut: warning, can xem route va request ID;
- PostgreSQL pool `waiting > 0` trong 2 phut: warning;
- disk host duoi 20% hoac upload storage tang dot bien: warning;
- khong co backup thanh cong trong 26 gio, checksum fail hoac restore drill fail:
  critical theo runbook backup.

Dashboard chi la kenh quan sat phu; alert phai den tu GitHub Actions, reverse
proxy, log aggregation hoac monitoring provider. Khong dua secret vao alert
body.

## Synthetic failure drill

Endpoint admin:

```text
POST /api/operations/synthetic-failure
```

`OPERATIONS_SYNTHETIC_FAILURE_ENABLED` mac dinh bat o development/test va tat
o production. Khi bat, endpoint tra 503 co code
`SYNTHETIC_OPERATIONAL_FAILURE`, cho phep xac nhan request ID -> 5xx metric ->
alert. Chi chay trong cua so drill va tat lai ngay sau do. Khong dat endpoint
nay vao frontend public.

## Logging va retention

Backend dung Pino JSON trong production va pino-pretty o development. Request
logger bo query string, nhan/gioi han `X-Request-Id`, va log method/path/status/
duration. Redaction bao gom auth, cookie, token, password, body/payload/input
va cac truong PII pho bien.

Docker Compose gioi han stdout log moi service o 10 MB x 5 file. Production
phai forward stdout vao log storage co retention toi thieu 30 ngay, access
control va encryption. Khong dung database de luu raw request log.

## Error tracking

Hien tai error tracking v1 la structured log + bounded recent error snapshot
trong process. Chua tich hop Sentry/Datadog/Elastic cu the de tranh khoa chat
vao mot provider. Khi chon provider, chi forward error name, route, status,
request ID, release SHA va stack da redact; khong forward request body, token,
diem, chuyen can, thong tin phu huynh hay file content.

## Gioi han hien tai

- Metrics reset khi process restart va khong phai source of truth.
- Chua co distributed trace/metrics exporter, p50/p99 hay alert provider duoc
  verify tren production.
- Upload metric la file count/size, chua co quota theo tenant hay capacity API
  cua object storage.
- Production gates can owner cau hinh uptime monitor, log sink, alert routing
  va synthetic drill schedule.
