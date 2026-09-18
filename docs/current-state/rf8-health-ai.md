# RF-8 — Health Tracking và AI/RAG

## Trạng thái

**Implementation complete ngày 18/09/2026.** RF-8 đã được áp migration cục bộ hai lần (lần hai là no-op), typecheck/build/lint và 13 suites/60 tests đều pass.

## Quyết định kiến trúc đã chốt

- `HealthMetric` có `source`, `timezone`, lịch sử dùng cursor stable (`sort field` + `_id`) và statistics bị giới hạn tối đa 366 ngày; khi không truyền range, API chỉ aggregate 90 ngày gần nhất.
- Health threshold là advisory. `HealthMetricsService` không còn gọi AI trực tiếp; thông báo vượt ngưỡng có nội dung deterministic, nêu rõ không phải chẩn đoán.
- `HealthProfileReader` là port được `AiAssistantService` dùng để tự đọc tối đa 30 metrics của chính người dùng. Client không còn là nguồn `recentMetrics` cho profile summary.
- `AiConversation` là metadata canonical; message canonical nằm ở `aiconversationmessages`, không còn embedded array. Message history dùng MongoDB query, projection, cursor stable và `limit + 1`.
- Migration `202609182400-rf8-ai-message-cutover` chuyển embedded messages và dữ liệu `AiSession`/`AiMessage` cũ một cách idempotent. `AiSessionsModule`, `AiMessagesModule`, `AiHealthInsightsModule` đã bị gỡ khỏi runtime; collection cũ chỉ còn dữ liệu lưu trữ/rollback.
- RAG retrieval phụ thuộc `VECTOR_SEARCH_PORT`; Atlas Vector Search là adapter. Provider SDK vẫn chỉ nằm ở `LlmGatewayService`.
- Blacklist dùng cache-aside TTL 60 giây cho cả prompt construction và endpoint check; create/update/delete invalidates cache. Search keyword escape literal input và giới hạn 100 ký tự.

## Migration và cutover

1. Chạy `database:migrate` trước khi deploy API mới.
2. Migration tạo index canonical, extract `AiConversation.messages`, rồi import `AiSession`/`AiMessage` theo `legacyAiSessionId` và `legacySourceKey` unique.
3. Không drop `aisessions`, `aimessages`, `aihealthinsights` trong migration này. Chỉ xóa collection sau retention window, backup và xác nhận không còn consumer.
4. Rollback ứng dụng chỉ cần mount lại legacy adapters; dữ liệu cũ vẫn còn nguyên.

## Local verification ngày 18/09/2026

- Migration đến schema version `202609182400`; chạy lại với `--expect-noop` thành công.
- Structural `explain('executionStats')` trên Mongo local chọn `IXSCAN` cho health history, conversation list và AI message history.
- Staging cần chạy lại cùng query catalog với fixture đại diện trước release để lấy p95/keys/docs examined thực tế; đây là release evidence vận hành, không phải blocker code RF-8.
