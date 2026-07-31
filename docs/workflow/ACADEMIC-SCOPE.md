# Academic Operations — Role & Portal Scope

Tài liệu này là checklist phạm vi UI/API theo role. Mỗi tab chỉ được đánh dấu
hoàn thành khi backend policy và dữ liệu thật tương ứng đã pass.

## Admin Portal

| Tab/chức năng | Task |
|---|---|
| Năm học & học kỳ | 5.1 |
| Môn học & chương trình | 5.2 |
| Enrollment/chuyển lớp/lịch sử học sinh | 5.3 |
| Phân công giảng dạy/chủ nhiệm | 5.4 |
| Cấu hình đầu điểm/công thức | 5.5 |
| Tổng hợp chuyên cần | 5.6 |
| Theo dõi bài tập/nộp bài | 5.7 |
| Quản trị gradebook | 5.8 |
| Duyệt, khóa, mở điểm & audit | 5.9 |
| Phiếu kết quả/bảng điểm | 5.10 |
| Hạnh kiểm/rèn luyện | 5.11 |
| Liên kết phụ huynh | 5.12 |
| Duyệt đơn/yêu cầu | 5.13 |
| Import/Export/Báo cáo học vụ | 5.14 |

## Teacher Portal

| Tab/chức năng | Task |
|---|---|
| Lớp/môn được phân công | 5.4 |
| Điểm danh | 5.6 |
| Bài tập & trạng thái nộp | 5.7 |
| Nhập điểm theo môn/lớp | 5.8 |
| Gửi duyệt/xin sửa điểm | 5.9 |
| Xem kết quả phạm vi được giao | 5.10 |
| Sổ chủ nhiệm/nhận xét/hạnh kiểm | 5.11 |
| Xử lý đơn theo vai trò chủ nhiệm | 5.13 |
| Import/Export roster/gradebook | 5.14 |

## Student Portal

| Tab/chức năng | Task |
|---|---|
| Lớp/năm học hiện tại và lịch sử | 5.3 |
| Chuyên cần | 5.6 |
| Bài tập & nộp bài | 5.7 |
| Bảng điểm đã công bố | 5.10 |
| Phiếu kết quả/in PDF | 5.10 |
| Hạnh kiểm & nhận xét đã công bố | 5.11 |
| Đơn từ/yêu cầu | 5.13 |

## Parent/Guardian Portal

| Tab/chức năng | Task |
|---|---|
| Chọn học sinh được liên kết | 5.12 |
| Thông báo | 5.12 |
| Chuyên cần | 5.12 + 5.6 |
| Bảng điểm đã công bố | 5.12 + 5.10 |
| Hạnh kiểm/nhận xét | 5.12 + 5.11 |

## Quy tắc acceptance xuyên role

1. Menu/tab không hiển thị nếu role không có khả năng truy cập.
2. Ẩn UI không thay thế backend authorization.
3. Admin, teacher, student và guardian phải có ít nhất một forbidden-path test.
4. Student/guardian chỉ thấy dữ liệu đã approved/published.
5. Mọi danh sách có loading/error/empty; bảng lớn có pagination hoặc virtualize.
6. Mobile phải dùng được luồng read; grade entry desktop/tablet được ưu tiên
   nhưng không được vỡ layout mobile.
7. Dashboard chỉ tổng hợp dữ liệu từ module đã hoàn thành, không dùng số giả.
