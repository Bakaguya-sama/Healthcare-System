# RF-10 — Canonical cutover runbook

## Kết quả RF-10A và RF-10B

- Runtime chỉ còn canonical `Consultation`, `AiConversation` và `AiConversationMessage`.
- Owner Consultation nằm tại `modules/consultations`; Admin, Chat và Review truy cập qua `ConsultationsService`, không đăng ký schema chéo module.
- Đã xóa `modules/sessions`, Session schema/service/controller/gateway/DTO, feature flag và toàn bộ HTTP/Socket compatibility aliases.
- Message và Review chỉ dùng `consultationId`; AI feedback chỉ expose `aiConversationId`.
- Ba legacy AI modules và destructive legacy seed đã bị xóa.
- `@nestjs/bullmq` đã bị gỡ vì worker dùng package `bullmq` trực tiếp.
- Migration đã áp dụng không bị sửa; collection/field/index lịch sử chưa bị drop để giữ khả năng đối soát và rollback dữ liệu.

## Contract canonical bắt buộc

Frontend repo mới chỉ tích hợp:

- HTTP `/consultations/**`, `/admin/consultations/**`, `/chat/consultation/**`, `/reviews/consultation/**`;
- Socket namespace `/consultations` và `/chat`;
- payload/event dùng `consultationId`, `join_consultation`, `leave_consultation`, `get_consultation_messages`, `send_consultation_message`, `consultation_message`, `consultation_changed`.

Không còn `/sessions`, `/admin/sessions`, `/chat/session/**`, `/reviews/session/**`, namespace `/session`, `doctorSessionId` hoặc event `*_session`. Đây là breaking cutover có chủ đích; không có feature flag để bật lại compatibility trong cùng release.

## Checklist RF-10C

- [x] Backup legacy được owner xác nhận trong `plan/preflight-checklist.md`.
- [x] Rehearsal migration/verify/no-op trên MongoDB replica set database riêng.
- [x] Reconciliation có 0 blocker và destructive migration có fail-fast test khi còn dữ liệu chưa ánh xạ.
- [x] Full unit/integration/E2E, boundary, typecheck, build, lint, OpenAPI và realtime checks pass.
- [x] Frontend owner xác nhận repository mới chỉ dùng canonical API.
- [x] Consumer/access-log observation: **N/A** vì không có frontend legacy production; quyết định canonical-only do owner đưa ra.
- [x] Physical cleanup được version hóa trong `202609202100-rf10c-physical-cleanup` và chạy thành công trên rehearsal database.

Trước khi deploy lên một database ngoài local rehearsal:

1. Xác nhận đúng URI/database và backup có thể restore.
2. Chạy `pnpm --filter api rf10c:reconcile`; chỉ tiếp tục khi `ready=true` và mọi blocker bằng 0.
3. Chạy `database:migrate`, `database:verify`, rồi `database:migrate -- --expect-noop`.
4. Lưu JSON reconciliation và migration log cùng release artifact.

## Rollback

RF-10B không còn runtime adapter. Nếu canonical release lỗi, rollback bằng release artifact trước đó hoặc hotfix canonical; không bật lại feature flag và không khôi phục dual-write. Dữ liệu legacy vẫn được giữ trong retention window để đối soát. Không restore collection cũ đè lên canonical collection.

## Điều kiện đóng RF-10 hoàn toàn

RF-10A runtime cutover, RF-10B canonical source cleanup và RF-10C local release rehearsal đã hoàn tất. RF-10 được đánh dấu **DONE** trong codebase; chạy migration trên staging/production là deployment operation và vẫn phải tuân thủ checklist URI/backup/reconciliation ở trên.
