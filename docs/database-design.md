# Thiết kế database

PostgreSQL 18 là database canonical. Migration nằm tại
`database/postgresql/migrations`, seed tại `database/postgresql/seeds`; runner
lưu checksum trong `schema_migrations`. SQL MySQL cũ chỉ để tham khảo lịch sử.

## Các domain chính

- Identity/RBAC: `users`, `roles`, `permissions`, `user_roles`.
- CMS: `categories`, `posts`, `post_images`, `documents`, `media_files`.
- Academic structure: academic years, semesters, subjects, curriculum.
- People: teacher/student profiles, guardians và guardian links.
- Enrollment: classrooms, enrollment history và classroom membership tương thích.
- Teaching: teaching assignments, timetables và timetable items.
- Learning operations: attendance, assignments/submissions, gradebooks/scores,
  conduct, report cards và student requests.
- Communication: notifications và user notification state.

## Source of truth

- Enrollment xác định học sinh thuộc lớp nào tại một thời điểm.
- Teaching assignment xác định giáo viên được dạy lớp/môn/học kỳ nào.
- Assessment configuration xác định cột điểm và công thức.
- Gradebook snapshot giữ cấu hình đã dùng khi nhập điểm.
- Published timetable version xác định lịch tuần; daily override chỉ thay đổi
  ngày cụ thể và không sửa lịch gốc.

## Hướng schema thời khóa biểu bắt buộc

Task 5.15 phải bổ sung mô hình cấu hình được, không chỉ tăng `lesson_index` lên
1-10:

```text
school_shift
  id, code, name, sort_order, is_active

bell_period
  id, shift_id, period_index, starts_at, ends_at

timetable_version
  classroom_id, academic_year_id, semester_id, status, version

timetable_slot
  version_id, day_of_week, shift_id, period_index,
  classroom_id, subject_id, teaching_assignment_id, room_id
```

Tên bảng cuối cùng phải dựa trên audit schema hiện tại, nhưng invariant không
được thay đổi:

- unique classroom slot;
- unique teacher slot;
- unique room slot;
- assignment khớp classroom/subject/semester;
- chỉ version không conflict mới được publish.

Nếu PostgreSQL không thể tạo unique constraint xuyên parent/child do scope nằm
ở bảng khác, service phải khóa/kiểm tra trong transaction và có database trigger
hoặc bảng slot đã denormalize đủ khóa để bảo vệ concurrent writes.

## Quy tắc thay đổi schema

1. Không sửa migration đã áp dụng.
2. Migration có backfill và kiểm tra dữ liệu vi phạm trước khi thêm constraint.
3. Không tạo constraint sau khi âm thầm bỏ qua record lỗi.
4. Dùng `NUMERIC` cho điểm, `TIMESTAMPTZ` cho sự kiện thời gian thực và kiểu
   time/local date rõ ràng cho bell schedule.
5. JSONB chỉ dùng cho metadata không cần invariant quan hệ.
6. Index dựa trên query/EXPLAIN, không thêm theo phỏng đoán.
