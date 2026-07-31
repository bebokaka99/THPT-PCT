# Task X.Y — Tên task

> **Phase:** X  
> **Trạng thái:** ⏳ Chưa thực hiện  
> **Yêu cầu trước:** Liệt kê task dependency

## Mục tiêu

Mô tả kết quả nghiệp vụ cần đạt, không chỉ tên file hoặc công nghệ.

## Phạm vi bắt buộc

- Database/migration.
- Backend API, validation, permission.
- Frontend routes, states và responsive.
- Dữ liệu kiểm tra local tối thiểu.
- Tài liệu vận hành liên quan.

## Ngoài phạm vi

Ghi rõ phần chưa làm để tránh mở rộng task không kiểm soát.

## Quy tắc kỹ thuật

- PostgreSQL migration mới, không sửa migration đã chạy.
- Không bypass service/repository hoặc RBAC.
- Không trả dữ liệu nhạy cảm.
- Mọi write quan trọng phải có transaction/audit khi phù hợp.
- UI phải có loading/error/empty/permission states.

## Checklist triển khai

- [ ] Đọc dependency và schema hiện tại
- [ ] Viết migration idempotent
- [ ] Backend validation/service/repository/API
- [ ] Permission và ownership tests
- [ ] Frontend service/type/routes/UI
- [ ] Responsive và accessibility smoke
- [ ] Cập nhật docs

## Tự kiểm tra bắt buộc

- [ ] `npm run db:setup`
- [ ] Backend `npm run quality`
- [ ] Frontend `npm run build`
- [ ] Happy path bằng API thật
- [ ] Ít nhất một forbidden path
- [ ] Không phá module hiện có
- [ ] Không tạo dữ liệu/file mồ côi

## Definition of Done

Task chỉ hoàn thành khi migration, build, automated tests và runtime flow đều
pass; report ghi rõ phần chưa kiểm tra và giới hạn còn lại.

## Khu vực Report

```text
[YYYY-MM-DD]
- Files/migrations:
- API/routes:
- Automated tests:
- Runtime checks:
- Security/RBAC checks:
- Known limitations:
- Next task:
```
