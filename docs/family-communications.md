# Family Communication & Acknowledgements

## Phạm vi

Task 5.20 bổ sung kênh thông báo trong ứng dụng cho nhà trường, giáo viên,
học sinh và phụ huynh. Kênh in-app là source of truth của v1; email/SMS chưa
được bật.

## API chính

- `GET /api/notifications/me?page=1&limit=10&unread=true&unacknowledged=true`
- `GET /api/notifications/me/unread-count`
- `PATCH /api/notifications/me/:id/read`
- `PATCH /api/notifications/me/:id/acknowledge`
- `PATCH /api/notifications/me/read-all`
- `GET /api/notifications/options`
- `GET /api/notifications` (admin hoặc người có `notifications.report`)
- `POST /api/notifications` (admin hoặc người có `notifications.send`)
- `GET /api/notifications/:id/report`
- `DELETE /api/notifications/:id` (admin)

Payload gửi thông báo có `target_scope` là `school`, `role`, `grade`,
`classroom` hoặc `users`; có `priority` là `normal`, `important`, `urgent`;
và `requires_acknowledgement` để yêu cầu người nhận xác nhận riêng với trạng
thái đã đọc.

## Quy tắc quyền

- Admin được gửi trong toàn trường, theo role, khối, lớp hoặc danh sách tài
  khoản và xem báo cáo toàn hệ thống.
- Teacher chỉ được gửi trong lớp mà mình là homeroom teacher, có teaching
  assignment active hoặc là teacher member; chỉ gửi cho học sinh/phụ huynh
  thuộc lớp đó.
- Student/guardian chỉ đọc và xác nhận notification được gán cho chính mình.
- Báo cáo chỉ trả trạng thái người nhận và tỷ lệ, không lặp lại nội dung riêng
  tư của thông báo.
- `idempotency_key` giúp retry không tạo thêm notification hoặc recipient.

## Frontend

- Admin: `/admin/communications`
- Teacher: `/teacher/communications`
- Người nhận: `/notifications`

Trang gửi thông báo có chọn phạm vi, lớp/khối/user, mức ưu tiên, liên kết và
checkbox xác nhận bắt buộc. Danh sách đã gửi có báo cáo read/acknowledgement.
Màn hình notification có nút `Xác nhận` riêng; mở thông báo chỉ đánh dấu đã
đọc.

## Kiểm tra

```powershell
cd backend
npm run db:setup
npm run test:family-communications
```

Smoke test kiểm tra scope teacher, forbidden paths, recipient isolation,
read/ack riêng biệt, report và idempotent retry.

## Giới hạn v1

- Chưa có email/SMS/push adapter.
- Chưa có lịch gửi trong tương lai, mẫu thông báo hoặc soạn rich text.
- Danh sách explicit users ở admin giới hạn 500 tài khoản trong màn hình chọn.
- Báo cáo hiện hiển thị danh sách trạng thái người nhận, chưa có export CSV.
