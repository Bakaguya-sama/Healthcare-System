# HealthAI DA2 — Roadmap hiện hành

> Cập nhật: **05/11/2026**
> Nguồn xác minh: code, migration, test, OpenAPI và realtime contract trong repository.
> Ký hiệu: ✅ Xong · 🚧 Đang làm · ⏳ Chưa bắt đầu · ⛔ Bị chặn

## ▶ TIẾP THEO CẦN LÀM

| Ưu tiên | Việc cần làm                                         | Lý do                                                                                                     | File/module liên quan                       | Cỡ  |
| ------: | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- | :-: |
|       1 | Implement CareTask policy đã chốt theo type         | Cần DTO/validation/event cho health check-in, appointment lifecycle, doctor review và education content ref | `chronic-care`, consultations, OpenAPI       |  M  |
|       2 | Hoàn thiện P0 export và Patient billing read surface | Còn thiếu report export, Plan catalog và Subscription/usage cho Patient                                   | `chronic-care`, `billing`, OpenAPI          |  M  |
|       3 | Đo và chốt policy vận hành scheduled booking         | Pilot đang dùng buffer 15 phút/min-notice 60 phút; cần dữ liệu để chốt policy dài hạn                     | config, `consultations`, runbook            |  S  |
|       4 | Chạy release-readiness DA2                           | Regression, privacy/security, migration rehearsal và demo evidence vẫn thuộc DA2 dù KPI metrics được hoãn | `test`, `docs/runbooks`, contract artifacts |  L  |

## 1. Tổng quan tiến độ

| Giai đoạn/module                                            |  Trạng thái   | Phạm vi đã chứng minh                                                                                 | Phần còn lại                                                      |
| ----------------------------------------------------------- | :-----------: | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| RF-0..RF-13 — backend foundation                            |      ✅       | Modular monolith, migration runner/verifier, Redis, outbox, contract tooling                          | Chỉ bảo trì                                                       |
| Chronic Care foundation — `CC-000..007`, `CC-011`, `CC-014` |      ✅       | Program/Rule/Enrollment command, Program/Enrollment read, task, evaluation, alert, report, AI summary | Rule read và non-metric response policy còn mở                    |
| Monitoring automation — `CC-003A`                           |      ✅       | Metric event, scheduler, reminder, retry/dead-letter/recovery                                         | Bật flag theo runbook ở môi trường triển khai                     |
| Consultation link/usage — `CC-008`, `CC-013/A/B`            |      ✅       | Alert link, quota ledger, urgent benefit, stale recovery, scheduled check-in/queue                    | On-demand queue policy còn mở                                     |
| Plan, AI quota — `CC-012A/B`                                |      ✅       | Plan lifecycle, snapshot entitlement, AI reserve/commit/release                                       | Patient-facing Plan/Subscription read API                         |
| Subscription payment — `CC-PAY-001`                         |      ✅       | VNPAY Sandbox IPN, order, grant, renewal queue, reconciliation                                        | Không bao gồm consultation charging hoặc refund                   |
| Contract/API handoff                                        |      🚧       | Program/Enrollment/CareTask read và typed education response đã có OpenAPI/test                        | Rule read, billing read, export và response policy còn mở         |
| Scheduled booking, queue/check-in                           |      ✅       | Availability, booking, scheduled check-in, own queue, Doctor queue/call-next, idempotency/race tests  | ETA và on-demand queue chưa có policy được chốt                   |
| Report/data export                                          |      ⏳       | CareReport immutable và role projection đã có                                                         | PDF/CSV export job/download contract                              |
| Web Patient/Doctor/Admin                                    | ⏳ Repo riêng | Đã chốt frontend không thuộc backend monorepo; tích hợp sau bằng OpenAPI/realtime                     | Full Web E2E thực hiện tại frontend repository sau khi ghép API   |
| Release readiness DA2                                       |      ⏳       | Unit, E2E, targeted integration đang xanh                                                             | Full regression, migration/restore, security/privacy, demo matrix |
| Product/operations metrics — `CC-OPS-001`                   |  ⏳ Hậu DA2   | Chưa có KPI aggregate/operations dashboard                                                            | Thực hiện sau DA2, không chặn release DA2                         |

## 2. Chi tiết từng giai đoạn

### Giai đoạn A — Backend foundation và Chronic Care core

