# PostgreSQL backup and restore runbook

## Muc tieu van hanh

- RPO v1: toi da 24 gio cho database va uploads.
- RTO v1: 4 gio ke tu luc xac nhan su co va chon recovery point.
- Daily backup luc 02:15 theo gio Viet Nam, giu toi thieu 30 ngay.
- Weekly restore drill luc 03:00 Chu nhat theo gio Viet Nam.
- Backup production phai nam tren persistent encrypted storage va duoc replicate
  sang mot failure domain khac. Thu muc tren cung mot may chi la ban sao tam.

Workflow `.github/workflows/backup.yml` chay tren runner co labels
`self-hosted`, `linux`, `production`. GitHub Environment `production-backup`
khong can production deploy approval hang ngay, nhung chi duoc phep chay tu `main`
va chi cap secret backup toi runner production.

## Dinh dang backup

Moi backup la mot thu muc `backup-<UTC timestamp>` gom:

- `database.dump.enc`: PostgreSQL custom dump ma hoa.
- `uploads.tar.gz.enc`: public/private uploads ma hoa.
- `manifest.json`: commit, thoi gian, row counts, artifact size va checksum.
- `SHA256SUMS`: SHA-256 cua artifacts va manifest.

Backend duoc pause trong luc tao database dump va upload archive. Frontend van
phuc vu static content, nhung API tam ngung trong vai giay. Script luon unpause
backend trong `finally`, ke ca khi backup loi.

Ma hoa dung AES-256-GCM voi key 32 byte base64 trong
`BACKUP_ENCRYPTION_KEY`. Key khong duoc dat trong `.env.docker`, source, log,
manifest hoac cung storage voi backup. Mat key dong nghia khong the restore.

Tao key:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes)
```

## Backup local

Docker stack phai dang chay va healthy:

```powershell
$env:BACKUP_ENCRYPTION_KEY="<base64-32-byte-key>"
node tools/backup-postgres.mjs `
  --env-file .env.docker `
  --output-dir backups/local `
  --retention-days 30
```

Script chi xoa cac thu muc `backup-*` cu co `manifest.json` hop le nam ben trong
`--output-dir`. Khong dung `--allow-plaintext` cho staging/production.

## Verify va restore drill

Chi verify checksum, authentication tag, pg_dump catalog va upload archive:

```powershell
node tools/restore-postgres.mjs `
  --backup-dir "<backup-directory>" `
  --env-file .env.docker `
  --verify-only
```

Restore vao database co lap, so sanh row counts va xoa sau khi pass:

```powershell
node tools/restore-postgres.mjs `
  --backup-dir "<backup-directory>" `
  --env-file .env.docker `
  --target-db thpt_pct_restore_drill `
  --drop-target-after-verify
```

Restore drill khong ghi de upload volumes. Upload archive van duoc giai ma va
kiem tra bang `tar -tzf`.

## In-place disaster restore

In-place restore la thao tac pha huy. Truoc khi chay:

1. Dung traffic vao portal va xac nhan backup recovery point.
2. Tao snapshot hien tai neu storage con truy cap duoc.
3. Kiem tra `manifest.json`, checksum va encryption key.
4. Dat `RESTORE_CONFIRM_DATABASE` dung ten database.
5. Chay voi `--allow-in-place`; chi them `--restore-uploads` khi database va
   upload archive chac chan cung recovery point.

```powershell
$env:RESTORE_CONFIRM_DATABASE="thpt_pct_pt"
node tools/restore-postgres.mjs `
  --backup-dir "<backup-directory>" `
  --env-file .env.docker `
  --target-db thpt_pct_pt `
  --allow-in-place `
  --restore-uploads
```

Script terminate database sessions, recreate database, restore dump, verify row
counts va unpause backend. Database migrations khong duoc rollback rieng; release
schema phai backward-compatible theo CI/CD runbook.

## GitHub configuration

Environment `production-backup` can:

- Secret `BACKUP_ENV_B64`: `.env.docker` production da base64.
- Secret `BACKUP_ENCRYPTION_KEY`: key 32 byte base64.
- Variable `BACKUP_ROOT`: absolute persistent path, vi du
  `/var/lib/thpt-pct-pt/backups`.
- Variable `BACKUP_RETENTION_DAYS`: mac dinh `30`.
- Variable `DEPLOY_PROJECT_NAME`: mac dinh `thpt-pct-pt-production`.

Runner can Docker Compose v2, Node.js 22+, quyen doc/ghi `BACKUP_ROOT` va quyen
truy cap containers production. Storage host phai replicate backup offsite; day
la external gate, khong duoc thay bang GitHub artifact vi du lieu co PII.

## Monitoring va incident

- GitHub Actions failure la alert backup v1; owner van hanh phai bat notification
  cho workflow `PostgreSQL Backup and Restore Drill`.
- Bao dong neu khong co backup thanh cong trong 26 gio, disk con duoi 20%, checksum
  fail hoac weekly restore drill fail.
- Khong xoa backup cu khi backup moi/verify chua pass.
- Moi quy phai drill restore tren ha tang staging va ghi thoi gian RPO/RTO thuc te.

## Gioi han hien tai

- Scheduled workflow chi chay sau khi co runner production va Environment secrets.
- Chua tich hop provider object storage cu the; production owner phai cau hinh
  encrypted offsite replication cua `BACKUP_ROOT`.
- Row-count verification phat hien mat du lieu quy mo bang, khong thay the domain
  reconciliation chi tiet cho diem, chuyen can va tep dinh kem.
