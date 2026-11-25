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

### 1.1. CareTask workspace — ✅ read và policy contract v1

1. Patient list task trong enrollment của chính mình; assigned Doctor chỉ list
   task của enrollment được assign. API dùng filter `status/type/from/to`, page
   hard cap và stable sort có `_id` tie-breaker. Admin không được đọc clinical
   CareTask trong DA2.
2. List/detail chỉ trả projection bounded và `allowedActions` tính ở server;
   không trả raw `response`, `completionRule`, reminder/rule snapshot hoặc audit.
3. Task `metric` chỉ dẫn consumer sang Health Tracking `HLTH-02`; endpoint
   response của CareTask từ chối loại này và không ghi đè HealthMetric.
4. `POST /care-tasks/:id/responses` bắt buộc `Idempotency-Key`, chỉ Patient owner
   được gọi. Education task có snapshot `responseMode=acknowledge` nhận đúng
   `{ action: "acknowledge" }`; `check_in` nhận `health-check-in.v1`. Cả hai dùng
   conditional transition `scheduled|due → completed`, transaction và audit.
5. Runtime policy v1: `check_in` là khai báo
   sức khỏe schema `health-check-in.v1` chỉ gồm `overallStatus`, `symptomCodes`,
   `severity`, không có free text. Sau persistence, backend phát event vào Rule
   Engine; chỉ CareRule `active` đã được approve mới có thể tạo CareAlert.
   `appointment` chỉ complete khi
   Consultation canonical `completed`, `no_show → missed`, cancellation làm task
   `cancelled` nếu mục tiêu chăm sóc không còn cần thiết, còn reschedule cùng mục
   tiêu giữ task và thay consultation reference. Consultation phải mang explicit
   `careTaskId` để làm canonical link. `doctor_review` chỉ Assigned Doctor
   complete, bắt buộc reason code thuộc allowlist `reviewed_no_action`,
   `follow_up_needed`, `consultation_recommended`,
   `care_plan_adjustment_needed`, và note plaintext tùy chọn; không nhận
   rich-text/free-form clinical note qua task response.
6. Education chỉ được gọi là “đã xác nhận đã xem”, không suy diễn đã đọc/hiểu.
   Snapshot content phải dùng immutable `contentId`, `version`, `locale`,
   `displayType`; không dùng URL tự do hoặc HTML trực tiếp trong CareTask.
7. **Trạng thái code hiện tại:** check-in, Doctor review, immutable education
   content và Consultation lifecycle đã là runtime behavior. Task thiếu template/
   content published vẫn fail-closed; task `completed|missed|cancelled`, quá
   `windowEnd` hoặc enrollment không active không nhận response. Patient có thể
   gửi response `check_in` hoặc xác nhận `education` khi task còn `scheduled`
   trước `windowStart`; Doctor review vẫn yêu cầu đã đến `windowStart`. Metric
   chỉ hoàn thành task khi thời điểm đo nằm trong cửa sổ metric. Retry cùng
   key/payload replay, cùng key khác request trả conflict.

**Contract implementation runtime v1:** `overallStatus` dùng
`improved|stable|worsened`; `severity` dùng `none|mild|moderate|severe`; và
`symptomCodes` là mảng unique `0..8` code `snake_case` thuộc allowlist trong
template snapshot. `severity=none` bắt buộc không có symptom; có symptom không
được dùng `none`. Đây là giới hạn payload kỹ thuật, không phải ngưỡng lâm sàng.
Backend chuẩn hóa response thành scalar facts (`check_in.overall_status`,
`check_in.severity`, `check_in.severity_rank`, `check_in.symptom.<code>`) vì Rule
Engine hiện chỉ evaluate scalar, không query trực tiếp mảng.

Rule source mapping phải khai báo `kind=care_task_check_in`, schema version,
template key và prefix fact được phép. Evaluation chỉ dùng Rule snapshot của
Enrollment nếu CareRule hiện tại cùng ID vẫn `active`; trong model hiện tại,
`active` là trạng thái đã được Admin activate/approve, không bổ sung cờ
`approved` song song. Command lưu task response, audit và Outbox cùng transaction;
event `care.task.check_in.submitted.v1` chỉ chứa `eventVersion`, `careTaskId`,
`enrollmentId`, `schemaVersion`, `submittedAt`, không chứa raw health response.
Worker đọc lại database, evaluate và chỉ sau đó tạo CareAlert.
Event check-in tuân theo feature flag `CARE_MONITORING_AUTOMATION_ENABLED` hiện có;
khi flag tắt worker defer event thay vì làm mất dữ liệu. Consultation cancellation
hiện không có disposition canonical nên phát `objectiveDisposition=unknown` và
giữ nguyên task; chỉ signal server-owned `no_longer_required` mới được cancel task.