**Trạng thái:** ✅ Xong

**Mục tiêu:** cung cấp engine Chronic Care dùng chung cho tăng huyết áp và tiểu đường, có audit, idempotency và safety guard.

- [x] Program/Rule versioning và lifecycle.
- [x] Enrollment, consent, baseline và entitlement activation gate.
- [x] CareTask rolling window, adherence và reminder.
- [x] Deterministic evaluation, alert dedupe/escalation và Doctor Priority Inbox.
- [x] Báo cáo 7/30 ngày, `SummaryInput v1`, AI guard/fallback.
- [x] Metric correction/void theo append-only lifecycle.

**Tiêu chí hoàn thành:** migration/verifier, unit/integration/E2E theo từng slice và contract safety đã có evidence trong source.

**Phụ thuộc:** RF-0..RF-13, MongoDB replica set, Redis và worker.

### Giai đoạn B — Consultation link, entitlement và usage

**Trạng thái:** ✅ Xong cho scheduled backend scope đã ghi; 🚧 on-demand queue policy còn mở

- [x] Tạo Consultation từ Care Alert với authorization và unique link.
- [x] Reservation/count/release ledger theo Subscription snapshot.
- [x] `care_program_included` cho urgent Care Alert: không dùng quota thông thường và không thu phí consultation riêng.
- [x] Stale on-demand recovery, waiting-room signal và scheduled review.
- [x] Availability Slot lifecycle, UTC/IANA contract, overlap buffer và write-fence chống race.
- [x] Scheduled booking/reschedule/cancel chỉ từ slot hợp lệ, atomic với quota ledger và idempotency.
- [x] Patient scheduled check-in và own-queue projection, fail-closed khi thiếu policy.
- [x] Doctor paginated queue/call-next, realtime contract, idempotency và database race protection.
- [ ] Chốt ETA và việc hợp nhất on-demand vào scheduled queue trước khi triển khai.

**Tiêu chí hoàn thành P0 còn lại:** scheduled/on-demand journey, check-in/queue, start/complete/no-show/cancel và quota race đều chạy E2E không sửa DB tay.

**Phụ thuộc:** Consultation core, Billing usage port, realtime contract.

### Giai đoạn C — Plan, AI quota và subscription payment

**Trạng thái:** ✅ Backend payment/grant xong; 🚧 Patient read surface còn thiếu

#### `CC-PAY-001` — VNPAY Sandbox và Subscription grant

> Alias lịch sử: `CC-7`. Không dùng lại tên cũ vì trùng cách đọc với `CC-007`.

- [x] PaymentOrder lấy giá/quyền lợi từ Plan snapshot phía server.
- [x] Signed Return/IPN verification; IPN là payment authority.
- [x] Duplicate/late/invalid callback xử lý idempotent.
- [x] Transactional outbox và Subscription grant/queued renewal.
- [x] Paid-without-grant reconciliation.
- [x] Public Sandbox happy path và targeted integration regression.
- [ ] Patient xem Plan published, Subscription hiện tại và usage còn lại.

**Ranh giới đã chốt:**

- `CC-PAY-001` chỉ sở hữu mua/gia hạn Subscription.
- Không có consultation charging trong DA2 hiện tại.
- `quotaPolicy = care_program_included` luôn cấm khoản phí consultation riêng.
- Nếu bổ sung consultation charging sau này, slice đó phải enforce và test invariant trên; không mở lại exit gate `CC-PAY-001`.
- Refund tự động/full refund là P1, không thuộc exit gate này.

**Tiêu chí hoàn thành:** exit gate backend `CC-PAY-001` đã **CLOSED ngày 03/11/2026**. Patient billing page và Payment Return UI thuộc frontend repository riêng; backend bàn giao read API/OpenAPI và giữ IPN là payment authority.

### Giai đoạn D — P0 API và consumer handoff

**Trạng thái:** 🚧 Đang làm

