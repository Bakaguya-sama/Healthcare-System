# RF-0 — Legacy behavior and status mapping

Tài liệu này đóng băng hành vi source hiện tại để RF-1 viết characterization tests. Nó không khẳng định hành vi hiện tại là business rule mục tiêu.

## 1. Session

Persisted status: `pending | active | completed | rejected`.

| Command    | Actor check                     | From                     | To          | Side effect                                                              |
| ---------- | ------------------------------- | ------------------------ | ----------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| create     | patient lấy từ JWT              | new                      | `pending`   | Ghi session; tạo notification cho doctor; emit `session_changed:created` |
| confirm    | doctor participant              | `pending`                | `active`    | Notification cho patient; emit `confirmed`                               |
| reject     | doctor participant              | `pending`                | `rejected`  | Notification cho patient; emit `rejected`                                |
| start      | doctor participant              | `pending                 | active`     | `active`                                                                 | Set `startedAt`; không emit session event   |
| complete   | doctor participant              | `active`                 | `completed` | Set notes/`endedAt`; emit `completed`                                    |
| cancel     | patient hoặc doctor participant | mọi status trừ completed | `rejected`  | Gửi nội dung “rejected by doctor”; emit `rejected`                       |
| reschedule | patient hoặc doctor participant | `pending                 | active`     | `pending`                                                                | Đổi `scheduledAt`; không notification/event |
| update     | participant                     | `pending                 | active`     | giữ nguyên hoặc DTO có thể gán field/status được DTO cho phép            | Không event                                 |
| delete     | patient participant             | `pending`                | deleted     | Không event                                                              |

Session hiện trộn request consultation và appointment semantics. `scheduledAt` bắt buộc ngay từ create nhưng doctor vẫn confirm/reject; không có AvailabilitySlot, hold/booking, queue hoặc payment link.

## 2. Chat/Message

Message không có lifecycle status. Send được phép khi Session là `pending` hoặc `active`; bị chặn ở `completed`/`rejected`.

- Sender phải là patient/doctor của session và `senderType` phải khớp.
- REST send hỗ trợ multipart upload; socket send chỉ nhận DTO/metadata hiện có.
- Update/delete chỉ so senderId; không có edit timestamp, tombstone hoặc audit.
- REST session history không kiểm tra participant trong service; Socket history có participant check.
- REST send phát `new_message` vào room nhưng không phát `chat_notification`; socket send phát cả hai.
- Pagination là page/skip, sort sentAt desc; chưa có stable `_id` tie-breaker/cursor.

## 3. Review

Review fields chỉ có patientId, doctorId, optional doctorSessionId, rating và comment.

| Operation         | Hành vi hiện tại                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| create            | Tìm doctor profile và session nhưng không xác minh session thuộc patient/doctor, không yêu cầu completed, không chặn duplicate; ghi review rồi update rating projection bằng write thứ hai |
| update            | Chỉ author; nếu rating đổi thì update projection bằng write riêng và rollback thủ công                                                                                                     |
| delete            | Chỉ author; update projection rồi delete, rollback thủ công nếu lỗi                                                                                                                        |
| helpful/unhelpful | Chỉ đọc review và trả success; không persist user/count                                                                                                                                    |
| flag              | Chỉ đọc review và trả success; không persist flag/adminNotes; route không có admin role metadata                                                                                           |
| query             | JWT toàn controller; list/doctor/session/rating/top dùng page/aggregation không đồng nhất                                                                                                  |

## 4. Notification

Persisted read state là `isRead` + optional `readAt`; gateway action là `send | mark_read | mark_all_read | deleted`.

| Operation                 | DB behavior                                                | Realtime behavior                                 |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| create                    | Insert unread                                              | Emit `notifications:send` đồng bộ sau insert      |
| find detail               | Nếu unread thì set `isRead=true`, nhưng không set `readAt` | Emit `mark_read`                                  |
| update read               | Gán `isRead`; không đồng bộ `readAt`                       | Emit `mark_read` kể cả chuyển unread              |
| markAsRead service method | Set `isRead=true`, `readAt=now`                            | Emit `mark_read`; không có controller route riêng |
| mark all                  | `updateMany isRead=true`, không set `readAt`               | Emit `mark_all_read` khi có thay đổi              |
| delete                    | Delete document                                            | Emit `deleted` với snapshot                       |

Notification chưa có delivery channel/status/attempt, outbox, worker, idempotency, retry hoặc dead-letter. `expiresAt` chưa có TTL index.

## 5. Compatibility rule cho refactor

- RF-1 tests phải ghi lại hành vi thực tế nhưng được phép đánh dấu defect bằng test skipped/TODO nếu việc giữ hành vi tạo rủi ro bảo mật.
- RF tasks không được âm thầm biến `rejected` thành `cancelled`, đổi payload event hay đổi envelope; thay đổi contract cần adapter/version và cập nhật `docs/fe-integration.md`.
- Business model mục tiêu (Consultation/Availability/Queue/Payment/Refund) thuộc feature work hoặc canonical domain task đã nêu trong plan, không được coi là “sửa lỗi nhỏ” của Session.
