# Môn học và chương trình

## Source of truth

- `subjects.code` là định danh nghiệp vụ ổn định của môn.
- `subjects.name` có thể đổi mà không làm mất lịch sử.
- `curriculum_subjects` xác định môn được áp dụng cho một khối trong một năm
  học và số tiết dự kiến mỗi tuần.
- `timetable_items.subject_id` là liên kết chuẩn.
- `timetable_items.subject_name` là snapshot để giữ khả năng đọc lịch sử và
  tương thích dữ liệu cũ, không phải khóa liên kết.

## Quy trình cấu hình

1. Admin mở `/admin/academic-periods`, bảo đảm năm học chưa khóa/đóng.
2. Admin mở `/admin/subjects`, kiểm tra hoặc import danh mục môn.
3. Chọn tab chương trình, năm học và khối 10/11/12.
4. Thêm môn, số tiết/tuần và trạng thái bắt buộc/tự chọn.
5. Teacher mở lớp và xếp thời khóa biểu từ các môn active đã được cấu hình.

## Import nhanh

Mỗi dòng dùng định dạng:

```text
CODE | Tên môn | subject_group
```

Ví dụ:

```text
TIENG_PHAP | Tiếng Pháp | languages
ROBOTICS | Robotics | technology_arts
```

Nhóm hợp lệ:

- `natural_sciences`
- `social_sciences`
- `languages`
- `technology_arts`
- `physical_education`
- `other`

Import upsert theo mã môn, tối đa 200 dòng/lần. Mã chỉ gồm chữ in hoa, số và
dấu gạch dưới, dài 2-30 ký tự.

## Dữ liệu legacy

Migration cố gắng map alias rõ ràng về môn chuẩn. Tên cũ không nhận diện chắc
chắn được tạo thành môn inactive có mã `LEGACY_*`; chuỗi gốc vẫn được giữ trong
thời khóa biểu.

Không xóa trực tiếp `LEGACY_*`. Sau khi xác minh:

1. Cấu hình môn chuẩn trong curriculum tương ứng.
2. Mở editor thời khóa biểu và thay từng tiết legacy bằng môn chuẩn.
3. Chỉ xóa/deactivate legacy khi không còn tham chiếu.

## Quyền

- Admin có `subjects.manage`: tạo, sửa, import, deactivate và cấu hình chương
  trình.
- Teacher/student đăng nhập có thể đọc danh mục phục vụ portal.
- Teacher không thể tự thay đổi danh mục hoặc chương trình.

## Lệnh kiểm tra

```powershell
cd D:\THPT-PCT-PT\backend
npm run db:setup
npm run test:schema
npm run test:subjects
```
