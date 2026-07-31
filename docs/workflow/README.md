# Workflow plans

Thư mục này là nguồn điều phối công việc chính thức của THPT-PCT-PT. Mỗi task
phải có một file Markdown riêng và được liên kết trong `WORKFLOW.md`.

## Nguồn dữ liệu chuẩn

- Database: PostgreSQL 18.
- Migration: `database/postgresql/migrations`.
- Seed: `database/postgresql/seeds`.
- Local runtime: Docker Compose hoặc PostgreSQL native.
- `database/schema` và `database/seeds` chỉ là lịch sử MySQL, không được dùng
  cho thay đổi mới.

## Khuôn task bắt buộc

- Dùng [TASK-TEMPLATE.md](TASK-TEMPLATE.md).
- Nêu rõ dependency, phạm vi, ngoài phạm vi và dữ liệu bị ảnh hưởng.
- Mọi task học vụ phải có happy path, conflict path và forbidden path.
- Build pass không đủ để đánh dấu hoàn thành; phải chạy migration, API thật,
  kiểm tra UI và xác nhận dữ liệu lưu đúng.
- Demo/fixture phải tuân thủ rule nghiệp vụ giống production. Không dùng dữ liệu
  trùng lịch hoặc sai phạm vi chỉ để làm UI có dữ liệu.
- Khi hoàn thành phải cập nhật task file, `WORKFLOW.md` và
  `docs/workflow-report.md`.

## Thứ tự hiện tại

1. Hoàn thành P0 còn mở: Task 5.16.
2. Hoàn thiện workflow học vụ P1: Task 5.17 đến 5.22.
3. Tiếp tục các production gate Phase 6.
4. Chỉ triển khai Phase 7 khi phạm vi sản phẩm được nhà trường chấp thuận.

Không mở module mới nếu task trước đang còn lỗi tính đúng đắn dữ liệu.