Doctor review dùng `POST /care-tasks/:id/doctor-review` với `Idempotency-Key`, DTO
`reasonCode` allowlist và `note?: string` plaintext tối đa 500 ký tự. Assigned
Doctor duy nhất được gọi; task phải còn active/in-window. Note được lưu như text,
không nhận HTML/object/upload và client phải HTML-escape khi render. Review không
tính Patient adherence. Education phải resolve chính xác content catalog published
theo `{ contentId, version, locale, displayType }`; không tìm thấy bản immutable
đó thì không trả URL/HTML fallback, `allowedActions=[]` và command fail-closed.

### 1.2. Đồng bộ CareTask theo trạng thái Enrollment

Mỗi command làm thay đổi Enrollment ghi state/revision, audit, idempotency receipt
và `care.enrollment.tasks.sync.v1` trong cùng MongoDB transaction. API trả trạng thái
Enrollment đã commit; việc schedule/cancel CareTask là side effect bất đồng bộ, vì
vậy client không được giả định danh sách task đã cập nhật ngay trong response đó.

Outbox worker không áp trạng thái cũ từ payload. Nó tải Enrollment hiện tại, kiểm tra
revision không thấp hơn event, rồi schedule idempotent task cho trạng thái `active`
hoặc hủy task còn mở cho `paused|completed|cancelled`/Enrollment không còn tồn tại.
Duplicate event/retry dùng cùng idempotency key và unique task key; event cũ không
được đảo ngược state mới. Event lỗi được retry/dead-letter theo outbox policy.

Reconciliation định kỳ quét Enrollment active theo `_id` batches để bổ sung task
còn thiếu, đồng thời quét task `scheduled|due` theo `_id` batches để hủy task có
Enrollment thiếu hoặc không active. Khi automation flag tắt, worker vẫn xử lý hủy
task không còn hợp lệ; tạo task active được hoãn cho tới khi automation được bật.
Trong khoảng chờ đồng bộ, task response, Doctor review, metric evaluation và
reminder đều đọc trạng thái Enrollment hiện tại và fail-closed nếu không active.
Đây là eventual consistency có reconciliation, không phải transaction xuyên hai
aggregate; staging/production cần quan sát outbox lag và dead-letter.

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
2. `checkInEarlyMinutes` lấy từ snapshot booking. Nếu snapshot thiếu giá trị này,
   command fail-closed với `BOOKING_POLICY_UNAVAILABLE`; không đọc ENV và không có
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

**Boundary DA2 đã chốt:** queue chỉ dành cho scheduled consultation. On-demand
giữ canonical accept/start flow hiện có; unified queue là follow-up hậu DA2 và
không được bật ngầm. ETA chưa có policy đo lường nên tiếp tục nullable.

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

### Patient Billing read — ✅ Slice D4

1. Patient gọi `GET /plans` hoặc `GET /plans/:id`; backend chỉ query Plan
   `published` đang nằm trong `effectiveFrom/effectiveUntil`, phân trang bounded và
   trả public projection. Draft, retired, refund policy nội bộ, audit và cấu hình
   VNPAY không đi ra consumer.
2. Patient gọi `GET /subscriptions/me`; JWT subject là ownership authority. Billing
   lifecycle service xác định `effective` Subscription (và provision/renew Free theo
   behavior hiện hữu), còn lịch sử được query riêng theo chính `userId`, filter status
   allowlist, pagination và stable `_id` tie-breaker.
3. Entitlement luôn lấy từ immutable `Subscription.planSnapshot`; Plan catalog hiện
   tại chỉ dùng cho màn hình chọn gói và không hồi tố quyền lợi đã grant. Queued renewal
   chỉ trả safe snapshot + thời điểm hiệu lực, không trả `nextPlanOrderId`.
