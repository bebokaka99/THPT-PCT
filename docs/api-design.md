# Thiết kế API

Backend dùng Node.js, Express và TypeScript. Tất cả endpoint nghiệp vụ dùng
prefix `/api` và JSON, trừ upload/download file.

## Nhóm route hiện có

- Public: health, posts, categories, documents, events, search.
- Identity: auth, users, roles, profiles, guardians.
- Academic structure: academic periods, subjects, enrollments, teaching assignments.
- Operations: classrooms, timetables, attendance, assignments, gradebooks,
  transcripts, conduct, student requests.
- Platform: media, notifications, importer, dashboard.

## Response và lỗi

- Detail: `{ "data": { ... } }`.
- List: `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`.
- Error phải có message có thể hành động và request ID.
- Conflict nghiệp vụ dùng `409` cùng mã máy đọc được, ví dụ
  `TEACHER_TIMETABLE_CONFLICT`; validation input dùng `400` hoặc `422` theo
  convention hiện tại.
- Không trả raw database error, enum key hoặc stack trace.

## Authorization

- `requireAuth` xác thực session/JWT.
- Permission chỉ là lớp đầu; API học vụ còn phải kiểm tra assignment,
  enrollment, guardian link và ownership.
- List cũng phải scope ở query, không fetch tất cả rồi filter trong controller.
- Student/guardian chỉ nhận dữ liệu đã công bố.

## Contract Task 5.15

- API cấu hình ca/tiết.
- API timetable version draft/publish/archive.
- Conflict preview trước khi lưu/publish.
- `GET /api/timetables/me` trả lịch cá nhân giáo viên đã hợp nhất đúng scope.
- Classroom/student endpoint chỉ trả timetable published.
- Error conflict trả đối tượng, ngày, ca, tiết và record đang chiếm slot.

## Contract Task 5.16

```http
GET /api/gradebooks/me?academic_year_id=&semester_id=&subject_id=
```

- Filter phải được validate và áp dụng trong repository.
- Response giữ danh sách score columns động theo `sort_order`.
- Không trả full content/audit của gradebook trong list student.
- Frontend dùng URL query tương ứng để reload vẫn giữ bộ lọc.

## Quy tắc implementation

1. Route → controller → service → repository.
2. SQL chỉ ở repository và luôn parameterized.
3. Multi-table write dùng transaction.
4. Pagination có limit tối đa.
5. Bulk endpoint có idempotency/atomic hoặc partial mode được mô tả rõ.
6. Mọi endpoint mới có happy, validation, conflict và forbidden tests.
