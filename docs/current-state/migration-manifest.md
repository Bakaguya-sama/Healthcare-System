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