4. `GET /subscriptions/me/usage` đọc đúng cycle và hai atomic counter mà Scheduled
   Booking dùng. Công thức là
   `available = consultationLimitPerCycle - consultationUsageCounted - consultationUsageReserved`.
   Dữ liệu thiếu, counter âm hoặc tổng vượt limit làm projection fail-closed; endpoint
   không tự sửa/reconcile lịch sử.
5. `care_program_included` không gọi reserve/count/release của ordinary ledger, nên
   không tăng `counted`/`reserved`, không giảm `available` và không tạo charge. Không
   được suy ra policy này chỉ vì thiếu ledger.

**Authorization/privacy:** ba route self-service chỉ cho Patient; Doctor/Admin không
dùng route này. Response không chứa raw ledger row, PaymentOrder, transaction/gateway,
IPN/Return, audit actor hay reconciliation metadata.

**Ngoại lệ đọc:** nếu lifecycle không tìm/provision được Subscription hiệu lực thì
`GET /subscriptions/me` trả `effective=null` nhưng vẫn có history bounded; usage trả
`BILLING_SUBSCRIPTION_NOT_FOUND`. Snapshot/cycle/counter hỏng trả
`BILLING_PROJECTION_UNAVAILABLE` thay vì đoán quota bằng 0 hoặc unlimited. Plan ID
invalid, không tồn tại hoặc ngoài public catalog đều trả cùng safe not-found behavior.

### Patient PaymentOrder history — ✅ Slice D7

1. Patient gọi `GET /billing/payments/orders`; JWT subject là ownership authority và
   API không nhận `patientId/userId` từ query.
2. Backend query trực tiếp `PaymentOrders.userId`, tùy chọn filter đúng enum `status`,
   phân trang bounded (`limit <= 100`) và sắp xếp ổn định theo
   `createdAt DESC, _id DESC` mặc định. Kết quả rỗng là một page hợp lệ.
3. Mỗi item chỉ lấy giá, currency và Plan `code/name/version` từ immutable
   `orderSnapshot`; Plan catalog hiện tại không hồi tố lịch sử thanh toán.
4. Projection không chứa `PaymentTransaction`, VNPAY/IPN/Return payload, chữ ký,
   gateway reference, idempotency key, reconciliation/grant/outbox hay audit metadata.
5. Patient mở một item bằng owner-scoped `BILL-05`; Doctor/Admin không dùng
   self-service list route này. List là read-only, không tạo payment, gọi VNPAY hoặc
   sửa trạng thái/grant Subscription.

**Ngoại lệ đọc:** query ngoài allowlist bị validation từ chối; snapshot hoặc timestamp
bắt buộc bị hỏng trả `BILLING_PROJECTION_UNAVAILABLE` thay vì lấy mutable Plan hoặc
điền giá trị giả. Cross-patient bị chặn ngay trong database filter.

**P0 API handoff sau Slice D7:** Patient PaymentOrder history và PDF/CSV report export
đều đã có runtime route, authorization, bounded projection và OpenAPI. Công việc tiếp
theo là release-readiness DA2; Admin billing dashboard/refund vẫn ngoài slice này.

## 5. Báo cáo và export — ✅ report và PDF/CSV export

**Actor:** Patient owner, Assigned Doctor.

**Luồng chính đã có:** tạo báo cáo 7/30 ngày theo timezone và `dataUntil`, hash
canonical input để replay idempotent, tạo AI narrative có grounding/guard/fallback.

**Ngoại lệ:** correction tạo report version mới và supersede version cũ; AI lỗi
vẫn trả deterministic report; projection theo role không lộ dữ liệu ngoài quyền.

**Runtime Slice 6:**

1. Patient owner hoặc Assigned Doctor có quyền trên Enrollment gọi
   `POST /care-reports/:id/exports` với `format=pdf|csv` và `Idempotency-Key`.
   Backend kiểm tra lại report, participant scope và entitlement; JWT là actor
   authority. Admin không được mở clinical export chỉ từ vai trò quản trị.
2. Command tạo/replay một export job bền vững rồi trả ngay; không render file trong
   HTTP request. Job có lifecycle `pending -> processing -> ready|failed`, và
   `ready -> expired` khi artifact hết hạn. Database là source of truth; queue/outbox
   chỉ vận chuyển metadata tối thiểu, không chứa report projection hay health data.
