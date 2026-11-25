# ADR: Đồng bộ CareTask theo Enrollment

**Trạng thái:** Chấp nhận cho runtime sau merge, 25/11/2026.

## Bối cảnh

Task cần được materialize khi Enrollment active/resume và hủy khi pause/complete/
cancel/rút consent. Việc schedule/cancel sau khi trả API hoặc bắt exception có thể
nuốt lỗi, tạo trạng thái lệch và không có đường retry bền vững.

## Quyết định

1. `PatientCareProgram` là source of truth. Mỗi command status-changing commit
   Enrollment revision, AuditLog, idempotency record và `care.enrollment.tasks.sync.v1`
   vào Outbox trong cùng MongoDB transaction.
2. Payload chỉ có event version, enrollment ID, revision và status snapshot; worker
   dùng ID/revision để kiểm tra nhưng quyết định từ trạng thái Enrollment hiện tại.
   Event cũ không được đảo ngược transition mới hơn.
3. Worker schedule task idempotent khi Enrollment hiện tại active, hoặc cancel
   `scheduled|due` task khi Enrollment inactive/missing. Task unique key hiện hữu,
   outbox idempotency/retry/lease và dead-letter vẫn là cơ chế recovery.
4. Reconciliation dùng keyset `_id` batches để duyệt toàn bộ active Enrollment và
   task còn mở; không giới hạn 200 đầu tiên. Automation flag chặn tạo task mới khi
   tắt, nhưng không chặn hủy task đã mất eligibility.
5. Task response/review/evaluation/reminder kiểm tra Enrollment active trong request/
   delivery path. GET task list không tự schedule side effect. Đồng bộ là eventual
   consistency; không tuyên bố transaction xuyên Enrollment/CareTask hoặc barrier
   giữa lifecycle change và worker dispatch.
6. Khi transition Enrollment đã commit nhưng worker lag, API trả Enrollment mới; task
   availability có thể đến sau. Consumer refresh task list; command/reminder vẫn
   fail-closed theo trạng thái mới nhất.

## Hệ quả và giới hạn

- Transaction MongoDB phải chạy trên replica set. Worker, Redis/BullMQ và MongoDB
  cần được giám sát; outbox lag/dead-letter cần runbook xử lý.
- Nếu worker unavailable, Enrollment state không rollback; event giữ bền vững và
  retry/reconciliation phục hồi task projection.
- Một task có thể tồn tại ngắn hạn sau transition nếu worker xử lý trễ; thao tác và
  reminder phải bị chặn ngay khi đọc thấy Enrollment không active.
- Khi resume, worker khôi phục task còn trong window đã bị hủy do pause hoặc do
  reconciliation inactive, giữ nguyên unique key; không khôi phục task đã hoàn tất,
  missed hoặc bị hủy vì lý do khác. Việc đọc trạng thái Enrollment và ghi task chưa
  có transaction chung: transition đồng thời với worker có thể làm projection lệch
  tạm thời; outbox/reconciliation sửa lại, không phải revision fence nguyên tử.
- Migration `202611251000` là thay đổi riêng để validator catalog nhận integer BSON
  versions; không sửa migration CC000 đã phát hành.
