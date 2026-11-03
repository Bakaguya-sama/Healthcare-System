# Luồng nghiệp vụ P0 DA2

> Cập nhật: 03/11/2026. Tài liệu này tóm tắt hành vi để review nghiệp vụ;
> `product-spec.md` và `chronic-care-spec.md` vẫn là nguồn quy tắc chi tiết.
> Ký hiệu: ✅ có code/test · 🚧 có một phần · ⏳ chưa triển khai.

## 1. Tham gia Care Program — ✅ command, 🚧 read API

**Actor:** Assigned Doctor, Patient; Admin quản lý Program/Rule lifecycle.

**Luồng chính**

1. Doctor `active + approved` tạo enrollment từ Program version đã publish.
2. Patient chấp nhận đúng consent version và nộp baseline bắt buộc.
3. Backend kiểm tra Doctor assignment, Program/Rule active, entitlement và
   baseline; đủ điều kiện thì chuyển enrollment `pending → active`.
4. Worker chỉ sinh Monitoring Task cho enrollment active.

**Ngoại lệ**

- Thiếu một activation condition: giữ `pending`, không sinh task/evaluation.
- Patient withdraw consent: chuyển `cancelled`; không xóa lịch sử.
- Doctor pause/resume/complete/cancel phải có reason và conditional transition.
- Patient-request-pause chưa có runtime command riêng; không được mô tả là đã có.

**Ràng buộc:** published version immutable; snapshot không bị đổi âm thầm;
idempotency key bắt buộc cho command; `completed|cancelled` không reopen.

## 2. Theo dõi chỉ số → evaluation → alert — ✅

**Actor:** Patient, worker, Assigned Doctor.

**Luồng chính**

1. Worker materialize CareTask theo timezone/rolling window.
2. Patient ghi HealthMetric; Health Tracking là source of truth.
3. Worker chạy deterministic Rule, lưu HealthEvaluation và dedupe CareAlert.
4. `attention|urgent` tạo notification; Doctor xem Priority Inbox và
   acknowledge/resolve/dismiss theo `allowedActions`.

**Ngoại lệ:** retry/crash dùng lease recovery; correction/void là append-only và
tạo evaluation/report version thay thế; metric đến muộn không mở lại task
terminal; provider notification lỗi đi qua outbox retry/dead-letter.

**Ràng buộc:** AI không quyết định severity; alert không thay thế cấp cứu;
automation flag chỉ bật theo runbook và phải quan sát lag/dead-letter.

## 3. Consultation từ Care Alert — ✅ backend link, 🚧 P0 booking/queue

**Actor:** Assigned Doctor, Patient, consultation worker.

**Luồng chính đã có**

1. Assigned Doctor tạo Consultation từ Care Alert hợp lệ.
2. Backend derive immutable `quotaPolicy`; client không được gửi severity/policy.
3. Urgent dùng `care_program_included`; attention dùng `consultation_limit`.
4. Consultation start/complete/cancel/no-show cập nhật usage ledger atomically.

**Ngoại lệ:** retry cùng alert trả Consultation cũ; stale on-demand có warning,
grace và system cancellation; Redis/waiting-room không xác minh được thì defer,
không tự hủy mù quáng.

**Ràng buộc:** `care_program_included` không dùng quota thông thường và không có
khoản phí consultation riêng; thiếu ledger không tự tạo miễn phí.

**P0 còn thiếu:** Availability Slot lifecycle, chống double-booking, scheduled
booking từ slot, Patient check-in, Doctor queue/call-next và race/reconnect E2E.

## 4. Mua/gia hạn Subscription qua VNPAY — ✅ `CC-PAY-001`

**Actor:** Patient, VNPAY, outbox worker; Admin chỉ xem evidence theo quyền.

**Luồng chính**

1. Patient gửi `planId` và `Idempotency-Key`; server snapshot giá/quyền lợi.
2. Backend trả signed payment URL/QR; Return chỉ hiển thị trạng thái chờ.
3. Signed IPN hợp lệ là authority chuyển order `paid` và enqueue grant request.
4. Worker cấp Subscription hoặc queue renewal đúng một lần.

**Ngoại lệ:** invalid signature/amount không đổi state; duplicate/late IPN
idempotent; paid-without-grant được reconciliation; cancel chỉ áp dụng unpaid
order; feature flag tắt chỉ chặn order mới.

**Ràng buộc:** không nhận amount/benefit từ client; không log secret/raw signed
query; QR/signed URL không persist; slice này không thu tiền từng Consultation
và không bao gồm refund.

**P0 còn thiếu:** Patient Plan catalog, Subscription/usage read API và order list.

## 5. Báo cáo và export — ✅ report, ⏳ export

**Actor:** Patient owner, Assigned Doctor.

**Luồng chính đã có:** tạo báo cáo 7/30 ngày theo timezone và `dataUntil`, hash
canonical input để replay idempotent, tạo AI narrative có grounding/guard/fallback.

**Ngoại lệ:** correction tạo report version mới và supersede version cũ; AI lỗi
vẫn trả deterministic report; projection theo role không lộ dữ liệu ngoài quyền.

**Ràng buộc:** summary không tạo severity/chẩn đoán; provenance bắt buộc; query
bounded; export chỉ cấp short-lived download cho actor có entitlement.

**P0 còn thiếu:** PDF/CSV export job, status/download API và authorization E2E.

## 6. Operations metrics — ⏳ hậu DA2

`CC-OPS-001` gồm adherence aggregate, acknowledgment time, follow-up conversion,
review effort, summary acceptance và conversion/usage theo tier. Hoãn slice này
không hoãn release regression, security/privacy, migration rehearsal hoặc demo
evidence của DA2. Không expose raw HealthMetrics và không trình bày dữ liệu demo
như kết quả lâm sàng.
