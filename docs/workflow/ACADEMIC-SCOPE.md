# Academic Operations - Role & Portal Scope

Tài liệu này là ma trận chức năng theo vai trò. Ký hiệu:

- `Done`: đã có workflow chạy được.
- `Polish`: đã có nền móng nhưng còn task hoàn thiện.
- `Planned`: chưa triển khai.

## Admin Portal

| Chức năng | Trạng thái | Task |
|---|---|---|
| Năm học, học kỳ, môn và chương trình | Done | 5.1, 5.2 |
| Xếp lớp và lịch sử enrollment | Done | 5.3 |
| Phân công giảng dạy/chủ nhiệm | Done | 5.4 |
| Cấu hình đầu điểm | Done | 5.5 |
| Chuyên cần | Done | 5.6 |
| Bài tập, sổ điểm, duyệt và khóa điểm | Done | 5.7-5.10 |
| Hạnh kiểm, phụ huynh, đơn học sinh | Done | 5.11-5.13 |
| Import/export và báo cáo học vụ | Done | 5.14 |
| Ca học, thời khóa biểu và phát hiện xung đột | Polish | 5.15 |
| Lịch kiểm tra/thi toàn trường | Planned | 5.17 |
| Dạy thay, đổi tiết, đổi phòng | Planned | 5.18 |
| Truyền thông có xác nhận đã đọc | Planned | 5.20 |
| Duyệt kế hoạch bài dạy theo tổ chuyên môn | Planned | 5.21 |
| Theo dõi sổ đầu bài toàn trường | Planned | 5.22 |

## Teacher Portal

| Chức năng | Trạng thái | Task |
|---|---|---|
| Lớp/môn được phân công | Done | 5.4 |
| Điểm danh, bài tập, nhập điểm | Done | 5.6-5.8 |
| Gửi duyệt điểm, phiếu kết quả, hạnh kiểm | Done | 5.9-5.11 |
| Xử lý đơn theo phạm vi chủ nhiệm | Done | 5.13 |
| Lịch dạy cá nhân không trùng tiết | Polish | 5.15 |
| Lịch kiểm tra/thi theo lớp/môn | Planned | 5.17 |
| Báo nghỉ, dạy thay, đổi tiết/phòng | Planned | 5.18 |
| Nhận bài, phản hồi và chấm bài nộp | Polish | 5.19 |
| Gửi thông báo lớp/phụ huynh có theo dõi đọc | Planned | 5.20 |
| Kế hoạch bài dạy và gửi tổ trưởng duyệt | Planned | 5.21 |
| Ghi sổ đầu bài theo tiết thực dạy | Planned | 5.22 |

## Student Portal

| Chức năng | Trạng thái | Task |
|---|---|---|
| Lớp hiện tại và lịch sử lớp | Done | 5.3 |
| Chuyên cần, bài tập, điểm, phiếu kết quả | Done | 5.6-5.10 |
| Hạnh kiểm, đơn/yêu cầu, hồ sơ | Done | 5.11-5.13 |
| Thời khóa biểu lớp theo ca | Polish | 5.15 |
| Lọc điểm theo năm/học kỳ/môn và xem chi tiết môn | Polish | 5.16 |
| Lịch kiểm tra/thi và lịch học bù | Planned | 5.17 |
| Nộp bài và xem phản hồi giáo viên | Polish | 5.19 |
| Thông báo bắt buộc và xác nhận đã đọc | Planned | 5.20 |

## Parent/Guardian Portal

| Chức năng | Trạng thái | Task |
|---|---|---|
| Chọn học sinh được liên kết | Done | 5.12 |
| Xem chuyên cần, điểm, hạnh kiểm | Done | 5.12 |
| Đơn nghỉ phép | Polish | 5.13, 5.20 |
| Lịch học và lịch kiểm tra | Planned | 5.15, 5.17 |
| Thông báo, xác nhận đã đọc và ưu tiên khẩn | Planned | 5.20 |

## Mở rộng sau core SIS

| Chức năng | Task |
|---|---|
| Y tế học đường và hỗ trợ học sinh | 7.1 |
| Tuyển sinh trực tuyến | 7.2 |
| Khoản thu, hóa đơn và đối soát | 7.3 |
| Liên thông dữ liệu và data governance | 7.4 |

## Quy tắc acceptance xuyên role

1. Menu ẩn không thay thế backend authorization.
2. Teacher phải đúng assignment; student phải đúng enrollment; guardian phải có
   liên kết còn hiệu lực.
3. Student/guardian chỉ thấy dữ liệu đã công bố.
4. Bảng lớn phải pagination hoặc virtualize và hoạt động trên mobile.
5. Mỗi workflow có loading, error, empty, conflict và forbidden state.
6. Dashboard chỉ tổng hợp dữ liệu thật từ module đã hoàn thành.
7. Dữ liệu demo phải vượt qua cùng validation/conflict engine với dữ liệu thật.
