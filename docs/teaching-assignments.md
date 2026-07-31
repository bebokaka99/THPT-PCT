# Teaching Assignments

## Mục đích

`teaching_assignments` là nguồn dữ liệu chuẩn để xác định một giáo viên có
được thao tác nghiệp vụ theo môn trong một lớp và học kỳ hay không. Không suy
luận quyền này từ `classroom_members`, `homeroom_teacher_user_id` hoặc chuỗi
`teacher_name` trong thời khóa biểu.

## Mô hình dữ liệu

Mỗi phân công liên kết:

- tài khoản giáo viên active;
- lớp active có năm học và khối;
- môn active trong curriculum của đúng năm học/khối;
- học kỳ thuộc cùng năm học;
- vai trò `primary` hoặc `assistant`;
- trạng thái `active` hoặc `inactive`;
- ngày bắt đầu/kết thúc nằm trong học kỳ.

Database trigger bảo vệ các bất biến trên, kể cả khi dữ liệu không đi qua API.
Identity teacher/class/subject/semester là immutable; thay đổi phạm vi phải kết
thúc record cũ và tạo record mới.

## Policy

| Trường hợp | Kết quả |
|---|---|
| Admin | Được quản lý tất cả assignment |
| Teacher có assignment active đúng class/subject/semester | Được phép theo policy nghiệp vụ tương ứng |
| Teacher chỉ là classroom member | Không có quyền bộ môn |
| Teacher là homeroom nhưng không có subject assignment | Chỉ có quyền chủ nhiệm hiện hành, không có quyền nhập điểm môn |
| Teacher có assignment inactive | Chỉ xem lịch sử |
| Student | Không truy cập API assignment |

Backend dùng `canTeachSubjectInClass` hoặc
`assertCanTeachSubjectInClass` cho các module học vụ tương lai. Không copy lại
logic kiểm tra bằng query riêng trong controller.

## API quản trị

```text
GET    /api/teaching-assignments
GET    /api/teaching-assignments/:id
POST   /api/teaching-assignments
POST   /api/teaching-assignments/bulk
PATCH  /api/teaching-assignments/:id
PATCH  /api/teaching-assignments/:id/status
DELETE /api/teaching-assignments/:id
```

`DELETE` là kết thúc hiệu lực, không xóa lịch sử. Bulk create được validate
trước và chạy trong một transaction.

Teacher dùng:

```text
GET /api/teaching-assignments/me
```

Response chỉ chứa assignment của user hiện tại. Admin có thể truyền
`teacher_user_id` trong API quản trị.

## Tích hợp timetable

`timetable_items.teaching_assignment_id` là optional để tương thích dữ liệu cũ.
Khi có giá trị:

- item phải thuộc đúng classroom;
- subject và semester phải khớp assignment active;
- `teacher_name` được chuẩn hóa từ teacher profile/user;
- assignment sai scope bị từ chối.

Backfill chỉ liên kết khi tên giáo viên, môn, lớp và học kỳ khớp chính xác.
Không tạo dữ liệu quyền dựa trên phỏng đoán.

## Quy trình vận hành

1. Admin tạo năm học và học kỳ.
2. Admin gắn lớp với năm học/khối.
3. Admin cấu hình curriculum cho năm học/khối.
4. Admin mở `Quản trị > Phân công giảng dạy`.
5. Chọn teacher, classroom, semester và một hoặc nhiều subject.
6. Xác nhận ngày hiệu lực rồi tạo bulk.
7. Teacher kiểm tra tại `Giáo viên > Lớp giảng dạy`.
8. Khi đổi giáo viên, kết thúc assignment cũ và tạo assignment mới.

## Giới hạn hiện tại

- Chưa có import XLSX và preview conflict.
- Chưa có phê duyệt/quyết định phân công.
- Chưa có audit event riêng ngoài timestamps và actor tạo.
- Assessment/gradebook chưa được bật; Task 5.5 sẽ định nghĩa cấu hình đầu điểm.
