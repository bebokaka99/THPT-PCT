# Import, export và báo cáo học vụ

## Truy cập

Đăng nhập bằng tài khoản admin và mở:

```text
http://localhost:5173/admin/academic-operations
```

Backend mặc định trong môi trường local hiện dùng:

```text
http://localhost:4001/api/academic-operations
```

## Quy trình import

1. Chọn loại dữ liệu.
2. Tải file mẫu CSV.
3. Nhập dữ liệu, không đổi tên cột.
4. Upload file và bấm **Kiểm tra file**.
5. Sửa tất cả dòng lỗi; job có lỗi không thể commit.
6. Khi số dòng lỗi bằng 0, bấm **Commit toàn bộ dữ liệu**.

Mỗi lần preview có `idempotency_key`. Retry cùng key và cùng nội dung trả lại
job cũ. Dùng cùng key cho file khác bị từ chối `409`.

## Cấu trúc file

### Xếp lớp

```csv
student_code,classroom_id,enrolled_at,note
12PCT01010001,1,2026-08-15,
```

### Bài tập

```csv
teaching_assignment_id,title,description,due_at,allow_late
1,Bài tập tuần 1,,2026-09-01T16:00:00+07:00,false
```

### Chuyên cần

Tất cả dòng trong một file phải cùng `session_id`.

```csv
session_id,student_code,status,note,correction_reason
1,12PCT01010001,present,,
```

### Điểm

Tất cả dòng trong một file phải cùng `gradebook_id`. `column_label` phải khớp
đúng nhãn cột trong sổ điểm. `expected_version` bảo vệ khỏi ghi đè thay đổi mới.

```csv
gradebook_id,student_code,column_label,state,score,expected_version,reason
1,12PCT01010001,Kiểm tra thường xuyên 1,scored,8.5,0,Nhập từ CSV
```

## API

```text
GET  /api/academic-operations/templates/:type
POST /api/academic-operations/imports/preview
GET  /api/academic-operations/imports
GET  /api/academic-operations/imports/:id
GET  /api/academic-operations/imports/:id/errors
POST /api/academic-operations/imports/:id/commit

GET /api/academic-operations/exports/roster
GET /api/academic-operations/exports/attendance
GET /api/academic-operations/exports/gradebook/:id
GET /api/academic-operations/exports/transcript-summary
GET /api/academic-operations/reports/summary
```

Preview dùng `multipart/form-data`:

```text
file=<csv>
type=enrollments|assignments|attendance|grades
idempotency_key=<8-120 ký tự>
```

## An toàn dữ liệu

- Không lưu file CSV sau khi parse.
- Không log nội dung file hoặc PII.
- Không chấp nhận công thức/macro.
- Không commit một phần.
- Import điểm không thể bypass trạng thái và khóa sổ điểm.
- SQL nghiệp vụ chỉ nằm trong repository và luôn dùng parameterized query.

## Giới hạn

V1 chỉ nhận CSV tối đa 2 MB/2.000 dòng và xử lý đồng bộ. Queue/worker là yêu cầu
bắt buộc trước khi nâng giới hạn hoặc chạy nhiều import đồng thời ở production.

