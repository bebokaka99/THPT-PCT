# Student Enrollments

Tài liệu này mô tả source of truth và quy trình vận hành lịch sử xếp lớp học
sinh sau Task 5.3.

## Source of truth

`student_enrollments` là nguồn dữ liệu chuẩn để xác định:

- học sinh đang học lớp nào;
- lịch sử chuyển lớp theo năm học;
- học sinh có quyền truy cập classroom nào;
- roster học sinh active của một lớp.

Không dùng `student_profiles.class_name` hoặc student row trong
`classroom_members` để đưa ra quyết định phân quyền. Hai dữ liệu này chỉ được
đồng bộ để tương thích các màn hình cũ.

## Trạng thái

| Trạng thái | Ý nghĩa |
| --- | --- |
| `active` | Đang học tại lớp |
| `transferred` | Đã chuyển sang lớp khác |
| `reserved` | Bảo lưu |
| `withdrawn` | Nghỉ học/rút hồ sơ |
| `graduated` | Đã tốt nghiệp |

Record `active` không có `ended_at`. Các trạng thái kết thúc phải có
`ended_at`.

## Quy trình admin

### Xếp lớp

1. Mở `/admin/enrollments`.
2. Chọn học sinh active có role student.
3. Chọn lớp và ngày vào lớp nằm trong năm học của lớp.
4. Gửi xếp lớp.

Database chặn học sinh có hơn một enrollment active trong cùng năm học.

### Chuyển lớp

1. Chọn `Chuyển lớp` trên enrollment active.
2. Chọn lớp đích trong cùng năm học và ngày hiệu lực.
3. Hệ thống chuyển record cũ thành `transferred`, đặt `ended_at`, rồi tạo
   record `active` mới có `previous_enrollment_id`.

Hai thay đổi được thực hiện trong cùng transaction. Không sửa classroom trực
tiếp trên record cũ.

### Bảo lưu, nghỉ học, tốt nghiệp

Chọn `Trạng thái`, nhập ngày hiệu lực và lý do. Sau khi kết thúc, học sinh mất
quyền truy cập lớp đó.

## API và phân quyền

API quản trị:

```text
GET   /api/enrollments
POST  /api/enrollments
POST  /api/enrollments/:id/transfer
PATCH /api/enrollments/:id/status
```

Các endpoint trên yêu cầu JWT và permission `enrollments.manage`.

API cá nhân:

```text
GET /api/enrollments/me
GET /api/enrollments/students/:userId
GET /api/enrollments/:id
```

Student chỉ đọc được dữ liệu của chính mình. Admin có permission được xem lịch
sử của student khác.

## Compatibility

- `POST /api/classrooms/:id/members` với role `student` tạo enrollment thay vì
  chỉ tạo membership.
- `DELETE /api/classrooms/:id/members/:memberId?role=student` kết thúc
  enrollment bằng trạng thái `withdrawn`.
- Trigger database đồng bộ active enrollment sang `classroom_members` và
  `student_profiles.class_name`.

Compatibility path sẽ được loại bỏ sau khi toàn bộ module học vụ đã chuyển sang
enrollment API.

## Kiểm tra vận hành

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:setup
npm run test:enrollments
npm run quality
```

Kiểm tra xung đột dữ liệu:

```sql
SELECT student_user_id, academic_year_id, COUNT(*)
FROM student_enrollments
WHERE status = 'active'
GROUP BY student_user_id, academic_year_id
HAVING COUNT(*) > 1;
```

Kết quả bắt buộc là không có dòng nào.

## Quy tắc cho task sau

- Teaching assignment, attendance, gradebook và report card phải resolve lớp
  của student từ enrollment theo đúng academic year.
- Không hard-delete enrollment history.
- Mọi chuyển lớp phải có actor, ngày hiệu lực và lý do.
- Bulk import phải transaction-safe và báo conflict theo từng student.
