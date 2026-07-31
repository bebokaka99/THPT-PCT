# Workflow plans

Các tài liệu trong thư mục này là kế hoạch/lịch sử được viết trước khi đổi
database. Những đoạn đề cập MySQL/XAMPP chỉ có giá trị tham khảo lịch sử.

Từ task `P0-DB` trở đi, quy ước chính thức là:

- PostgreSQL 18.
- Migration tại `database/postgresql/migrations`.
- Seed tại `database/postgresql/seeds`.
- Chạy local bằng Docker Compose hoặc PostgreSQL native.
- Không chạy lại SQL trong `database/schema` và `database/seeds`.

## Khuôn task bắt buộc

- Dùng [TASK-TEMPLATE.md](TASK-TEMPLATE.md) khi tạo task mới.
- Task phải mô tả kết quả nghiệp vụ, dependency, ngoài phạm vi, security rules,
  self-check và Definition of Done.
- Không đánh dấu hoàn thành chỉ vì TypeScript build pass.
- Task học vụ phải test role + ownership + assignment/enrollment scope.

## Thứ tự mới

- Phase 4 hoàn thiện portal/CMS hiện có.
- Phase 5 xây Academic Operations: năm học, môn, enrollment, phân công, điểm
  danh, bài tập, gradebook, bảng điểm, hạnh kiểm và guardian.
- Phase 6 mới chuẩn bị production.
