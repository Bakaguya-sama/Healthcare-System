# Kế hoạch Backend: Refactor code cũ và phát triển tính năng mới

## 1. Thông tin và phạm vi tài liệu

| Thuộc tính                 | Giá trị                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Ngày lập                   | 11/09/2026                                                                                                                   |
| Cập nhật gần nhất          | 15/09/2026 - tách riêng kế hoạch refactor backend và feature backend; loại task triển khai frontend                          |
| Deadline                   | 31/12/2026                                                                                                                   |
| Phạm vi thực thi           | Chỉ Backend: NestJS, MongoDB/Mongoose, Redis, BullMQ, REST, Socket.IO, WebRTC signaling, worker, test, CI/CD và tài liệu API |
| Ngoài phạm vi thực thi     | Web Client, Web Admin và React Native; được triển khai ở repository frontend khác                                            |
| Kiến trúc đích             | Modular Monolith, domain-oriented modules, DDD-lite cho domain phức tạp                                                      |
| Chiến lược                 | Refactor có kiểm soát, không rebuild toàn bộ                                                                                 |
| Database                   | MongoDB mới, Mongoose làm ODM, migration có version                                                                          |
| Nguồn nghiệp vụ            | `docs/BUSINESS_RULES.md`, `docs/db-template-v7.dbml`, `docs/overview.md`                                                     |
| Hợp đồng bàn giao frontend | OpenAPI, realtime event schemas và `docs/fe-integration.md`                                                                  |
| Điều kiện khởi động        | Hoàn thành và chuyển `plan/preflight-checklist.md` sang `APPROVED` trước `BE-RF-001`                                         |

Tài liệu này cố ý chia thành hai phần lớn không đan xen:

1. **Phần A — Refactor backend code cũ:** giữ hành vi đang có, sửa cấu trúc và nền kỹ thuật.
2. **Phần B — Phát triển backend feature mới:** thêm hành vi/nghiệp vụ chưa có trong phiên bản cũ.

Trước khi thực thi, dùng `plan/preflight-checklist.md` để chốt scope, baseline Git/database, runtime, secrets, môi trường, owner và Go/No-Go gate. Checklist là nơi ghi lựa chọn; tài liệu này là thứ tự thực hiện sau khi đã `GO`.

Thứ tự ưu tiên khi có mâu thuẫn:

1. Sản phẩm là hệ thống **tư vấn sức khỏe**, không khám hoặc chẩn đoán.
2. `docs/BUSINESS_RULES.md`.
3. `docs/db-template-v7.dbml`.
4. OpenAPI/realtime contract đã được duyệt.
5. Code cũ.

## 2. Quy tắc phân loại công việc

### 2.1 Refactor là gì

Một task là **refactor** khi người dùng thực hiện cùng một hành vi trước và sau thay đổi. Task có thể đổi module, schema, repository, API nội bộ hoặc hạ tầng, nhưng không thêm năng lực sản phẩm mới.

Ví dụ thuộc refactor:

- Sửa API build và test.
- Hợp nhất hai User schema.
- Đổi `password` thành `passwordHash`.
- Chuyển OTP từ MongoDB sang Redis.
- Chuyển flow yêu cầu tư vấn cũ từ Session sang Consultation `on_demand`.
- Chuyển message từ `sessionId` sang `consultationId`.
- Hợp nhất các module AI/RAG trùng lặp.
- Chuyển notification đang có sang outbox/BullMQ để retry an toàn.
- Sửa authorization room và CORS của Socket.IO.

### 2.2 Feature mới là gì

Một task là **feature mới** khi tạo thêm hành vi mà người dùng hoặc admin chưa thể thực hiện ở phiên bản cũ.

Ví dụ thuộc feature mới:

- Bác sĩ tạo AvailabilitySlot.
- Bệnh nhân chủ động đặt lịch theo slot.
- Check-in, hàng đợi, gọi bệnh nhân tiếp theo và no-show.
- OAuth nếu phiên bản cũ chưa có flow hoạt động.
- Nhắc lịch 24 giờ/15 phút và FCM device delivery.
- AI daily quota.
- Payment, cancel payment order và refund.
- Moderation workflow đầy đủ.

### 2.3 Trường hợp dễ bị trộn

| Nhu cầu      | Phần refactor                                                                  | Phần feature mới                                       |
| ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Consultation | Chuyển request/accept/decline/chat cũ từ Session sang Consultation `on_demand` | Scheduled consultation, slot, check-in, queue, no-show |
| Notification | Chuẩn hóa collection và chuyển cách gửi hiện có sang outbox/worker             | Reminder, FCM, campaign mới                            |
| AI           | Hợp nhất persistence/orchestrator/RAG cũ                                       | Quota ngày và usage reconciliation                     |
| Auth         | Hợp nhất User, refresh session, Redis OTP                                      | OAuth login/linking nếu chưa tồn tại                   |
| Review       | Sửa unique/rating/placeholder hiện có                                          | Violation/moderation workflow mới                      |
| Realtime     | Sửa auth, room, CORS, Redis presence                                           | Queue events mới hoặc TURN capability mới              |

Quy tắc bắt buộc:

- Không tạo issue hoặc pull request mang đồng thời refactor và feature mới.
- Nếu feature cần sửa nền, tạo task refactor riêng và merge trước.
- Migration runner là refactor nền; migration collection/index của feature thuộc chính feature đó.
- Test refactor chứng minh không regression; test feature chứng minh acceptance criteria mới.
- Frontend không nằm trong Definition of Done của backend. Backend chỉ chịu trách nhiệm cung cấp contract và môi trường tích hợp ổn định.

Quy ước ID:

| Tiền tố    | Ý nghĩa                                |
| ---------- | -------------------------------------- |
| `BE-RF-*`  | Backend refactor code/hành vi cũ       |
| `BE-NF-*`  | Backend feature mới                    |
| `BE-REL-*` | Tích hợp, hardening và release backend |

## 3. Kiến trúc backend đích

### 3.1 Quyết định chính

- Giữ NestJS, TypeScript, MongoDB Atlas, Mongoose, Socket.IO, Cloudinary và Google GenAI SDK.
- Dùng Modular Monolith; không tách microservices trong deadline.
- Dùng DDD-lite cho Identity, Consultation, Billing và AI Usage.
- Module CRUD đơn giản chỉ cần controller, service và repository/schema.
- Redis phục vụ OTP, rate limit, quota, presence và BullMQ.
- BullMQ phục vụ background jobs; Kafka chưa cần.
- Transactional Outbox bảo đảm side effect không mất sau khi business transaction commit.
- Mongoose schema phục vụ runtime mapping/validation; migration files quản lý collection, validator, index và backfill.
- Không dùng `autoIndex`, `syncIndexes()` hoặc Mongo shell script như cơ chế deploy schema ở staging/demo.

### 3.2 Cấu trúc đề xuất

```text
apps/api/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── auth/
│   ├── errors/
│   ├── logging/
│   ├── pagination/
│   └── validation/
├── infrastructure/
│   ├── database/
│   ├── redis/
│   ├── queue/
│   ├── outbox/
│   ├── cloudinary/
│   └── observability/
└── modules/
    ├── authentication/
    ├── practitioners/
    ├── consultations/
    ├── health-tracking/
    ├── ai-advisory/
    ├── billing/
    ├── notifications/
    └── moderation/

database/
├── migrations/
├── seeds/
├── atlas/
├── migration-runner.ts
└── verify-database.ts
```

Module phức tạp:

```text
consultations/
├── domain/
│   ├── entities/
│   ├── policies/
│   └── events/
├── application/
│   ├── commands/
│   ├── queries/
│   └── ports/
├── infrastructure/
│   ├── mongoose/
│   └── jobs/
└── presentation/
    ├── http/
    └── socket/
```

Quy tắc phụ thuộc:

```text
presentation  -> application -> domain
infrastructure -> application ports/domain
domain -> không phụ thuộc NestJS, Mongoose, Redis, Socket.IO hoặc provider SDK
```

### 3.3 Hiện trạng công nghệ trong source

Không cài lại hoặc thay công nghệ chỉ vì plan nhắc đến nó. Audit hiện tại cho thấy:

| Nhóm             | Hiện trạng                                                                           | Quyết định                                                                  |
| ---------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| OpenAPI/Swagger  | Đã có `@nestjs/swagger`; `main.ts` đã dựng Swagger UI                                | Giữ, chuẩn hóa contract và giới hạn cách public ở production                |
| JWT/Passport     | Đã có `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/jwt` và `JwtStrategy` | Giữ; gom cấu hình/guard về Authentication, không cài auth framework khác    |
| Input validation | Đã có global `ValidationPipe`, `class-validator`, `class-transformer`                | Giữ; bổ sung validation biến môi trường và DTO/query convention             |
| Rate limiting    | Chưa có `@nestjs/throttler`                                                          | Thêm P0, policy khác nhau theo endpoint và event                            |
| HTTP hardening   | Chưa có Helmet                                                                       | Thêm P0 và đăng ký trước route/Swagger                                      |
| Cache            | Chưa có cache manager/cache policy                                                   | Chỉ thêm cache có chọn lọc sau khi query/index đã tối ưu                    |
| Redis/worker     | Chưa có Redis client, BullMQ module/worker                                           | Thêm P0 khi bắt đầu OTP, outbox, reminder và job nền                        |
| Health checks    | Chưa có Terminus                                                                     | Thêm P0 cho liveness/readiness và graceful shutdown                         |
| Logging          | Chủ yếu là `console`/Nest logger, chưa có correlation ID thống nhất                  | P0 dùng structured JSON + correlation ID; Pino chỉ là lựa chọn có điều kiện |
| Configuration    | Có `ConfigModule`, nhưng secret còn fallback và chưa fail-fast khi env sai           | Bổ sung schema/validate function; production không có secret mặc định       |

### 3.4 Dependency và tool được chấp nhận

#### Thêm ở P0

| Package/tool                | Dùng cho                                                  | Giới hạn                                                                      |
| --------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `helmet`                    | Security headers cho HTTP API                             | Cấu hình trước route; kiểm tra CSP nếu bật Swagger UI                         |
| `@nestjs/throttler`         | Rate limit auth, OTP, AI, upload, signaling, payment      | In-memory chỉ dùng local/test; multi-instance dùng Redis-backed storage       |
| `ioredis`                   | Redis connection dùng chung                               | Một `RedisModule`, có namespace, timeout, retry và shutdown lifecycle         |
| `@nestjs/bullmq` + `bullmq` | Outbox delivery, notification, reminder và retryable jobs | Không đưa business transaction chính vào queue; job phải idempotent           |
| `@nestjs/terminus`          | `/health/live` và `/health/ready`                         | Readiness kiểm tra dependency bắt buộc; liveness không gọi provider bên ngoài |

Không cần thêm package để validate env ở vòng đầu vì `class-validator` và `class-transformer` đã có. Dùng custom `validate()` trong `ConfigModule.forRoot`, dừng ứng dụng ngay khi thiếu/sai `JWT_SECRET`, MongoDB URI, Redis URL hoặc provider secrets bắt buộc. Xóa mọi production fallback kiểu `default_secret_change_in_production`.

Structured logging vòng đầu dùng Nest `ConsoleLogger` dạng JSON, middleware/interceptor tạo `correlationId` và `AsyncLocalStorage` của Node. Chỉ thêm `nestjs-pino` nếu benchmark cho thấy cần throughput cao hơn hoặc cần transport/redaction/tích hợp log collector mà logger chuẩn không đáp ứng.

#### Thêm có điều kiện ở P1

| Package/tool                                                       | Khi nào mới thêm                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `@nestjs/cache-manager` + `cache-manager` + `@keyv/redis`          | Sau RF-2D, khi có số liệu chứng minh read query lặp lại và cache đem lại lợi ích                         |
| OAuth Passport strategy tương ứng, ví dụ `passport-google-oauth20` | Chỉ sau khi chốt provider OAuth; không cài nhiều strategy dự phòng                                       |
| `dependency-cruiser`                                               | Khi cần CI chặn import ngược giữa presentation/application/domain/infrastructure                         |
| `knip`                                                             | Trong cleanup để tìm dependency/export/file không còn dùng; mọi kết quả phải được review trước khi xóa   |
| OpenAPI lint/diff tool                                             | Khi OpenAPI artifact đã ổn định; dùng để chặn breaking change ngoài allowlist                            |
| OpenTelemetry hoặc Sentry                                          | Sau basic logging/metrics; chọn một lộ trình quan sát, không tích hợp đồng thời nhiều SDK trước deadline |

