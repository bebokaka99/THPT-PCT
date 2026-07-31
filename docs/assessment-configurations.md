# Assessment Configurations

## Source of truth

`assessment_configurations` và `assessment_categories` là nguồn chuẩn cho cấu
trúc đầu điểm. UI gradebook tương lai không được tự tạo cột hoặc hardcode hệ số.

Scope của cấu hình:

```text
subject_id + semester_id + grade_level
```

Mỗi scope có tối đa một draft và một active version. Khi activate draft mới,
active cũ chuyển thành archived và vẫn giữ toàn bộ categories.

## Trạng thái và thao tác

| Trạng thái | Sửa nội dung | Xóa | Activate | Tạo version |
|---|---:|---:|---:|---:|
| Draft | Có | Có | Có | Không cần |
| Active | Không | Không | Đã active | Có |
| Archived | Không | Không | Không | Có nếu chưa có draft |

Database trigger bảo vệ state transition và ngăn chỉnh category của active hoặc
archived version. API cũng kiểm tra lại để trả lỗi 409 rõ ràng.

## Quyền

| Actor | Danh sách | Detail | Create/update/activate | Calculator |
|---|---|---|---|---|
| Admin có permission | Tất cả | Tất cả | Có | Có |
| Teacher có assignment active | Active đúng scope | Active đúng scope | Không | Có |
| Teacher khác | Không | 403 | Không | 403 |
| Student | Không | Không | Không | Không |

Classroom membership hoặc vai trò chủ nhiệm không thay thế teaching assignment.

## Công thức backend

```text
average(category) = sum(values) / count(values)
normalized(category) = average / category_scale * configuration_scale
weighted(category) = normalized * weight_percent / 100
raw = sum(weighted categories)
final = configured_round(raw)
```

Calculator yêu cầu:

- có đủ tất cả category code;
- mỗi category có ít nhất một score;
- không vượt `max_entries`;
- score nằm trong `0..category.score_scale`;
- không có category code trùng hoặc lạ.

Ví dụ cấu hình thang 10, một chữ số, `half_up`:

```text
TX [8, 9], weight 40% => average 8.5 => 3.4
CK [7.5], weight 60% => 4.5
raw = 7.9
final = 7.9
```

## Quy trình vận hành

1. Hoàn tất academic year/semester.
2. Hoàn tất curriculum theo khối.
3. Mở `Admin > Cấu hình đầu điểm`.
4. Chọn học kỳ, khối và môn trong curriculum.
5. Khai báo categories và đảm bảo tổng trọng số 100%.
6. Lưu draft, kiểm tra calculator và activate.
7. Teacher xem tại `Giáo viên > Cấu hình đầu điểm`.
8. Khi thay đổi công thức, tạo version mới; không sửa active version.

## Tích hợp gradebook tương lai

- Mỗi grade record phải tham chiếu configuration/category version cụ thể.
- Grade publication phải lưu raw score, final score và rounding metadata.
- Không tính điểm tổng kết chỉ ở frontend.
- Configuration có grade reference phải dùng `ON DELETE RESTRICT`.
- Recalculation phải có audit actor, thời gian, lý do và old/new result.

## Giới hạn v1

- Chưa lưu score thật.
- Chưa có approval workflow.
- Chưa có category optional.
- Chưa có import/export template.
- Precision configuration tối đa 2 chữ số thập phân.
