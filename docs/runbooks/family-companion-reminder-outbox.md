# Runbook E2 — Family Companion reminder/outbox

## Mục tiêu

Family Companion chỉ chạy khi `FAMILY_COMPANION_ENABLED=true`. Mặc định cờ là
`false`; khi tắt, API trả lỗi fail-closed và worker không claim event
`family.reminder.dispatch.v1` hoặc job hết hạn invitation.

## Worker và lịch chạy

- `outbox-dispatch-schedule`: 5 giây/lần, claim outbox theo batch và đẩy vào
  BullMQ với retry exponential/backoff.
- `family-invitation-expiry`: 60 giây/lần, chuyển `pending` quá
  `invitationExpiresAt` sang `expired`, ghi AuditLog và outbox trong transaction.
- `family-weekly-progress`: 1 giờ/lần, tạo tối đa một reminder/link/tuần bằng
  `uniqueKey`; delivery chỉ in-app.
- `family-missed-task-reminders`: 60 giây/lần quét CareTask `missed + required`
  bằng keyset cursor `_id`, batch tối đa 200; cursor có tie-breaker duy nhất và
  lượt quét tiếp theo bắt được task mới phát sinh. Một task lỗi không chặn task
  sau; lượt quét sau thử lại. Key FamilyReminder ổn định theo FamilyLink + task,
  không đổi theo ngày kể cả task legacy thiếu `missedAt`.
- `family.reminder.dispatch.v1`: kiểm tra lại link, permission và trạng thái
  task và enrollment ngay trong delivery path trước khi tạo notification.
  Pause/revoke, task không còn `missed + required`, hoặc enrollment không còn
  `active`/không xác định đều suppress. Reminder Patient trong cửa sổ task dùng
  `care.task.reminder`; task đã missed phát event Patient riêng
  `care.task.missed-reminder.v1` với idempotency key theo task. Companion chỉ
  được gửi sau khi Notification Patient đã persist và đủ grace 60 phút tính từ
  `missedAt`. Nếu event Patient còn pending/processing, event Companion được hoãn
  một phút trong transaction; nếu event dead hoặc kết thúc không có notification,
  FamilyReminder chuyển `skipped` với reason `patient_reminder_not_dispatched`,
  tránh hoãn vô hạn. Worker chỉ persist nội dung tối thiểu in-app.
- `family.health-metric-sharing.changed.v1`: consumer kiểm tra lại link active,
  phiên invitation và revision sharing active trước khi tạo thông báo in-app;
  retry dùng notification idempotency key ổn định. Khi tắt cờ, event được hoãn.
  Grant/revoke/read API và consumer notification đã được nối vào runtime; unit/
  integration/API test có evidence trong `docs/evidence/phase-e2-family-companion-2026-11-23.md`.
  Chưa có staging deploy/worker smoke, vì vậy chưa bật cờ tại môi trường deploy.

## Chính sách reminder

1. Reminder Patient trong cửa sổ task giữ event `care.task.reminder`. Khi task
   thành `missed`, Family scheduler yêu cầu Chronic Care tạo event
   `care.task.missed-reminder.v1`; worker chỉ tạo Notification nếu task vẫn
   `missed + required` và enrollment còn `active`. Notification idempotency key
   riêng theo task giúp crash sau khi persist nhưng trước khi ack outbox không tạo
   bản trùng. Companion chờ Notification đã persist; trạng thái outbox `delivered`
   riêng lẻ không được xem là bằng chứng đã thông báo cho Patient.
2. Thời điểm contact được tính theo timezone Patient, quiet hours `21:00–08:00`.
3. Contact chỉ nhận nội dung trạng thái tối thiểu; không đưa HealthMetric, CareAlert,
   chẩn đoán, thuốc, bác sĩ, consultation, chat, AI hoặc nội dung care-plan.