#### Không thêm trong scope hiện tại

- Không thêm Kafka, RabbitMQ hoặc microservice transport: Redis + BullMQ + Outbox đủ cho tải và deadline dự kiến.
- Không thêm `@nestjs/cqrs` chỉ để đổi tên service; command/query class thuần TypeScript đã đủ cho DDD-lite.
- Không thêm Elasticsearch trước khi Atlas Search/query catalog chứng minh MongoDB không đáp ứng.
- Không thêm Prisma, TypeORM hoặc repository framework khác; persistence đích là Mongoose.
- Không thêm GraphQL khi REST + Socket đã là contract đã chọn.
- Không dùng global cache interceptor cho toàn API và không tạo generic `BaseRepository`.
- Compression ưu tiên reverse proxy/CDN; chỉ bật trong Nest khi hạ tầng triển khai không đảm nhiệm và đã đo CPU/latency.

### 3.5 Chính sách caching

Cache là lớp tối ưu sau pagination, projection, aggregation và index; không dùng cache để che `COLLSCAN`, N+1 hoặc endpoint không giới hạn.

Áp dụng manual cache-aside sau một `CachePort`, với key có namespace/version, TTL ngắn, timeout/fallback rõ ràng và metric hit/miss/error. Ưu tiên cache:

- danh sách bác sĩ đã duyệt và search facets ít thay đổi;
- plan/subscription product catalog và reference/config data;
- blacklist/moderation keywords đang active;
- dữ liệu đọc ổn định khác chỉ sau khi query catalog chứng minh có tỷ lệ đọc lặp cao.

Không cache hoặc chỉ cache cực ngắn với invalidation/version chặt:

- quyết định authorization, account ban/status và refresh-session state;
- claim slot, booking command, queue position/call-next/check-in/no-show;
- message write path, unread count cần nhất quán tức thời;
- health alert/latest health data nhạy cảm;
- payment, IPN, cancel và refund state;
- AI quota reserve/commit/release.

Invalidation phát từ domain event/outbox sau khi transaction commit. Cache lỗi phải fail-open cho read không nhạy cảm nhưng không được làm auth/payment/booking fail-open. Có chống cache stampede cho hot key, không lưu token/OTP/raw health payload, và phải có integration test cho TTL, invalidation và Redis unavailable.

### 3.6 Chính sách Swagger, Passport và throttling

**Swagger/OpenAPI**

- Giữ `@nestjs/swagger`; không thay bằng thư viện tài liệu API khác.
- Bổ sung tags, operation ID ổn định, request/response/error schema, auth scheme, pagination và examples không chứa dữ liệu thật.
- CI xuất `openapi.json`, lint và diff với baseline; artifact là contract cho repo frontend.
- Swagger UI chỉ bật ở local/staging hoặc được bảo vệ ở production; không public mặc định.
- API versioning được cấu hình trước khi generate document; realtime event có schema riêng.

**Passport/Auth**

- Giữ Passport cho HTTP JWT và OAuth strategy tương lai; không tự viết lại toàn bộ authentication middleware.
- Chỉ một nơi đăng ký `JwtModule`, `JwtStrategy`, token verifier và auth policy; module khác import public auth facade/guard.
- Nếu phần lớn endpoint là private, dùng global JWT guard và decorator `@Public()` cho allowlist nhỏ.
- Socket handshake dùng token verifier/policy dùng chung nhưng không cố tái sử dụng nguyên HTTP `AuthGuard`.
- Việc kiểm tra account active trên mỗi request chỉ được tối ưu bằng short-lived account/session version cache sau khi có revoke/ban/logout-all test; không bỏ kiểm tra để giảm query.

**Throttling**

- Có baseline theo IP cho public route và theo authenticated principal cho private route.
- Dùng bucket riêng: login, refresh, OTP send/verify, AI, upload, payment/IPN, consultation request và Socket signaling/message.
- OTP và AI quota vẫn có business counter riêng trong Redis; throttler không thay thế quota/attempt policy.
- Multi-instance dùng Redis-backed throttler storage; thiết lập `trust proxy` đúng số hop trước khi tin forwarded IP.
- Socket event phải có guard/rate-limit riêng; HTTP global throttler không tự bảo vệ gateway events.
- Trả lỗi `429` nhất quán, có audit/metric cho abuse nhưng không log credential hoặc health payload.

---

# PHẦN A — REFACTOR BACKEND CODE CŨ

## 4. Mục tiêu và giới hạn phần refactor

Mục tiêu:

- Đưa backend hiện tại về trạng thái build/test/CI ổn định.
- Giữ luồng đang có: local auth, quản lý user/bác sĩ, gửi yêu cầu tư vấn, bác sĩ accept/decline, chat, review, health metrics, AI/RAG và notification hiện có.
- Thay cấu trúc ngang/trùng lặp bằng module ownership rõ ràng.
- Chuẩn bị persistence, contract và hạ tầng đủ ổn định để phát triển feature mới.

Không làm trong Phần A:

- Không tạo slot hoặc booking.
- Không tạo hàng đợi/check-in/no-show.
- Không thêm OAuth mới.
- Không thêm payment/refund.
- Không thêm reminder/FCM/campaign mới.
- Không thêm AI quota.
- Không implement Web, Admin hoặc Mobile.

### 4.1 Kết quả audit service hiện tại

Các file dưới đây đang gộp nhiều trách nhiệm. Số dòng chỉ là tín hiệu để ưu tiên audit, không phải tiêu chí duy nhất bắt buộc tách file:

| File                                           | LOC xấp xỉ | Trách nhiệm đang bị gộp                                                                          |
| ---------------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------ |
| `ai-assistant/ai-assistant.service.ts`         |      1.185 | conversation, message orchestration, RAG, upload ảnh, prompt, LLM, summary, search và statistics |
| `health-metrics/health-metrics.service.ts`     |        895 | CRUD, authorization, validation, alert, notification, daily aggregation, BMI và statistics       |
| `users/users.service.ts`                       |        615 | user CRUD, doctor lookup, profile assembly, patient profile, reviews, violations và Cloudinary   |
| `reviews/reviews.service.ts`                   |        571 | review CRUD, session validation, rating projection, helpful/flag và top-doctor query             |
| `sessions/sessions.service.ts`                 |        549 | create/list, authorization và toàn bộ state transition                                           |
| `admin/admin.service.ts`                       |        456 | doctor verification, account sanction, session query và dashboard statistics                     |
| `ai-assistant/services/llm-gateway.service.ts` |        419 | provider configuration, generation, retry và response transformation                             |
| `auth/auth.service.ts`                         |        381 | register, doctor files, login, token, OTP, password và profile assembly                          |
| `chat/chat.service.ts`                         |        374 | upload attachment, room authorization, message command và query                                  |
| `notifications/notifications.service.ts`       |        312 | persistence, read state và realtime emission                                                     |

Code còn phân tán theo capability trùng lặp:

- User/Auth/Profile nằm ở `auth`, `users`, `patients`, `admin` và `admins`.
- AI persistence/API nằm đồng thời ở `ai-assistant`, `ai-sessions`, `ai-messages`, `ai-feedbacks`, `ai-documents`, `ai-document-chunks`, `ai-health-insights` và `rag`.
- Session, Chat, Review và Admin trực tiếp inject model của nhau, làm ownership và transaction boundary không rõ.
- Controller upload khoảng 569 dòng và service Cloudinary khoảng 409 dòng cũng cần tách command/validation/provider adapter dù không mang tên business service.

### 4.2 Kết quả audit database query hiện tại

Một số endpoint đã có `page/limit`, nhưng chưa có convention chung và vẫn còn các query không bounded:

| Vị trí                                        | Vấn đề quan sát được                                                                    | Hướng refactor                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `users.service.ts::findAll/findDoctors`       | Tải toàn bộ doctor rồi toàn bộ user, join bằng `Map` trong memory; không pagination     | Query/aggregation theo filter + projection + pagination; bỏ in-memory full join |
| `users.service.ts::findProfileById`           | Tải toàn bộ violations và reviews; tính rating distribution trong application           | Tách paginated sub-resources; dùng aggregation cho summary/distribution         |
| `health-metrics.service.ts::getStatistics`    | Tải toàn bộ lịch sử để tính avg/min/max; không sort nhưng lấy phần tử cuối làm `latest` | Bắt buộc time range hoặc window; dùng aggregation `$group`/sorted latest        |
| `sessions.service.ts::getUpcoming`            | Có giới hạn ngày nhưng không giới hạn số record                                         | Thêm cursor/limit và stable sort                                                |
| `ai-health-insights.service.ts`               | Chỉ paginate khi client truyền đồng thời page + limit; stats tải toàn bộ documents      | Default pagination bắt buộc; stats dùng aggregation hoặc loại module theo DB v7 |
| `admin.service.ts::getDoctorApplication`      | Search user bằng regex rồi đưa toàn bộ ID vào `$in`                                     | Escape/min-length search; aggregate lookup hoặc search index; cap/maxTimeMS     |
| `blacklist-keywords.service.ts::checkContent` | Đọc toàn bộ blacklist từ MongoDB ở mỗi request                                          | Cache active normalized keywords và invalidate khi CRUD                         |
| Nhiều list DTO                                | `limit` thiếu `@Type`, `@IsInt`, `@Min`, `@Max`; `sortBy` nhận field tùy ý              | Dùng DTO/convention chung và allowlist sort fields                              |
| Nhiều read query                              | Trả hydrated Mongoose documents hoặc populate dù chỉ đọc một vài field                  | Dùng explicit projection + `lean()`; kiểm tra populate bằng query count         |
| Search regex                                  | Regex không escape/không anchor có thể không dùng index và tốn CPU                      | Escape input; dùng text/Atlas Search hoặc normalized prefix strategy            |

Các index hiện có chưa đủ để kết luận query đã tối ưu. Ví dụ schema có index đơn lẻ nhưng API thường filter + sort nhiều field. Index cuối cùng phải được tạo từ **query catalog thực tế**, xác minh bằng `explain('executionStats')`, không thêm index theo cảm tính.

### 4.3 Mục tiêu chất lượng sau refactor

- Không có public/admin list endpoint trả mảng không giới hạn, trừ lookup cấu hình nhỏ có hard cap và lý do ghi rõ.
- Timeline tăng liên tục như Message, Notification, HealthMetric dùng cursor pagination; danh sách quản trị hữu hạn có thể dùng page/limit.
- `limit` có default và hard max ở DTO/service; không tin query parameter thô.
- Sort field dùng allowlist và luôn có tie-breaker `_id` để kết quả ổn định.
- Read-only queries dùng projection và `lean()` khi không cần document methods/hooks.
- Không tải toàn bộ collection chỉ để count/average/group trong Node.js nếu Mongo aggregation xử lý được.
- Critical query không `COLLSCAN` trên representative dataset, trừ collection cấu hình rất nhỏ được ghi nhận.
- Query performance có baseline trước/sau và được regression test ở repository/integration level.

## 5. Các bước refactor backend

### RF-0 — Audit và đóng băng hành vi cũ

Mục tiêu: biết chính xác cái gì đang tồn tại trước khi thay đổi.

Các bước:

1. Gắn tag/branch baseline và ghi nhận dirty worktree.
2. Inventory REST endpoints, guards, DTO, Socket.IO events, cron/job và external integrations.
3. Inventory Mongoose schemas, collection names, indexes và cross-module `@InjectModel()`.
4. Map các API/event đang được Web Client/Admin/Mobile cũ sử dụng; chỉ audit consumer, không sửa frontend.
5. Đánh dấu từng capability: `keep`, `refactor`, `replace`, `remove`, `defer`.
6. Chụp OpenAPI hiện tại và lưu baseline.
7. Viết current-state status mapping cho Session, Chat, Review và Notification.
8. Lập danh sách known defects riêng với feature requests.

Deliverables:

- `docs/current-state/endpoints.md`.
- `docs/current-state/realtime-events.md`.
- `docs/current-state/database-inventory.md`.
- OpenAPI baseline.
- Backlog `BE-RF-*` có owner, dependency và estimate.

Exit gate:

- Mỗi module cũ có disposition rõ ràng.
- Không còn feature request bị ghi nhầm thành defect/refactor.

Ước lượng: **2-3 person-days**.

Trạng thái thực thi: **DONE ngày 2026-09-15 (`BE-RF-001`)**.

Evidence:

- `docs/current-state/endpoints.md` và source-derived `openapi-baseline.json`/Postman collection: 173 operations trên 121 paths.
- `docs/current-state/realtime-events.md`: 4 namespaces và event/consumer/risk mapping.
- `docs/current-state/database-inventory.md`: schema, collection, index và cross-model access.
- `docs/current-state/legacy-behavior.md`, `known-defects.md`, `module-disposition.md`.
- `docs/current-state/rf-backlog.md`: owner, dependency, estimate và trạng thái; `BE-RF-002` là task kế tiếp sau khi qua RF-1 entry blockers trong preflight checklist.
- Runtime OpenAPI snapshot bị chặn bởi build baseline và phải được thay thế sau RF-1; blocker được lưu trong artifact, không giả lập response schema.

### RF-1 — Stabilize build, test và CI

Mục tiêu: tạo safety net trước khi đổi cấu trúc.

Các bước:

1. Di chuyển `createIndex.ts` khỏi application compile hoặc thay bằng migration script đúng chỗ.
2. Sửa mismatch `Doctor`/`DoctorProfile` mà chưa redesign nghiệp vụ.
3. Sửa Mongoose enum metadata làm Auth test không khởi động.
4. Sửa TypeScript errors theo root cause; không tắt strict để che lỗi.
5. Chuẩn hóa scripts `lint`, `typecheck`, `build`, `test:unit`, `test:integration`, `test:e2e`.
6. Bật CI fail-fast; bỏ `continue-on-error` ở build/test bắt buộc.
7. Viết characterization tests tối thiểu cho:
   - register/login/refresh/logout;
   - doctor profile/approval;
   - create request/accept/decline Session;
   - chat authorization;
   - create Review/rating;
   - health metric create/query;
   - AI conversation/RAG happy path;
   - notification create/read.
8. Lưu log baseline và test fixtures ổn định.

Exit gate:

- Backend build xanh từ checkout sạch.
- CI đỏ khi cố tình tạo type/test error.
- Critical behavior cũ có characterization test.

Ước lượng: **5-7 person-days**.

Trạng thái thực thi: **DONE ngày 2026-09-15 (`BE-RF-002`, `BE-RF-003`, `BE-RF-004`)**.

Evidence:

- Mongo shell script cũ được lưu ngoài application compile tại `database/legacy/create-indexes.mongosh.js`; đây chỉ là baseline tham khảo, không thay migration runner của RF-4.
- Standalone legacy `DoctorSchema` được khôi phục để sửa compile mismatch mà chưa hợp nhất/redesign Practitioner.
- Mongoose enum metadata của legacy Auth User đã có runtime `type: String` rõ ràng.
- `lint`, `typecheck`, `build`, `test:unit`, `test:integration`, `test:e2e` là command read-only/fail-fast; CI backend không còn `continue-on-error` hoặc `--passWithNoTests`.
- Characterization coverage và kết quả chạy được ghi tại `docs/current-state/rf1-verification.md`.
- Local/test infrastructure được khóa bằng `compose.yaml`: MongoDB replica set `rs0` và Redis.

### RF-2 — Tách service và chuẩn hóa data-access/query

Mục tiêu: loại bỏ god service, gom code theo capability/owner và tạo chuẩn truy vấn dùng chung trước khi refactor từng domain.

#### RF-2A Inventory và tách trách nhiệm service

1. Với mỗi service, lập bảng `method -> responsibility -> models/providers -> caller -> transaction -> side effects`.
2. Đánh dấu method thuộc command, query, domain policy, provider adapter hay orchestration.
3. Tách theo capability; không tách máy móc mỗi method thành một class.
4. Controller/gateway chỉ parse input, gọi use case và map response; không chứa query/business branching dài.
5. Không tạo `CommonService`, `BaseService` hoặc repository tổng quát biết mọi model.
6. Module khác gọi public facade/port, không inject Mongoose model trực tiếp.
7. Side effect email/socket/upload/LLM đi qua port hoặc outbox, không trộn trong persistence query.
8. Mỗi bước tách phải giữ characterization tests xanh.

Đích tách theo module:

| Service hiện tại       | Thành phần đích                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AiAssistantService`   | `AiConversationCommandService`, `AiConversationQueryService`, `AiResponseOrchestrator`, `RagRetrievalService`, `AiMediaService`, `AiStatisticsQuery`       |
| `HealthMetricsService` | `HealthMetricCommandService`, `HealthMetricQueryService`, `MetricRuleEvaluator`, `HealthStatisticsQuery`, `BmiProjectionService`, `HealthAlertCoordinator` |
| `UsersService`         | `UserCommandService`, `UserQueryService`, `PractitionerQueryService`, `PatientProfileService`, `ProfileAssembler`; admin use case ở module admin           |
| `ReviewsService`       | `ReviewCommandService`, `ReviewQueryService`, `RatingProjectionService`; helpful/flag theo module phù hợp                                                  |
| `SessionsService`      | Consultation commands, Consultation queries và state policies trong canonical module                                                                       |
| `AdminService`         | `PractitionerVerificationService`, `AccountModerationService`, `AdminDashboardQuery`                                                                       |
| `AuthService`          | `RegisterUser`, `LoginUser`, `RefreshSession`, `OtpService`, `PasswordService`; file upload qua port riêng                                                 |
| `ChatService`          | `MessageCommandService`, `MessageQueryService`, `AttachmentService`, room authorization policy                                                             |
| `NotificationsService` | `NotificationCommandService`, `NotificationQueryService`, delivery/outbox adapter                                                                          |

Không dùng LOC làm gate cứng. Một service có thể dài nếu có một trách nhiệm thuần nhất; ngược lại service ngắn vẫn phải tách nếu vi phạm ownership. Mục tiêu review là mỗi class có một lý do nghiệp vụ/kỹ thuật rõ ràng để thay đổi và dependency list phù hợp.

Trạng thái RF-2A: **DONE ngày 2026-09-16 (`BE-RF-005`)**.

Evidence:

- `docs/current-state/service-responsibility-map.md` inventory 32/32 service files.
- Chín hotspot được map đến từng method theo responsibility, model/provider, caller, transaction/side effect và class/task đích.
- Controller/gateway orchestration, cross-module model injection và chuỗi multi-write/provider side effect không có transaction đã được gán owner/port và backlog task xử lý.
- RF-2A chỉ tạo decomposition plan; không di chuyển runtime source hoặc trộn feature mới trước khi RF-2B/RF-2D tạo data/query boundary ổn định.

#### RF-2B Chuẩn pagination và query contract

Trạng thái RF-2B: **DONE ngày 2026-09-16 (`BE-RF-006`)**.

Evidence:

- `apps/api/src/common/pagination` cung cấp shared DTO, request/result types, bounded normalization, opaque cursor codec, result builder và compatibility mapper.
- Query DTO hiện hữu dùng numeric transform, hard max `100` và sort allowlist; các raw pagination params tại Chat/AI Assistant controller đã được thay bằng DTO.
- Sort list được chuẩn hóa với `_id` tie-breaker; cursor strategy và cutover owner được ghi tại `docs/current-state/pagination-query-contract.md`.
- Unit tests bao phủ max limit, allowlist, canonical page/cursor result và invalid cursor. Response legacy được giữ qua compatibility policy cho tới domain cutover.

Tạo shared query primitives ở `common/pagination`:

```ts
type PageRequest = {
  page: number;
  limit: number;
};

type CursorRequest = {
  cursor?: string;
  limit: number;
};

type PageResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type CursorResult<T> = {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
};
```

Quy tắc:

1. Default `limit = 20`, hard max `100`; endpoint đặc thù có thể thấp hơn.
2. DTO dùng `@Type(() => Number)`, `@IsInt()`, `@Min(1)` và `@Max(...)`.
3. Không dùng `query.page`/`query.limit` chưa normalize trực tiếp trong `.skip()`/`.limit()`.
4. Message, Notification, HealthMetric và audit/event timelines dùng cursor `(sortValue, _id)` để tránh `skip` lớn.
5. Admin lists có nhu cầu nhảy trang được dùng page/limit, nhưng phải đặt max và index hỗ trợ sort.
6. Cursor được encode/validate phía server, không cho client chèn raw Mongo filter.
7. Sort fields dùng enum/allowlist; sort luôn thêm `_id` làm tie-breaker.
8. Chỉ trả `total` khi consumer thực sự cần. Cursor response dùng `limit + 1` để xác định `hasNextPage`.
9. Response pagination thống nhất; không xen kẽ `{data,total}`, `{pagination.pages}` và `{count}` tùy module.
10. Endpoint lookup/config không pagination phải có hard cap và comment/contract giải thích.

#### RF-2C Chuẩn projection, populate và aggregation

Trạng thái RF-2C: **DONE ngày 2026-09-16**.

Evidence:

- 18 service owners đã có explicit projection cho list/read paths; read model không cần document methods dùng `.lean()`.
- Populate paths đều khai báo field; internal/sensitive fields không còn bị serialize ngầm từ các list đã chuyển đổi.
- HealthMetric statistics, AI Health Insight risk counts và doctor rating distribution dùng aggregation thay vì hydrate toàn bộ collection để tính trong Node.js.
- AI Message user history dùng `$lookup` + `$facet`, loại bỏ flow tải tối đa 1.000 session IDs để dựng `$in`.
- Data/count độc lập ở các legacy AI/config lists chạy song song. Contract, exception và verification nằm tại `docs/current-state/read-query-contract.md`.
- Exit gate đạt: typecheck/build pass, lint 398/402 warnings, 38 unit + 2 integration + 2 E2E tests pass.

1. Mọi query đọc phải khai báo response projection; không mặc định trả toàn document.
2. Dùng `.lean()` cho read model nếu không cần Mongoose methods, virtuals hoặc save hooks.
3. Không populate document lớn bằng mặc định; chỉ select field cần thiết.
4. Với hot list, cân nhắc aggregation `$lookup` + `$project` hoặc denormalized snapshot thay cho nhiều populate round trips.
5. Không query collection A toàn bộ để tạo `$in` cho collection B.
6. Count/average/min/max/distribution dùng aggregation thay vì tải toàn bộ documents vào memory.
7. Các query độc lập được chạy song song có kiểm soát; không đặt `await` nối tiếp nếu không có dependency.
8. Bulk read/write dùng `$in`, `bulkWrite` hoặc transaction phù hợp thay vì loop query từng record.
9. Chỉ chọn denormalization khi có owner và reconciliation strategy rõ ràng.

#### RF-2D Query catalog, index và performance verification

Trạng thái RF-2D: **DONE ngày 2026-09-16** (`BE-RF-007`).

Evidence:

- `docs/current-state/query-catalog.md` ghi 8 query P0, cardinality, projection, pagination, index, budget và cache decision.
- Fixture 66.000 documents đo explain + 25 samples/query trước/sau; 8/8 query sau tối ưu dùng managed `IXSCAN`, không blocking `SORT`, và examine tối đa 20 keys/docs cho page 20.
- Migration versioned tạo 14 index, có runner idempotent và đồng bộ tên/index shape với Mongoose schemas.
- Integration regression apply migration hai lần và kiểm tra plans; regex search được escape/giới hạn, directory legacy có hard cap 100.
- Exit gate đạt: typecheck/build pass, lint 398/402 warnings, 41 unit + 4 integration + 2 E2E tests pass.

Tạo `docs/current-state/query-catalog.md` với mỗi query:

| Thuộc tính cần ghi   | Nội dung                                                   |
| -------------------- | ---------------------------------------------------------- |
| Query ID             | Ví dụ `Q-USR-001`                                          |
| Caller/API           | Endpoint hoặc job sử dụng                                  |
| Collection           | Collection owner                                           |
| Filter               | Equality/range/search fields                               |
| Sort                 | Thứ tự đầy đủ, gồm `_id` tie-breaker                       |
| Projection           | Field thực sự trả về                                       |
| Pagination           | Page hoặc cursor                                           |
| Expected cardinality | Nhỏ/vừa/lớn và dữ liệu test đại diện                       |
| Index candidate      | Equality -> sort -> range theo query shape                 |
| Explain result       | winning plan, keys/docs examined, returned, execution time |
| Budget               | p95 mục tiêu trên staging/test fixture                     |

Quy trình tối ưu một query:

```text
capture current query + representative data
 -> measure baseline
 -> normalize filter/sort/projection/pagination
 -> propose compound/partial/text/search index
 -> run explain('executionStats')
 -> compare before/after
 -> add repository integration/performance assertion
 -> add versioned index migration
