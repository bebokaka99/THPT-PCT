# So dau bai dien tu v1

## Muc dich

So dau bai ghi nhan tiet day thuc te theo timetable da cong bo va daily override
da duoc publish. Du lieu nay phuc vu giao vien, GVCN va admin; khong phai public
content va khong hien thi cho student/guardian trong v1.

## API

Tat ca endpoint can Bearer token.

- `GET /api/class-journals/options?date=YYYY-MM-DD`: teacher lay cac tiet hieu luc
  trong ngay de tao journal.
- `GET /api/class-journals?page=1&limit=20&from=&to=&classroom_id=&semester_id=&status=`:
  teacher xem pham vi cua minh, admin/reviewer xem danh sach.
- `POST /api/class-journals`: teacher tao journal cho tiet cua minh.
- `GET /api/class-journals/:id`: teacher owner hoac reviewer xem chi tiet.
- `PATCH /api/class-journals/:id`: teacher owner cap nhat; admin correction phai co
  `correction_reason`.
- `GET /api/class-journals/:id/audit`: admin/reviewer xem lich su chinh sua.
- `GET /api/class-journals/report?from=YYYY-MM-DD&to=YYYY-MM-DD&classroom_id=&semester_id=`:
  reviewer/admin xem tong hop tiet du kien, da ghi, con thieu, hoan thanh, draft,
  cancelled va substitute.

## Payload tao/cap nhat

```json
{
  "timetable_item_id": 123,
  "journal_date": "2026-08-03",
  "attendance_session_id": null,
  "lesson_content": "On tap ham so bac hai",
  "class_comment": "Lop tham gia day du",
  "progress_note": "Hoan thanh muc 2",
  "homework": "Bai 4, 5 trang 42",
  "status": "completed",
  "correction_reason": "Chi dung cho admin correction"
}
```

`status` nhan `draft`, `completed` hoac `cancelled`. `attendance_session_id` neu co
phai dung lop, mon, hoc ky, ngay va tiet cua journal.

## Phan quyen

- `class_journals.manage`: teacher tao/sua journal tiet minh; admin co quyen mac dinh.
- `class_journals.review`: reviewer/admin doc danh sach, chi tiet va report.
- `class_journals.correct`: admin correction journal; backend bat buoc ly do.
- Student va guardian khong co route journal de tranh lo nhan xet noi bo.

## Kiem tra local

```powershell
$env:DATABASE_URL="postgresql://..."
cd backend
npm run db:setup
npm run build
npm run test:class-journals
```

Smoke test tao du lieu tam, kiem tra duplicate, teacher scope, student denial,
substitute ownership, admin correction/audit va report; sau do tu don dep.

## Gioi han

- Teacher UI chua chon attendance session hien co trong form; API da co validation.
- Chua co reviewer theo bo mon/khoi lop.
- Report chua tu dong suy ra lich nghi ngoai cac du lieu academic calendar va daily
  schedule override da cong bo.
