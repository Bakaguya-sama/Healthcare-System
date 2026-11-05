# Luồng nghiệp vụ P0 DA2

> Cập nhật: 05/11/2026. Tài liệu này tóm tắt hành vi để review nghiệp vụ;
> `product-spec.md` và `chronic-care-spec.md` vẫn là nguồn quy tắc chi tiết.
> Ký hiệu: ✅ có code/test · 🚧 có một phần · ⏳ chưa triển khai.

## 1. Tham gia Care Program — ✅ command và Program/Enrollment read API

**Actor:** Assigned Doctor, Patient; Admin quản lý Program/Rule lifecycle.

**Luồng chính**

1. Doctor `active + approved` tạo enrollment từ Program version đã publish.
2. Patient chấp nhận đúng consent version và nộp baseline bắt buộc.
3. Backend kiểm tra Doctor assignment, Program/Rule active, entitlement và
   baseline; đủ điều kiện thì chuyển enrollment `pending → active`.
4. Worker chỉ sinh Monitoring Task cho enrollment active.
5. Patient/Doctor đọc catalog Program bằng filter allowlist và pagination. Patient
   và Doctor chỉ thấy Program `published`; Admin thấy lifecycle catalog theo role.
6. Patient list/detail enrollment của chính mình; Doctor chỉ list/detail enrollment
   được assign. JWT là authority, `patientId` chỉ là filter thu hẹp cho Doctor.
7. Enrollment detail trả projection bounded: Program version, participant summary,
   lifecycle, consent/baseline được phép, task/alert/report summary. Không trả raw
   task response, HealthMetric, report input, rule snapshot hoặc audit trail.

**Ngoại lệ**

- Thiếu một activation condition: giữ `pending`, không sinh task/evaluation.
- Patient withdraw consent: chuyển `cancelled`; không xóa lịch sử.
- Doctor pause/resume/complete/cancel phải có reason và conditional transition.
- Patient-request-pause chưa có runtime command riêng; không được mô tả là đã có.

**Ràng buộc:** published version immutable; snapshot không bị đổi âm thầm;
idempotency key bắt buộc cho command; `completed|cancelled` không reopen.
Read API dùng page/limit hard cap, filter/sort allowlist và `_id` tie-breaker. Admin
Enrollment read bị cấm theo chính sách DA2 hiện hành.

### 1.1. CareTask workspace — ✅ read surface, 🚧 response theo type

1. Patient list task trong enrollment của chính mình; assigned Doctor chỉ list
   task của enrollment được assign. API dùng filter `status/type/from/to`, page
   hard cap và stable sort có `_id` tie-breaker. Admin không được đọc clinical
   CareTask trong DA2.
2. List/detail chỉ trả projection bounded và `allowedActions` tính ở server;
   không trả raw `response`, `completionRule`, reminder/rule snapshot hoặc audit.
3. Task `metric` chỉ dẫn consumer sang Health Tracking `HLTH-02`; endpoint
   response của CareTask từ chối loại này và không ghi đè HealthMetric.
4. `POST /care-tasks/:id/responses` bắt buộc `Idempotency-Key`, chỉ Patient owner
   được gọi. Hiện chỉ education task có snapshot
   `completionRule.responseMode = acknowledge` nhận payload allowlist
   `{ action: "acknowledge" }`; transition `scheduled|due → completed` chạy
   conditional trong transaction và ghi audit sau persistence.
5. Chính sách nghiệp vụ đã chốt cho phần mở rộng kế tiếp: `check_in` là khai báo
   sức khỏe có schema versioned/allowlist; `appointment` chỉ complete khi
   Consultation canonical `completed`, `no_show → missed`, cancellation làm task
   `cancelled` nếu mục tiêu chăm sóc không còn cần thiết, còn reschedule cùng mục
   tiêu giữ task và thay consultation reference. `doctor_review` chỉ Assigned
   Doctor complete, bắt buộc reason code và note plaintext tùy chọn; không nhận
   rich-text/free-form clinical note qua task response.
