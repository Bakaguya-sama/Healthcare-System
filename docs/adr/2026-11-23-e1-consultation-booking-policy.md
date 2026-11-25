# ADR — E1 canonical consultation booking policy

## Quyết định

`doctorProfile.bookingSettings` là nguồn cấu hình mutable duy nhất cho scheduled
booking. Pilot chỉ chấp nhận `bookingPolicy = instant`; API và domain policy từ
chối `approval_required` cho đến khi có UX, state machine và SLA được phê duyệt.

Khi Patient đặt lịch, backend chụp toàn bộ settings áp dụng vào
`Consultation.bookingSettingsSnapshot`. Các command cancel, reschedule, check-in
và no-show dùng snapshot đó. Reschedule chỉ đổi slot/thời điểm, không thay policy
snapshot sang policy mới của Doctor.

## Lý do

ENV deployment không thể hiện ownership, audit hay lịch sử policy. Snapshot ngăn
Doctor/Admin thay đổi setting hôm nay làm thay đổi quyền của lịch đã đặt trước đó.

## Migration và rollback

Migration `202611231000` chỉ provision settings instant cho Doctor Profile chưa
có settings; rerun là no-op. Nó không sửa historic consultation snapshot. Nếu
rollback ứng dụng, scheduled booking mới phải bị feature-flag disable/fail-closed;
không được quay về ENV hoặc rewrite consultation cũ.

## Scheduled stale review

Sau 24 giờ, worker chỉ enqueue review/reminder vận hành có idempotency. Worker
không auto-cancel, no-show, release quota, refund hay đổi ledger. Operations/Admin
quyết định command thủ công theo runbook.