- [x] Regenerate OpenAPI và xử lý drift Billing/Plan/`CC-PAY-001` ngày 03/11/2026.
- [x] Program list/detail read API theo Patient/Doctor/Admin projection.
- [ ] Rule read API theo role (`GET /care-programs/:id/rules`): Doctor active summary; Admin active/draft projection; không history/pagination.
- [x] Enrollment list/detail theo Patient owner/Assigned Doctor; Admin bị cấm theo quyết định DA2 hiện hành.
- [x] CareTask list/detail bounded theo Patient owner/Assigned Doctor; Admin bị cấm.
- [x] Idempotent response command: metric giữ ở HLTH-02, configured education nhận acknowledgment.
- [x] Chốt policy: check-in health declaration; appointment complete/no-show/cancel/reschedule mapping; Assigned Doctor review; immutable education content reference.
- [ ] Implement DTO/validation/state transition/event cho policy CareTask đã chốt; các type mới hiện fail-closed.
- [ ] Patient Plan/Subscription/usage API.
- [ ] Report PDF/CSV export và download authorization.
- [ ] Đồng bộ `docs/integration-contract.md`, OpenAPI và sequence diagram cùng một PR/slice.

**Tiêu chí hoàn thành:** mọi API P0 dùng trong demo tồn tại trong OpenAPI, có authorization/error contract và test; không còn nhãn “Target P0” cho route đã triển khai.

**Phụ thuộc:** Giai đoạn A–C.

**Quyết định đã chốt CareTask:** (1) `check_in` là health declaration; (2)
appointment chỉ complete từ Consultation `completed`, `no_show → missed`, cancel
→ `cancelled` khi mục tiêu không còn áp dụng, same-goal reschedule giữ task và
đổi reference; (3) chỉ Assigned Doctor complete `doctor_review`, required reason
code và optional plaintext note; (4) education content dùng immutable
`contentId/version/locale/displayType`; acknowledgment chỉ nghĩa “đã xác nhận đã
xem”; (5) task terminal, ngoài window hoặc enrollment inactive không nhận late
response.

**Câu hỏi thiết kế còn lại, không phải policy business:** exact field/range và
safety-escalation mapping của health declaration; event/outbox nào từ
Consultation cập nhật appointment task; endpoint/DTO cụ thể cho doctor review;
và content service/catalog nào resolve immutable education reference. Các type
tương ứng vẫn fail-closed cho đến khi các contract này được code/test/OpenAPI.

### Giai đoạn E — Release readiness DA2

**Trạng thái:** ⏳ Chưa bắt đầu

- [ ] Full unit/integration/E2E và concurrency regression.
- [ ] OpenAPI/realtime/boundary/type/lint/build gate.
- [ ] Migration `migrate → verify → expect-noop` trên database rỗng và rehearsal backup/restore.
- [ ] Feature-flag matrix: AI, monitoring automation và VNPAY.
- [ ] Privacy/security review: role scope, redaction, upload, logs và raw health/AI payload.
- [ ] Demo scenarios: bình thường, attention và urgent/escalation.
- [ ] Đóng gói OpenAPI/realtime contract và integration notes cho frontend repository riêng; full Web E2E chạy sau khi frontend ghép API.

**Tiêu chí hoàn thành:** P0 critical journeys chạy không sửa DB tay; contract artifact khớp source; blocker còn lại không bị ghi thành “done”.

**Phụ thuộc:** Giai đoạn D và môi trường demo.

### Giai đoạn F — Hậu DA2: `CC-OPS-001` Product/operations metrics

**Trạng thái:** ⏳ Hoãn sau DA2

- [ ] KPI adherence aggregate.
- [ ] Alert acknowledgment time và follow-up conversion.
- [ ] Doctor review effort và AI summary acceptance.
- [ ] Conversion/usage theo tier; tách seed/demo khỏi dữ liệu thật.
- [ ] Bounded query, index/explain evidence và operations dashboard.

**Tiêu chí hoàn thành:** KPI query bounded/verified, không expose raw HealthMetrics và không trình bày demo data như kết quả lâm sàng.

**Phụ thuộc:** P0 DA2 đã ổn định và có dữ liệu vận hành phù hợp.

## 3. Rủi ro và câu hỏi mở

