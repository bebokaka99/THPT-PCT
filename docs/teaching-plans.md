# Kế hoạch giảng dạy

Module kế hoạch giảng dạy cho phép giáo viên lập kế hoạch theo đúng phân công
lớp, môn, học kỳ và tuần học; sau đó gửi ban chuyên môn duyệt.

## Luồng trạng thái

`draft -> submitted -> approved`

Reviewer có thể chuyển `submitted -> rejected`. Giáo viên chỉnh bản `rejected`
sẽ tạo version mới và đưa kế hoạch về `draft`. Bản `approved` không được sửa;
reviewer có thể chuyển bản đã kết thúc sang `archived`.

## Phân quyền

- Giáo viên có `teaching_plans.manage`: chỉ xem và quản lý kế hoạch thuộc
  teaching assignment đang active của chính mình.
- Admin hoặc tài khoản có `teaching_plans.review`: xem báo cáo, duyệt, từ chối
  và lưu trữ.
- Học sinh không có API hoặc route truy cập nội dung kế hoạch nội bộ.

Ở v1, reviewer là admin/ban chuyên môn toàn trường. Project chưa có entity tổ
chuyên môn và mapping tổ trưởng, nên chưa thể giới hạn reviewer theo từng
`subject_group`. Đây là bước mở rộng bắt buộc trước khi giao quyền reviewer cho
giáo viên không phải admin.

## API

- `GET /api/teaching-plans/options`
- `GET /api/teaching-plans/summary`
- `GET /api/teaching-plans`
- `GET /api/teaching-plans/:id`
- `POST /api/teaching-plans`
- `PATCH /api/teaching-plans/:id`
- `POST /api/teaching-plans/:id/submit`
- `POST /api/teaching-plans/:id/approve`
- `POST /api/teaching-plans/:id/reject`
- `POST /api/teaching-plans/:id/archive`
- `DELETE /api/teaching-plans/:id`

Kế hoạch có thể tham chiếu tùy chọn `timetable_item_id`, `assignment_id` và
`media_file_id`. UI v1 chưa có picker thân thiện cho ba liên kết này; học liệu
dạng mô tả vẫn nhập trong trường `resources`.

## Kiểm tra

```powershell
cd backend
npm run db:setup
npm run test:teaching-plans
```

Giao diện:

- Giáo viên: `/teacher/teaching-plans`
- Admin: `/admin/teaching-plans`
