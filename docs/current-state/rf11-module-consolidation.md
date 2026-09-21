# RF-11 — Bounded-context module consolidation

Status: **DONE — 2026-09-21** (`BE-RF-080` đến `BE-RF-086`).

## Kết quả

`AppModule` không còn compose module theo collection/controller. Runtime business topology chỉ còn:

| Context | Public module | Capability nội bộ |
| --- | --- | --- |
| Identity | `AuthenticationModule`, `UsersModule` | token/session/OTP/strategy; account, patient/admin profile, doctor directory và account administration |
| Consultation | `ConsultationsModule` | consultation core, messaging, reviews và realtime adapters |
| AI Advisory | `AiAdvisoryModule` | conversations, feedback, knowledge-base documents/chunks và retrieval/ingestion |
| Health Tracking | `HealthTrackingModule` | metric history, statistics, alerts và AI health-profile reader port |
| Moderation | `ModerationModule` | blacklist policy và violation workflow |
| Notification | `NotificationsModule` | notification history, gateway và delivery orchestration |
| Administration | `AdministrationModule` | admin-facing orchestration và cross-context profile read assembler |

Platform adapters đã rời `modules/`:

- Cloudinary/upload → `infrastructure/files` qua `FilesModule`.
- Nodemailer → `infrastructure/email` qua `EmailModule`.
- Outbox/worker → `infrastructure/outbox`.
- Redis presence → `infrastructure/realtime/presence`.
- Passport/JWT strategy được đặt trong Authentication; `AuthCoreModule` trùng composition đã bị xóa.

## Ownership sau consolidation

- `UsersModule` là runtime owner duy nhất đăng ký `User` và `Patient` models. Authentication nhận model token do owner export trong cùng Identity bounded context, không tự đăng ký lại schema.
- Doctor/Admin profile canonical nằm trong `User`; runtime `DoctorSchema`, `AdminSchema` và dual write đã bị xóa. Migration lịch sử/collection retention không bị sửa bởi source cleanup.
- `ConsultationsModule` đăng ký Consultation, Message và Review. Review cập nhật rating qua `UsersService`, không đăng ký Doctor model.
- `ModerationModule` đăng ký BlacklistKeyword và Violation. User profile tổng hợp report qua `ViolationsService`, không đăng ký Violation trong Users.
- `AiAdvisoryModule` đăng ký toàn bộ AI conversation/feedback/document/chunk models; document/chunk không còn top-level Nest module.
- `AdministrationModule` không đăng ký model. Command account/doctor gọi `UserAdministrationService`; profile read model phối hợp Users, Reviews và Violations owner services.

## Đã xóa

- Top-level modules: `patients`, `admins`, `chat`, `reviews`, `rag`, `ai-assistant`, `ai-feedbacks`, `ai-documents`, `ai-document-chunks`, `blacklist-keywords`, `violations`, `cloudinary`, `presence`, `outbox`, `auth`, `admin`, `health-metrics`.
- Empty legacy directories: `ai-sessions`, `ai-messages`, `ai-health-insights`.
- Orphan code: duplicate Authentication `UserSchema`, scaffold `Auth` entity/DTOs, legacy Doctor/Admin runtime schemas và `AuthCoreModule`.
- Collection-level `*.module.ts` files; capability folders chỉ còn controller/service/DTO/entity/provider của owner context.

## Contract và dữ liệu

- HTTP routes, Socket event names và canonical payload names được giữ nguyên; việc đổi đường dẫn source không đổi public URL.
- Không sửa migration đã áp dụng. `doctors`/`admins` trong migration lịch sử không còn runtime model; physical collection cleanup chỉ được làm bằng migration mới sau retention/reconciliation gate.
- Admin role runtime dùng canonical `super_admin`, `user_manager`, `ai_manager` từ `core/domain/user.enums.ts`; duplicate enum cũ đã bị loại bỏ.

## Enforcement

`boundary:check` hiện fail khi:

- xuất hiện lại top-level module ngoài allowlist bounded context;
- capability con tạo `*.module.ts` riêng;
- legacy Session/AI compatibility vocabulary hoặc frontend workspace dependency quay lại.

## Verification local

- TypeScript typecheck: pass.
- API build: pass.
- Unit: 13 suites / 56 tests pass.
- Integration: 5 suites / 13 tests pass.
- E2E: 1 suite / 4 tests pass.
- Realtime contract check: pass.
- OpenAPI runtime generation/check: pass; semantic diff so với baseline RF-10 bằng `0`.
- Boundary check: pass.
- ESLint: 0 errors; warning count nằm dưới repository budget hiện tại.
