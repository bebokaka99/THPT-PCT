# Quy trình duyệt và khóa sổ điểm

## Luồng vận hành

1. Giáo viên mở sổ từ phân công giảng dạy và nhập điểm ở trạng thái `draft`.
2. Giáo viên chọn **Gửi duyệt**. Sổ chuyển sang chỉ đọc và admin nhận thông báo.
3. Admin chọn **Duyệt** hoặc **Trả lại**. Trả lại bắt buộc ghi lý do.
4. Điểm đã duyệt hiển thị cho học sinh. Admin có thể khóa sổ để kết thúc kỳ nhập.
5. Nếu cần sửa sổ đã khóa, giáo viên gửi yêu cầu có lý do. Chỉ admin/reviewer
   khác người yêu cầu mới được duyệt mở lại.

## Kiểm tra và truy vết

Trang `/admin/gradebooks` hiển thị trạng thái, hàng đợi yêu cầu sửa, lịch sử
workflow và cho phép xuất CSV. Nhật ký được giữ bất biến trong PostgreSQL.

## Quy tắc bắt buộc cho thay đổi tương lai

- Không cập nhật trực tiếp trạng thái sổ ngoài repository workflow.
- Không thêm đường ghi điểm bỏ qua kiểm tra `draft`.
- Không xóa hoặc sửa audit record.
- Mọi transition mới phải cập nhật đồng thời state matrix ở service, trigger DB,
  smoke test và tài liệu này.
- Việc gửi notification không được làm thay đổi quyền truy cập điểm.
