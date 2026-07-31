# Bai tap va bai nop

## Tong quan

Module `assignments` quan ly bai tap theo phan cong giang day. Bai tap khong
duoc gan truc tiep bang role hoac ten lop tu do; `teaching_assignment_id` la
nguon xac dinh teacher, classroom, subject va semester.

## Trang thai

- `draft`: teacher/admin duoc sua va xoa neu chua co submission.
- `published`: hoc sinh trong roster duoc xem va nop bai.
- `closed`: chi xem, khong nhan submission moi.
- Submission la `submitted`, `late` hoac `withdrawn`.

## Deadline va timezone

- `due_at`, `published_at`, `closed_at` va thoi diem nop dung PostgreSQL
  `TIMESTAMPTZ`.
- API nhan/tra ISO 8601.
- Backend la noi quyet dinh late, khong tin dong ho frontend.
- UI dinh dang theo locale `vi-VN`; moi truong production can thong nhat
  `Asia/Ho_Chi_Minh`.
- Sau deadline: reject neu `allow_late=false`; luu status `late` neu
  `allow_late=true`.

## File policy

- Multipart field: `file`.
- Toi da 10 MB.
- Cho phep: jpg, jpeg, png, webp, pdf, doc, docx, xls, xlsx.
- File duoc luu qua media pipeline hien co.
- Replace tao version moi, file cu giu lai va danh dau inactive.
- Transaction that bai se xoa media vua tao de tranh orphan.

## API

Tat ca route can JWT va permission tuong ung.

- `GET /api/assignments`
- `GET /api/assignments/:id`
- `POST /api/assignments`
- `PATCH /api/assignments/:id`
- `POST /api/assignments/:id/publish`
- `POST /api/assignments/:id/close`
- `DELETE /api/assignments/:id`
- `GET /api/assignments/:id/submissions`
- `POST /api/assignments/:id/submissions`

## Security

- Admin xem toan bo.
- Teacher chi xem/quyen quan ly assignment trong phan cong cua chinh minh;
  sua/publish/close/xoa con yeu cau teacher la nguoi tao.
- Student chi thay assignment published/closed neu enrollment cua em bao phu
  ngay assignment duoc publish.
- Notification publish gui theo roster tai ngay publish, khong lay role student
  toan truong.

## UI

- `/admin/assignments`: tong quan toan truong va tien do nop.
- `/teacher/assignments`: tao/sua draft, giao/dong bai, xem submission.
- `/student/assignments`: xem chi tiet, tai huong dan, nop/thay file.

## Kiem tra

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:setup
npm run test:assignments
npm run quality

cd D:\THPT-PCT-PT\frontend
npm run build
```