```

Gate cho critical/hot queries:

- Không có `COLLSCAN`, blocking in-memory sort hoặc unbounded result trên representative dataset, trừ ngoại lệ được ADR/query catalog ghi rõ.
- `docsExamined`/`keysExamined` và response p95 có baseline; regression vượt budget phải làm test/CI cảnh báo hoặc fail theo mức đã chốt.
- Index phải khớp filter + sort thực tế; không thêm index đơn lẻ chỉ vì field xuất hiện trong schema.
- Duplicate/redundant index được loại sau khi kiểm tra usage và observation window.
- Search regex được escape, có min/max input; ưu tiên text/Atlas Search hoặc normalized prefix search.

#### RF-2E Cache có chọn lọc sau tối ưu query

Trạng thái: **DONE — 2026-09-17** cho candidate đầu tiên `Q-PRC-001` doctor directory. Evidence và policy: `docs/current-state/cache-policy.md`. Các query còn lại giữ quyết định không cache; Redis lifecycle/health tổng quát sau đó đã hoàn tất ở `BE-RF-022`.

1. Không tạo cache task trước khi query có pagination/projection/index và baseline ở RF-2D.
2. Chọn tối đa 2-3 read query có reuse cao cho vòng đầu, ưu tiên doctor directory, plan catalog hoặc active moderation keywords.
3. Tạo `CachePort` và Redis adapter; business/application layer không phụ thuộc trực tiếp Keyv/Redis client.
4. Định nghĩa cache key version, TTL, owner, dữ liệu được phép lưu và event invalidation cho từng entry trong query catalog.
5. Invalidation chỉ phát sau transaction commit, ưu tiên domain event/outbox; không xóa cache trước khi write chắc chắn thành công.
6. Có timeout/fallback, chống stampede và test Redis unavailable; cache miss/error không được làm hỏng read flow không nhạy cảm.
7. Đo hit ratio, latency và database load trước/sau; loại cache nếu không tạo lợi ích đo được.

Deliverables:

- Service responsibility map và danh sách class/use case đích.
- `common/pagination` cùng DTO/response conventions.
- `docs/current-state/query-catalog.md`.
- Script/fixture tạo representative dataset.
- Explain baselines cho Users/Practitioners, Consultations, Messages, HealthMetrics, Notifications và AI conversations.
- Cache decision record cho từng query được cache hoặc quyết định không cache.

Exit gate:

- Không còn list endpoint công khai nào thiếu pagination/hard cap trong contract mới.
- Các query được ưu tiên P0 có query ID, index plan và baseline.
- Service decomposition plan được map vào từng task module; không thực hiện big-bang rewrite.

Ước lượng: **8-12 person-days** cho decomposition/query foundation; cache có chọn lọc **2-4 person-days P1** sau khi Redis foundation sẵn sàng.

### RF-3 — Chuẩn hóa backend repository và API contract

Trạng thái: **DONE — 2026-09-17** (`BE-RF-010` đến `BE-RF-014`). Evidence: `docs/current-state/rf3-platform-contract.md`, generated OpenAPI và realtime artifacts. Distributed Redis throttle/lifecycle không bị nhập nhầm vào RF-3 và vẫn thuộc `BE-RF-022` ở RF-4.

Mục tiêu: backend hoạt động độc lập với repository frontend.

Các bước backend:

1. Đưa dependency backend về đúng `package.json` của backend.
2. Loại bỏ import source trực tiếp từ `apps/client`, `apps/admin` hoặc package UI.
3. Backend sở hữu domain enum và DTO.
4. Chuẩn hóa `ConfigModule` bằng fail-fast environment validation; xóa secret fallback và truy cập `process.env` rải rác.
5. Hardening bootstrap: Helmet, API versioning, CORS allowlist, body/upload limits, `trust proxy` theo topology và graceful shutdown.
6. Giữ Swagger hiện có nhưng bổ sung tags, operation ID, response/error schema, bearer/cookie/OAuth scheme khi tương ứng.
7. Tạo OpenAPI generation trong CI và chỉ bật Swagger UI ở local/staging hoặc sau lớp bảo vệ.
8. Kiểm tra breaking contract bằng OpenAPI diff.
9. Tạo `docs/realtime-events.md` hoặc JSON Schema cho Socket events.
10. Chuẩn hóa biến môi trường `CORS_ORIGINS`, API prefix và Socket path.
11. Gom Passport/JWT registration, strategy, verifier, guard/decorator về `AuthCoreModule`; xóa `JwtModule` cấu hình lặp ở feature modules.
12. Thêm global/route throttling cho HTTP; định nghĩa policy và guard riêng cho Socket events.
13. Thêm JSON logging, correlation ID, error envelope và redaction test.
14. Cập nhật `docs/fe-integration.md` khi REST/event contract thay đổi.

Backend không chịu trách nhiệm:

- Tạo repository frontend.
- Cài TanStack Query/Zustand.
- Viết page/component/hook.
- Generate client hoặc sửa build frontend.

Exit gate:

- Backend clone/build/test độc lập.
- OpenAPI artifact và realtime contract được xuất tự động.
- Không có dependency source từ frontend.
- Ứng dụng từ chối khởi động khi production configuration không hợp lệ.
- Helmet, throttling, correlation ID và Swagger exposure có integration test.

Ước lượng: **6-9 person-days**, gồm backend boundary, contract và platform hardening.

### RF-4 — Mongoose và database foundation

Trạng thái: **DONE — 2026-09-17** (`BE-RF-020` đến `BE-RF-022`). Evidence: `docs/current-state/rf4-database-foundation.md`, ADR-0001, database/Redis integration tests và CI empty-database bootstrap gate.

Mục tiêu: database mới được tạo lặp lại hoàn toàn từ source control.

Các bước:

1. Chốt MongoDB/Mongoose version, connection lifecycle và transaction policy trong ADR.
2. Tạo `DatabaseModule` chuẩn; thêm Terminus liveness/readiness và `enableShutdownHooks()`.
3. Tắt `autoIndex`/`autoCreate` ở staging/demo.
4. Tạo migration runner có:
   - migration version/name/checksum;
   - `_schema_migrations`;
   - migration lock;
   - trạng thái running/applied/failed;
   - kiểm tra `MIN_SCHEMA_VERSION`.
5. Tạo `database:verify` để kiểm tra collection options, validators và indexes.
6. Tạo reference seed và demo seed tách biệt, idempotent.
7. Dùng replica set cho local/CI để test transaction.
8. CI chạy migrate database rỗng, verify, test và migrate lần hai phải no-op.
9. Viết transaction proof trung lập với feature mới.
10. Tạo Atlas Vector Search definition dưới source control.
11. Tạo `RedisModule` dùng chung cho API/worker với connection lifecycle, namespace, timeout/retry policy và health indicator.
12. Quy định key naming/TTL/data classification cho OTP, throttling, presence, quota, cache và BullMQ; không để từng module tự tạo Redis connection/config riêng.

Migration ownership:

- Runner/verifier/framework thuộc `BE-RF-020` và `BE-RF-021`.
- Canonical collection của code cũ thuộc task refactor module tương ứng.
- AvailabilitySlots, Payments, Refunds hoặc feature collections không được tạo trong task foundation; chúng thuộc Phần B.

Exit gate:

- Một command dựng được database local/CI từ rỗng.
- Không cần thao tác Mongo shell thủ công.
- Transaction rollback proof pass.
- Migration lần hai không thay đổi database.
- Readiness phản ánh MongoDB/Redis bắt buộc; shutdown đóng HTTP, Socket, MongoDB, Redis và worker có trật tự.

Ước lượng: **7-10 person-days**.

### RF-5 — Refactor Identity và Practitioner hiện có

Trạng thái: **DONE — 2026-09-17** (`BE-RF-030` đến `BE-RF-032`). Evidence: `docs/current-state/rf5-identity-doctor.md`. Trong code dùng tên `DoctorDirectoryService`, `QueryDoctorsDto` và `searchDoctors()` thay cho thuật ngữ tổng quát Practitioner.

Mục tiêu: chỉ còn một nguồn dữ liệu User và giữ nguyên local authentication.

Các bước Identity:

1. Chọn canonical User schema/model và explicit collection name.
2. Hợp nhất `password`/`passwordHash` thành `passwordHash`.
3. Chuẩn hóa role, status và principal shape.
4. Tạo AuthSessions, chỉ lưu refresh-token hash.
5. Triển khai refresh rotation, token family và replay detection.
6. Chuyển OTP sang Redis dưới dạng code hash + attempts + TTL.
7. Password change, ban và logout-all revoke sessions liên quan.
8. Chuẩn hóa auth guard/decorator/policy.
9. Thêm audit AuthEvents cho hành động bảo mật quan trọng.
10. Xóa User schema trùng chỉ sau khi mọi consumer đã chuyển.

Các bước Doctor:

1. Giữ Doctor là User role với `doctorProfile` embedded theo DB v7.
2. Chuyển doctor search/profile query qua `DoctorDirectoryService` facade.
3. Chuẩn hóa workflow duyệt hồ sơ bác sĩ đang có.
4. Ghi reviewer, reason, `verifiedAt` và audit event.
5. Xóa `patients`, `admins` hoặc Doctor model trùng khi không còn consumer.
6. Thay `UsersService.findAll/findDoctors` không giới hạn bằng paginated Doctor/User queries có projection và stable sort.
7. Không tải toàn bộ Doctor rồi join User bằng `Map`; dùng canonical embedded profile hoặc aggregation/query phù hợp.
8. Tách reviews/violations khỏi profile detail thành paginated sub-resources; rating distribution dùng aggregation/read model.
9. Doctor application search không tạo `$in` từ danh sách User không giới hạn; dùng aggregate lookup/search strategy đã benchmark.
10. Allowlist filter/sort, escape search input và xác minh indexes bằng query catalog.

Không thuộc phase này:

- OAuthAccounts/login OAuth.
- UserDevices/FCM.
- Booking settings hoặc AvailabilitySlot.

Exit gate:

- Một User source of truth.
- Local login/refresh/logout/password/ban E2E pass.
- Không có plaintext OTP hoặc refresh token trong MongoDB.
- Doctor approval/search không regression.
- User/doctor/admin list queries có pagination, projection, `lean()` phù hợp và explain baseline.

Ước lượng: **8-12 person-days**.

### RF-6 — Chuyển Session cũ sang Consultation core

Mục tiêu: giữ nguyên luồng cũ nhưng chuyển sang tên và trạng thái domain đúng.

Luồng cũ bắt buộc được giữ:

```text
Patient gửi yêu cầu tư vấn cho Doctor
 -> Doctor xem danh sách yêu cầu
 -> Doctor accept hoặc decline một hay nhiều yêu cầu
 -> Khi accepted, hai bên chat/tư vấn
 -> Consultation hoàn tất hoặc bị hủy theo policy