3. Worker reload immutable `CareReport`, đúng report version/input hash và audience
   của actor, dựng bounded export projection rồi render PDF/CSV. Correction tạo report
   version mới không làm thay nội dung export job đã gắn với version cũ.
4. Artifact được upload vào private storage. Storage key, provider response và URL
   gốc không đi ra API. `GET /care-report-exports/:id` chỉ cho đúng export owner và
   chỉ mint short-lived signed download URL khi job `ready`; URL không persist trong
   job, outbox, log hoặc cache dài hạn.
5. Retry cùng idempotency key và payload trả job cũ; cùng key khác report/format trả
   conflict. Worker retry không tạo artifact/job song song và phải xử lý recovery theo
   outbox/job convention hiện hữu.
6. PDF và CSV dùng cùng audience-safe source projection. Không export raw
   HealthMetric, CareTask response, Rule input/snapshot, audit metadata, AI/provider
   prompt hay dữ liệu ngoài persisted CareReport/CareSummary được phép cho actor.
7. Job/file có expiry và cleanup. Expiry chỉ xóa/thu hồi artifact, không xóa hoặc sửa
   immutable CareReport. Chính xác TTL, PDF layout/branding/locale và CSV column schema
   dùng hai config bắt buộc `CARE_REPORT_EXPORT_ARTIFACT_TTL_MINUTES` và
   `CARE_REPORT_EXPORT_SIGNED_URL_TTL_SECONDS`; thiếu config thì command fail-closed.
   Đơn vị lần lượt là phút và giây; khuyến nghị deploy hiện tại `1440`/`300`, signed
   URL phải ngắn hơn artifact lifetime. Cloudinary credential và Outbox worker phải
   được cấu hình/chạy riêng; không ghi credential vào source/docs.
   PDF/CSV hiện dùng renderer deterministic `care-report-export.v1`; thay branding,
   locale hoặc CSV columns phải tăng renderer version.

**Ngoại lệ:** report/job ngoài scope dùng safe not-found; thiếu entitlement hoặc
participant authority bị từ chối; job chưa ready không phát URL; artifact mất/hỏng
không trả storage path mà chuyển/giữ trạng thái lỗi xác định được. Endpoint đọc không
tự render lại hay reconcile dữ liệu lâm sàng.

**Evidence runtime:** durable entity/index/migration, transaction job+outbox, leased
worker/retry, private authenticated storage adapter, deterministic PDF/CSV renderer,
owner-only status/signed URL, expiry cleanup và integration race/authorization tests.

## 6. Operations metrics — ⏳ hậu DA2

`CC-OPS-001` gồm adherence aggregate, acknowledgment time, follow-up conversion,
review effort, summary acceptance và conversion/usage theo tier. Hoãn slice này
không hoãn release regression, security/privacy, migration rehearsal hoặc demo
evidence của DA2. Không expose raw HealthMetrics và không trình bày dữ liệu demo
như kết quả lâm sàng.

## 7. Booking policy pilot và câu hỏi mở

- Runtime lấy `bufferMinutes`, `minNoticeMinutes`, cancellation/check-in/no-show
  từ `doctorProfile.bookingSettings`; không dùng biến môi trường. Doctor chưa có
  settings hợp lệ làm command slot/booking fail-closed với
  `BOOKING_POLICY_NOT_CONFIGURED`.
- Hai giá trị trên là baseline pilot, chưa phải policy vĩnh viễn vì chưa có dữ
  liệu vận hành thật và `CC-OPS-001` không thuộc slice này. Khuyến nghị đánh giá
  lại bằng phân bố thời lượng phiên/overtime,
  tỷ lệ hủy sát giờ và lead time đặt lịch; sau khi chốt nên chuyển sang
  `doctorProfile.bookingSettings` có hard limits như product spec.
- Cutoff hủy/đổi lịch hiện dùng mốc 60 phút đã được chấp nhận ở CC-013. Nếu owner
  thay đổi, phải version/snapshot policy và bổ sung migration/test trước rollout.
- `checkInEarlyMinutes` được snapshot khi booking; runtime fail-closed nếu lịch
  cũ không có snapshot hợp lệ. Cần đo tỷ lệ đến sớm/muộn, no-show và tải queue
  trước khi thay đổi policy, sau đó snapshot theo version.
