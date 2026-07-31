# Quy trình cấp tài khoản học sinh

## Phạm vi

- Giáo viên được quản trị viên tạo thủ công tại `/admin/users/new`.
- Học sinh được tạo theo lô tại `/admin/users/bulk-students`.
- Luồng bulk nhận CSV, cho xem trước, tạo tài khoản trong một transaction và có thể gán ngay vào lớp.

## Quy tắc tài khoản

- Username: `<khoa>pct<DDMM><4-so-ngau-nhien>`.
- Ví dụ: học sinh sinh ngày `03/09`, khóa `21` có thể nhận `21pct03090001`.
- Mật khẩu ban đầu: phần số sau `pct`, ví dụ `03090001`.
- Username được kiểm tra unique trong database.
- Password chỉ trả về một lần sau khi tạo và chỉ lưu bcrypt hash trong database.

## File CSV

Cột bắt buộc:

```text
full_name,date_of_birth
```

Cột tùy chọn:

```text
class_name,student_code,phone,parent_phone,email
```

`date_of_birth` nhận `DD/MM/YYYY` hoặc `YYYY-MM-DD`. Mỗi batch tối đa 1000 dòng.

## Quy tắc bắt buộc khi phát triển tiếp

1. Không ghi plaintext password vào database, log hoặc audit event.
2. Không cho frontend tự sinh username; backend là nguồn dữ liệu duy nhất cho quy tắc tài khoản.
3. Mọi batch phải chạy transaction: lỗi một dòng thì rollback toàn bộ batch.
4. API bulk luôn cần JWT và permission `users.manage`.
5. Không tự tạo role giáo viên trong luồng bulk học sinh.
6. Không đổi format tài khoản nếu chưa có migration dữ liệu và kế hoạch tương thích.
7. Không trả password ở endpoint list/detail user.
8. Sau mỗi thay đổi auth/users phải chạy `npm run quality` trong backend và build frontend.

## Tự kiểm tra

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:setup
npm run quality

cd D:\THPT-PCT-PT\frontend
npm run build
```
