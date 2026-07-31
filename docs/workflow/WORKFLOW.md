# THPT-PCT-PT — WORKFLOW MASTER PLAN

> **Mục đích:** Kế hoạch phát triển A-Z cho toàn bộ school portal.
> Mỗi task là 1 file `.md` riêng, tự chứa: mô tả, hướng làm, plan dự phòng, checklist, và khu vực report.
>
> **Cách sử dụng:** Khi bắt đầu task, đọc file `.md` tương ứng → thực hiện → tự đánh dấu checklist → report kết quả ngay trong file đó.
> Phạm vi tab theo role được kiểm soát tại
> [ACADEMIC-SCOPE.md](ACADEMIC-SCOPE.md).

---

## Tổng quan phases

| Phase | Folder | Mô tả | Số tasks |
|-------|--------|-------|----------|
| 0 | `phase-0-critical-fixes/` | Sửa lỗi bảo mật & critical bugs | 3 |
| 1 | `phase-1-foundation/` | Nền tảng code quality & DX | 5 |
| 2 | `phase-2-backend-stabilization/` | Ổn định & cải tiến backend | 6 |
| 3 | `phase-3-frontend-stabilization/` | Ổn định & cải tiến frontend | 5 |
| 4 | `phase-4-feature-completion/` | Hoàn thiện & thêm features | 8 |
| 5 | `phase-5-academic-operations/` | Nghiệp vụ học vụ/SIS cốt lõi | 14 |
| 6 | `phase-6-production-prep/` | Security, vận hành & deploy production | 8 |

---

## Phase 0 — Critical Fixes (BẮT BUỘC LÀM TRƯỚC)

- [x] [0.1 — JWT Secret Security](phase-0-critical-fixes/0.1-jwt-secret-security.md)
- [x] [0.2 — Schema Migration Conflicts](phase-0-critical-fixes/0.2-schema-migration-conflicts.md)
- [x] [0.3 — Inline Auth Anti-pattern](phase-0-critical-fixes/0.3-inline-auth-antipattern.md)

## Phase 1 — Foundation & Code Quality

- [x] [1.1 — Extract Shared Validators](phase-1-foundation/1.1-extract-shared-validators.md)
- [x] [1.2 — API Client Consistency](phase-1-foundation/1.2-api-client-consistency.md)
- [x] [1.3 — Frontend Auth Headers Utility](phase-1-foundation/1.3-frontend-auth-headers.md)
- [x] [1.4 — Error Handling Foundation](phase-1-foundation/1.4-error-handling-foundation.md)
- [x] [1.5 — Backend Logging Setup](phase-1-foundation/1.5-backend-logging-setup.md)

## Phase 2 — Backend Stabilization

- [x] [2.1 — Rate Limiting](phase-2-backend-stabilization/2.1-rate-limiting.md)
- [x] [2.2 — Input Sanitization & SQL Safety](phase-2-backend-stabilization/2.2-input-sanitization.md)
- [x] [2.3 — Database Connection Tuning](phase-2-backend-stabilization/2.3-database-connection-tuning.md)
- [x] [2.4 — Soft Delete Posts & Documents](phase-2-backend-stabilization/2.4-soft-delete.md)
- [x] [2.5 — Full-Text Search Foundation](phase-2-backend-stabilization/2.5-fulltext-search.md)
- [x] [2.6 — Unit Tests Backend](phase-2-backend-stabilization/2.6-unit-tests-backend.md)

## Phase 3 — Frontend Stabilization

- [x] [3.1 — React Query Integration](phase-3-frontend-stabilization/3.1-react-query.md)
- [x] [3.2 — Global Error & Toast System](phase-3-frontend-stabilization/3.2-global-error-toast.md)
- [x] [3.3 — Auth Token Auto-Refresh](phase-3-frontend-stabilization/3.3-auth-token-refresh.md)
- [x] [3.4 — Responsive UI Audit](phase-3-frontend-stabilization/3.4-responsive-ui-audit.md)
- [x] [3.5 — SEO Meta Tags](phase-3-frontend-stabilization/3.5-seo-meta-tags.md)

## Phase 4 — Feature Completion

- [x] [4.1 — Student Portal Rebuild](phase-4-feature-completion/4.1-student-portal.md)
- [x] [4.2 — Teacher Portal Polish](phase-4-feature-completion/4.2-teacher-portal-polish.md)
- [x] [4.3 — Notification Center UI](phase-4-feature-completion/4.3-notification-center.md)
- [x] [4.4 — Profile Management](phase-4-feature-completion/4.4-profile-management.md)
- [x] [4.5 — Events Module](phase-4-feature-completion/4.5-events-module.md)
- [x] [4.6 — Timetable Export & Print](phase-4-feature-completion/4.6-timetable-export.md)
- [x] [4.7 — Media Image Optimization](phase-4-feature-completion/4.7-media-optimization.md)
- [x] [4.8 — Admin Dashboard Stats](phase-4-feature-completion/4.8-admin-dashboard-stats.md)

## Phase 5 — Academic Operations (BẮT BUỘC TRƯỚC SIS PRODUCTION)

> Gradebook không được làm trước các task 5.1–5.5. `classroom_members`,
> `class_name` và chuỗi subject trong timetable hiện tại không đủ làm source of
> truth cho dữ liệu học vụ.