- ETA chưa có mô hình đáng tin cậy từ duration/overtime thực tế nên API trả
  `estimatedWaitMinutes = null`, `etaReason = ETA_POLICY_NOT_CONFIGURED`. Không
  suy ra ETA bằng cách nhân position với duration mặc định.

## 8. Luồng invitation người thân đồng hành

- Patient tạo một invitation version. Hệ thống có thể trả deep-link, QR và mã 6
  chữ số cùng trỏ tới invitation đó; artifact không chứa email, user ID hoặc PHI.
- Invitation có hiệu lực 7 ngày. Short code chỉ có hiệu lực 15 phút, one-time,
  bị rate-limit và chỉ lưu hash. Regenerate vô hiệu artifact cũ nhưng không đổi
  consent/permission.
- Người chưa có account phải đăng ký role Patient, verify email và đăng nhập rồi
  mới redeem/accept. Người đã có account chỉ cần đăng nhập và redeem.
- Patient tìm contact bằng `GET /users/family-companion/contacts` trong module
  User. API dùng tìm gần đúng theo tên/email/số điện thoại đã xác minh, phân trang,
  chỉ trả Patient active đã xác minh email cùng ID và thông tin nhận diện tối thiểu.
- FE cho Patient chọn một record; `POST /family-links` nhận `contactUserId` đó hoặc
  `share: true`. Backend xác minh lại người nhận khi tạo invitation; không có
  bảng contact lookup/reference trung gian.
- Accept chỉ chuyển `pending -> active` sau khi contact xem consent version và
  chọn permission `missed_task_reminder`/`weekly_progress`. Revoke có hiệu lực
  ngay với notification/query mới; không vô hiệu hóa account độc lập của contact.

## 9. Quyết định đã chốt cho Chronic Care read

- Admin không được đọc Enrollment trong DA2 hiện tại, kể cả list, detail hay raw
  clinical projection. Route Enrollment tiếp tục chỉ dành cho Patient owner và
  Assigned Doctor. Audit log hiện hữu không tự cấp clinical-data access.
- Rule read API (`GET /care-programs/:id/rules`) đã được triển khai theo projection
  riêng cho từng actor. Patient bị từ chối. Doctor `active + approved` chỉ đọc Rule `active` của Program
  `published` qua `version`, `status`, bounded `testSummary`; không nhận raw
  declarative conditions, `dataSources`, scenario inputs hay evaluation trace. Doctor
  gửi `view=draft` bị từ chối thay vì âm thầm đổi sang active.
- Admin mặc định `view=active`; muốn đọc draft phải gửi rõ `view=draft`. Draft hiện
  hành được chọn deterministic bằng `status=draft`, `version DESC`, `_id DESC`,
  `limit=1`. Nhiều draft cùng version không được GET tự sửa; implementation phải ghi
  technical warning/evidence phù hợp.
- Admin được đọc raw declarative `rules` và `dataSources`. Test evidence chỉ trả
  bounded DTO: summary có outcome/count/reason-code/interpreter-version/time và tối
  đa 50 sanitized scenario results gồm scenario key, pass/fail, expected/actual
  severity. Không trả raw Patient/Enrollment/HealthMetric/check-in input, stack trace
  hay full interpreter trace. Vì entity hiện lưu `testResults` dạng Mixed, nếu không
  map/validate an toàn thì chỉ trả summary hoặc bỏ evidence, không trả raw record.
- Program `draft`: Admin chỉ đọc draft Rule. Program `published`: Admin đọc active
  hoặc draft mới nhất theo view. Program `retired`: Admin chỉ được đọc active Rule
  cuối cùng để audit/đối chiếu, không đọc draft; Doctor không đọc Rule của Program
  retired. Doctor không cần có Enrollment trước để đọc active summary của public
  published Program.
- P0 không có Rule version history hay pagination. Program/Rule ngoài scope hoặc
  không tồn tại dùng safe not-found; không có Rule theo view trả
  `CARE_RULE_NOT_FOUND`; Doctor chưa active/approved hoặc yêu cầu draft trả forbidden;
  projection/evidence hỏng trả `CARE_RULE_PROJECTION_UNAVAILABLE`, không leak raw data.
