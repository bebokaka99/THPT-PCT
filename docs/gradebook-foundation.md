# Sổ điểm nền móng

## Route

Frontend:

- Giáo viên: `/teacher/gradebook`
- Admin: `/admin/gradebooks`
- Học sinh: `/student/grades`

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

1. Năm học và học kỳ chưa đóng/khóa.
2. Lớp có `grade_level` và thuộc đúng năm học.
3. Môn nằm trong curriculum của khối.
4. Giáo viên có active teaching assignment cho lớp/môn/học kỳ.
5. Có assessment configuration active khớp môn/học kỳ/khối.

## Nhập điểm

- Chọn phân công tại `/teacher/gradebook`, sau đó nhấn **Mở sổ điểm**.
- Nhập số từ `0` đến max score của cột hoặc chọn `Vắng`/`Miễn`.
- Thay đổi hợp lệ tự lưu sau khoảng 900 ms.
- Hai phiên cùng sửa một ô sẽ nhận `409` ở phiên dùng version cũ.
- `Vắng` tính như 0; `Miễn` được loại khỏi mẫu số.
- Gradebook hiện là draft nên student chưa xem được.

## Kiểm tra

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:setup
npm run test:gradebooks
npm run build

cd D:\THPT-PCT-PT\frontend
npm run build
```

Task tiếp theo là 5.9 để thêm submit, approval, rejection, locking và publish.
