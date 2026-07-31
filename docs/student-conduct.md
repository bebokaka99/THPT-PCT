# Quản lý kết quả rèn luyện

## Tổng quan

Module rèn luyện lưu một kết quả theo học sinh và học kỳ. Giáo viên chủ nhiệm
nhập mức đánh giá và nhận xét, admin thực hiện duyệt/khóa, học sinh chỉ xem dữ
liệu đã được duyệt.

## Quy trình

```text
draft -> submitted -> approved -> locked
             |
             +-> rejected -> draft
```

- `draft`: giáo viên chủ nhiệm được sửa.
- `submitted`: chờ admin duyệt, không được sửa.
- `approved`: học sinh xem được, admin có thể khóa.
- `locked`: bất biến và dùng cho hồ sơ lịch sử.
- `rejected`: thao tác trả lại chuyển bản ghi về `draft` và bắt buộc có lý do.

## Mức đánh giá

| Giá trị API | Hiển thị |
|---|---|
| `good` | Tốt |
| `fair` | Khá |
| `pass` | Đạt |
| `not_pass` | Chưa đạt |

Không tự động xếp loại từ số ngày nghỉ/đi muộn. Giao diện chỉ hiển thị tổng hợp
chuyên cần để giáo viên tham khảo.

## Giao diện

- Giáo viên: `/teacher/conduct`
- Admin: `/admin/conduct`
- Học sinh: kết quả xuất hiện trong `/student/grades`
- Phiếu kết quả: hiển thị mức rèn luyện và nhận xét chủ nhiệm khi dữ liệu đã
  `approved` hoặc `locked`.

## API

Tất cả endpoint dưới đây yêu cầu JWT:

```text
GET  /api/conduct/me?semester_id={id}
GET  /api/conduct?classroom_id={id}&semester_id={id}
PUT  /api/conduct/students/{studentId}
POST /api/conduct/{id}/submit
POST /api/conduct/{id}/approve
POST /api/conduct/{id}/reject
POST /api/conduct/{id}/lock
GET  /api/conduct/{id}/audit
```

Payload lưu bản nháp:

```json
{
  "classroom_id": 1,
  "semester_id": 1,
  "rating": "good",
  "homeroom_comment": "Có ý thức học tập và tham gia hoạt động tốt."
}
```

Payload trả lại:

```json
{
  "reason": "Cần bổ sung nhận xét cụ thể."
}
```

## Quy tắc vận hành

1. Phải nhập và duyệt rèn luyện trước khi đóng/khóa học kỳ.
2. Chỉ giáo viên được gán làm chủ nhiệm lớp hoặc admin mới được truy cập roster.
3. Chỉ admin có `conduct.review` được duyệt, trả lại hoặc khóa.
4. Không đưa nhận xét học sinh vào public API, log hoặc notification body.
5. Snapshot report card giữ nguyên kết quả lịch sử sau khi học kỳ đã đóng.
