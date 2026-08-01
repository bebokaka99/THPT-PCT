# Load va Performance Test

## Nguyen tac

- Khong load test production neu chua co phe duyet va cua so bao tri.
- Chay tren staging/fixture co dataset gan quy mo truong: user, lop, enrollment,
  teaching assignment, posts, documents, media va gradebook.
- Moi report phai ghi commit SHA, image digest, concurrency, request mix, DB pool,
  CPU/memory va ket qua p50/p95/p99.
- Write test phai idempotent/isolated; 409 optimistic-lock conflict la ket qua
  hop le khi test concurrent gradebook save.

## Cong cu

`node tools/load-test.mjs` khong them dependency. Runbook chi tiet tai
`tools/load-tests/README.md`.

Workflow manual `.github/workflows/performance.yml` chay tren runner labels
`self-hosted`, `linux`, `staging` va Environment `staging-performance`. Owner
phai dat `PERFORMANCE_TARGET_APPROVED=true`, `PERFORMANCE_BASE_URL` la HTTPS
ket thuc `/api`, va secrets identity neu bat authenticated mode. Workflow chi
chay read baseline; write drill van phai chay co giam sat tren fixture rieng.

## Baseline/SLO v1

- Read mix p95 <= 750 ms tren local/staging.
- Unexpected error rate <= 1%; 429 do rate limit phai duoc tach va ghi ro.
- Readiness fail, DB pool exhaustion, 5xx va p95 vuot target phai tao incident
  note, khong bo qua de lam pass.

Day la gate ky thuat ban dau. Product owner can chot target production theo so
nguoi dung dong thoi, dac biet dau nam hoc va gio nhap diem.

## Kich ban

1. Public read: homepage API, posts, documents, categories, search.
2. Authenticated read: auth/me, notifications va portal queries theo role.
3. Gradebook save: fixture gradebook draft, optimistic locking, no data corruption.
4. Upload: media PNG nho, cleanup record/file sau test.
5. Spike: tang concurrency tung buoc tren staging, theo doi p95, 5xx, pool
   waiting, CPU/memory va disk.

## Ket qua source/local

Docker local 2026-08-01:

- public read mix: 60 request, concurrency 5, p95 82.95 ms, error 0%;
- authenticated read mix: 30 request, concurrency 5, p95 115.1 ms, error 0%;
- login: 2 request, p95 257.74 ms, error 0%;
- media upload: 5 request, p95 195.62 ms, cleanup failure 0;
- sau test PostgreSQL pool waiting = 0, 5xx trong cua so 5 phut = 0;
- record/file `load-test-*` con lai trong DB/filesystem = 0.

Lan authenticated run dau tien bi 429 vi chay ngay sau batch 60 request trong
cung rate-limit window. Sau khi window reset, cung kich ban pass. 429 duoc giu
trong report nhu mot capacity/security signal, khong bi doi thanh success.

Chua danh dau production performance pass vi chua co staging dataset/runner va
gradebook write fixture duoc owner phe duyet. Do phan local runtime khong thay
the benchmark production.

## Gioi han va buoc tiep theo

- Chua co baseline staging that, query plan review va capacity limit cho school
  peak.
- Chua chot CDN/object storage benchmark.
- Task sau khi co report la tune query/index/pool/cache co so lieu, sau do rerun
  cung request mix va fixture de so sanh.
