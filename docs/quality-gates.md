# Quality gates

Một task chỉ được xem là hoàn thành khi:

1. Migration mới chạy được trên database sạch và chạy lại không gây lỗi.
2. Backend `npm run build` pass.
3. Frontend `npm run build` pass nếu task ảnh hưởng frontend hoặc contract API.
4. Smoke test của luồng bị ảnh hưởng pass.
5. Không làm hỏng health, auth và route public hiện có.
6. Báo cáo ghi rõ lệnh đã chạy, kết quả, phần chưa kiểm chứng và giới hạn còn lại.

## Gate hiện có

`backend/npm run quality` thực hiện:

- TypeScript build backend.
- Kiểm tra production từ chối JWT secret mặc định/placeholder.
- Kiểm tra production chấp nhận JWT secret đủ mạnh.
- Kiểm tra schema canonical của notifications và timetables.
- Kiểm tra optional auth cho public/private posts và documents.
- Chạy unit test cho shared backend validators.
- Tạo một tài khoản học sinh bằng API bulk.
- Kiểm tra username/password đúng format.
- Đăng nhập bằng username vừa tạo.
- Xóa dữ liệu smoke test sau khi hoàn tất.

GitHub Actions tại `.github/workflows/ci.yml` dựng PostgreSQL 18, chạy migrations, backend smoke test và build cả backend/frontend.