4. Quota missed-task được giới hạn theo Companion account, dùng thời điểm
   `lastMissedTaskDispatchedAt` và cửa sổ trượt 24 giờ; thời gian cấp quota lấy
   từ `$$NOW` của MongoDB trong conditional update, không dựa đồng hồ từng worker;
   không chia bucket theo ngày
   hoặc FamilyLink. `FamilyReminderQuotas` chỉ chứa Companion ID và timestamp,
   không chứa task hay dữ liệu lâm sàng. Hai worker dùng transaction cập nhật cùng
   một quota record nên chỉ một reminder có thể dispatch trong cửa sổ đó.
5. Nếu quota còn hiệu lực, worker hoãn tới `lastMissedTaskDispatchedAt + 24 giờ`
   rồi áp dụng lại quiet hours. Cập nhật reminder `scheduledAt` và outbox event
   đang xử lý sang `pending`/`nextAttemptAt` nằm trong cùng transaction. Lỗi tạo
   notification hoặc notification outbox làm rollback cả quota và trạng thái
   reminder; retry không giữ quota.
6. Khi dispatch thành công, quota timestamp, `FamilyReminder.dispatched`,
   `Notification`, `notification.created` outbox event và ack event
   `family.reminder.dispatch.v1` commit cùng transaction. Khi suppress, trạng thái
   `FamilyReminder.skipped` và ack event cũng cùng transaction. Crash trước commit
   rollback tất cả; crash sau commit thì event đã delivered, nên không có khoảng
   giữa để tạo notification trùng hoặc để reminder đã xử lý nhưng event còn treo.
7. Migration forward-only `202611241040` tạo quota collection/index và index scan
   CareTask. Chạy `pnpm --filter api database:migrate`, sau đó
   `pnpm --filter api database:verify`; không bật feature flag trước khi verifier
   xác nhận version mới trên môi trường deploy.

## Trạng thái Patient-first

`getPatientReminderState` kết hợp Notification đã persist với trạng thái hai
outbox key của Patient. Kết quả `pending`/`processing` làm Companion được hoãn;
`notified` cho phép đi tiếp sau khi các policy khác pass; `dead` hoặc
`delivered_without_notification` suppress fail-closed; `not_scheduled` được hoãn
để lượt scheduler kế tiếp tạo event. Mỗi lượt retry đều kiểm tra lại task,
enrollment, link và permission trước khi dispatch. Nếu luồng nghiệp vụ Patient
không phát được Notification trong quá trình lỗi/không đủ điều kiện, không tạo
notification cho Companion để “bù” thay Patient.

Semantics đồng thời: task/enrollment được đọc lại trong đường dispatch, ngay trước
quota và notification. Một trạng thái enrollment đổi sau lần đọc cuối nhưng trước
commit có thể cạnh tranh với transaction dispatch; hiện chưa có khóa chung với
lifecycle Chronic Care để biến việc pause thành barrier nguyên tử. Không tuyên bố
đã loại bỏ race đó.

## Kiểm tra vận hành an toàn

```powershell
$env:FAMILY_COMPANION_ENABLED = 'false'
pnpm --filter api database:verify
pnpm --filter api realtime:check
pnpm --filter api openapi:check
```

Khi rehearsal ở staging, bật cờ ở process worker trước, quan sát outbox
`pending/processing/dead`, queue lag và retry; sau đó bật API. Tắt cờ là kill
switch cho reminder và thông báo sharing: event chưa gửi sẽ bị hoãn. Các event
lifecycle family khác hiện được worker xác nhận như audit fact. Không ghi raw token, mã 6
chữ số, email/phone, PHI hay payload notification vào log/evidence.

## Xử lý dead-letter

Không replay mù. Xác định `familyReminderId`/`uniqueKey` từ metadata đã redacted,
kiểm tra link còn `active`, permission còn `active`, rồi replay một event với cùng
idempotency key. Nếu link đã pause/revoke, đánh dấu `skipped` và không gửi lại.
