# RF-0 — Module disposition

Mỗi module legacy đã được gán đúng một hướng chính. `keep` không có nghĩa giữ nguyên implementation; `replace` không cho phép xóa trước khi migration/adapter/cutover hoàn tất.

| Module/capability    | Disposition                        | Lý do và đích                                                                              |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `auth`               | **replace/refactor**               | Gom Authentication, canonical User/AuthSession, Redis OTP; giữ compatibility endpoints    |
| `users`              | **refactor**                       | Tách command/query/profile, pagination/projection; loại cross-model god service            |
| `patients`           | **consolidate**                    | Chốt Patient profile ownership với canonical User, tránh hai API profile                   |
| `admins`             | **consolidate**                    | Account/admin profile ownership về Identity/Admin; không duy trì hai admin modules độc lập |
| `admin`              | **refactor**                       | Tách practitioner verification, account moderation, dashboard query                        |
| `consultations`      | **canonical owner**                | Owner duy nhất của schema, state transition, HTTP và realtime Consultation                 |
| `sessions`           | **removed**                        | RF-10B đã xóa module, adapter, feature flag, HTTP/Socket aliases và Session DTO             |
| `chat`               | **refactor**                       | Message command/query, authorization, cursor, attachment port                              |
| `reviews`            | **refactor**                       | Unique consultation review + atomic rating projection/moderation                           |
| `health-metrics`     | **keep/refactor**                  | Giữ capability, tách command/query/statistics/rules và tối ưu aggregation                  |
| `notifications`      | **keep/refactor**                  | Owner notification + delivery outbox/worker                                                |
| `presence`           | **refactor**                       | Shared state/Redis adapter, auth/origin/throttle; không giữ memory-only multi-instance     |
| `violations`         | **keep/refactor**                  | Manual moderation workflow/audit; thêm query/index theo catalog                            |
| `blacklist-keywords` | **keep/refactor**                  | Moderation config; cache có invalidation sau query baseline                                |
| `cloudinary`/upload  | **refactor adapter**               | Tách media port, policy và lifecycle khỏi domain services; bỏ debug exposure production    |
| `nodemailer`         | **refactor adapter**               | Email delivery qua notification/outbox worker, không await trong domain write              |
| `ai-assistant`       | **keep as target facade/refactor** | Client đang dùng; tách conversation/query/orchestration/provider                           |
| `rag`                | **keep/refactor**                  | Giữ retrieval/ingestion ports; version search definition và background ingest              |
| `ai-documents`       | **consolidate**                    | Knowledge/document owner cho RAG; refactor ingestion async                                 |
| `ai-document-chunks` | **consolidate/internalize**        | Không coi raw chunk CRUD là public product API lâu dài                                     |
| `ai-sessions`        | **removed after consolidation**    | Runtime/source đã xóa ở RF-10; historical collection chỉ giữ cho retention/rollback         |
| `ai-messages`        | **removed after consolidation**    | Runtime/source đã xóa ở RF-10; canonical history là `AiConversationMessage`                 |
| `ai-feedbacks`       | **canonical**                      | Dùng `aiConversationId`; RF-10B đã backfill liên kết và xóa runtime `aiSessionId`            |
| `ai-health-insights` | **removed**                        | Không có runtime consumer; module/schema/service đã xóa ở RF-10                             |

## Feature modules chưa tồn tại

OAuth, AvailabilitySlot, scheduled booking, Queue/Check-in/No-show, Payment/Refund và UserDevice/FCM không thuộc disposition legacy. Chúng là `BE-NF-*` có dependency rõ trong plan. Outbox foundation đã được triển khai ở RF-9.

## Removal gate

Một module/endpoint chỉ được xóa khi đủ: không có source consumer, access-log window không có traffic hoặc owner xác nhận, data retention/migration đã chạy, OpenAPI diff được duyệt và compatibility window đã kết thúc.