```

Luồng trên được biểu diễn bằng Consultation `type = on_demand`; đây là refactor, không phải feature mới.

Các bước:

1. Chốt state machine tối thiểu cho hành vi cũ:
   - request status: `pending -> accepted|declined|expired`;
   - consultation status: `confirmed -> in_progress -> completed|cancelled`.
2. Không tiếp tục dùng `ACTIVE` cho cả confirmed và in-progress.
3. Không dùng `REJECTED` để biểu diễn cancellation.
4. Tạo Consultation schema/repository/domain mapper tối thiểu.
5. Tạo use cases request, accept, decline, start, complete và cancel tương ứng hành vi cũ.
6. Viết compatibility adapter `/sessions` nếu consumer cũ còn hoạt động.
7. Map Session ID/status sang Consultation ID/status rõ ràng.
8. Không dual-write âm thầm; nếu cần dual-write phải có reconciliation và kill switch.
9. Chạy regression test so sánh old/new behavior.
10. Chỉ xóa Session code/collection sau consumer audit và observation window.
11. Chuẩn hóa list/history query theo PageResult hoặc CursorResult; `getUpcoming` phải có hard limit/cursor dù đã giới hạn ngày.
12. Tạo compound indexes theo actor + status/type + thời gian + `_id` dựa trên query catalog.
13. Dùng projection/`lean()` cho list; chỉ hydrate aggregate khi thực hiện command/state transition.

Không thuộc phase này:

- AvailabilitySlot hoặc scheduled booking.
- Check-in, queue position, call-next hoặc no-show.
- Reminder lịch hẹn.

Exit gate:

- Flow request/accept/decline/tư vấn cũ chạy end-to-end qua Consultation core.
- Status không còn nhập nhằng.
- Compatibility mapping được tài liệu hóa.
- Consultation list/upcoming không trả unbounded data và critical explain plan không COLLSCAN.

Ước lượng: **7-10 person-days**.

### RF-7 — Refactor Chat, Review và Realtime hiện có

Mục tiêu: chuyển consumer của Session sang Consultation mà không thêm nghiệp vụ mới.

Chat/Realtime:

1. Chuyển message foreign key từ `sessionId` sang `consultationId`.
2. Chỉ participant của consultation hợp lệ được join room và đọc/gửi message.
3. Chuẩn hóa JWT verification dùng chung cho gateway.
4. Thay Socket CORS `*` bằng allowlist.
5. Thêm message idempotency/client message ID và retry-safe persistence.
6. Chuẩn hóa event name/version cho các event đang có.
7. Chuyển process-local presence sang Redis TTL/heartbeat nếu chạy nhiều instance.
8. Thêm Socket.IO Redis Adapter sau multi-instance proof.
9. Giữ basic WebRTC signaling hiện có nếu đã tồn tại; không mở rộng TURN/mobile ở đây.
10. Message history dùng cursor `(sentAt, _id)`; không dùng page/skip cho lịch sử dài.
11. Chỉ project fields cần cho message DTO; attachment metadata lớn có contract riêng nếu cần.

Review:

1. Giữ Reviews là collection riêng và unique theo consultation.
2. Chỉ patient participant được review consultation completed.
3. Cập nhật doctor rating trong transaction hoặc rebuildable projection.
4. Endpoint helpful/flag phải thực sự thay đổi dữ liệu hoặc bị loại khỏi contract; không trả success giả.
5. Chưa tạo moderation workflow đầy đủ trong refactor.
6. Review list dùng bounded page/cursor và compound index `(doctorId, createdAt, _id)` hoặc query shape tương đương.
7. Rating summary/distribution chạy bằng aggregation hoặc maintained projection, không tải toàn bộ reviews vào Node.js.

Exit gate:

- Room authorization/socket tests pass.
- Message retry không tạo duplicate.
- Review unique/rating transaction pass.
- Không còn message dùng Session model trực tiếp.
- Message/review list queries có stable cursor/sort và performance baseline.

Ước lượng: **7-10 person-days**.

### RF-8 — Refactor Health Tracking và AI/RAG hiện có

Mục tiêu: chia nhỏ service và làm rõ ownership nhưng giữ output nghiệp vụ hiện tại.

Health Tracking:

1. Chuẩn hóa metric type, unit, `recordedAt`, timezone và source.
2. Tách CRUD/query khỏi `MetricRuleEvaluator`.
3. Giữ threshold warning là cảnh báo tham khảo, không chẩn đoán.
4. Tạo `HealthProfileReader` port cho AI; AI không inject HealthMetric model.
5. Dùng time-series collection nếu spike xác nhận query/update pattern phù hợp.
6. HealthMetric history dùng cursor `(recordedAt, _id)` và bắt buộc bounded result.
7. `getStatistics` nhận time range/window; dùng Mongo aggregation cho count/avg/min/max và `$top`/sorted latest.
8. Không tải toàn bộ metric history vào application memory để thống kê.

AI/RAG:

1. Chọn một canonical AiConversation/AiMessage model.
2. Hợp nhất các module AI CRUD cũ và `ai-assistant`.
3. Tách `AiConversationService`, `AiResponseOrchestrator`, `RagRetrievalService`, `AiSafetyService` và provider adapters.
4. Đưa Vector Search pipeline sau `VectorSearchPort`.
5. Tách document ingestion thành job nếu hiện tại đã có ingestion.
6. Chuẩn hóa disclaimer, safety rules và error mapping.
7. Xóa endpoint/module AI trùng sau contract audit.
8. Conversation/message history dùng cursor; summary/statistics dùng aggregation/projection.
9. Allowlist sort fields; regex search phải escape và có min/max input hoặc chuyển sang Atlas Search/text index.
10. Quyết định rõ `ai-health-insights`: loại khỏi canonical DB v7 hoặc chuyển use case cần thiết vào Health/AI; không giữ CRUD module mồ côi.
11. `BlacklistKeywordsService.checkContent` dùng cache active keywords có invalidation/version thay vì đọc toàn collection mỗi request.

Không thuộc phase này:

- Daily quota/AiUsageDaily.
- AI tự chẩn đoán hoặc tự sanction user.
- Loại AI insight mới chưa có acceptance criteria.

Exit gate:

- Health và AI/RAG regression tests pass.
- Không còn AI service nguyên khối hoặc model conversation trùng.
- Domain/application không phụ thuộc provider SDK trực tiếp.
- Health/AI queries không còn unbounded statistics/history và có explain baseline cho hot paths.

Ước lượng: **7-11 person-days**.

### RF-9 — Refactor Notification và background processing hiện có

Mục tiêu: side effect đang có không mất khi API/worker restart.

Các bước:

1. Tách Notification khỏi Upload/Cloudinary ownership sai chiều.
2. Chuẩn hóa Notification schema và read/unread APIs đang có.
3. Tạo OutboxEvents, outbox repository và transaction integration.
4. Tạo BullMQ module, queue naming, retry/backoff và dead-job policy.
5. Tạo dispatcher claim/lease/idempotency.
6. Chạy worker ở process riêng với readiness/health.
7. Chuyển email/Socket side effect đang tồn tại sang worker.
8. Dùng `jobId = idempotencyKey`; consumer vẫn phải idempotent.
9. Thêm metrics cho waiting/active/failed/dead và oldest pending outbox.
10. Test crash sau commit, duplicate enqueue và retry delivery.
11. Notification history dùng cursor `(createdAt, _id)`; unread filter có compound index khớp filter + sort.
12. Outbox claim query có index theo status/nextAttemptAt/lockedAt và hard batch size.
13. Worker không load toàn bộ pending events; claim theo bounded batch/lease.

Không thuộc phase này:

- Appointment reminder mới.
- FCM/UserDevices mới.
- Notification campaign mới.
- No-show job của queue mới.
- Payment/refund worker.

Exit gate:

- API restart không mất pending event.
- Retry không tạo duplicate business effect.
- Dead/stuck job quan sát và xử lý lại được.
- Notification/outbox queries bounded, dùng stable sort và pass repository performance tests.

Ước lượng: **7-10 person-days**.

### RF-10 — Cutover và xóa code cũ

Mục tiêu: kết thúc refactor thay vì duy trì hai implementation lâu dài.

Các bước:

1. Chạy full regression trên staging.
2. Kiểm tra access log để xác định legacy endpoint/event còn consumer hay không.
3. Đối soát User, Consultation, Message, Review, Notification và AI data.
4. Tắt legacy provider bằng feature flag.
5. Theo dõi observation window.
6. Xóa duplicate schemas, services, modules, model tokens và dependencies.
7. Xóa compatibility adapter chỉ sau khi frontend repo xác nhận không còn dùng; đây là điều kiện phối hợp, không phải task implement frontend.
8. Cập nhật OpenAPI, realtime docs, migration manifest và runbook.

Exit gate:

- Không còn duplicate User/AI/Session implementation.
- Không còn cross-module model injection trái ownership.
- Backend build/test từ checkout sạch và DB rỗng.

Ước lượng: **4-6 person-days**.

## 6. Definition of Done cho refactor

Một task `BE-RF-*` chỉ Done khi:

- Hành vi cần giữ đã có characterization test trước thay đổi.
- Không thêm endpoint hoặc state transition mang nghiệp vụ mới.
- Old/new output hoặc contract đã được so sánh.
- Unit/integration/regression tests liên quan pass.
- Không có TypeScript, lint hoặc build error.
- Migration/index được version hóa nếu data model thay đổi.
- Không leak Mongoose Document ra khỏi infrastructure.
- OpenAPI/realtime contract được cập nhật nếu adapter thay đổi.
- Code cũ được xóa hoặc có issue cutover cụ thể; không để TODO vô thời hạn.
- Class/service sau refactor có trách nhiệm và dependency boundary rõ ràng; không chỉ chuyển một god service sang tên khác.
- List/history endpoint có pagination hoặc hard cap đã được duyệt.
- Query parameter được normalize/validate; sort field có allowlist và stable tie-breaker.
- Read query có projection/`lean()` phù hợp; aggregation thay cho full collection processing khi khả thi.
- Critical query có query-catalog entry, index migration và `explain('executionStats')` trước/sau.

## 7. Backlog refactor backend

| ID        | Công việc                                    | Phụ thuộc                                             | Done khi                                                                                 |
| --------- | -------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| BE-RF-001 | Audit endpoint/event/schema/consumer         | Không                                                 | Inventory và disposition đầy đủ                                                          |
| BE-RF-002 | Sửa API build/typecheck                      | BE-RF-001                                             | Build xanh                                                                               |
| BE-RF-003 | CI fail-fast và test commands                | BE-RF-002                                             | CI chặn lỗi thật                                                                         |
| BE-RF-004 | Characterization tests                       | BE-RF-002                                             | Critical old flows có baseline                                                           |
| BE-RF-005 | Service responsibility/dependency map        | BE-RF-001, BE-RF-004                                  | God services có decomposition plan theo capability                                       |
| BE-RF-006 | Pagination/query/response conventions        | BE-RF-005                                             | Shared DTO/result, max limit và sort allowlist được test                                 |
| BE-RF-007 | Query catalog + explain baseline             | BE-RF-006                                             | P0 queries có index plan và representative baseline                                      |
| BE-RF-010 | Backend standalone boundary                  | BE-RF-002                                             | Không import source frontend                                                             |
| BE-RF-011 | OpenAPI/realtime generation                  | BE-RF-010                                             | Contract artifact trong CI                                                               |
| BE-RF-012 | Config/bootstrap hardening                   | BE-RF-010                                             | Env fail-fast, Helmet, versioning, CORS/proxy/body limits và graceful shutdown được test |
| BE-RF-013 | Chuẩn hóa Passport/JWT + Swagger exposure    | BE-RF-011, BE-RF-012                                  | Một auth registration; OpenAPI đủ auth/error contract; UI không public mặc định          |
| BE-RF-014 | HTTP/Socket throttling + correlation logging | BE-RF-012, BE-RF-013                                  | Policy theo route/event, `429`, Redis storage path và redaction tests pass               |
| BE-RF-020 | DatabaseModule + migration runner            | BE-RF-003                                             | DB rỗng migrate/no-op                                                                    |
| BE-RF-021 | Verifier/index/validator/seed                | BE-RF-020                                             | Drift test pass                                                                          |
| BE-RF-022 | RedisModule + Terminus health lifecycle      | BE-RF-012, BE-RF-020                                  | API/worker dùng một Redis config; health/shutdown tests pass                             |
| BE-RF-030 | Canonical User/AuthSessions/Redis OTP        | BE-RF-022, BE-RF-013, BE-RF-004                       | Local auth E2E pass                                                                      |
| BE-RF-031 | Canonical Practitioner                       | BE-RF-030                                             | Doctor query/approval pass                                                               |
| BE-RF-032 | Tối ưu User/Practitioner/Admin queries       | BE-RF-006, BE-RF-007, BE-RF-031                       | Không unbounded join/list; explain baseline pass                                         |
| BE-RF-040 | Consultation core + Session adapter          | BE-RF-020, BE-RF-004                                  | Old request flow E2E pass                                                                |
| BE-RF-041 | Message migration                            | BE-RF-040                                             | Auth/idempotency tests pass                                                              |
| BE-RF-042 | Review/rating refactor                       | BE-RF-040                                             | Unique/transaction tests pass                                                            |
| BE-RF-043 | Socket auth/CORS/presence                    | BE-RF-014, BE-RF-030, BE-RF-040                       | Room/multi-instance tests pass                                                           |
| BE-RF-044 | Tối ưu Consultation/Message/Review queries   | BE-RF-006, BE-RF-007, BE-RF-040, BE-RF-041, BE-RF-042 | Cursor/page, projection và critical explain pass                                         |
| BE-RF-050 | Health Tracking refactor                     | BE-RF-020, BE-RF-004                                  | Regression pass                                                                          |
| BE-RF-051 | AI/RAG consolidation                         | BE-RF-020, BE-RF-004                                  | Một canonical model/orchestrator                                                         |
| BE-RF-052 | Tối ưu Health/AI queries                     | BE-RF-006, BE-RF-007, BE-RF-050, BE-RF-051            | Statistics aggregation và history/search budgets pass                                    |
| BE-RF-060 | Notification ownership                       | BE-RF-020, BE-RF-004                                  | API cũ không regression                                                                  |
| BE-RF-061 | Outbox/BullMQ cho effect cũ                  | BE-RF-022, BE-RF-060, BE-RF-021                       | Crash/retry tests pass                                                                   |
| BE-RF-062 | Tối ưu Notification/Outbox queries           | BE-RF-006, BE-RF-007, BE-RF-060, BE-RF-061            | Cursor và bounded claim explain tests pass                                               |
| BE-RF-063 | Cache-aside cho read query đã chứng minh     | BE-RF-007, BE-RF-022 và query owner tương ứng         | TTL/invalidation/fallback tests pass; có metric lợi ích trước/sau                        |
| BE-RF-070 | Legacy cutover/cleanup                       | Tất cả RF trên                                        | Không còn legacy consumer/code                                                           |

---

# PHẦN B — PHÁT TRIỂN BACKEND FEATURE MỚI

## 8. Điều kiện bắt đầu feature mới

Không cần đợi toàn bộ refactor hoàn tất, nhưng mọi feature đều phụ thuộc `BE-RF-006` (query/pagination convention) và `BE-RF-007` (query catalog/performance baseline), sau đó mới xét dependency domain trực tiếp dưới đây.

| Feature                | Refactor bắt buộc hoàn thành trước                |
| ---------------------- | ------------------------------------------------- |
| OAuth                  | BE-RF-030, BE-RF-011                              |
| AvailabilitySlot       | BE-RF-020, BE-RF-031                              |
| Scheduled booking      | BE-RF-040 và AvailabilitySlot                     |
| Queue/check-in/no-show | BE-RF-040, BE-RF-043 và scheduled/on-demand rules |
| Reminder/FCM           | BE-RF-061                                         |
| AI quota               | BE-RF-051, BE-RF-022                              |
| Payment                | BE-RF-030, BE-RF-061                              |
| Refund                 | Payment basic đã pass sandbox/IPN gate            |
| Moderation             | BE-RF-030, BE-RF-040, BE-RF-042                   |
| WebRTC/TURN mở rộng    | BE-RF-043 và Consultation authorization           |

Mỗi feature được triển khai theo cùng trình tự:

```text
business rules
 -> state/authorization/error contract
 -> DB schema/index/migration
 -> domain policy và tests
 -> application use cases
 -> REST/Socket adapters
 -> outbox/jobs nếu có
 -> integration/E2E/concurrency tests
 -> OpenAPI/realtime docs
 -> feature flag staging
 -> sign-off
