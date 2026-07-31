# Đơn và yêu cầu học sinh

## Vai trò

- **Học sinh:** xem loại đơn đang hoạt động, tạo bản nháp, đính kèm minh chứng,
  gửi và hủy đơn khi còn chờ xử lý.
- **Giáo viên:** xét đơn có phạm vi `homeroom` của học sinh đang thuộc lớp mình
  chủ nhiệm.
- **Admin:** xem toàn bộ, xét đơn cấp trường và cấu hình loại đơn/SLA.

Đơn còn ở trạng thái `draft` chỉ chủ đơn nhìn thấy; reviewer chỉ truy cập từ
thời điểm học sinh submit.

## Trạng thái

```text
draft -> pending -> in_review -> approved
                         \-----> rejected
draft/pending -> cancelled
```

Database trigger từ chối mọi transition ngoài ma trận trên. Mỗi transition ghi
một dòng history gồm actor, trạng thái cũ/mới, lý do, revision và thời gian.

## API chính

```text
GET   /api/student-requests/types
POST  /api/student-requests/types
PATCH /api/student-requests/types/:id

GET   /api/student-requests
POST  /api/student-requests
GET   /api/student-requests/:id
POST  /api/student-requests/:id/attachments
GET   /api/student-requests/:id/attachments/:attachmentId/download
POST  /api/student-requests/:id/submit
POST  /api/student-requests/:id/cancel
POST  /api/student-requests/:id/start-review
POST  /api/student-requests/:id/approve
POST  /api/student-requests/:id/reject
GET   /api/student-requests/:id/history
```

Attachment dùng multipart field `file`, tối đa 10 MB; hỗ trợ PDF, Word và ảnh
phổ biến. File nằm ngoài `/uploads`, không có public URL và chỉ được tải sau khi
API xác minh owner/reviewer.

## Loại đơn mặc định

- Đơn xin nghỉ học: GVCN, SLA 2 ngày.
- Giấy xác nhận học sinh: admin, SLA 5 ngày.
- Đề nghị điều chỉnh thông tin: admin, bắt buộc minh chứng, SLA 7 ngày.

## Chạy kiểm tra

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:setup
npm run test:student-requests
npm run quality

cd D:\THPT-PCT-PT\frontend
npm run build
```

## Giới hạn v1

- `form_schema` đã có trong database nhưng UI chưa render form động theo schema.
- Chưa có ký số, số văn bản, email/SMS hoặc quy trình nhiều cấp reviewer.
- Duyệt đơn không tự động sửa hồ sơ định danh.
- Private file đang dùng local disk; khi deploy nhiều instance cần chuyển sang
  object storage private và signed download.
