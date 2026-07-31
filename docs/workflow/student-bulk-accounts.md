# STUDENT-BULK - Cấp tài khoản học sinh hàng loạt

## Thay đổi

- Thêm username đăng nhập riêng cho học sinh; email học sinh có thể để trống.
- Thêm ngày sinh vào student profile.
- Thêm `POST /api/users/students/bulk`, bảo vệ bằng `users.manage`.
- Username dùng mẫu `<khoa>pct<DDMM><4-so-ngau-nhien>`.
- Password ban đầu là phần số sau `pct` và database chỉ lưu bcrypt hash.
- Thêm `/admin/users/bulk-students` với CSV preview, CSV mẫu, chọn lớp và tải credentials.
- Login nhận email hoặc username và chuyển đúng portal theo role.
- Thêm migration `002_student_bulk_accounts.sql`.
- Thêm smoke test và GitHub Actions quality gate.

## Kết quả tự kiểm tra

- `npm run db:setup`: pass.
- `npm run quality` backend: pass.
- `npm run build` frontend: pass.
- Tạo hai tài khoản học sinh qua API: pass.
- Đăng nhập lại bằng username/password sinh tự động: pass.
- Frontend local: HTTP 200.
- Backend health và database: pass.

## Giới hạn

- CSV parser hỗ trợ dấu phẩy và quoted field cơ bản, chưa nhận `.xlsx`.
- Chưa bắt đổi mật khẩu ở lần đăng nhập đầu tiên.
- Mỗi batch tối đa 1000 học sinh.
