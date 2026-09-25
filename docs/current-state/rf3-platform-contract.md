# RF-3 — Backend boundary, platform hardening và API contract

Status: **DONE — 2026-09-17** (`BE-RF-010` đến `BE-RF-014`).

## 1. Backend repository boundary

- `apps/api` không còn dependency `workspace:*`, `@repo/*` hoặc import source từ `apps/client`/`apps/admin`.
- Enum user/account/doctor mà backend sử dụng thuộc `src/core/domain/user.enums.ts`; frontend có thể sinh type từ OpenAPI thay vì sở hữu enum runtime của backend.
- `cloudinary`, `multer` và `@types/multer` nằm trong package API; package root không còn giữ runtime dependency thay backend.
- `pnpm --filter api boundary:check` fail nếu workspace dependency hoặc frontend/UI source dependency quay lại.

## 2. Runtime configuration

`ConfigModule` dùng `validateEnvironment()` và fail khi Mongo URI, JWT secret, CORS allowlist, port, boolean hoặc limit không hợp lệ. Production từ chối wildcard/empty CORS, JWT dưới 32 ký tự và Swagger UI được bật.

Runtime code dùng `ConfigService`; `process.env` chỉ còn ở các CLI entrypoint migration/benchmark. JWT, Cloudinary và SMTP không có secret fallback trong source.

| Biến                         | Mặc định non-production | Ý nghĩa                                  |
| ---------------------------- | ----------------------- | ---------------------------------------- |
| `API_PREFIX` / `API_VERSION` | `api` / `1`             | REST base path vẫn là `/api/v1`          |
| `SOCKET_PATH`                | `/socket.io`            | Socket.IO transport path, khác namespace |
| `CORS_ORIGINS`               | localhost 5173/5174     | Allowlist dùng chung HTTP và Socket      |
| `TRUST_PROXY`                | `loopback`              | Express trusted proxy topology           |
| `BODY_LIMIT`                 | `1mb`                   | JSON/urlencoded body cap                 |
| `SWAGGER_ENABLED`            | true ngoài production   | Production bắt buộc false                |
| `THROTTLE_ENABLED`           | false                   | Mặc định true ở staging/production       |
| `HTTP_THROTTLE_*`            | 120 request/60 giây     | Global HTTP policy                       |
| `WS_THROTTLE_*`              | 30 event/10 giây        | Chat event policy theo user/handler      |

## 3. Bootstrap và security headers

`configureApplication()` là nguồn cấu hình chung cho runtime, E2E và OpenAPI generator:

- Helmet được gắn trước application middleware; CSP chỉ tắt khi Swagger UI non-production được bật.
- URI versioning, CORS allowlist, trust proxy, body limits và validation pipe dùng config đã validate.
- Correlation middleware nhận hoặc sinh `x-correlation-id`, trả lại header và giữ ID bằng `AsyncLocalStorage`.
- `enableShutdownHooks()` được bật. Shutdown thứ tự Mongo/Redis/worker đầy đủ tiếp tục thuộc RF-4/RF-8 khi các lifecycle module đó tồn tại.
- Một `ConfiguredIoAdapter` áp dụng Socket path và CORS chung; gateway không còn `origin: '*'`.

## 4. Authentication core

`AuthCoreModule` là registration duy nhất cho Passport, `JwtModule` và `JwtStrategy`. Tên này phân biệt phần hạ tầng xác thực dùng chung với `AuthModule` chứa API/nghiệp vụ đăng nhập. Chat, Session, Notification và Presence không còn tự tạo JWT module/secret. Strategy dùng `JWT_SECRET` bắt buộc và query tối thiểu để từ chối account không active.

OAuth/cookie scheme chưa được khai báo trong OpenAPI vì runtime hiện chỉ có bearer JWT. OAuth là feature mới `BE-NF-001`; thêm scheme trước khi có flow thật sẽ tạo contract sai.

## 5. Contract artifacts

| Contract | Source                                     | Artifact                                  | Gate             |
| -------- | ------------------------------------------ | ----------------------------------------- | ---------------- |
| REST     | controller/DTO + `core/openapi/openapi.ts` | `apps/api/openapi/openapi.json`           | `openapi:check`  |
| Socket   | `core/realtime/realtime-contract.ts`       | `apps/api/contracts/realtime-events.json` | `realtime:check` |

OpenAPI có operation ID ổn định, bearer scheme và `ErrorResponse` dùng chung cho 400/401/403/404/409/429/500. `openapi:check` báo riêng path/method bị xóa và fail với mọi artifact drift. CI chạy contract gates; thay đổi có chủ đích phải review diff rồi chạy generator.

## 6. Throttling và observability

- `THROTTLE_ENABLED` mặc định `false` ở development/test và `true` ở staging/production; giá trị khai báo tường minh luôn được ưu tiên.
- Khi bật, HTTP dùng global `ProxyThrottlerGuard`; auth routes có limit chặt hơn từ 3–10 request/phút tùy thao tác.
- Khi bật, Chat Socket dùng `WsThrottleGuard` và phát Socket.IO `exception` khi vượt limit.
- RF-3 ban đầu dùng storage theo process; RF-4/`BE-RF-022` đã thay bằng Redis storage dùng chung cho HTTP và Socket để hỗ trợ nhiều API replica.
- `JsonLogger` xuất JSON, gắn correlation ID và redact authorization/cookie/password/token/OTP/API secret ở cả object lồng nhau và chuỗi.
- `HttpExceptionFilter` trả error envelope ổn định: `statusCode`, `timestamp`, `path`, `method`, `correlationId`, `error`, `message`.

## 7. Verification

- Lint: 0 error, 398 legacy warning (không tăng quá baseline gate 402); typecheck và production build đều đạt.
- Unit: 10 suite/53 test đạt, gồm config fail-fast, log redaction/correlation, throttle theo môi trường và Socket throttling.
- Integration: 3 suite/5 test đạt với MongoDB replica set và Redis.
- E2E: 1 suite/4 test đạt, gồm legacy login contract, validation error envelope, Helmet header, Swagger exposure và HTTP 429.
- `boundary:check`, `openapi:check` và `realtime:check` đều đạt và được thêm vào CI gate.
- Redis lifecycle/health và distributed throttle đã hoàn tất ở RF-4/`BE-RF-022`; multi-instance Socket presence vẫn thuộc `BE-RF-043`.
