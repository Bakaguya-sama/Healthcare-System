# Database migration manifest

Registry chuẩn nằm tại `apps/api/src/database/migrations/migration-registry.ts`. Không sửa file migration hoặc checksum đã được ghi vào database.

| Version | Migration | Vai trò sau RF-10 |
| ---: | --- | --- |
| 202609162200 | `rf2d-query-indexes` | Lịch sử index ban đầu; index `sessions` được giữ như migration đã áp dụng |
| 202609172100 | `rf5-canonical-identity` | Canonical User/AuthSession |
| 202609182100 | `rf6-consultations` | Copy Session sang Consultation idempotent |
| 202609182200 | `rf7-chat-reviews` | Backfill Message/Review sang `consultationId` |
| 202609182300 | `rf8-health-ai` | Health/AI canonical foundation |
| 202609182400 | `rf8-ai-message-cutover` | Import AI session/message cũ vào canonical conversation history |
| 202609182500 | `rf9-outbox` | Outbox nền |
| 202609182510 | `rf9-atomic-notifications` | Notification + outbox atomic contract |
| 202609202000 | `rf10b-canonical-cleanup` | Backfill `AiFeedback.aiConversationId` và tạo index canonical |
| 202609202100 | `rf10c-physical-cleanup` | Reconcile bắt buộc, drop collection/index và unset field legacy |

RF-10C đã thêm migration riêng, không sửa migration lịch sử. Migration chỉ cleanup sau khi tất cả blocker reconciliation bằng 0; nếu còn Session/AI/Message/Review/Feedback chưa ánh xạ canonical thì migration fail trước thao tác drop. Trên môi trường đích luôn chạy `rf10c:reconcile` và kiểm tra backup trước `database:migrate`.

## DA2 migration addendum — registry hiện hành

Bảng RF-10 phía trên được giữ như lịch sử foundation. Các migration DA2 hiện được
registry quản lý tiếp theo như sau:

| Version | Migration | Vai trò |
| ---: | --- | --- |
| 202609281000 | `cc000-chronic-care-foundation` | Chronic Care collections/index foundation |
| 202609291000 | `cc001a-care-catalog` | Care Program/Rule catalog |
| 202609291100 | `cc001b-enrollment` | Patient Care Program enrollment |
| 202609291200 | `schema-simplification` | Canonical schema simplification |
| 202609291300 | `cc014-baseline-schema-engine` | Versioned baseline schema contract |
| 202609300900 | `cc014-remove-redundant-baseline-version` | Remove redundant baseline version field |
| 202609301000 | `cc002-care-tasks` | CareTask persistence/indexes |
| 202610020900 | `cc003-cc004-evaluations-alerts` | HealthEvaluation và CareAlert |
| 202610061000 | `cc005-doctor-priority-inbox` | Doctor priority inbox query index |
| 202610061100 | `cc006-care-reports` | Immutable CareReport persistence/indexes |
| 202610061200 | `health-metric-contract-alignment` | HealthMetric canonical contract alignment |
| 202610091200 | `cc007-care-summaries` | CareSummary persistence/indexes |
| 202610151000 | `cc012-billing-access` | Plan/Subscription entitlement foundation |
| 202610152000 | `data001a-consultation-contract` | Consultation data contract alignment |
| 202610161000 | `cc008-care-alert-consultation-link` | CareAlert–Consultation canonical link |
| 202610161100 | `cc013-consultation-usage-ledger` | Consultation usage reservation/count/release ledger |
| 202610181000 | `cc013-booking-policy-snapshot` | Booking policy snapshot fields |
| 202610181100 | `cc013-legacy-quota-exemption` | Explicit audited legacy quota exemption |
| 202610191000 | `cc003a-alert-deduplication` | CareAlert dedupe/escalation indexes |
| 202610201000 | `cc013a-urgent-alert-consultation-benefit` | Included urgent Care Program consultation policy |
| 202610201100 | `cc013b-stale-consultation-recovery` | Stale consultation recovery evidence |
| 202610211000 | `cc012b-ai-quota` | AI quota/reservation persistence |
| 202610221000 | `cc012b-ai-quota-settlement` | AI quota settlement fields |
| 202610221100 | `cc012b-usage-reconciliation-name` | Usage reconciliation naming alignment |
| 202610231000 | `cc7-payment-orders` | PaymentOrder/VNPAY/subscription grant foundation |
| 202611031000 | `scheduled-booking-availability-slots` | Availability Slot và Scheduled Booking |
| 202611041000 | `patient-check-in-doctor-queue` | Scheduled check-in và Doctor queue/call-next |
| 202611042000 | `care-task-read-response` | CareTask read/typed-response persistence alignment |
| 202611052000 | `care-task-policy-v1` | Check-in, education catalog, doctor review và Consultation link contract |
| 202611061000 | `care-report-exports` | Durable PDF/CSV export job, idempotency, worker lease và expiry cleanup indexes |
| 202611062000 | `patient-payment-order-read-indexes` | BILL-04 owner/status stable pagination indexes |
| 202611171000 | `care-catalog-validator-reconciliation` | Reapply canonical CareProgram/CareRule validators |
| 202611171100 | `consultation-null-timestamp-reconciliation` | Remove legacy BSON null optional Consultation timestamps |
| 202611171200 | `care-catalog-version-type-reconciliation` | Convert legacy BSON int catalog versions to canonical double |