```

## 9. Các feature backend mới

### NF-1 — OAuth login và account linking

Ưu tiên: **P1**, nâng thành P0 nếu là yêu cầu bắt buộc của đề cương/demo.

Các bước:

1. Tạo OAuthAccounts migration/repository với unique `(provider, providerUserId)`.
2. Chốt policy cho:
   - login account đã link;
   - link vào account đang đăng nhập;
   - email trùng với local account;
   - OAuth-only account không có password;
   - unlink provider cuối cùng.
3. Thêm `state`, PKCE khi phù hợp và callback URI allowlist.
4. Callback tạo cùng principal/AuthSession shape với local login.
5. Rate limit callback/linking và ghi AuthEvent.
6. Viết E2E cho login, link, conflict, replay state và banned account.
7. Cập nhật OpenAPI/security documentation.

Không thực hiện UI OAuth trong repository backend.

Done khi:

- OAuth không tạo User trùng.
- Session rotation/revocation dùng chung với local auth.
- State/callback/linking tests pass.

Ước lượng: **3-5 person-days**.

### NF-2 — AvailabilitySlot và Scheduled Consultation

Ưu tiên: **P0**.

#### NF-2A AvailabilitySlot

1. Tạo AvailabilitySlots migration, validator và indexes.
2. Chốt timezone và lưu `startsAt`/`endsAt` theo UTC.
3. Doctor active + approved mới được tạo slot.
4. Validate duration, lead time, booking horizon và overlap.
5. Use cases: create, create batch, list, block/cancel và expire.
6. Không cho sửa thời gian của slot đã booked; dùng cancel/recreate theo policy.
7. REST endpoints cho doctor quản lý và patient query available slots.
8. Test ownership, overlap, timezone và concurrent writes.

#### NF-2B Scheduled booking

1. Patient chọn một slot ID; không gửi `scheduledAt` tùy ý.
2. Atomic claim slot bằng conditional update hoặc transaction.
3. Cùng transaction tạo Consultation `type = scheduled`, cập nhật slot và ghi outbox.
4. Chống double booking bằng unique/partial index phù hợp.
5. Implement list upcoming/history theo actor.
6. Implement cancel theo actor, cancellation window và reason.
7. Reopen slot chỉ khi policy cho phép và thời gian vẫn hợp lệ.
8. Expire slot quá hạn bằng idempotent job/query.
9. E2E và race test nhiều request book cùng slot.

Done khi:

- Một slot chỉ được gắn với tối đa một consultation hợp lệ.
- Booking/cancel/reopen transaction và concurrency tests pass.
- OpenAPI mô tả đầy đủ request, response, status và error codes.

Ước lượng: **12-17 person-days**.

### NF-3 — On-demand v2, Check-in và hàng đợi

Ưu tiên: **P0**.

#### NF-3A On-demand v2

1. Giữ hành vi bệnh nhân gửi yêu cầu và bác sĩ accept/decline từ Consultation core.
2. Bổ sung request expiry, retry/cooldown và pending uniqueness policy.
3. Doctor chỉ nhận request khi active, approved và đủ điều kiện nhận tư vấn.
4. Accept/decline dùng conditional update để chống xử lý lặp/race.
5. Phát consultation/outbox events sau transition.

#### NF-3B Check-in

1. Chốt cửa sổ check-in sớm/muộn cho scheduled consultation.
2. On-demand accepted có thể vào waiting theo rule riêng, không cần giả slot.
3. Transition chỉ hợp lệ khi consultation confirmed và chưa cancelled/completed.
4. Lưu `checkedInAt` và `queuePriorityAt` phía server.

#### NF-3C Queue và call-next

1. Queue là query/projection từ Consultations; không tạo BullMQ job cho từng bệnh nhân trong hàng đợi.
2. Sắp xếp theo doctor, status, `queuePriorityAt` và tie-breaker ổn định.
3. Atomic `call-next` chỉ chuyển đúng một patient sang called/invited state.
4. Repeated call-next hoặc retry phải idempotent.
5. Chỉ doctor owner hoặc admin có quyền xem/thao tác queue.
6. Phát `queue.v1.changed` và consultation update event.

#### NF-3D No-show

1. Delayed job kiểm tra lại trạng thái tại thời điểm chạy.
2. Không mark no-show nếu consultation đã started/cancelled/completed.
3. Job retry không tạo transition hoặc notification trùng.

Done khi:

- Scheduled và on-demand đều có đường vào Consultation hợp lệ.
- Check-in/call-next/no-show state tests pass.
- Race test chứng minh không gọi hai patient cho cùng một lượt.
- REST và realtime contracts đầy đủ cho frontend repo sử dụng.

Ước lượng: **10-15 person-days**.

### NF-4 — Notification mới: reminder, FCM và campaign

Ưu tiên:

- Appointment reminder: **P0**.
- FCM/UserDevices: **P1**.
- Campaign: **P2/defer**.

Appointment reminder:

1. Khi booking commit, tạo outbox/job schedule theo timezone chuẩn.
2. Reminder mặc định trước lịch 24 giờ và 15 phút; cấu hình được.
3. Cancel/reschedule làm job cũ trở nên no-op hoặc bị thay bằng version mới.
4. Worker re-read consultation trước khi gửi.
5. Idempotency key gồm consultation, reminder type và schedule version.

FCM:

1. Tạo UserDevices migration/repository.
2. Register/revoke device token và notification preference APIs.
3. Không log full device token.
4. Xử lý invalid token và delivery retry.

Campaign chỉ triển khai nếu P0 đã ổn định; cần batch fan-out, rate limit và audit.

Done khi:

- Reminder đúng thời điểm và không gửi sau cancel.
- Retry không gửi trùng ngoài policy.
- FCM failure không rollback business transaction.

Ước lượng: reminder **3-5**, FCM **3-5**, campaign **3-5 person-days**.

### NF-5 — AI daily quota

Ưu tiên: **P0** nếu subscription/quota nằm trong demo.

Các bước:

1. Tạo AiUsageDaily migration/index.
2. Reserve quota atomically trong Redis trước provider call.
3. Commit reservation khi thành công; release theo policy khi provider thất bại.
4. Ghi token/model usage vào AiMessage và daily aggregate.
5. Dùng key theo user/date/timezone với TTL; không reset toàn Redis bằng cron.
6. Tạo reconciliation command Redis ↔ AiUsageDaily.
7. API trả remaining/limit/resetAt và error code ổn định khi hết quota.
8. Test concurrency, provider timeout, retry và reconciliation.

Done khi:

- Concurrent requests không vượt quota ngoài sai số đã chốt.
- Failure/retry không trừ lượt hai lần.
- Không ảnh hưởng disclaimer “tư vấn, không chẩn đoán”.

Ước lượng: **4-6 person-days**.

### NF-6 — Billing, VNPAY và cancel unpaid order

Ưu tiên: **P0 nếu payment bắt buộc trong demo**, nếu không có thể hạ P1 để bảo vệ Consultation P0.

Các bước payment:

1. Spike VNPAY Sandbox cho create/query/IPN và quyền merchant.
2. Tạo Plans, PaymentOrders, PaymentTransactions và Subscriptions migrations.
3. Order snapshot giá, currency, duration, quota và features tại thời điểm mua.
4. Tiền VND dùng integer; không dùng floating point.
5. Tạo signed payment URL phía server.
6. Return URL chỉ hiển thị/truy vấn trạng thái; không cấp subscription.
7. IPN verify signature, amount, currency, reference và merchant data.
8. Xử lý IPN idempotent trong transaction:
   - ghi/upsert PaymentTransaction;
   - order chuyển sang paid;
   - tạo đúng một subscription grant cho order;
   - tạo Notification/OutboxEvent.
9. Unique provider transaction/reference indexes.
10. Tạo reconciliation command cho pending/paid mismatch.

Các bước cancel unpaid order:

1. Chỉ cancel order `created|pending` bằng conditional update.
2. Cancel endpoint idempotent và lưu reason/actor/time.
3. Không gọi refund API vì chưa có captured payment.
4. Nếu valid IPN đến sau cancel, vẫn ghi nhận tiền và grant; đánh dấu cần thông báo/đối soát.
5. Test cancel-vs-IPN race.

Done khi:

- Invalid signature không thay đổi dữ liệu.
- Duplicate IPN không tạo duplicate transaction/subscription.
- Cancel/late-IPN behavior nhất quán và audit được.

Ước lượng: payment **9-13**, cancel **1-2 person-days**.

### NF-7 — Full refund có admin duyệt

Ưu tiên: **P1, feature flag, chỉ bắt đầu sau NF-6 đạt gate**.

Phạm vi MVP:

- Chỉ full refund một lần cho một paid order.
- Không partial refund, multiple refund, chargeback hoặc auto-approve.
- Không tự động refund khi consultation bị hủy.

Các bước:

1. Tạo PaymentRefunds migration với unique order lifecycle và provider request ID.
2. Patient tạo request; admin approve/reject.
3. Transaction request chuyển order `paid -> refund_pending` và ghi outbox.
4. Worker claim approved refund và gọi provider ngoài Mongo transaction.
5. Giữ stable `providerRequestId` khi retry.
6. Timeout/unknown chuyển `manual_review`; query/reconcile trước khi retry provider.
7. Chỉ khi provider xác nhận thành công mới transactionally:
   - refund `succeeded`;
   - order `refunded`;
   - subscription grant của order `cancelled`;
   - audit + notification/outbox.
8. Failure có kết luận đưa order về paid theo policy; không revoke grant sớm.
9. Tạo reconciliation command và admin audit endpoints.
10. E2E cho approve/reject/retry/unknown/duplicate/entitlement rollback.

Cut-line:

- Nếu VNPAY basic chưa pass trước 29/11, không implement provider refund.
- Có thể giữ request/admin workflow với fake adapter cho demo nhưng phải ghi rõ không phải VNPAY refund thật.

Ước lượng: **6-9 person-days**.

### NF-8 — Moderation workflow

Ưu tiên: **P1**; AI classification là **P2**.

Các bước:

1. Tạo ViolationReports migration/repository.
2. Workflow `pending -> processing -> resolved|dismissed`.
3. Severity `low|medium|high` và evidence references.
4. Admin decision, reason, audit và sanction integration.
5. Ban/unban tạo AuthEvent, revoke AuthSessions và notification.
6. AI chỉ tạo classification draft; admin luôn quyết định.
7. Không hard-delete evidence/report phục vụ audit.

Done khi:

- Authorization và state transition tests pass.
- Mọi sanction truy được actor, reason và evidence.
- AI không tự động khóa tài khoản.

Ước lượng: manual workflow **5-8**, AI draft **2-4 person-days**.

### NF-9 — WebRTC backend/TURN mở rộng

Ưu tiên: **P1**.

Chỉ phần backend/infrastructure nằm trong kế hoạch:

1. Signaling events có version và payload validation.
2. Server authorize consultation participant trước join/signal.
3. Lưu call start/end/consent metadata cần thiết; không lưu signaling noise.
4. Cấu hình TURN credentials ngắn hạn nếu hạ tầng hỗ trợ.
5. Rate limit signaling và chống room spoofing.
6. Test signaling giữa hai clients giả lập và qua hai network khi demo.

Không thuộc kế hoạch backend:

- Camera/microphone UI.
- React Native foreground/background call.
- CallKeep hoặc native call screen.

Ước lượng backend: **4-7 person-days**.

## 10. Definition of Done cho feature mới

Một task `BE-NF-*` chỉ Done khi:

- Business rule, actor, precondition và state transition được chốt.
- API/event/error contract được mô tả trước hoặc cùng implementation.
- Schema, validator và index có migration version riêng.
- Controller/gateway có authentication, authorization và validation.
- Domain/use-case unit tests pass.
- Repository integration tests chạy với MongoDB replica set.
- E2E happy/error path pass.
- Concurrency/idempotency tests có cho booking, queue, quota, payment và worker.
- Outbox/job consumers idempotent nếu có side effect.
- OpenAPI, realtime docs và `docs/fe-integration.md` được cập nhật.
- Feature flag/rollback có cho feature rủi ro hoặc P1.
- Không cần frontend code để chứng minh backend Done; dùng API/Socket E2E tests.
- Mọi list/history endpoint dùng shared pagination contract, hard max và stable sort.
- Query mới có entry trong query catalog; compound/partial index được chứng minh bằng explain trên representative data.
- Không đưa query/business logic mới trở lại service cũ đang chờ xóa.

## 11. Backlog feature backend

| ID        | Feature                        |         Ưu tiên | Phụ thuộc                       | Done khi                          |
| --------- | ------------------------------ | --------------: | ------------------------------- | --------------------------------- |
| BE-NF-001 | OAuth login/linking            |              P1 | BE-RF-030, BE-RF-011            | Security/linking E2E pass         |
| BE-NF-010 | AvailabilitySlot               |              P0 | BE-RF-020, BE-RF-031            | Overlap/ownership tests pass      |
| BE-NF-011 | Scheduled booking              |              P0 | BE-NF-010, BE-RF-040            | Double-booking race pass          |
| BE-NF-012 | Scheduled cancel/reopen/expire |              P0 | BE-NF-011                       | Transaction/state tests pass      |
| BE-NF-020 | On-demand v2 expiry/retry      |              P0 | BE-RF-040                       | Conditional transition tests pass |
| BE-NF-021 | Check-in                       |              P0 | BE-NF-011, BE-NF-020            | Window/state tests pass           |
| BE-NF-022 | Queue + atomic call-next       |              P0 | BE-NF-021, BE-RF-043            | Priority/race tests pass          |
| BE-NF-023 | No-show job                    |              P0 | BE-NF-021, BE-RF-061            | Retry/idempotency pass            |
| BE-NF-030 | Appointment reminders          |              P0 | BE-NF-011, BE-RF-061            | Cancel/version/retry tests pass   |
| BE-NF-031 | UserDevices + FCM              |              P1 | BE-RF-061                       | Revoke/retry/privacy tests pass   |
| BE-NF-032 | Campaign fan-out               |              P2 | BE-RF-061                       | Batch/rate-limit/audit pass       |
| BE-NF-040 | AI daily quota                 |              P0 | BE-RF-051                       | Concurrent reserve/reconcile pass |
| BE-NF-050 | VNPAY payment/subscription     |           P0/P1 | BE-RF-030, BE-RF-061            | Signature/IPN/idempotency pass    |
| BE-NF-051 | Cancel unpaid order            | P0 cùng payment | BE-NF-050                       | Cancel-vs-IPN race pass           |
| BE-NF-052 | Full refund                    |              P1 | BE-NF-050, BE-RF-061            | Provider/reconcile/grant E2E pass |
| BE-NF-060 | Manual moderation              |              P1 | BE-RF-030, BE-RF-040, BE-RF-042 | Workflow/audit pass               |
| BE-NF-061 | AI moderation draft            |              P2 | BE-NF-060, BE-RF-051            | Human approval enforced           |
| BE-NF-070 | WebRTC/TURN backend            |              P1 | BE-RF-043, BE-NF-022            | Authorized signaling demo pass    |

---

# PHẦN C — TÍCH HỢP VÀ PHÁT HÀNH BACKEND

## 12. Bàn giao contract cho repository frontend

Backend phải cung cấp; không implement consumer:

1. `openapi.json` sinh tự động từ NestJS DTO/decorators.
2. Version API và changelog breaking/non-breaking.
3. Realtime event catalog gồm event name, direction, auth, payload và error.
4. Error envelope/code ổn định.
5. `docs/fe-integration.md` mô tả page → DTO → API/event → permission/state.
6. Seed data và staging account phục vụ frontend integration.
7. CORS origins và environment contract.
8. Contract smoke tests chạy độc lập với UI.

Frontend repository chịu trách nhiệm:

- Generate API client và query hooks.
- State management/cache invalidation.
- Web/Admin/Mobile pages và components.
- UI loading/error/empty/offline/reconnect.
- Browser/mobile E2E.

Điều kiện phối hợp duy nhất chặn xóa legacy backend: frontend xác nhận không còn gọi legacy endpoint/event. Đây không phải công việc implement frontend trong plan này.

## 13. Lịch thực hiện backend đến 31/12

Lịch ưu tiên hoàn thành nền refactor trước, sau đó tập trung feature. Một vài contract/design feature có thể chuẩn bị sớm nhưng không code vào module legacy.

| Thời gian   | Nhóm việc                     | Kết quả bắt buộc                                                                         |
| ----------- | ----------------------------- | ---------------------------------------------------------------------------------------- |
| 15/09-20/09 | RF-0, RF-1                    | Audit, backend build xanh, CI fail-fast, characterization tests                          |
| 21/09-04/10 | RF-2, RF-3, RF-4              | Service/query standards, backend độc lập, OpenAPI, migration runner và DB rỗng bootstrap |
| 05/10-18/10 | RF-5, RF-6                    | Canonical Identity/Practitioner và old on-demand flow trên Consultation                  |
| 19/10-01/11 | RF-7, RF-8, RF-9              | Chat/review/realtime, Health/AI, notification/outbox và module query optimization        |
| 02/11-15/11 | NF-2                          | AvailabilitySlot và scheduled booking hoàn chỉnh                                         |
| 16/11-29/11 | NF-3, NF-4, NF-5              | Queue/check-in/no-show, reminder và AI quota                                             |
| 30/11-08/12 | NF-6 và tối đa một P1 đã chọn | Payment/cancel nếu bắt buộc; hoặc OAuth/refund/moderation/WebRTC theo cut-line           |
| 09/12-13/12 | RF-10 + integration           | Legacy cutover, reconciliation, contract freeze                                          |
| 14/12-23/12 | Release Candidate             | Full regression, load/security, backup/restore, demo rehearsal                           |
| 24/12-31/12 | Buffer                        | Chỉ blocker, security và lỗi demo; không thêm feature                                    |

Quy tắc cut-line:

- Feature freeze tuyệt đối từ 14/12.
- Không nhận toàn bộ OAuth + refund + moderation + WebRTC cùng lúc.
- Nếu payment không bắt buộc cho demo, ưu tiên Consultation/Queue stability hơn Billing.
- Nếu payment được giữ, refund chỉ làm khi payment basic pass trước 29/11.
- FCM và campaign không được làm chậm in-app notification/reminder P0.

## 14. Ước lượng backend

### 14.1 Refactor

| Nhóm                                                                    | Person-days |
| ----------------------------------------------------------------------- | ----------: |
| Audit, build, tests và CI                                               |        7-10 |
| Service decomposition, pagination/query conventions và explain baseline |        8-12 |
| Cache-aside có chọn lọc sau query baseline                              |         2-4 |
| Backend boundary, contracts và platform hardening                       |         6-9 |
| Mongoose/migration/database foundation                                  |        7-10 |
| Identity + Practitioner                                                 |        8-12 |
| Session → Consultation core                                             |        7-10 |
| Chat + Review + Realtime                                                |        7-10 |
| Health + AI/RAG                                                         |        7-11 |
| Notification + Outbox/BullMQ                                            |        7-10 |
| Cutover/cleanup                                                         |         4-6 |
| **Tổng RF thô nếu làm cả cache P1**                                     |  **70-104** |

Cache là P1 có thể cắt mà không ảnh hưởng tính đúng đắn. Nếu bỏ cache khỏi deadline, tổng RF thô là **68-100 person-days**; vẫn giữ Redis vì OTP, throttling phân tán, presence, quota và BullMQ cần Redis.

### 14.2 Feature mới

| Feature                                   | Person-days | Cut-line       |
| ----------------------------------------- | ----------: | -------------- |
| OAuth                                     |         3-5 | P1             |
| Slot + scheduled                          |       12-17 | P0             |
| On-demand v2 + check-in + queue + no-show |       10-15 | P0             |
| Reminder                                  |         3-5 | P0             |
| FCM                                       |         3-5 | P1             |
| Campaign                                  |         3-5 | P2             |
| AI quota                                  |         4-6 | P0             |
| Payment + cancel                          |       10-15 | P0/P1 tùy demo |
| Full refund                               |         6-9 | P1             |
| Manual moderation                         |         5-8 | P1             |
| AI moderation draft                       |         2-4 | P2             |
| WebRTC/TURN backend                       |         4-7 | P1             |

Với hai thành viên học tập song song, toàn bộ RF + toàn bộ NF không an toàn trước 31/12. Committed scope nên là RF bắt buộc + Slot/Scheduled + Queue + Reminder + AI quota; Payment chỉ là P0 nếu đề cương/demo bắt buộc.

## 15. Kiểm thử backend

### 15.1 Test pyramid

- Unit: domain policies, state machines, mappers, signature và error mapping.
- Integration: Mongoose repositories, indexes, transactions, Redis và BullMQ consumers.
- Contract: OpenAPI snapshot/diff và realtime payload schemas.
- E2E: HTTP + Socket critical journeys không cần UI.
- Concurrency: booking, accept request, call-next, quota, IPN và refund.
- Load/soak: REST, queue query, Socket connect/reconnect và worker throughput.

### 15.2 Critical suites trước release

- Auth rotation/replay/logout-all/ban.
- Doctor approval/authorization.
- Old on-demand request compatibility.
- Scheduled double booking.
- Check-in/call-next/no-show races.
- Message room authorization/idempotency.
- Review unique/rating transaction.
- Outbox crash/retry/dead job.
- AI quota reserve/commit/release.
- VNPAY signature/duplicate-IPN/cancel race nếu payment bật.
- Refund unknown/reconcile nếu refund bật.
- Database bootstrap/no-op/drift.

### 15.3 Query và pagination performance tests

1. Tạo seed profile tối thiểu cho performance test, ví dụ nhiều Users/Doctors, Consultation histories, Messages, HealthMetrics và Notifications; kích thước cụ thể được lưu trong query catalog.
2. Contract test mọi list endpoint với:
   - thiếu page/cursor;
   - `limit = 0`, số âm và vượt hard max;
   - sort field không hợp lệ;
   - cursor hỏng/hết hạn;
   - nhiều record có cùng timestamp để kiểm tra `_id` tie-breaker;
   - page/cursor kế tiếp không thiếu hoặc lặp record.
3. Repository test chạy `explain('executionStats')` cho P0 query shapes và lưu winning plan/keys/docs examined.
4. Test/query instrumentation đếm số Mongo operations để phát hiện populate hoặc loop gây N+1 ngoài budget.
5. Không assert thời gian millisecond tuyệt đối trong CI không ổn định; CI kiểm tra plan shape, bounded scan và query count. p95 latency được đo trên staging với dataset đã ghi nhận.
6. Load test riêng cho message history, doctor search, health history/statistics, consultation list/queue và notification history.

## 16. Security và privacy

- Dùng Helmet trước route registration; CORS, CSP, upload/body size và proxy trust là cấu hình allowlist, không dùng wildcard tùy tiện.
- Production configuration fail-fast; không có JWT/provider secret mặc định trong source.
- Access token ngắn hạn; refresh token chỉ lưu hash.
- OTP chỉ ở Redis với TTL/attempt limit.
- OAuth dùng state/PKCE/callback allowlist khi bật.
- `@nestjs/throttler` đặt baseline và bucket riêng cho auth, OTP, AI, upload, payment và signaling; multi-instance dùng Redis storage.
- Socket events có limiter riêng; cấu hình HTTP global guard không được xem là đã bảo vệ WebSocket.
- Không tin `userId`, role, amount, price hoặc queue priority từ client.
- Sanitize rich text/message; validate MIME, size, magic bytes và ownership upload.
- Không log password, OTP, token, cookie, provider secret, raw health payload hoặc device token.
- Room authorization luôn kiểm tra participant phía server.
- Payment/refund verify signature và idempotency server-side.
- Audit admin actions, doctor approval, ban/unban, plan changes và refund/moderation decisions.
- Không hard-delete dữ liệu audit quan trọng.

## 17. Observability và vận hành

- Structured JSON logs với `correlationId`; thêm `consultationId`, `jobId` hoặc `orderCode` khi liên quan. Vòng đầu dùng Nest JSON logger + `AsyncLocalStorage`; Pino chỉ thêm khi có nhu cầu đã đo.
- `@nestjs/terminus` cung cấp liveness/readiness tách riêng; readiness kiểm tra MongoDB, Redis và dependency bắt buộc, liveness không phụ thuộc API bên thứ ba.
- Cache metrics gồm hit/miss/error/latency và invalidation failure; không đưa key/value chứa dữ liệu nhạy cảm vào log/metric label.
- Metrics tối thiểu:
  - API latency/error rate;
  - Mongo/Redis health;
  - Socket connections/reconnect;
  - BullMQ waiting/active/failed/dead;
  - oldest pending outbox;
  - booking conflict/call-next race;
  - AI provider latency/token/quota;
  - payment invalid/duplicate IPN;
  - refund pending/manual-review nếu bật.
- Theo dõi Mongo slow query, operation/route, documents examined/returned, pool wait và query timeout; không log filter chứa dữ liệu sức khỏe nhạy cảm.
- Dashboard p95/p99 cho các query ID P0 và cảnh báo khi pagination endpoint trả vượt hard cap.
- Alert staging/demo cho worker dead jobs, outbox backlog, payment mismatch và migration version mismatch.
- Có reconciliation commands cho rating, outbox, AI usage và payment/refund.

## 18. Feature flags và rollback

```text
CONSULTATIONS_V2_ENABLED
SCHEDULED_BOOKING_ENABLED
ON_DEMAND_QUEUE_ENABLED
OUTBOX_DELIVERY_ENABLED
OAUTH_ENABLED
AI_DAILY_QUOTA_ENABLED
VNPAY_ENABLED
VNPAY_REFUND_ENABLED
MODERATION_V2_ENABLED
WEBRTC_ENABLED
```

Nguyên tắc:

- Migration additive trước; không xóa field/collection trong cùng release cutover.
- Deploy code backward-compatible trước migration phá vỡ.
- Worker có kill switch nhưng giữ OutboxEvents pending.
- Tắt VNPAY chỉ chặn tạo order mới, không bỏ IPN của order đã tạo.
- Tắt refund chỉ chặn request/approve mới; refund processing phải đi đến kết luận.
- Có backup/restore rehearsal và export index definitions.
- Legacy adapter chỉ bị xóa sau consumer confirmation và observation window.

## 19. CI/CD backend

Pipeline bắt buộc:

```text
install --frozen-lockfile
 -> lint
 -> typecheck
 -> unit tests
 -> start Mongo replica set + Redis
 -> database:migrate
 -> database:verify
 -> integration/E2E/contract tests
 -> generate + lint + diff openapi.json
 -> dependency-boundary check nếu đã bật
 -> database:migrate lần hai, phải no-op
 -> build API + worker
 -> container scan/build