6. Education chỉ được gọi là “đã xác nhận đã xem”, không suy diễn đã đọc/hiểu.
   Snapshot content phải dùng immutable `contentId`, `version`, `locale`,
   `displayType`; không dùng URL tự do hoặc HTML trực tiếp trong CareTask.
7. **Trạng thái code hiện tại:** ngoài education acknowledgment đã có, các policy
   mới ở trên chưa có endpoint/schema canonical nên vẫn fail-closed bằng
   `CARE_TASK_RESPONSE_POLICY_NOT_CONFIGURED`. Task `completed|missed|cancelled`,
   ngoài response window hoặc enrollment không active không nhận response; retry
   cùng key/payload replay, cùng key khác request trả conflict.

**Việc còn thiết kế trước khi code:** chốt exact field/range/reason code và safety
escalation cho health check-in; định nghĩa event/outbox chuyển appointment task
theo Consultation; định nghĩa endpoint/DTO doctor review; và chọn nguồn content
được approve để resolve `contentId + version`. Backend không nhận free-form
payload hoặc tự tạo Consultation/DoctorReview giả trong thời gian chờ.

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

## 3. Consultation từ Care Alert và scheduled booking — ✅ booking và scheduled queue

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

**Scheduled booking đã có**

1. Doctor `active + approved` tạo/sửa/block/xóa slot của chính mình. Doctor list
   slot theo `from/to/status` với pagination và stable sort; Patient list theo
   `from/to` với pagination, còn backend luôn ép `status = available` và notice
   window nên client không thể dùng query để xem slot booked/blocked/expired.
2. Timestamp lưu UTC, slot giữ IANA timezone để hiển thị/policy. Slot active của
   cùng Doctor không overlap và phải cách nhau theo buffer cấu hình.
3. Patient claim slot bằng `Idempotency-Key`; transaction đồng thời đổi slot
   `available → booked`, tạo Consultation `scheduled/accepted/not_started` và
   reserve quota của chu kỳ Subscription đang hiệu lực. Unique index và
   conditional claim bảo vệ lớp cuối; race hai request chỉ một request thành công.
4. Scheduled booking dùng `consultation_limit`, không tạo PaymentOrder và không
   gọi VNPAY. `care_program_included` vẫn chỉ dành cho urgent Care Alert đã được
   backend xác minh; client không thể tự chọn policy.
5. Patient hủy/đổi lịch trước cutoff snapshot 60 phút. Hủy đúng hạn release quota
   và mở lại slot nếu slot chưa qua giờ; đổi lịch atomically claim slot mới rồi
   mở slot cũ. Slot booked không được Doctor sửa/block/xóa trực tiếp.
6. Admin không có API override/block/unblock slot.

**Scheduled check-in và queue đã có**

1. Patient owner gửi `POST /consultations/:id/check-in` cùng `Idempotency-Key`.
   Backend chỉ nhận Consultation `scheduled/accepted/not_started`, kiểm tra cửa sổ
   từ `scheduledStartAt - checkInEarlyMinutes` đến
   `scheduledStartAt + noShowAfterMinutes`, rồi atomically ghi `waiting`,
   `queueJoinedAt` và `queuePriorityAt = scheduledStartAt`.
2. `checkInEarlyMinutes` ưu tiên snapshot của booking; booking cũ thiếu snapshot
   chỉ được dùng cấu hình `CONSULTATION_CHECK_IN_EARLY_MINUTES`. Nếu cả hai đều
   thiếu, command fail-closed với `CHECK_IN_POLICY_NOT_CONFIGURED`; không có
   default ngầm.
3. Patient chỉ đọc snapshot queue của chính Consultation mình qua
   `GET /consultations/:id/queue`. Position được tính phía server; ETA trả
   `null` cùng `ETA_POLICY_NOT_CONFIGURED` cho tới khi có policy đã được đo/chốt.
4. Doctor `active + approved` đọc queue của chính mình qua
   `GET /doctors/me/queue?page&limit`. Queue chỉ gồm scheduled Consultation hợp
   lệ và sắp ổn định theo `queuePriorityAt`, `queueJoinedAt`, `_id`.
