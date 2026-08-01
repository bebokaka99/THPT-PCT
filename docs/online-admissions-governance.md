# Governance gate - Online Admissions

## Trạng thái

Tài liệu này là decision record trước Task 7.2. Khi các quyết định `ADM-001` đến
`ADM-012` còn `Pending`, không mở form tuyển sinh public, không nhận upload từ
applicant và không tạo migration chứa PII tuyển sinh.

## Scope v1 khuyến nghị

V1 chỉ tiếp nhận hồ sơ, cho applicant theo dõi trạng thái, hỗ trợ reviewer yêu cầu
bổ sung và chuyển **hồ sơ đã được người có thẩm quyền phê duyệt** thành student
account/enrollment. Hệ thống không tự quyết định trúng tuyển.

Workflow đề xuất:

```text
draft -> submitted -> reviewing -> needs_changes -> submitted
                                  -> approved -> converted
                                  -> rejected
```

Mọi transition cần actor, reason, timestamp và optimistic revision. `approved`
không đồng nghĩa `converted`; conversion là transaction riêng, có duplicate check
và idempotency key.

Ngoài scope v1:

- tự chấm điểm hoặc tự quyết định đủ điều kiện/trúng tuyển;
- đồng bộ cổng tuyển sinh ngoài khi chưa có contract chính thức;
- thanh toán lệ phí, OCR/AI đọc hồ sơ hoặc public PII lookup;
- tạo `users`, `student_profiles` hoặc enrollment trước trạng thái approved;
- gửi giấy tờ qua public `/uploads` hoặc email attachment.

## Phân loại dữ liệu

| Nhóm | Classification đề xuất | Quy tắc tối thiểu |
|---|---|---|
| Applicant identity/contact | Restricted | Không public/log; encrypt field nếu policy yêu cầu |
| Application answers | Restricted | Allowlist theo admission cycle/version |
| Identity/academic documents | Highly restricted | Private quarantine, malware scan, authorized download |
| Consent evidence | Confidential | Version, timestamp, channel và purpose |
| Review/audit | Confidential | Append-only; reason không sao chép giấy tờ |
| Aggregate report | Internal | Không có row-level PII hoặc nhóm quá nhỏ |

## Quyết định bắt buộc

| ID | Quyết định | Owner cần chốt | Trạng thái |
|---|---|---|---|
| ADM-001 | Admission cycle, đối tượng, thời gian mở/đóng và owner | School admissions | Pending |
| ADM-002 | Field/document allowlist và validation theo cycle | Admissions + data owner | Pending |
| ADM-003 | Applicant identity verification/recovery channel | Product + security | Pending |
| ADM-004 | Privacy notice, consent version và guardian flow cho minor | Privacy + school | Pending |
| ADM-005 | Reviewer roles, transitions, appeal/correction và SLA | Admissions leadership | Pending |
| ADM-006 | CAPTCHA/bot defense, shared rate limit và abuse response | Security + platform | Pending |
| ADM-007 | Malware scanner, quarantine, object storage và download policy | Platform + security | Pending |
| ADM-008 | Retention cho draft/rejected/approved documents và legal hold | Data owner + privacy | Pending |
| ADM-009 | Duplicate/matching rules với existing applicant/student | Admissions + SIS owner | Pending |
| ADM-010 | Conversion mapping, account delivery và enrollment effective date | SIS owner + admissions | Pending |
| ADM-011 | Email/SMS provider, template, retry và message retention | Product + platform | Pending |
| ADM-012 | Aggregate report/export, redaction và access owner | Data owner | Pending |

Không ghi applicant PII, credential, token hoặc document URL vào decision record
trong Git.

## Technical gap hiện tại

Project đã có admin users/bulk student provisioning, enrollment transaction
patterns, request rate limit và private upload directories. Tuy nhiên chưa có:

- applicant identity/email verification/password recovery;
- CAPTCHA/bot defense và shared rate-limit store cho multi-instance;
- malware scanning, quarantine/object storage hoặc expiring signed download;
- admission-cycle form versioning và immutable consent evidence;
- retention/erasure job cho applicant documents;
- external notification provider với delivery/retry audit.

SEC-008, SEC-009, SEC-010 và SEC-012 trong security audit là blocker trực tiếp.
Không mở public admissions bằng memory rate limit và local file volume hiện tại.

## Data model dự kiến sau approval

Tên bảng chỉ là proposal, chưa được phép tạo migration:

- `admission_cycles`: versioned intake configuration và effective window;
- `admission_applicants`: identity/contact tách khỏi `users`;
- `admission_applications`: cycle, status, revision, submitted/review metadata;
- `admission_application_answers`: allowlisted/versioned answers;
- `admission_documents`: private object key, quarantine/scan state, retention;
- `admission_consents`: notice version, purpose, actor/channel/timestamp;
- `admission_reviews`: reviewer decision/reason và transition revision;
- `admission_conversion_runs`: idempotency, target user/profile/enrollment IDs;
- `admission_audits`: access/change/denied events không chứa raw PII.

Applicant ID phải là stable opaque identifier; không dùng email/phone làm primary
key hoặc public lookup key.

## Conversion contract

Chỉ service conversion được tạo student record. Transaction tối thiểu:

1. lock application approved và xác nhận chưa converted;
2. chạy duplicate check theo ADM-009, không tự merge hồ sơ mơ hồ;
3. tạo/reuse user theo quyết định được reviewer xác nhận;
4. tạo student profile và enrollment đúng academic year/classroom;
5. ghi conversion target IDs cùng audit/idempotency key;
6. commit rồi mới gửi account-delivery notification;
7. retry cùng idempotency key phải trả cùng result, không tạo bản ghi mới.

Nếu bất kỳ write nào lỗi, rollback toàn bộ database transaction. File retention và
notification dùng outbox/job sau commit, không nằm trong transaction dài.

## Acceptance và forbidden tests

- form đóng/mở đúng admission cycle timezone và không dựa vào frontend clock;
- applicant chỉ xem/sửa hồ sơ của mình qua identity proof đã duyệt;
- enumeration application ID/email/phone không tiết lộ hồ sơ tồn tại;
- reviewer chỉ xem cycle/scope được phân công; admin thường không mặc định đọc;
- invalid transition, stale revision và duplicate submission bị chặn rõ;
- file chưa scan/scan fail không thể download hoặc đưa vào review;
- MIME/extension giả, oversized archive và path traversal bị từ chối;
- approved conversion chạy hai lần vẫn chỉ có một user/profile/enrollment;
- rejected/draft retention dry-run và legal-hold guard có evidence;
- log, metric, notification và aggregate report không lộ applicant PII;
- production test dùng synthetic applicants, không dùng hồ sơ học sinh thật.

## Trình tự triển khai sau phê duyệt

1. **7.2A - Trust foundation:** applicant identity, bot defense, notification
   channel, malware quarantine/object storage và retention contracts.
2. **7.2B - Intake API:** cycle/form versioning, draft/submission, consent và
   private documents.
3. **7.2C - Review & conversion:** reviewer workflow, duplicate resolution,
   idempotent student/enrollment transaction và audit.
4. **7.2D - Applicant/Admin UI & rollout:** accessible public form, tracking,
   reviewer workspace, load/abuse/privacy/restore evidence.

Không gộp public intake với conversion trong một endpoint hoặc một release lớn.
