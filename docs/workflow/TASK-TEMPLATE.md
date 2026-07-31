# Task X.Y - Tên task

> **Phase:** X
> **Ưu tiên:** P0 | P1 | P2
> **Trạng thái:** Chưa thực hiện | Đang thực hiện | Hoàn thành | Bị chặn
> **Yêu cầu trước:** Liệt kê task dependency

## Mục tiêu

Mô tả kết quả nghiệp vụ có thể quan sát và kiểm chứng được.

## Phạm vi bắt buộc

- Database/migration và kế hoạch backfill.
- Backend API, validation, transaction, permission và audit.
- Frontend route, loading/error/empty/permission states và responsive.
- Dữ liệu demo hợp lệ để kiểm tra thủ công.
- Tài liệu vận hành liên quan.

## Ngoài phạm vi

Ghi rõ phần chưa làm để ngăn mở rộng task ngoài kiểm soát.

## Quy tắc nghiệp vụ

- Liệt kê invariant bắt buộc và trường hợp xung đột.
- Xác định source of truth, trạng thái và quyền theo phạm vi.
- Không hardcode quy tắc có thể thay đổi theo năm học/trường.

## Quy tắc kỹ thuật

- Chỉ thêm migration PostgreSQL mới; không sửa migration đã áp dụng.
- SQL nghiệp vụ chỉ nằm trong repository và phải parameterized.
- Controller không truy cập database trực tiếp.
- Write nhiều bảng phải dùng transaction.
- Dữ liệu nhạy cảm phải có RBAC, scope và audit phù hợp.
- Không đánh dấu hoàn thành nếu fixture vi phạm nghiệp vụ.

## Checklist triển khai

- [ ] Đọc schema, API và task dependency hiện tại
- [ ] Chốt migration/backfill/rollback
- [ ] Backend validation/service/repository/API
- [ ] Conflict, permission và ownership tests
- [ ] Frontend service/type/routes/UI
- [ ] Responsive và accessibility smoke
- [ ] Dữ liệu demo hợp lệ
- [ ] Cập nhật tài liệu

## Tự kiểm tra bắt buộc

- [ ] `npm run db:setup`
- [ ] Backend `npm run quality`
- [ ] Frontend `npm run build`
- [ ] Happy path bằng API thật
- [ ] Conflict path trả lỗi rõ ràng
- [ ] Forbidden path theo role/scope
- [ ] Reload UI giữ đúng dữ liệu
- [ ] Không phá module hiện có
- [ ] Docker runtime healthy nếu task tác động runtime

## Definition of Done

Task chỉ hoàn thành khi migration, automated tests và runtime flow đều pass;
dữ liệu demo không vi phạm invariant; report ghi rõ giới hạn còn lại. Build pass
hoặc có màn hình mới nhưng chưa lưu/đọc đúng dữ liệu không được tính là hoàn
thành.

## Khu vực Report

```text
[YYYY-MM-DD]
- Files/migrations:
- API/routes:
- Automated tests:
- Runtime/UI checks:
- Security/RBAC/conflict checks:
- Demo data:
- Known limitations:
- Next task:
```
