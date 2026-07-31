# Vai trò và phân quyền

Hệ thống định hướng phân quyền theo role-based access control.

## Role mặc định

- `admin`: toàn quyền quản trị hệ thống.
- `teacher`: quản lý nội dung, văn bản, thời khóa biểu, sự kiện và thông báo liên quan.
- `student`: truy cập nội dung công khai, thông báo và dữ liệu học tập được cấp quyền.

## Permission ban đầu

- `posts.read`
- `posts.manage`
- `users.manage`
- `roles.manage`
- `documents.manage`
- `timetables.manage`
- `events.manage`
- `notifications.manage`

Danh sách quyền sẽ được mở rộng khi API nghiệp vụ được triển khai chi tiết.

