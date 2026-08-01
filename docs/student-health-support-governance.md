# Governance gate - Student Health & Support Records

## Trạng thái

Tài liệu này là decision record bắt buộc trước Task 7.1. Nó không phải sự đồng ý
thu thập dữ liệu sức khỏe và không thay thế đánh giá pháp lý/privacy của nhà
trường. Khi các quyết định bên dưới còn `Pending`, không tạo migration, API, seed,
importer hoặc UI chứa dữ liệu sức khỏe thật hay demo.

## Scope v1 khuyến nghị

Chỉ triển khai **emergency support summary tối thiểu** phục vụ xử lý tình huống tại
trường. Không xây dựng bệnh án điện tử.

Được cân nhắc sau phê duyệt từng field:

- hướng dẫn hỗ trợ khẩn cấp ngắn gọn đã được guardian xác nhận;
- dị ứng/cảnh báo khẩn cấp ở dạng có cấu trúc, không chứa diễn giải chẩn đoán;
- đầu mối liên hệ khẩn cấp lấy từ nguồn guardian/profile đã xác minh;
- accommodation/support instruction cần thiết trong môi trường học đường;
- ngày xác minh, người xác minh và ngày cần rà soát lại.

Không thuộc v1:

- chẩn đoán, đơn thuốc, kết quả xét nghiệm, ảnh bệnh án hoặc lịch sử điều trị;
- tư vấn tâm lý dạng free-text, đánh giá lâm sàng hoặc ghi âm;
- kết nối bệnh viện, kê đơn, chấm điểm rủi ro tự động hoặc AI;
- public link, email notification chứa nội dung sức khỏe;
- import hàng loạt trước khi có mapping, consent và rollback được duyệt.

## Phân loại dữ liệu

| Nhóm | Classification đề xuất | Quy tắc tối thiểu |
|---|---|---|
| Emergency summary | Highly restricted | Field encryption, audit mỗi lần đọc/ghi, không log payload |
| Support accommodation | Restricted/highly restricted theo field | Chỉ chia sẻ phần cần thiết theo purpose |
| Guardian confirmation | Confidential | Chỉ verified guardian và health staff |
| Access/audit metadata | Confidential | Append-only, không chứa nội dung sức khỏe |
| Clinical record ngoài scope | Prohibited | Reject ở validation/import |

Classification cuối cùng phải do data owner và privacy owner ký duyệt.

## Ma trận quyền cần phê duyệt

| Actor | List/search | Read summary | Update | Assign access | Export |
|---|---:|---:|---:|---:|---:|
| Public | No | No | No | No | No |
| Student | Pending | Pending | No | No | No |
| Verified guardian | Pending | Pending | Confirm-only | No | No |
| Teacher/homeroom | No mặc định | Pending emergency subset | No | No | No |
| Admin | Metadata only | No mặc định | No | Yes | No |
| Health staff | Assigned scope | Assigned scope | Assigned scope | No | Pending |
| Operations/developer | No | No | No | No | No |

Admin quản trị account/assignment không đồng nghĩa được đọc health payload. Không
dùng `users.manage` hoặc role `admin` làm shortcut để đọc emergency summary.

## Các quyết định bắt buộc

| ID | Quyết định | Owner cần chốt | Trạng thái |
|---|---|---|---|
| HLT-001 | Danh sách field được phép và field bị cấm | Data owner + health owner | Pending |
| HLT-002 | Ai được cấp role `health_staff`, ai duyệt/thu hồi | School leadership | Pending |
| HLT-003 | Student/guardian xem, xác nhận và yêu cầu sửa thế nào | Product + privacy | Pending |
| HLT-004 | Teacher có được xem emergency subset hay chỉ gọi health staff | School leadership | Pending |
| HLT-005 | Retention trigger, thời hạn, archive/delete/legal hold | Data owner + privacy | Pending |
| HLT-006 | KMS/secret manager, key rotation và recovery owner | Platform + security | Pending |
| HLT-007 | Break-glass workflow, reason, alert và review SLA | Security + health owner | Pending |
| HLT-008 | Incident response và notification chain | Security + leadership | Pending |
| HLT-009 | Privacy notice, consent/confirmation evidence | Privacy + school | Pending |
| HLT-010 | Export/correction/erasure workflow | Data owner + privacy | Pending |

Approval record phải ghi người duyệt, vai trò, ngày, version và link tới policy.
Không ghi token, secret hoặc health payload vào file Markdown/Git.

## Technical prerequisites

Project hiện có RBAC, audit patterns, private uploads và encrypted backup nhưng
chưa có application-level field encryption hoặc KMS provider. Trước schema health:

1. Thêm role `health_staff` và permission riêng; không kế thừa quyền đọc từ admin.
2. Tạo encryption provider abstraction dùng authenticated encryption và managed
   key ở staging/production; ciphertext, key version và nonce tách rõ.
3. Có key rotation/re-encryption job idempotent và recovery drill.
4. Audit mọi read/write/denied/break-glass event nhưng không ghi payload.
5. Search/list chỉ dùng metadata đã phê duyệt; không decrypt hàng loạt để filter.
6. Private attachment phải có malware scan, authorization download và retention.
7. Backup/restore drill phải chứng minh ciphertext vẫn giải mã được bằng key
   recovery procedure, không lưu key cùng backup.

Không tự viết crypto primitive và không lưu encryption key trong database,
repository, frontend bundle hoặc committed env file.

## Data model dự kiến sau approval

Tên bảng chỉ là proposal, chưa được phép tạo migration:

- `health_staff_assignments`: user, scope, effective dates, approved/revoked by;
- `student_emergency_summaries`: student, encrypted payload, key version,
  verification/review metadata, optimistic revision;
- `health_guardian_confirmations`: verified guardian, summary revision, status;
- `health_access_audits`: actor, student, action, purpose/reason, outcome, request id;
- `health_break_glass_events`: reason, expiry, alert/review status nếu HLT-007 duyệt.

Source of truth cho student là `student_enrollments`; guardian phải có link
`verified`. Không copy email/phone vào health payload nếu có thể resolve từ profile
đã được kiểm soát.

## Acceptance và forbidden tests

Sau khi được duyệt, implementation tối thiểu phải chứng minh:

- health staff đúng assignment đọc/cập nhật được summary trong scope;
- health staff hết hạn/revoked bị chặn ngay cả khi access token còn hạn;
- admin quản lý assignment nhưng đọc payload nhận 403;
- teacher/student/guardian xử lý đúng theo HLT-003/HLT-004, không dựa vào menu;
- guardian chưa verified hoặc link revoked nhận 403;
- list không trả ciphertext, key version nội bộ hoặc full payload;
- log/notification/error không chứa nội dung health;
- concurrent update dùng revision và trả conflict rõ;
- key rotation giữ nguyên plaintext semantic và audit đầy đủ;
- backup restore + key recovery pass trên fixture tổng hợp;
- retention job có dry-run, legal-hold guard và evidence report;
- export/import không hoạt động khi policy tương ứng chưa được bật.

## Trình tự triển khai sau phê duyệt

1. **7.1A - Security foundation:** role/permission, encryption provider, key
   rotation contract, access audit và tests.
2. **7.1B - Emergency summary API:** schema tối thiểu, validation, ownership,
   guardian confirmation và forbidden tests.
3. **7.1C - Portal UI:** health-staff workspace, admin assignment metadata và các
   read-only view đã được policy cho phép.
4. **7.1D - Operations:** retention, backup/key recovery drill, break-glass drill,
   privacy review và production rollout evidence.

Không gộp bốn stage thành một release lớn.