| Mức        | Rủi ro/câu hỏi                                         | Xử lý đề xuất                                                                                 |
| ---------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Trung bình | Policy pilot 15/60 chưa có dữ liệu vận hành đủ để chốt | Đo duration/overtime, lead time và hủy sát giờ; version/snapshot trước khi đổi policy         |
| Trung bình | `checkInEarlyMinutes` và ETA chưa có dữ liệu để chốt   | Fail-closed check-in; ETA nullable; đo arrival/no-show/duration trước khi snapshot policy     |
| Trung bình | Frontend tích hợp sau ở repository riêng               | Pin OpenAPI/realtime version, generate client và chạy contract/full Web E2E tại frontend repo |
| Trung bình | Roadmap cũ và tracker cũ có thể tiếp tục bị dùng       | Chỉ giữ trong `plan/archive`; mọi file archive phải có banner lịch sử                         |
| Trung bình | Target DBML còn collection P1/chưa deploy              | Mỗi slice tiếp tục đối chiếu DBML ↔ entity ↔ migration ↔ DTO/port                             |
| Trung bình | Monitoring automation mặc định tắt                     | Bật theo runbook, kiểm tra worker/lag/dead-letter trước demo                                  |

## 4. Quy tắc cập nhật roadmap

- Chỉ đánh dấu ✅ khi có source và test/evidence tương ứng.
- Một task “Target” trong DBML/integration docs không được coi là đã triển khai.
- Evidence dài và lịch sử sửa lỗi đưa vào `plan/archive` hoặc runbook; roadmap chỉ giữ trạng thái hiện hành.
- Mỗi thay đổi trạng thái phải cập nhật ngày và changelog bên dưới.

## 5. Changelog

### 03/11/2026

- Viết lại roadmap từ source audit và chuyển bản cũ vào `plan/archive/roadmap-legacy-2026-11-03.md`.
- Chuẩn hóa `CC-7` thành `CC-PAY-001`, giữ alias lịch sử một lần.
- Ghi nhận exit gate `CC-PAY-001` đã đóng.
- Tách KPI/operations metrics thành `CC-OPS-001` hậu DA2; giữ release-readiness trong P0 DA2.
- Giữ Availability Slot, scheduled booking, queue/check-in và export trong P0 DA2.
- Ghi rõ ranh giới Subscription payment với consultation charging.
- Cập nhật ưu tiên tiếp theo theo code và contract hiện tại.
- Regenerate OpenAPI từ source; `openapi:check`, realtime check và boundary check xanh.
- Chốt frontend Patient/Doctor/Admin và Payment Return UI nằm ở repository riêng; backend monorepo bàn giao canonical contracts để ghép API sau.
- Bổ sung Availability Slot và scheduled booking: migration/validator/index,
  Doctor-owned lifecycle, Patient discovery, atomic claim + quota reservation,
  idempotent booking, cancel/reschedule cutoff và concurrency integration test.
- Giữ `bufferMinutes`/`minNoticeMinutes` là cấu hình fail-closed chờ owner chốt;
  không bật Admin slot override và không đụng payment/VNPAY.

### 04/11/2026

- Chọn baseline pilot `bufferMinutes = 15`, `minNoticeMinutes = 60` phút; runtime
  vẫn fail-closed nếu môi trường triển khai bỏ thiếu cấu hình.
- Chuẩn hóa list Availability Slot theo filter, pagination, hard limit và stable
  sort; tách query Patient để không expose filter trạng thái nội bộ.
- Xác nhận `GET /consultations` đã có role-scoped filters và pagination cho
  Patient/Doctor; cập nhật integration contract theo code thực tế.
- Bổ sung scheduled Patient check-in/own queue và Doctor queue/call-next: stable
  ordering, pagination, actor scope, idempotent replay, transaction và partial
  unique indexes chống hai item called/hai phiên active.
- Giữ call-next ở `waiting + calledAt`; `/start` mới chuyển `in_consultation` và
  count quota. Check-in/call-next không đụng quota, PaymentOrder hoặc VNPAY.
- `checkInEarlyMinutes` fail-closed khi thiếu snapshot/config; ETA trả null cùng
  reason code. On-demand queue và ETA policy tiếp tục là câu hỏi mở.
- Bổ sung Chronic Care Program list/detail và Enrollment list/detail: DTO/projection
  theo actor, filter allowlist, pagination hard cap, stable `_id` tie-breaker,
  ownership từ JWT và bounded task/alert/report summary.
- Chốt không bật Admin Enrollment read trong DA2 hiện hành; `AuditLog` không tự cấp
  clinical-data access. Chốt Rule read P0 chỉ lấy current active/draft view, không
  pagination/version history; không thêm index/migration vì query actor scope đã
  khớp index hiện hữu.
