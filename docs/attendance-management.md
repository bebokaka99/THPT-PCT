# Quản lý chuyên cần

## Phạm vi v1

Module chuyên cần dùng `student_enrollments` và `teaching_assignments` làm
source of truth. Không dùng `classroom_members` để suy đoán học sinh hoặc quyền
giáo viên.

Trạng thái hỗ trợ:

| Mã | Ý nghĩa | Tính vào tỷ lệ có mặt |
|---|---|---|
| `present` | Có mặt | Có |
| `late` | Đi trễ | Có |
| `excused` | Vắng có phép | Không |
| `unexcused` | Vắng không phép | Không |

Tỷ lệ chuyên cần v1:

```text
(present + late) / total_records * 100
```

## Luồng giáo viên

1. Admin cấu hình năm học, học kỳ, chương trình môn và phân công giảng dạy.
2. Admin xếp học sinh vào lớp bằng enrollment.
3. Giáo viên mở `/teacher/attendance`, chọn phân công, ngày và tiết.
4. Backend tạo session duy nhất theo lớp, học kỳ, ngày, tiết và môn.
5. Detail session dựng roster theo enrollment có hiệu lực tại ngày học.
6. Giáo viên cập nhật trạng thái và lưu cả lớp trong một transaction.

Giáo viên bộ môn chỉ thao tác trên scope assignment của mình. Giáo viên chủ
nhiệm được thao tác attendance của lớp chủ nhiệm. Admin xem toàn bộ tại
`/admin/attendance`.

## Chỉnh lý và audit

- Lần lưu hoặc sửa session thuộc ngày trước ngày hiện tại bắt buộc có
  `correction_reason`.
- Mỗi record thay đổi ghi `attendance_record_audits` gồm actor, old/new status,
  old/new note, reason và thời gian.
- Record không thay đổi không tạo audit thừa.
- Nếu batch có một học sinh không thuộc lớp tại ngày học, toàn bộ transaction
  rollback.

## API

| Method | Endpoint | Scope |
|---|---|---|
| `GET` | `/api/attendance/sessions` | Admin/teacher theo scope |
| `POST` | `/api/attendance/sessions` | Admin/teacher theo scope |
| `GET` | `/api/attendance/sessions/:id` | Admin/teacher theo scope |
| `PUT` | `/api/attendance/sessions/:id/records` | Bulk save atomic |
| `GET` | `/api/attendance/sessions/:id/audit` | Admin/homeroom/creator |
| `GET` | `/api/attendance/me` | Student, chỉ record của chính mình |
| `GET` | `/api/attendance/summary/classrooms/:id` | Admin/teacher theo scope |

Các endpoint summary hỗ trợ `semester_id`, `from`, `to`. List session hỗ trợ
`page`, `limit`, `classroom_id`, `semester_id`, `from`, `to`.

## Kiểm tra local

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:setup
npm run test:attendance
npm run quality

cd D:\THPT-PCT-PT\frontend
npm run build
```

Mở:

- Admin: `http://localhost:5173/admin/attendance`
- Teacher: `http://localhost:5173/teacher/attendance`
- Student: `http://localhost:5173/student/attendance`

Giữ cùng hostname `localhost` cho frontend và API trong quá trình test cookie
refresh. Không trộn `localhost` và `127.0.0.1`.

## Giới hạn

- Chưa tự gửi notification khi vắng/đi trễ.
- Chưa có import attendance từ máy chấm công hoặc XLSX.
- Chưa có trạng thái khóa/chốt session riêng.
- Chưa có báo cáo in/PDF hoặc dashboard xu hướng theo tháng.