- [x] [5.1 — Academic Years & Semesters](phase-5-academic-operations/5.1-academic-years-semesters.md)
- [x] [5.2 — Subjects & Curriculum](phase-5-academic-operations/5.2-subjects-curriculum.md)
- [x] [5.3 — Student Enrollment History](phase-5-academic-operations/5.3-enrollment-history.md)
- [x] [5.4 — Teaching Assignments](phase-5-academic-operations/5.4-teaching-assignments.md)
- [x] [5.5 — Assessment Configuration](phase-5-academic-operations/5.5-assessment-configuration.md)
- [x] [5.6 — Attendance Management](phase-5-academic-operations/5.6-attendance-management.md)
- [x] [5.7 — Assignments & Homework](phase-5-academic-operations/5.7-assignments-homework.md)
- [x] [5.8 — Gradebook & Teacher Grade Entry](phase-5-academic-operations/5.8-gradebook-foundation.md)
- [x] [5.9 — Grade Approval, Locking & Audit](phase-5-academic-operations/5.9-grade-approval-locking-audit.md)
- [x] [5.10 — Student Transcript & Report Card](phase-5-academic-operations/5.10-student-transcript-report-card.md)
- [x] [5.11 — Conduct & Homeroom Comments](phase-5-academic-operations/5.11-conduct-homeroom-comments.md)
- [x] [5.12 — Parent & Guardian Portal](phase-5-academic-operations/5.12-parent-guardian-portal.md)
- [x] [5.13 — Student Requests & School Forms](phase-5-academic-operations/5.13-student-requests-forms.md)
- [x] [5.14 — Academic Import/Export & Reports](phase-5-academic-operations/5.14-academic-import-export-reports.md)

## Phase 6 — Production Preparation

- [x] [6.1 — Production Security & Privacy Audit](phase-6-production-prep/6.1-security-privacy-audit.md)
- [x] [6.2 — Docker Setup](phase-6-production-prep/6.2-docker-setup.md)
- [ ] [6.3 — CI/CD Pipeline](phase-6-production-prep/6.3-cicd-pipeline.md)
- [ ] [6.4 — Environment & Secrets Management](phase-6-production-prep/6.4-environment-secrets.md)
- [ ] [6.5 — Database Backup & Restore Strategy](phase-6-production-prep/6.5-database-backup-restore.md)
- [ ] [6.6 — Observability & Operations](phase-6-production-prep/6.6-observability-operations.md)
- [ ] [6.7 — Load & Performance Test](phase-6-production-prep/6.7-load-performance-test.md)
- [ ] [6.8 — Domain, SSL & Production Release](phase-6-production-prep/6.8-domain-ssl-release.md)

---

## Quy tắc thực hiện

1. **Thứ tự:** Phase 0 → 1 → 2/3 → 4 → 5 → 6. Không bỏ qua
   dependency để làm UI trước data model.
2. **Mỗi task:** Đọc file task và `TASK-TEMPLATE.md`, chốt scope, triển khai,
   tự kiểm tra rồi ghi report trong chính file.
3. **Database:** Chỉ thêm migration mới tại
   `database/postgresql/migrations`; không sửa migration đã áp dụng, không dùng
   MySQL legacy làm source of truth.
4. **Security:** Mọi API học vụ phải kiểm tra cả role, assignment/enrollment và
   ownership. Có role đúng nhưng sai lớp/môn vẫn phải bị từ chối.
5. **Dữ liệu nhạy cảm:** Điểm, chuyên cần, hạnh kiểm, thông tin phụ huynh không
   được xuất hiện trong public API, log, notification body hoặc frontend bundle.
6. **Audit:** Sửa điểm, khóa/mở điểm, chuyển lớp, chỉnh chuyên cần và liên kết
   guardian phải ghi actor, thời gian, lý do và old/new values phù hợp.
7. **Transaction:** Bulk import, chuyển lớp, bulk attendance/grades và publish
   kết quả phải atomic hoặc có partial mode được mô tả rõ.
8. **Quality gate:** Tối thiểu `npm run db:setup`, backend
   `npm run quality`, frontend `npm run build`, happy path thật và forbidden
   path theo role.
9. **Không hoàn thành giả:** Không đánh dấu `[x]` nếu chỉ scaffold/build pass
   mà chưa chạy migration, runtime API và role isolation.
10. **Khi lỗi:** Ghi lỗi, nguyên nhân, dữ liệu ảnh hưởng và plan dự phòng trong
    report; không bỏ qua test thất bại.
11. **Khi xong:** Đánh dấu checklist trong file task và `WORKFLOW.md`, cập nhật
    `docs/workflow-report.md`, ghi giới hạn và task kế tiếp.
12. **SQL runtime:** Query nghiệp vụ chỉ đặt trong `*.repository.ts` và phải
    parameterized; controller/service không viết SQL. DDL/seed chỉ đặt trong
    `database/postgresql/migrations` và `database/postgresql/seeds`.

---

> Cập nhật lần cuối: 2026-07-31
> Trạng thái: **Task 6.3 chờ deploy runners; Task 6.4 source/local gates pass,
> chờ environment secret thật**
>
> Production deployment chỉ bắt đầu sau khi đã chốt rõ phạm vi Phase 5. Nếu
> deploy sớm bản CMS/classroom hiện tại, phải ghi rõ đó chưa phải SIS hoàn chỉnh.
