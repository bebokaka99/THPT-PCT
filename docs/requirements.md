# Yêu cầu dự án

THPT-PCT-PT là project remake website trường THPT Phan Chu Trinh Phan Thiết thành school portal hiện đại.

## Phạm vi giai đoạn đầu

- Public website hiển thị tin tức, văn bản, sự kiện và thông báo.
- Backend API phục vụ frontend và các màn hình quản trị.
- PostgreSQL lưu người dùng, phân quyền và dữ liệu trường học.
- Phân quyền nhiều vai trò: admin, giáo viên, học sinh.

## Nguyên tắc kỹ thuật

- Tách rõ frontend, backend, database và docs.
- Không dùng Prisma trong giai đoạn scaffold.
- Không phụ thuộc XAMPP cho môi trường local hoặc deployment.
- Migration PostgreSQL phải có ledger, checksum và chạy transaction theo file.
- Ưu tiên cấu trúc dễ mở rộng theo module.
- Chỉ tạo nền móng chạy được, chưa triển khai tính năng nghiệp vụ sâu.
