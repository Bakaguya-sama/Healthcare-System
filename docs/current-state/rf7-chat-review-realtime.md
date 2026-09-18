# RF-7 — Chat, Review và Realtime

## Đã triển khai

- `messages.consultationId` là liên kết chuẩn; `doctorSessionId` chỉ còn là field đọc tương thích trong giai đoạn chuyển đổi.
- Migration `202609182200-rf7-chat-reviews` backfill liên kết từ dữ liệu cũ, tạo compound cursor indexes, unique review theo consultation và unique `(consultationId, clientMessageId)` cho retry-safe send.
- Message history dùng cursor kép `(sentAt, _id)` và giới hạn `limit + 1`; API cũ vẫn trả envelope `data`/`pagination.limit`.
- Chat service chỉ xác thực participant trên `Consultation`; các socket room không thể join/read nếu không phải patient/doctor của consultation.
- Socket protocol chuẩn: `join_consultation`, `leave_consultation`, `get_consultation_messages`, `consultation.message.v1`. Event `*_session` còn alias để client cũ chuyển đổi dần.
- JWT handshake dùng helper dùng chung; Socket.IO dùng cùng `CORS_ORIGINS` allowlist, không wildcard.
- Presence ghi Redis set theo user với TTL 300 giây và vẫn có fallback local khi Redis tạm lỗi.
- Review là collection riêng, unique theo consultation; chỉ patient của consultation đã `completed` được tạo review. Helpful/flag thực sự ghi dữ liệu.
- Doctor review history hỗ trợ cursor `(createdAt, _id)` và compound index `(doctorId, createdAt, _id)`; page vẫn được giữ cho client cũ.
- Rating summary vẫn dùng aggregation và doctor projection; cache directory bị invalidate sau thay đổi rating.

## Compatibility và giới hạn

- Legacy documents cần chạy database migrations trước khi bật canonical-only reads.
- Socket.IO Redis Adapter chưa bật vì cần multi-instance proof/load test riêng; Redis presence đã sẵn sàng.
- Không mở rộng TURN/WebRTC hoặc moderation workflow trong RF-7.

## Verification

- Typecheck, build, ESLint và 13 test suites/60 tests pass ngày 18/09/2026.
- Cần bổ sung E2E socket retry/room authorization và explain baseline trên staging dataset trước RF-10 cutover.
