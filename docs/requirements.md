# Yêu cầu dự án THPT-PCT-PT

THPT-PCT-PT là cổng thông tin và hệ thống vận hành học vụ cho Trường THPT Phan
Chu Trinh - Phan Thiết. Sản phẩm gồm public website và portal theo vai trò.

## Phạm vi cốt lõi

- Public website: tin tức, danh mục, sự kiện, tài liệu và tìm kiếm.
- Admin: tài khoản, lớp, enrollment, phân công, học kỳ, môn, thời khóa biểu,
  chuyên cần, bài tập, điểm, hạnh kiểm, đơn và báo cáo.
- Teacher: lịch dạy cá nhân, lớp/môn phụ trách, điểm danh, bài tập, sổ điểm,
  nhận xét, đơn học sinh, kế hoạch bài dạy, sổ đầu bài và hồ sơ.
- Student: lớp, thời khóa biểu, chuyên cần, bài tập, điểm theo môn, phiếu kết
  quả, hạnh kiểm, đơn và hồ sơ.
- Guardian: theo dõi đúng học sinh được liên kết, không có quyền sửa dữ liệu
  học vụ.

## Trạng thái phạm vi

- Nền móng CMS và học vụ đã có.
- Chưa được coi là SIS production-ready trước khi hoàn thành Task 5.15
  (timetable integrity) và 5.16 (grade subject exploration).
- Y tế, tuyển sinh, khoản thu và liên thông dữ liệu thuộc Phase 7, chỉ triển khai
  sau quyết định sản phẩm/privacy.

## Tech stack chuẩn

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Query.
- Backend: Node.js, Express, TypeScript, repository/service architecture.
- Database: PostgreSQL 18.
- Runtime local/deploy: Docker; không phụ thuộc XAMPP.
- Không dùng Prisma; SQL parameterized nằm trong repository.

## Quy tắc nghiệp vụ bắt buộc

1. Teacher access dựa trên assignment; student dựa trên enrollment; guardian
   dựa trên guardian link còn hiệu lực.
2. Dữ liệu student/guardian xem phải approved/published/locked theo workflow.
3. Một giáo viên, lớp hoặc phòng không được xuất hiện hai lần trong cùng slot
   lịch hiệu lực.
4. Ca học, tiết học, năm/học kỳ, môn, số lần TX và công thức không hardcode.
5. Điểm tổng kết do backend tính và duyệt; frontend không tự suy luận.
6. Mọi thay đổi điểm, chuyên cần, enrollment, lịch và liên kết guardian quan
   trọng phải có audit.
7. Demo/seed phải hợp lệ theo cùng rule với production.

## Yêu cầu chất lượng

- Migration mới, có checksum, không sửa migration đã áp dụng.
- Write nhiều bảng dùng transaction.
- API có validation, error code rõ và không trả PII ngoài phạm vi.
- UI có loading, error, empty, conflict và permission state.
- Task học vụ có happy/conflict/forbidden automated tests.
- Definition of Done tuân thủ `docs/workflow/TASK-TEMPLATE.md`.
