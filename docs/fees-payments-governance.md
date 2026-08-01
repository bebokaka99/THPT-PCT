# Governance gate - Fees, Receipts & Reconciliation

## Trạng thái

Tài liệu này là decision record bắt buộc trước Task 7.3. Nó không xác nhận portal
được phép thu tiền trực tuyến hoặc phát hành chứng từ tài chính chính thức. Khi
`FIN-001` đến `FIN-014` còn `Pending`, không tạo ledger production, payment
webhook hoặc receipt mang giá trị pháp lý.

## Scope v1 khuyến nghị

V1 quản lý fee plan/charge, miễn giảm có phê duyệt, ghi nhận giao dịch đã thu qua
kênh được nhà trường xác nhận, phân bổ payment vào charge và reconciliation theo
batch. Student/verified guardian chỉ xem nghĩa vụ và biên nhận đã phát hành.

Online card/bank payment là stage riêng sau khi chọn provider. Portal không xử lý
thẻ, CVV, PIN, OTP hoặc giữ tiền.

Workflow đề xuất:

```text
fee plan: draft -> approved -> active -> closed
charge: pending -> issued -> partially_paid -> paid | cancelled
payment: received -> verified -> allocated -> reconciled | reversed
receipt: draft -> issued -> voided (không hard delete)
```

Không cho sửa/xóa trực tiếp record đã posted/issued/reconciled. Sai sót phải dùng
adjustment, reversal hoặc void entry tham chiếu bản gốc.

## Ngoài scope v1

- ví điện tử tự xây, xử lý thẻ, lưu provider credential trong database;
- tự động thu định kỳ hoặc auto-debit;
- kế toán tổng hợp, thuế, payroll hoặc thay thế phần mềm kế toán;
- tự suy luận miễn giảm hoặc chặn học tập vì chưa thanh toán;
- public lookup invoice/receipt bằng ID tăng dần;
- multi-currency trước khi policy và rounding được duyệt.

## Phân loại dữ liệu

| Nhóm | Classification đề xuất | Quy tắc tối thiểu |
|---|---|---|
| Student charges/balance | Restricted | Student hoặc verified guardian đúng link; finance scope |
| Payment/provider reference | Highly restricted | Không log; token hóa/redact; không chứa card data |
| Receipt | Restricted | Opaque reference, authorized download, immutable version |
| Adjustment/exemption reason | Restricted | Không đưa vào notification/public report |
| Reconciliation/audit | Confidential | Append-only; finance/auditor segregation |
| Aggregate finance report | Internal/confidential | Không lộ student-level PII |

## Quyết định bắt buộc

| ID | Quyết định | Owner cần chốt | Trạng thái |
|---|---|---|---|
| FIN-001 | Khoản thu nào thuộc portal và legal basis/owner | School leadership + finance | Pending |
| FIN-002 | Currency, amount precision, rounding và timezone/cutoff | Finance + accounting | Pending |
| FIN-003 | Role finance maker/checker/auditor và segregation | Leadership + security | Pending |
| FIN-004 | Student/guardian visibility, dispute và support channel | Product + finance | Pending |
| FIN-005 | Miễn/giảm/điều chỉnh, approval levels và evidence | Finance leadership | Pending |
| FIN-006 | Charge/invoice numbering, lifecycle và cancellation | Accounting | Pending |
| FIN-007 | Payment channels/provider và PCI/data boundary | Procurement + security | Pending |
| FIN-008 | Webhook signature, replay window, idempotency và retry | Provider + platform | Pending |
| FIN-009 | Refund/reversal/chargeback workflow và authority | Finance + provider | Pending |
| FIN-010 | Reconciliation source, cutoff, tolerance và unmatched SLA | Finance operations | Pending |
| FIN-011 | Receipt template, numbering, signing và legal status | Accounting + legal | Pending |
| FIN-012 | Retention, backup, audit/legal hold và correction | Data owner + legal | Pending |
| FIN-013 | Accounting export/import contract và approval | Accounting + data owner | Pending |
| FIN-014 | Incident, fraud alert, outage/manual fallback và owner | Security + finance | Pending |

Không ghi bank account, provider secret, transaction token hoặc dữ liệu học sinh
vào file Markdown/Git.

## Technical gap hiện tại

