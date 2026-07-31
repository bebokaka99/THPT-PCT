# Thiết kế API

Backend dùng Node.js + Express + TypeScript.

## Prefix

Tất cả API nghiệp vụ dự kiến dùng prefix:

```text
/api
```

## Endpoint hiện có

```text
GET /api/health
```

Response:

```json
{
  "status": "ok",
  "message": "THPT-PCT-PT API is running"
}
```

## Định hướng module

- `auth`: đăng nhập, đăng xuất, refresh token, hồ sơ hiện tại.
- `users`: quản lý tài khoản.
- `roles`, `permissions`: phân quyền.
- `posts`, `categories`: tin tức và chuyên mục.
- `media`, `documents`: file và văn bản.
- `timetables`, `classes`, `subjects`: dữ liệu học vụ.
- `events`, `notifications`: sự kiện và thông báo.

