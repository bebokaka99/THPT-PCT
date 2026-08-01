# Load test harness

`tools/load-test.mjs` su dung Node.js native `fetch` va `FormData`, khong can
package moi. Mac dinh chi chay read mix tren public API, an toan de chay local.

## Read baseline

```powershell
$env:LOAD_TEST_BASE_URL='http://127.0.0.1:4000/api'
$env:LOAD_TEST_CONCURRENCY='5'
$env:LOAD_TEST_REQUESTS='60'
$env:LOAD_TEST_REPORT_PATH='tools/load-tests/reports/local-read.json'
node tools/load-test.mjs
```

Scenario read gom liveness/readiness, categories, published posts/documents va
search. Ket qua co p50/p95/p99, status distribution va error rate.

## Authenticated reads

Chi dung account staging/test, khong dung password production trong shell history:

```powershell
$env:LOAD_TEST_IDENTIFIER='teacher-loadtest@pct.local'
$env:LOAD_TEST_PASSWORD='<staging-password>'
$env:LOAD_TEST_AUTH_ROUTES='/notifications/me?limit=10,/gradebooks?limit=10&status=draft'
node tools/load-test.mjs --requests 60 --concurrency 5
```

## Write scenarios

Write test mac dinh tat. Chi bat tren database fixture/staging rieng:

```powershell
$env:LOAD_TEST_ALLOW_WRITES='true'
$env:LOAD_TEST_WRITE_REQUESTS='5'
$env:LOAD_TEST_GRADEBOOK_ID='<dedicated-draft-gradebook-id>'
$env:LOAD_TEST_GRADEBOOK_ENTRIES='[{"student_user_id":123,"column_id":456,"state":"scored","score":"8","expected_version":0}]'
node tools/load-test.mjs --writes true
```

Upload test tao PNG 1x1, upload song song va xoa cac media record da tao. Gradebook
test co the tao HTTP 409 optimistic-lock conflict khi nhieu request ghi cung mot
entry; day la ket qua mong doi, khong phai data corruption. Khong chay write test
tren production. Fixture phai duoc tao rieng va cleanup sau drill.

## SLO baseline

Default gate la p95 <= 750 ms va unexpected error rate <= 1%. Day la target
baseline cho local/staging, khong tu dong la production SLO. Staging phai ghi lai
concurrency, dataset size, image/CPU/memory, DB pool va request mix cung report
JSON de so sanh truoc/sau khi tune.

## Gioi han

- Harness khong mo phong CDN, multi-region, browser rendering hay WebSocket.
- Khong co full-text/SQL query planner benchmark trong script; dung `EXPLAIN`
  co phe duyet rieng tren staging.
- Khong co write fixture tu dong vi grading data can owner nghiep vu phe duyet.
