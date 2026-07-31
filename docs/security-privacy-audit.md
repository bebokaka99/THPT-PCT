# Production Security & Privacy Audit

Ngày audit: 2026-07-30  
Phạm vi: backend API, frontend SPA, PostgreSQL schema, upload local và tài liệu
vận hành.  
Kết luận: đủ điều kiện chuyển sang Task 6.2 để đóng gói môi trường; chưa đủ
điều kiện mở public production cho tới khi các production blockers trong tài
liệu này được đóng.

## 1. Ma trận truy cập

| Nhóm API | Public | Student/Guardian | Teacher | Admin |
|---|---|---|---|---|
| health, search, category, post/document/event published | Read | Read | Read | Read |
| auth/me, notification/me, profile/me | Không | Chính user | Chính user | Chính user |
| users, roles, profiles admin | Không | Không | Không | `users.manage` |
| posts, categories, importer | Read published | Read published | Theo permission | `posts.manage` |
| documents, media | Read published/file public | Read published | Theo permission | Permission quản lý tương ứng |
| classrooms | Không | Chỉ lớp đang tham gia | Lớp được phân công/homeroom | Tất cả |
| enrollment | Không | Chính học sinh | Không mặc định | `enrollments.manage` |
| teaching assignment | Không | Không | Chỉ assignment của mình | `teaching_assignments.manage` |
| attendance | Không | Chỉ bản ghi của mình | Assignment/lớp được giao | Permission quản lý |
| assignment/homework | Không | Lớp đang học | Assignment/lớp được giao | Permission quản lý |
| gradebook/transcript/conduct | Không | Chỉ bản thân | Đúng lớp/môn/chủ nhiệm | Permission quản lý |
| guardian portal | Không | Chỉ liên kết `verified` | Không | Quản lý liên kết |
| student requests | Không | Owner | Reviewer/GVCN đúng scope | Quản lý |
| academic import/export/report | Không | Không | Không | Permission import/export/report |

Nguyên tắc bắt buộc: role chỉ là điều kiện đầu tiên. API học vụ phải tiếp tục
kiểm tra enrollment, teaching assignment, classroom membership, ownership và
trạng thái kỳ học.

## 2. Kiểm kê PII

| Nhóm | Dữ liệu | Mức | Quy tắc |
|---|---|---|---|
| Tài khoản | username, email, full name, status, password hash | Restricted | Không public/log; chỉ admin quản lý |
| Hồ sơ | ngày sinh, điện thoại, parent phone, avatar, bio | Restricted | Self hoặc admin đúng quyền |
| Học vụ | lớp, lịch sử nhập học/chuyển lớp, phân công | Confidential | Theo scope lớp/năm học |
| Chuyên cần | trạng thái, ghi chú, thời gian | Restricted | Student self; teacher assignment; admin |
| Điểm/học bạ | điểm thành phần, tổng kết, snapshot | Restricted | Không đưa vào notification/log/public API |
| Hạnh kiểm | rating, nhận xét chủ nhiệm | Restricted | Theo workflow và transcript scope |
| Phụ huynh | contact, quan hệ, linked student | Restricted | Chỉ verified link; có access audit |
| Đơn học sinh | lý do, phản hồi, private attachment | Restricted | Owner/reviewer; file không public |
| Audit | actor, old/new value, IP/request metadata nếu có | Confidential | Append-only; truy cập vận hành hạn chế |

## 3. Retention đề xuất

Đây là baseline kỹ thuật, không thay thế quyết định pháp lý của nhà trường.
Owner nghiệp vụ và người phụ trách dữ liệu phải phê duyệt trước production.

