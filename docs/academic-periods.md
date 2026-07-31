# Vận hành năm học và học kỳ

## Source of truth

PostgreSQL `academic_years` và `semesters` là nguồn dữ liệu chuẩn. Các cột
`classrooms.school_year` và `timetables.school_year/semester` chỉ được giữ để
tương thích với dữ liệu và client cũ; write mới phải gửi `academic_year_id` và
`semester_id`.

## Quy trình đầu năm học

1. Admin mở `/admin/academic-periods`.
2. Tạo năm học với ngày bắt đầu/kết thúc không chồng năm hiện có.
3. Tạo các học kỳ nằm trong date range của năm học.
4. Kích hoạt học kỳ cần dùng. Backend đồng thời kích hoạt đúng năm học và tắt
   period active cũ trong một transaction.
5. Tạo lớp hoặc thời khóa biểu bằng period đã cấu hình.

## Khóa và đóng

- `Khóa`: chặn write học vụ nhưng admin có thể mở khóa.
- `Đóng`: trạng thái kết thúc, tự khóa và không mở lại trong flow v1.
- Đóng năm học sẽ đóng toàn bộ học kỳ thuộc năm đó.
- Period có lớp/thời khóa biểu tham chiếu không thể xóa.

## Backfill

Migration `020_create_academic_periods.sql` chỉ map năm dạng `YYYY-YYYY` với hai
năm liên tiếp. Học kỳ map best-effort theo tên/mã HK1, HK2. Record không nhận
diện được vẫn được giữ nguyên với foreign key `NULL` để admin xử lý, không tự
gán sai.

Kiểm tra record chưa map:

```sql
SELECT id, name, school_year
FROM classrooms
WHERE academic_year_id IS NULL;

SELECT id, classroom_id, school_year, semester
FROM timetables
WHERE academic_year_id IS NULL
   OR (semester IS NOT NULL AND semester_id IS NULL);
```

## Quality gate

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:setup
npm run quality

cd D:\THPT-PCT-PT\frontend
npm run build
```