```

Không dùng `continue-on-error` cho lint, typecheck, build hoặc critical tests. Staging/demo chỉ deploy khi schema version đáp ứng `MIN_SCHEMA_VERSION`.

## 20. Rủi ro chính

| Rủi ro                                                 | Tác động   | Giảm thiểu                                                                                   |
| ------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------- |
| Bắt đầu feature khi build chưa xanh                    | Cao        | RF-1 hard gate                                                                               |
| God service chỉ bị chia file nhưng vẫn coupling        | Cao        | Responsibility map, port ownership và dependency tests/review gate                           |
| List endpoint/query không bounded làm tăng RAM/latency | Cao        | Shared pagination, hard max, cursor cho timeline và load test                                |
| Index không khớp filter + sort thực tế                 | Cao        | Query catalog, explain baseline và versioned index migration                                 |
| Regex search/populate gây query chậm                   | Trung bình | Escape/allowlist, Atlas/text search, projection/lean và query-count budget                   |
| Cache che query xấu hoặc trả dữ liệu cũ                | Cao        | Chỉ cache sau explain baseline; TTL/invalidation owner, versioned key và Redis-failure tests |
| Rate limit chỉ lưu memory nên lệch giữa instance       | Cao        | Redis-backed throttler storage; test IP/principal và cấu hình proxy                          |
| Cài quá nhiều tool làm trễ deadline                    | Trung bình | P0/P1 gate; package có owner/use case/exit gate, cắt cache/APM/dev tools trước core flow     |
| Gắn feature mới trực tiếp vào Session legacy           | Cao        | Hoàn tất BE-RF-040 trước; feature dùng Consultation core                                     |
| Double booking/call-next race                          | Cao        | Conditional update, partial unique index, transaction, race tests                            |
| Worker gửi lặp                                         | Cao        | Outbox, stable idempotency key, consumer idempotent                                          |
| Mongoose schema/index drift                            | Cao        | Versioned migration + verifier trong CI                                                      |
| Scope payment/refund quá lớn                           | Cao        | Payment conditional P0; refund P1 gate 29/11                                                 |
| WebRTC thất bại qua NAT                                | Trung bình | TURN spike; backend-only scope; P1                                                           |
| AI quota/cost                                          | Trung bình | Redis reserve + daily reconciliation                                                         |
| Dữ liệu sức khỏe lọt log                               | Cao        | Allowlist logging và redaction tests                                                         |
| Frontend chưa chuyển khỏi legacy                       | Trung bình | Giữ adapter, theo dõi access log; không nhận implement frontend vào plan BE                  |

## 21. Quy tắc làm việc

- Một PR chỉ thuộc `BE-RF`, `BE-NF` hoặc `BE-REL`.
- Không refactor format toàn repo trong feature PR.
- Nếu feature phát hiện nợ kỹ thuật chặn triển khai, tạo `BE-RF` issue riêng.
- PR lớn hơn khoảng 500 dòng logic nên tách khi có thể; generated migration/contract được loại trừ.
- Migration, schema, repository, use case và test của một slice được review cùng nhau nhưng chia commit rõ.
- Không merge trực tiếp vào release branch.
- ADR bắt buộc cho quyết định khó đảo ngược:
  - Modular Monolith/DDD-lite;
  - Mongoose ownership/migrations/transactions;
  - Consultation state model;
  - Redis/BullMQ/Outbox;
  - OAuth/session rotation;
  - VNPAY/refund idempotency.
- Mỗi sprint demo bằng API/Socket test hoặc scripted scenario; không cần chờ frontend UI.

## 22. Checklist bắt đầu ngay

Thực hiện đúng thứ tự:

1. [x] Tạo `BE-RF-001` và hoàn thành inventory/disposition ngày `2026-09-15`.
2. [x] Hoàn thành `BE-RF-002`, sửa API build/typecheck ngày `2026-09-15`.
3. [x] Hoàn thành `BE-RF-003`, bật CI fail-fast ngày `2026-09-15`.
4. [x] Hoàn thành `BE-RF-004`, viết characterization tests cho old flows ngày `2026-09-15`.
5. [x] Hoàn thành service responsibility map (`BE-RF-005`) ngày `2026-09-16`; chưa di chuyển file hàng loạt.
6. [x] Hoàn thành pagination/query conventions và query catalog (`BE-RF-006`, `BE-RF-007`) ngày `2026-09-16`; đã đo baseline trước/sau index.
7. [x] Chốt backend-only repository boundary và OpenAPI ownership (`BE-RF-010`, `BE-RF-011`) — 2026-09-17.
8. [x] Hardening config/bootstrap, Passport/Swagger, throttling và logging (`BE-RF-012` đến `BE-RF-014`) — 2026-09-17.
9. [x] Tạo DatabaseModule, migration runner, verifier, DB bootstrap và Redis/health lifecycle (`BE-RF-020` đến `BE-RF-022`) — 2026-09-17.
10. [ ] Refactor Identity/Practitioner và query của chúng (`BE-RF-030` đến `BE-RF-032`).
11. [ ] Chuyển old request flow, Message/Review/Realtime và tối ưu query (`BE-RF-040` đến `BE-RF-044`).
12. [ ] Refactor Health/AI cùng query aggregation/search (`BE-RF-050` đến `BE-RF-052`).
13. [ ] Refactor Notification/Outbox cùng cursor/bounded claims (`BE-RF-060` đến `BE-RF-062`).
14. [ ] Chỉ nhận cache task `BE-RF-063` nếu query baseline chứng minh cần; không coi đây là P0.
15. [ ] Chỉ sau các gate tương ứng mới nhận `BE-NF-010` trở đi.
16. [ ] Không tạo task Web/Admin/Mobile trong repository hoặc board backend.

## 23. Tóm tắt quyết định

1. Chỉ backend được thực hiện theo tài liệu này; frontend nằm ở repository và kế hoạch khác.
2. Refactor và feature mới nằm ở hai phần riêng, có ID và Definition of Done riêng.
3. Luồng request/accept/decline/chat cũ được giữ và refactor thành Consultation `on_demand`.
4. Slot, scheduled booking, check-in, queue và no-show là feature mới.
5. Mongoose tiếp tục là ODM; database mới được dựng bằng migration versioned.
6. Redis + BullMQ + Outbox được dùng; Kafka chưa cần.
7. Notification worker foundation là refactor; reminder/FCM/campaign là feature mới.
8. AI/RAG consolidation là refactor; AI quota là feature mới.
9. Payment/cancel/refund đều là feature mới; refund là P1 có gate.
10. Backend bàn giao OpenAPI, realtime schemas và `fe-integration.md`; không implement frontend.
11. Feature freeze ngày 14/12; 24/12-31/12 chỉ dành cho buffer và blocker.
12. Deadline 31/12 chỉ khả thi khi giữ P0 và không nhận đồng thời toàn bộ OAuth, refund, moderation và WebRTC.
13. Service dài/rải rác được refactor theo capability và ownership; không dùng LOC làm tiêu chí tách máy móc.
14. Mọi list/history query phải bounded, có pagination chuẩn, projection, sort allowlist và index được xác minh bằng query catalog/explain.
15. Giữ Swagger, Passport/JWT và ValidationPipe hiện có; chuẩn hóa thay vì thay framework.
16. Thêm P0: Helmet, Throttler, Redis/ioredis, BullMQ và Terminus; dùng structured JSON logging/correlation ID không cần package mới ở vòng đầu.
17. Cache manager là P1, chỉ dùng cache-aside có chọn lọc sau tối ưu query; không cache state nhạy cảm của auth, booking/queue, health, payment/refund hoặc AI quota.
18. Dev tools/APM/OAuth strategy chỉ thêm khi có use case và owner rõ; Kafka, CQRS package, Elasticsearch, Prisma và GraphQL không thuộc scope deadline này.