| Dữ liệu | Retention đề xuất | Hành động cuối kỳ |
|---|---|---|
| Refresh session | Hết hạn + tối đa 30 ngày | Job xóa session expired/revoked |
| Request/application log | 30-90 ngày | Rotate và xóa an toàn |
| Media tạm/orphan | 30 ngày sau khi xác nhận không được tham chiếu | Cleanup job |
| Student request attachment | Theo quy chế hồ sơ, mặc định xem xét 24 tháng | Xóa file và record theo policy |
| Academic record/report snapshot | Theo quy chế lưu trữ giáo dục | Archive có kiểm soát, không hard delete tùy ý |
| Security/grade/attendance audit | Tối thiểu một năm học và theo quy chế | Archive append-only |
| Account rời trường | Khóa ngay; dữ liệu profile theo policy | Pseudonymize/xóa khi hết retention |

## 4. Finding và remediation

| ID | Severity | Finding | Trạng thái | Owner |
|---|---|---|---|---|
| SEC-001 | High | Session vẫn sống sau đổi role/status/password | Closed: revoke toàn bộ refresh session; access token được hydrate user mỗi request | Backend |
| SEC-002 | High | Frontend dependency advisory React Router | Mitigated: 7.18.2, SPA không dùng RSC/server actions; cấm bật RSC và theo dõi upstream | Frontend/Platform |
| SEC-003 | Medium | Query có thể lộ email/search/token trong log | Closed: log pathname, Pino redact secret fields | Backend |
| SEC-004 | Medium | PDF/Office giả mạo MIME/extension | Closed: kiểm tra magic bytes trước khi ghi | Backend |
| SEC-005 | Medium | PostgreSQL TLS bỏ kiểm tra certificate | Closed: production mặc định `rejectUnauthorized=true` | Platform |
| SEC-006 | Medium | Password tạo thủ công chỉ cần 6 ký tự | Closed: tối thiểu 10 ký tự, chữ và số | Backend |
| SEC-007 | Low | Auth response có thể bị cache; cookie SameSite lax | Closed: `no-store`, `SameSite=Strict` | Backend |
| SEC-008 | Medium | Rate limit memory store không đồng bộ multi-instance | Open, production blocker khi scale hơn một instance | Platform, Task 6.6 |
| SEC-009 | Medium | Upload local chưa malware scan/object storage | Open, blocker trước khi cho nguồn không tin cậy upload | Platform, Task 6.2/6.6 |
| SEC-010 | Medium | Chưa có MFA/password recovery/first-login password change | Open, cần trước rollout diện rộng | Product/Auth |
| SEC-011 | Low | Container scan chưa thể chạy vì chưa có image | Deferred | Platform, Task 6.2 |
| SEC-012 | Medium | Retention/erasure job chưa tự động | Open | Data owner/Platform |

Không có critical finding. Không có high finding chưa có mitigation. Các finding
medium được ghi owner và điều kiện release cụ thể.

## 5. Kiểm tra đã chạy

- Backend TypeScript build và toàn bộ `npm run quality`.
- Unit tests validation/password/sanitization.
- Refresh rotation, logout và token reuse.
- Lock user, đổi role và kiểm tra refresh session bị revoke.
- IDOR/RBAC theo student, teacher, guardian và admin trong các smoke suite.
- CORS origin lạ trả 403.
- Security headers qua health endpoint.
- Upload PDF giả bị từ chối; PDF signature hợp lệ upload/delete được.
- Backend production dependencies: 0 vulnerability.
- Frontend production build: pass.
- Frontend dependency audit: advisory RSC nêu tại SEC-002; ứng dụng không có
  RSC route, action hoặc server rendering.

## 6. Production release gate

Trước release public phải xác nhận:

1. Secret production nằm trong secret manager; không dùng file committed.
2. HTTPS end-to-end; PostgreSQL TLS xác minh certificate.
3. CORS chỉ có domain thật; `TRUST_PROXY_HOPS` đúng topology.
4. Shared rate-limit store nếu có từ hai backend instance.
5. Backup/restore drill pass theo Task 6.5.
6. Log retention và PII access được duyệt.
7. Upload untrusted có malware scanning hoặc bị tắt.
8. CI chạy build, tests, dependency scan và image scan.
9. Không bật React Router RSC/server actions khi SEC-002 chưa có upstream fix.