- Read path chỉ query `CareProgram` và `CareRule`; không populate Enrollment hay dữ
  liệu lâm sàng. Active dùng unique lifecycle constraint hiện hữu. Draft dùng
  `careProgramId + status`, rồi sort `version DESC, _id DESC`; vì số version của một
  Program bị giới hạn bởi catalog workflow và route chỉ lấy một record, Slice 5 không
  thêm index/migration mới.

## E2 — Reminder Family Companion

- Với FamilyLink active, Patient cấp hoặc đổi grant chia sẻ HealthMetric sau
  khi xác nhận consent; Companion nhận thông báo in-app và xem summary/trend
  theo scope được cấp. Quyền bao gồm lịch sử và dữ liệu mới, không tự hết hạn.

Khi Companion xem chỉ số, backend chuẩn hóa một cửa sổ dùng chung cho summary và
trend. Mặc định là tuần lịch hiện tại từ thứ Hai 00:00 đến thứ Hai kế tiếp
00:00 theo `Asia/Ho_Chi_Minh` (`[start,end)`). Có thể chọn tuần/tháng/quý/năm,
toàn bộ lịch sử hoặc khoảng custom; anchor chọn ngày trong kỳ để điều hướng.
Trend trả các điểm đo gốc theo thứ tự mới đến cũ, còn summary tính trên toàn
cửa sổ bằng quy tắc thống kê của Health Tracking. Cửa sổ không giới hạn grant
lịch sử. Patient API giữ nguyên semantics cũ; request Companion v1 chỉ truyền
`from/to` tiếp tục coi `to` là inclusive, còn FE mới dùng `period=custom` với
`to` end-exclusive.
- Pause chặn đọc; resume khôi phục grant còn hiệu lực; Patient thu hồi grant
  hoặc một bên revoke link sẽ chặn đọc tiếp. Re-invite không kế thừa grant cũ.

- Reminder Patient trong cửa sổ task tiếp tục dùng event canonical
  `care.task.reminder`. Khi task đã chuyển sang `missed`, scheduler tạo riêng
  `care.task.missed-reminder.v1` với key theo task; worker chỉ ghi notification
  in-app nếu task còn missed/required và enrollment còn active. Companion chờ
  notification Patient được persist trước khi dispatch sau grace period 60 phút;
  không coi riêng trạng thái outbox `delivered` là bằng chứng Patient đã nhận.
- `weekly_progress` dedupe theo link và tuần, tối đa một lần/tuần; delivery chỉ
  in-app và payload là trạng thái tổng quát.
- Worker kiểm tra lại link, permission và task ngay trước dispatch; pause, revoke
  hoặc task đã hoàn thành đều suppress.
- Quiet hours `21:00–08:00` dùng timezone của Patient; worker reschedule ra ngoài
  khoảng này.
- Missed-task scheduler duyệt mọi task bằng keyset pagination theo `_id`, tối đa
  200 mỗi batch; các task trùng timestamp không bị bỏ qua. Một task lỗi được tính
  vào lỗi vận hành và sẽ được thử lại ở lượt quét kế tiếp.
- Patient reminder dùng `care.task.reminder.<taskId>` cho nhắc trong cửa sổ và
  `care.task.missed-reminder.<taskId>` cho nhắc khi task đã missed. Companion chỉ
  được dispatch sau khi notification Patient đã persist và đã qua grace 60 phút
  từ `missedAt`; event Patient còn pending/processing thì contact được hoãn, còn
  event dead hoặc kết thúc không có notification thì contact bị suppress. Trước
  khi tạo notification, delivery path kiểm tra lại task, enrollment qua
  public port Chronic Care, FamilyLink và đúng FamilyPermission. Thiếu hoặc không
  xác định được enrollment thì fail-closed.
- Quota Companion lưu duy nhất `lastMissedTaskDispatchedAt` theo account. Cập nhật
  quota, notification, notification outbox và `FamilyReminder.dispatched` là một
  transaction; hai worker cạnh tranh cùng Companion chỉ một transaction được
  dispatch. Quota hết hạn thì event được hoãn đủ 24 giờ trượt; cập nhật
  `scheduledAt` và outbox event hoãn cùng transaction.
- Đổi trạng thái enrollment/link/permission sau lần kiểm tra cuối nhưng trước
  commit vẫn là race giữa hai bounded context; hệ thống kiểm tra ngay trong
  delivery transaction nhưng chưa có khóa dùng chung với mọi lifecycle mutation.
  Không xem đây là atomic barrier.
