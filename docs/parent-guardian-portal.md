# Parent & Guardian Portal

## Luồng thiết lập

1. Admin tạo tài khoản user có role `guardian` tại `/admin/users/new`.
2. Admin mở `/admin/guardians`, chọn guardian và học sinh rồi tạo lời mời.
3. Liên kết mới có trạng thái `pending` và chưa cấp quyền đọc.
4. Sau khi kiểm tra hồ sơ ngoài hệ thống, admin nhấn **Xác minh**.
5. Guardian đăng nhập bằng tài khoản riêng và truy cập `/parent`.
6. Khi cần chấm dứt quyền truy cập, admin nhấn **Thu hồi**. Request tiếp theo
   của guardian bị từ chối ngay cả khi token đăng nhập vẫn còn hạn.

Không xác minh quan hệ chỉ dựa trên số điện thoại. Nhà trường phải đối chiếu hồ
sơ phù hợp trước khi chuyển trạng thái sang `verified`.

## Dữ liệu guardian được xem

- Danh sách học sinh có liên kết `verified`.
- Chuyên cần của học sinh.
- Điểm từ gradebook `approved` hoặc `locked`.
- Kết quả rèn luyện/nhận xét `approved` hoặc `locked`.
- Notification được gửi trực tiếp, theo role guardian hoặc target `all`.

Guardian không được sửa bất kỳ dữ liệu học vụ nào.

## API quản trị

```text
GET  /api/guardians/links?page=1&limit=20&q=&status=
POST /api/guardians/links
POST /api/guardians/links/:id/verify
POST /api/guardians/links/:id/revoke
GET  /api/guardians/links/:id/audit
```

Payload mời:

```json
{
  "guardian_user_id": 10,
  "student_user_id": 25,
  "relationship": "Mẹ"
}
```

## API phụ huynh

```text
GET   /api/guardians/me/students
GET   /api/guardians/me/students/:studentId/summary?semester_id=
GET   /api/guardians/me/preferences
PATCH /api/guardians/me/preferences
```

## Privacy và audit

- Link được kiểm tra trực tiếp trong database trên mỗi lần đọc summary.
- `guardian_link_audits` ghi actor, trạng thái cũ/mới, reason và revision.
- `guardian_access_audits` ghi guardian, student, resource, semester và thời gian.
- Không ghi điểm, nhận xét hoặc dữ liệu chuyên cần vào request log.
- Audit chỉ được xóa trong test cleanup bằng session setting chuyên biệt.

## Recovery

V1 chưa có email/SMS recovery tự phục vụ. Admin xác minh danh tính phụ huynh
theo quy trình nội bộ rồi đặt mật khẩu mới từ `/admin/users/:id/edit`.
