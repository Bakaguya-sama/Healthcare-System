# RF-12 — Boundary hardening và service decomposition

Status: **DONE — 2026-09-21** (`BE-RF-090` đến `BE-RF-093`).

## Phạm vi

RF-12 xử lý follow-up kiến trúc sau RF-11 và không thay đổi public HTTP/Socket contract. Staging evidence của RF-9/RF-10 không thuộc phase này theo quyết định của owner.

## Boundary và dependency

- Doctor application query contract đã chuyển về Users; Users không còn import Administration.
- Các context công bố dependency được phép dùng qua `public-api.ts`.
- `boundary:check` resolve cross-context relative imports và chỉ cho phép public API hoặc module composition root.
- Authentication và Users là hai module trong cùng Identity context nên được phép dùng internal identity dependency; các context khác không có exception ngầm.
- `doctors` đã bị loại khỏi bounded-context/module allowlist vì doctor profile canonical thuộc User.

## Service decomposition

AI conversation được chia thành:

- `AiAssistantService`: facade giữ contract cho controller và consumer hiện tại.
- `AiMessageOrchestrationService`: start/send message, upload ảnh, RAG/safety/LLM và health summary orchestration.
- `AiConversationQueryService`: list/detail/search/statistics/summary với bounded query.
- `AiConversationManagementService`: favorite/archive/rating/update/delete.

Health Tracking được chia thành:

- `HealthMetricsService`: facade và write/BMI orchestration.
- `HealthMetricQueryService`: recent history, list/detail và DB-native statistics; implement `HealthProfileReader`.
- `HealthMetricAlertService`: threshold, daily-total evaluation, notification và alert review.

## Verification

- TypeScript typecheck: pass.
- API build: pass.
- Unit: 13 suites / 56 tests pass.
- Integration với MongoDB replica set và Redis local: 5 suites / 13 tests pass.
- E2E: 1 suite / 4 tests pass.
- Boundary check: pass.
- Realtime contract check: pass.
- OpenAPI runtime check: pass; public contract không đổi.
- ESLint: 0 errors / 281 warnings, dưới repository budget 402.

RF-9/RF-10 staging evidence không được thực hiện trong RF-12 theo quyết định scope; đây vẫn là release gate riêng trước Release Candidate.
