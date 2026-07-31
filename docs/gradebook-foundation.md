# Sổ điểm nền móng

## Route

Frontend:

- Giáo viên: `/teacher/gradebook`.
- Admin: `/admin/gradebooks`.
- Học sinh: `/student/grades`.

Backend:

```text
GET  /api/gradebooks
POST /api/gradebooks
GET  /api/gradebooks/:id
PUT  /api/gradebooks/:id/scores
GET  /api/gradebooks/:id/audit
GET  /api/gradebooks/me
```

## Điều kiện mở sổ điểm

1. Năm học/học kỳ chưa đóng hoặc khóa.
2. Lớp thuộc đúng năm học và khối.
3. Môn nằm trong curriculum.
4. Giáo viên có assignment active đúng lớp/môn/học kỳ.
5. Có assessment configuration active.

## Điểm thành phần

- Số cột TX lấy từ configuration snapshot, không giới hạn 2 hoặc 3.
- Hỗ trợ `scored`, `absent`, `exempt`, `unscored`.
- Frontend không tự tính tổng kết; backend dùng `NUMERIC` và công thức đã lưu.
- Mọi sửa điểm ghi audit; concurrent update dùng version và trả `409`.
- Student/guardian không được xem draft, rejected hoặc audit nội bộ.

## Trạng thái hoàn thiện

- Teacher entry, approval/locking và report card đã có nền móng.
- Student đã xem được score columns động.
- Task 5.16 còn phải bổ sung filter năm/học kỳ/môn ở API và URL, cùng màn hình
  chi tiết một môn. Vì vậy trải nghiệm tra cứu điểm chưa được coi là hoàn tất.

## Kiểm tra

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:setup
npm run test:gradebooks
npm run build

cd D:\THPT-PCT-PT\frontend
npm run build
```
