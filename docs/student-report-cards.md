# Phiếu kết quả học tập

Tài liệu này mô tả cách vận hành bảng điểm học kỳ và phiếu kết quả của học sinh.

## Nguồn dữ liệu

- Chỉ gradebook ở trạng thái `approved` hoặc `locked` được đưa vào phiếu.
- Điểm tổng kết và trung bình được tính tại backend.
- `student_report_snapshots` lưu đầu phiếu; bảng
  `student_report_snapshot_subjects` lưu kết quả từng môn.
- Học kỳ mở trả dữ liệu đã duyệt hiện tại. Học kỳ khóa/đóng trả snapshot để lịch
  sử không thay đổi.

## Quy trình vận hành

1. Giáo viên nhập và gửi duyệt gradebook.
2. Admin hoặc người có quyền duyệt gradebook.
3. Học sinh xem kết quả đã duyệt tại `/student/grades`.
4. Khi khóa/đóng học kỳ, backend tự tạo snapshot cho học sinh có enrollment.
5. Admin có thể kiểm tra tại `/admin/report-cards`; giáo viên xem phạm vi tại
   `/teacher/report-cards`.
6. Chọn “In / Lưu PDF” và dùng print dialog để in hoặc lưu PDF A4.

## Phân quyền

| Vai trò | Phạm vi |
| --- | --- |
| Student | Chỉ phiếu của chính mình |
| Subject teacher | Chỉ học sinh/lớp/môn được phân công |
| Homeroom teacher | Toàn bộ môn của học sinh lớp chủ nhiệm |
| Admin | Toàn trường và tạo snapshot thủ công |

## API kiểm tra

```powershell
# Học sinh xem phiếu của mình
curl.exe -H "Authorization: Bearer <student-token>" `
  "http://localhost:4001/api/transcripts/me?semester_id=<semester-id>"

# Admin hoặc giáo viên xem danh sách lớp
curl.exe -H "Authorization: Bearer <token>" `
  "http://localhost:4001/api/transcripts/classrooms/<classroom-id>?semester_id=<semester-id>"

# Admin tạo snapshot thủ công sau khi học kỳ đã khóa
curl.exe -X POST -H "Authorization: Bearer <admin-token>" `
  "http://localhost:4001/api/transcripts/semesters/<semester-id>/snapshot"
```

## Lưu ý

- Không gửi ID nội bộ, audit log hoặc điểm chưa duyệt vào bản in.
- Snapshot là bất biến; không sửa trực tiếp dữ liệu lịch sử.
- Nếu cần điều chỉnh sau khóa, dùng change request của gradebook và quy trình
  nghiệp vụ được phê duyệt; snapshot cũ vẫn giữ nguyên.
- PDF ký số, trọng số môn và xếp loại học lực chưa thuộc phiên bản này.