Project chưa có finance domain, finance-specific role separation, provider
adapter, webhook signature verification, durable outbox/job queue, receipt signing
hoặc reconciliation engine. Có thể tái sử dụng:

- PostgreSQL transaction và row locking;
- idempotency-key pattern từ academic import;
- optimistic revision và append-only audit patterns;
- verified guardian link và enrollment source of truth;
- encrypted backup/release/observability foundation.

Memory rate limit và local upload không đủ bảo vệ public payment webhook hoặc
receipt production. Provider secret phải ở secret manager và rotation runbook,
không ở finance tables.

## Ledger/data model dự kiến sau approval

Tên bảng chỉ là proposal, chưa được phép tạo migration:

- `fee_catalog_items` và `fee_plans`: versioned policy/effective period;
- `student_charges`: immutable issued amount/currency và enrollment reference;
- `charge_adjustments`: compensating entry, reason, maker/checker approval;
- `payment_records`: channel/provider reference, state và idempotency key;
- `payment_allocations`: amount phân bổ giữa payment và charge;
- `receipts`: immutable issued snapshot/version và void reference;
- `reconciliation_batches/items`: source statement, match state và reviewer;
- `payment_webhook_events`: signature outcome, unique provider event ID, payload
  hash/encrypted raw retention theo FIN-008/FIN-012;
- `finance_audits`: actor, action, entity/revision, reason/outcome, không card data.

Tiền phải lưu bằng representation chính xác đã duyệt (không dùng floating point).
Mỗi record có currency rõ; không cộng khác currency.

## Invariant tài chính

1. `sum(allocations)` không vượt payment verified amount.
2. Charge paid balance do backend tính từ immutable charge/adjustment/allocation.
3. Webhook event ID unique; replay trả cùng result và không double-post.
4. Maker không tự approve adjustment/refund vượt policy.
5. Reconciled record không sửa; reversal tạo entry mới tham chiếu bản gốc.
6. Receipt issued không regenerate từ mutable live data; dùng immutable snapshot.
7. Guardian chỉ xem charge/receipt của verified linked student còn hiệu lực.
8. Notification không chứa provider token, account number hoặc exemption reason.
9. Finance report không dùng frontend-calculated balance làm source of truth.
10. Không hard delete ledger/audit để “sửa số liệu”.

## Reconciliation contract

Mỗi batch phải ghi source, statement period, checksum, imported/reconciled by và
revision. Import chạy preview trước commit, có idempotency key và row-level result.

- exact match chỉ khi amount/currency/reference thỏa rule đã duyệt;
- ambiguous match vào review queue, không tự chọn record đầu tiên;
- unmatched/duplicate/late event có reason code và SLA;
- closing batch cần checker khác maker nếu FIN-003 yêu cầu;
- tổng opening + inflow - reversal = closing phải được backend xác minh;
- rerun cùng file/checksum không tạo payment hoặc allocation mới.

## Acceptance và forbidden tests

- teacher/general admin không xem student balance hoặc payment details;
- student/guardian khác scope nhận 403, opaque IDs không chống IDOR thay RBAC;
- duplicate webhook/retry không double charge/payment/receipt;
- concurrent allocation giữ invariant và stale revision trả conflict;
- partial payment, overpayment, reversal và void receipt tính balance đúng;
- maker/checker segregation bị enforce tại backend;
- provider signature sai/expired/replayed bị reject và audit metadata-only;
- reconciliation import duplicate/ambiguous có report, không auto-match sai;
- receipt snapshot không đổi khi profile/fee label sau đó thay đổi;
- logs/errors/metrics không chứa amount kèm identity, account/token hoặc raw webhook;
- backup/restore giữ ledger totals và audit chain;
- production drill dùng synthetic transactions, không dùng tiền thật.

## Trình tự triển khai sau phê duyệt

1. **7.3A - Finance foundation:** money type, roles/segregation, immutable ledger,
   audit và invariant tests.
2. **7.3B - Charges & view-only portal:** fee plans, charges, adjustments, approved
   student/guardian views; chưa có online payment.
3. **7.3C - Payments, receipts & reconciliation:** manual/provider adapters,
   idempotent webhooks, allocations, receipts, reconciliation và export.
4. **7.3D - Operations & rollout:** provider sandbox, fraud/incident, restore,
   load/security/reconciliation evidence và production approval.

Không gộp ledger foundation và public online payment vào một release.