### `202611061000-care-report-exports`

Migration tạo/đồng bộ validator cho `carereportexports` và ba query-shape index:

1. `{ ownerId: 1, idempotencyKey: 1 }` unique — HTTP replay/race protection.
2. `{ status: 1, leaseExpiresAt: 1, _id: 1 }` — atomic worker claim và stale-lease recovery.
3. `{ status: 1, expiresAt: 1, _id: 1 }` — bounded expiry cleanup.

Migration đã được đăng ký trong `migration-registry.ts`, collection/index đã được
đăng ký trong `schema-manifest.ts`. Evidence ngày 2026-11-06:

- lần chạy đầu: `applied 202611061000-care-report-exports`;
- lần chạy thứ hai: `skip 202611061000-care-report-exports` (idempotent/no-op);
- verifier: schema version `202611061000`, `43` collections, `115` managed indexes.

Không sửa migration lịch sử `cc006-care-reports`: export job có lifecycle và query
shape riêng, còn `CareReport` tiếp tục là immutable clinical snapshot.

### `202611062000-patient-payment-order-read-indexes`

Migration additive, không sửa validator hay migration PaymentOrder lịch sử. Hai index:

1. `{ userId: 1, createdAt: -1, _id: -1 }` — owner history không status.
2. `{ userId: 1, status: 1, createdAt: -1, _id: -1 }` — owner history có status.

`_id` là tie-breaker của stable page sort. Migration được đăng ký trong registry và
hai index được khai báo trong schema manifest. Evidence local replica set ngày
2026-11-06: `applied 202611062000-patient-payment-order-read-indexes`; verifier pass
`version=202611062000, collections=37, managedIndexes=117`; lần migrate thứ hai trả
`skip 202611062000-patient-payment-order-read-indexes`.

### Release-readiness reconciliations (2026-11-17)

The release rehearsal found historical BSON representation drift that the
current strict validators intentionally reject on restore. Three additive,
idempotent migrations reconcile representation only:

1. `202611171000-care-catalog-validator-reconciliation` reapplies the registry's
   canonical CareProgram and CareRule validators after historical validator drift.
2. `202611171100-consultation-null-timestamp-reconciliation` removes `null` only
   from optional Consultation timestamp fields; it never writes or infers a timestamp.
3. `202611171200-care-catalog-version-type-reconciliation` converts BSON `int`
   `version` fields in CareProgram/CareRule documents to BSON `double` without
   changing their numeric value.

On the approved Atlas test rehearsal, `database:verify` passed at `202611171200`;
the second migration run was a no-op. A full backup restored to an isolated local
rehearsal database with 1,541 documents and zero failures.