5. `POST /doctors/me/queue/call-next` dùng transaction và partial unique index
   để chỉ một item được gọi. Call-next ghi `calledAt` nhưng giữ `waiting`; Doctor
   gọi `/start` mới chuyển sang `in_consultation` và count quota. Vì vậy
   check-in/call-next không reserve, release, count quota và không tạo payment.
6. Partial unique index chặn một Doctor có hai item `waiting + calledAt`; index
   khác chặn hai Consultation `in_consultation`. Retry cùng idempotency key trả
   state đã persist với `replayed = true` và không phát lại realtime event.

**Ngoại lệ:** sai owner/role trả 403; quá sớm hoặc quá cửa sổ trả 422; state
terminal/non-scheduled trả conflict xác định; queue rỗng, đã có item called hoặc
đang có phiên active trả 409. MongoDB là source of truth; realtime chỉ phát sau
persistence.

**P0 còn mở:** đưa on-demand accepted vào cùng queue và policy ETA có căn cứ đo
lường. Hai phần này không được bật ngầm trong scheduled slice.

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

## 7. Booking policy pilot và câu hỏi mở

- Owner đã chọn giá trị pilot `bufferMinutes = 15` và `minNoticeMinutes = 60` phút,
  được ghi trong `.env.example`. Runtime vẫn bắt buộc cấu hình rõ
  `SCHEDULED_BOOKING_BUFFER_MINUTES` và
  `SCHEDULED_BOOKING_MIN_NOTICE_MINUTES`; command slot/booking fail-closed với
  `BOOKING_POLICY_NOT_CONFIGURED` nếu môi trường triển khai bỏ thiếu.
- Hai giá trị trên là baseline pilot, chưa phải policy vĩnh viễn vì chưa có dữ
  liệu vận hành thật và `CC-OPS-001` không thuộc slice này. Khuyến nghị đánh giá
  lại bằng phân bố thời lượng phiên/overtime,
  tỷ lệ hủy sát giờ và lead time đặt lịch; sau khi chốt nên chuyển sang
  `doctorProfile.bookingSettings` có hard limits như product spec.
- Cutoff hủy/đổi lịch hiện dùng mốc 60 phút đã được chấp nhận ở CC-013. Nếu owner
  thay đổi, phải version/snapshot policy và bổ sung migration/test trước rollout.
- `checkInEarlyMinutes` chưa được owner chốt. Runtime hiện fail-closed nếu booking
  snapshot và `CONSULTATION_CHECK_IN_EARLY_MINUTES` đều thiếu. Khuyến nghị pilot
  15 phút chỉ là đề xuất trong product spec; cần đo tỷ lệ đến sớm/muộn, no-show
  và tải queue trước khi chốt, sau đó snapshot theo version.
- ETA chưa có mô hình đáng tin cậy từ duration/overtime thực tế nên API trả
  `estimatedWaitMinutes = null`, `etaReason = ETA_POLICY_NOT_CONFIGURED`. Không
  suy ra ETA bằng cách nhân position với duration mặc định.

## 8. Quyết định đã chốt cho Chronic Care read

- Admin không được đọc Enrollment trong DA2 hiện tại, kể cả list, detail hay raw
  clinical projection. Route Enrollment tiếp tục chỉ dành cho Patient owner và
  Assigned Doctor. Audit log hiện hữu không tự cấp clinical-data access.
- Rule read API (`GET /care-programs/:id/rules`) vẫn là slice riêng. Patient không
  có Rule read. Doctor chỉ đọc Rule `active` của Program `published` qua summary
  `version`, `status`, `testSummary`; không nhận raw declarative conditions.
- Admin được đọc Rule `draft` và raw declarative conditions. Admin cũng nhận
  `dataSources`, nhưng `testResults` và simulation evidence chỉ là bounded summary
  (validation/outcome/count/reason code/version/time); không trả raw Patient,
  HealthMetric input hoặc full evaluation trace.
- Không có Rule version history hay pagination trong P0. Mỗi role chỉ đọc một Rule
  hiện hành: Doctor là `active`; Admin mặc định `active` hoặc draft mới nhất khi
  yêu cầu view draft. Quy tắc chọn draft mới nhất phải deterministic theo version,
  rồi `_id` trước khi route được triển khai.
