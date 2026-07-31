# Teaching Assignments

## Mục đích

`teaching_assignments` là nguồn dữ liệu chuẩn xác định giáo viên được dạy môn
nào, lớp nào và học kỳ nào. Không suy luận quyền này từ classroom membership,
GVCN hoặc chuỗi `teacher_name` trong thời khóa biểu.

## Policy

- Admin quản lý assignment khi có permission phù hợp.
- Giáo viên chỉ xem assignment của chính mình.
- Quyền nhập điểm/điểm danh theo môn cần assignment active đúng
  class + subject + semester.
- GVCN không tự động có quyền nhập điểm mọi môn.
- Assignment inactive chỉ giữ lịch sử, không cấp quyền write.
- Đổi teacher/class/subject/semester phải kết thúc record cũ và tạo record mới.

## API

```text
GET    /api/teaching-assignments/me
GET    /api/teaching-assignments
GET    /api/teaching-assignments/:id
POST   /api/teaching-assignments
POST   /api/teaching-assignments/bulk
PATCH  /api/teaching-assignments/:id
PATCH  /api/teaching-assignments/:id/status
DELETE /api/teaching-assignments/:id
```

Bulk create phải validate trước và chạy trong transaction.

## Tích hợp thời khóa biểu

`timetable_items.teaching_assignment_id` liên kết tiết học với đúng giáo viên.
Khi có giá trị:

- assignment phải active;
- classroom, subject và semester phải khớp;
- tên giáo viên hiển thị lấy từ user/profile, không tin chuỗi client gửi lên.

Assignment đúng không đồng nghĩa timetable không xung đột. Task 5.15 phải kiểm
tra thêm teacher/classroom/room theo cùng `day + shift + period + semester`.

## Giới hạn hiện tại

- Chưa có approval workflow cho phân công.
- Dữ liệu cũ có thể chưa liên kết assignment.
- Conflict nhiều lớp cùng tiết của một giáo viên chưa được bảo vệ đầy đủ cho
  đến khi Task 5.15 hoàn thành.
