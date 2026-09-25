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
│   ├── files/
│   ├── email/
│   ├── realtime/
│   └── observability/
└── modules/
    ├── authentication/
    ├── users/
    ├── doctors/
    ├── consultations/
    ├── health-tracking/
    ├── ai-advisory/
    ├── billing/
    ├── notifications/
    ├── moderation/
    └── administration/

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
9. Ghi hành động bảo mật quan trọng vào `AuditLogs` với `domain = auth`.
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

Trạng thái: **DONE — 2026-09-18** (`BE-RF-040`). Evidence: `docs/current-state/rf6-consultation-core.md` và `consultations.service.spec.ts`.

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

Trạng thái RF-7: **CORE IMPLEMENTATION DONE ngày 2026-09-18** (`BE-RF-041`–`BE-RF-044`, commit `e9f8733`). Migration RF-7 phải chạy trước khi bật canonical-only reads.

Audit exit gate ngày 2026-09-18:

- Đạt: consultation ownership, participant room authorization, shared JWT helper, CORS allowlist, message idempotency, cursor message/review history, Redis presence TTL/heartbeat, review uniqueness/completed rule, helpful/flag mutation, typecheck/build/lint và 13 test suites/60 tests.
- Còn follow-up trước khi coi RF-7 **release-ready hoàn toàn**: socket authorization/retry E2E chuyên biệt, Mongo transaction/replica proof cho review-rating projection, staging explain/load baseline, và Socket.IO Redis Adapter sau multi-instance proof.
- RF-7 được ghi nhận hoàn tất phần lõi; các follow-up trên phải đóng trong RF-10/integration gate, không mở rộng thêm nghiệp vụ RF-7.

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
9. Sửa chỉ số theo append-only: tạo HealthMetric mới với `replacesMetricId`, chuyển bản ghi cũ sang `superseded|voided` và ghi `AuditLogs` với `domain = health`; không ghi đè giá trị đã đo.

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

Trạng thái RF-8: **IMPLEMENTATION DONE ngày 2026-09-18**. HealthMetric có metadata (`source`, `timezone`), cursor history stable, bounded projection và statistics range mặc định/tối đa. `HealthProfileReader` được AI dùng trực tiếp; Health alert không còn phụ thuộc AI. `AiConversation` là metadata canonical và `AiConversationMessage` là history canonical có DB-native cursor. Migration `202609182400` idempotent extract embedded history, migrate `AiSession`/`AiMessage`, rồi legacy runtime modules/`AiHealthInsights` được gỡ khỏi AppModule. RAG retrieval đi qua `VectorSearchPort`; blacklist cache-aside được dùng ở prompt path và invalidates khi thay đổi.

Audit exit gate:

- Đạt: typecheck/build/lint, 13 test suites/60 tests; migration local apply/no-op pass; health statistics không hydrate toàn bộ history; Health/AI dependency direction rõ; RAG provider đi qua `VectorSearchPort`; blacklist lookup có TTL cache/invalidation; message history DB-native cursor; local structural explain chọn IXSCAN cho ba hot query.
- Follow-up vận hành trước release: chạy query catalog/load test với fixture đại diện trên staging để ghi p95/keys/docs examined, rồi chỉ drop legacy collections sau retention window/backup/consumer audit. Đây không mở lại scope code RF-8.

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

Trạng thái RF-9: **CORE IMPLEMENTATION DONE, còn release-evidence gate (audit 2026-09-18)**.

- Đạt: Notification đã tách Upload/Cloudinary; write Notification + Outbox dùng Mongo transaction khi connection hỗ trợ replica set; notification/outbox đều có idempotency key, bounded claim/lease, per-event BullMQ job với `jobId = idempotencyKey`, retry exponential và dead state; Socket create/read/delete events đều đi qua outbox → Redis pub/sub → API gateway; notification history chỉ allow sort `createdAt` đã có index.
- Còn release evidence: endpoint/dashboard metrics/readiness và dead-event requeue runbook; crash-after-commit, duplicate enqueue, retry delivery integration test với worker thật; representative explain/load baseline. Local development không có replica set phải không được dùng để chứng minh transaction rollback.
- Kết luận: phần code RF-9 đã đủ để các feature sau dùng outbox; checklist vẫn chưa Done cho đến khi các test/operational evidence trên được chạy và lưu lại.

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

Trạng thái RF-10: **DONE — RF-10A/B/C đã hoàn tất ở source và local release rehearsal (21/09/2026)**.

- Đã xóa implementation/schema/module AI cũ (`AiSession`, `AiMessage`, `AiHealthInsight`) và legacy destructive seed; collection lịch sử chưa bị drop để bảo toàn rollback/retention.
- Đã xóa Session schema/model token, nhánh persistence trùng và toàn bộ compatibility adapter. Runtime chỉ expose canonical `ConsultationsModule`; Admin, Chat và Review đi qua owner service.
- Đã xóa `LEGACY_SESSION_API_ENABLED`, HTTP `/sessions`, namespace `/session`, Socket alias `*_session` và runtime field `doctorSessionId`. Frontend repo mới phải tích hợp contract canonical ngay từ đầu.
- Đã gỡ dependency `@nestjs/bullmq` không dùng; worker tiếp tục dùng trực tiếp `bullmq`.
- Không sửa checksum migration đã áp dụng và không drop collection trong application migration. Manifest/runbook cutover nằm ở `docs/current-state/rf10-cutover.md` và `migration-manifest.md`.
- Release sign-off còn cần: staging full regression từ DB đã migrate, đối soát số liệu theo runbook, frontend contract test, observation window và quyết định drop collection/index/field lịch sử sau backup/retention.

#### RF-10A — Runtime/data cutover (đã thực hiện)

Mục tiêu của RF-10A là loại bỏ dual persistence và duplicate runtime trước, chưa phải đích cuối về tên/cấu trúc source:

1. `SessionSchema`, `SessionModel` và nhánh đọc/ghi collection `sessions` đã bị xóa khỏi runtime.
2. AI legacy modules/services/schemas đã bị xóa sau khi migration canonical hoàn tất.
3. Admin, Chat và Review không còn tự đăng ký `ConsultationSchema`; chỉ owner Consultation giữ model token.
4. `/sessions` hiện là adapter có feature flag và không còn nghiệp vụ/persistence riêng.
5. Collection cũ vẫn được giữ theo retention/rollback; không sửa checksum migration đã chạy.

Việc RF-10A còn giữ thư mục `modules/sessions`, `SessionsModule`, các DTO/method mang tên Session và mapper `legacyResponse/toLegacy` chỉ là trạng thái chuyển tiếp. Đây **không phải cấu trúc cuối cùng** và không được dùng làm nền để viết feature mới.

#### RF-10B — Canonical structure cleanup (đã thực hiện, backend-only)

Mục tiêu: source code và internal API chỉ dùng ngôn ngữ Consultation; compatibility nếu còn cần phải bị cô lập ở mép hệ thống, không bọc logic mới bằng service cũ và không làm bẩn canonical response.

Quyết định mặc định cho project hiện tại: frontend sẽ được xây ở repository mới và chưa có bằng chứng về consumer production cần giữ, vì vậy ưu tiên **canonical-only** và xóa compatibility ngay trong RF-10B. Chỉ chuyển sang phương án adapter cô lập nếu access log hoặc owner của một client đang deploy chứng minh contract cũ vẫn còn được dùng.

Thứ tự thực hiện:

1. Tạo/move canonical module sang `modules/consultations/`:
   - `consultations.module.ts` / `ConsultationsModule`;
   - `consultations.controller.ts`;
   - `consultations.service.ts` hoặc tách rõ command/query/access policy nếu file tiếp tục lớn;
   - `entities/consultation.entity.ts`;
   - `dto/create-consultation.dto.ts`, `update-consultation.dto.ts`, `query-consultation.dto.ts`.
2. Đổi toàn bộ internal import từ `modules/sessions/**` sang `modules/consultations/**`; `AppModule`, Admin, Chat và Review chỉ import `ConsultationsModule` hoặc consultation port/facade.
3. Làm canonical service thuần Consultation:
   - input dùng Consultation DTO, không nhận `CreateSessionDto/UpdateSessionDto/QuerySessionDto`;
   - output giữ `requestStatus`, `sessionStatus`, `scheduledStartAt`, không tự thêm `status` hoặc `scheduledAt` legacy;
   - bỏ `legacyResponse`, `toLegacy`, `applyLegacyStatusFilter` khỏi canonical path;
   - tách mapper legacy ra compatibility boundary nếu adapter vẫn còn.
4. Đổi tên internal method để không tiếp tục lan vocabulary cũ:
   - `getSessionMessages` → `getConsultationMessages`;
   - `getSessionDetails` → xóa, chỉ giữ `getConsultationDetails`;
   - `findBySessionId` → `findByConsultationId`;
   - Admin `getAllSessions/getSessionById` → `getAllConsultations/getConsultationById`;
   - biến `session/sessionId/sessionModel` trong code canonical → `consultation/consultationId/consultationModel`.
5. Chuẩn hóa canonical HTTP/realtime contract:
   - `/admin/consultations`, `/chat/consultation/:consultationId`, `/reviews/consultation/:consultationId`;
   - event/payload chỉ dùng `consultation_*` và `consultationId`;
   - canonical consultation controller phát event canonical sau command thành công, không phụ thuộc `SessionsGateway`.
6. Cô lập compatibility (chỉ khi còn consumer được chứng minh) vào `modules/compatibility/legacy-sessions/`:
   - chỉ gồm controller/gateway DTO cũ, mapper và feature guard;
   - controller gọi trực tiếp canonical facade/use case rồi map response tại boundary;
   - **không tạo `SessionsService` trung gian**, không model token, không business rule, không database query;
   - không cho module feature mới import compatibility module.
7. Nếu dự án chưa có frontend production/consumer thực tế, chọn canonical-only ngay:
   - xóa `SessionsController`, `SessionsService`, `SessionsGateway`, `LegacySessionStatus`, legacy DTO và `LEGACY_SESSION_API_ENABLED`;
   - xóa `/sessions`, `/admin/sessions`, `/chat/session/**`, `/reviews/session/**` và Socket alias `*_session` khỏi OpenAPI/realtime contract;
   - không cần duy trì adapter chỉ để tương thích với source frontend cũ không còn được deploy.
8. Loại runtime compatibility fields sau khi data migration đã được verify:
   - ngừng nhận `doctorSessionId` trong Message/Review DTO;
   - ngừng select/map `doctorSessionId` trong response;
   - tạo migration mới để drop legacy indexes/fields/collections sau retention; tuyệt đối không sửa migration cũ.
9. Cập nhật tests và tài liệu:
   - unit test canonical DTO/output không chứa alias Session;
   - architecture test fail nếu source ngoài `compatibility/` chứa `Session(s)` vocabulary hoặc import path `modules/sessions`;
   - OpenAPI breaking diff phải chỉ chứa danh sách endpoint legacy đã duyệt;
   - realtime contract, FE integration, query catalog, responsibility map và cutover runbook cùng dùng canonical names.

Exit gate RF-10B:

- Không còn directory `modules/sessions`.
- Không còn `SessionsModule`, `SessionsService` hoặc Session DTO trong canonical source.
- Canonical response không chứa `status/scheduledAt/doctorSessionId` do mapper legacy tự thêm.
- Ngoài `modules/compatibility/legacy-sessions` (nếu còn), code chỉ dùng `Consultation` vocabulary.
- Feature mới chỉ phụ thuộc `ConsultationsModule`/port canonical.
- Nếu chưa có consumer production, compatibility directory cũng phải được xóa và backend chạy canonical-only.

Ước lượng RF-10B: **2-4 person-days** nếu xóa compatibility ngay; **3-5 person-days** nếu phải giữ adapter cô lập và kiểm thử cả hai contract.

Kết quả RF-10B thực hiện 20/09/2026:

- Canonical owner đã chuyển hoàn toàn sang `modules/consultations`; không còn directory/module/service/controller/gateway/DTO `sessions` trong runtime source.
- HTTP Admin/Chat/Review và Socket chỉ còn route/event/payload `consultation`; không còn feature flag hoặc adapter compatibility.
- Message và Review chỉ nhận/đọc `consultationId`; AI feedback dùng `aiConversationId`. Migration `202609202000-rf10b-canonical-cleanup` backfill AI feedback và tạo index canonical mà không sửa migration cũ.
- Boundary check chặn tái xuất hiện `modules/sessions`, `Sessions*`, `doctorSessionId` và legacy flag ngoài migration/spec lịch sử.
- Typecheck, build, lint, unit và E2E đã pass tại local. Migration/backfill canonical pass trên Mongo local; full integration cần chạy lại trong RF-10C với Mongo replica set + Redis đúng topology.

#### RF-10C — Release evidence và physical cleanup

1. Chạy migration/verify/full regression với database rỗng và bản restore production-like.
2. Đối soát dữ liệu và audit access log/Socket event trong observation window.
3. Nhận xác nhận frontend chỉ dùng canonical contract.
4. Xóa compatibility directory còn lại và feature flag nếu RF-10B phải giữ tạm.
5. Sau backup + retention deadline, tạo migration mới drop legacy fields, indexes và collections.

Kết quả RF-10C hoàn tất 21/09/2026:

- Migration `202609202100-rf10c-physical-cleanup` chạy reconciliation trước mọi thao tác destructive và fail nếu còn bản ghi chưa ánh xạ canonical.
- Đã drop ở rehearsal database các collection `sessions`, `aisessions`, `aimessages`, `aihealthinsights`; unset các field provenance/compatibility và loại legacy indexes khỏi schema manifest.
- Đã chạy migration → verify → migration no-op → reconciliation trên MongoDB `rs0` database riêng; schema version `202609202100`, 36 managed indexes, 0 blocker.
- Full integration 5 suite/13 test, unit 13 suite/56 test, E2E 4 test, boundary/typecheck/build/lint/OpenAPI/realtime đều pass.
- Frontend owner đã quyết định repository mới chỉ dùng canonical API; dự án không có legacy frontend production cần observation window, nên consumer/access-log gate được ghi **N/A theo owner decision**, không giả lập traffic.
- Backup legacy đã được owner xác nhận trong preflight. Migration destructive chưa được chạy tự động lên database ngoài local rehearsal; deployment phải chạy `rf10c:reconcile` trước `database:migrate` trên URI đích.

RF-10 được đánh dấu **DONE** cho codebase/local release evidence. Việc chạy migration trên staging/production vẫn là deployment operation có backup và URI đích rõ ràng, không phải thay đổi source còn thiếu.

### RF-11 — Hợp nhất module theo bounded context và xóa module thừa

Mục tiêu: hoàn thiện topology nội bộ sau RF-10. Những module nhỏ đang đại diện cho một collection, một controller hoặc một kỹ thuật triển khai phải được đưa về đúng bounded context; `AppModule` chỉ composition các module nghiệp vụ/platform cấp cao. Đây là **refactor backend**, không thêm endpoint, state transition hoặc feature mới.

Audit source ngày 21/09/2026 cho thấy `AppModule` vẫn import trực tiếp nhiều module nhỏ như `patients`, `admins`, `ai-feedbacks`, `ai-documents`, `ai-document-chunks`, `chat`, `reviews`, `presence` và `cloudinary`. Các thư mục `ai-sessions`, `ai-messages`, `ai-health-insights` đã rỗng sau RF-10 nhưng vẫn còn trên cây source. RF-11 phải xử lý dứt điểm cả dependency topology lẫn physical cleanup, không chỉ đổi tên hoặc di chuyển file.

Nguyên tắc thiết kế:

- Hợp nhất theo **nghiệp vụ và ownership**, không hợp nhất chỉ vì tên giống nhau hoặc để giảm số thư mục.
- Một bounded context có một public Nest module/facade; capability bên trong vẫn tách theo thư mục/use case, không dồn thành một god service.
- Chỉ tạo internal Nest module khi capability có lifecycle, configuration hoặc dependency graph riêng. Nếu không, dùng provider/use case/repository thông thường trong module owner.
- Cross-context chỉ gọi public facade/application port hoặc domain event; không inject model/repository/provider nội bộ của context khác.
- DDD-lite áp dụng cho context có state machine, invariants hoặc nhiều adapter. CRUD đơn giản không cần tạo đủ lớp hình thức.
- Giữ nguyên canonical HTTP/Socket/OpenAPI contract trong RF-11. Mọi contract diff ngoài thay đổi đã duyệt là regression.
- Không sửa hoặc xóa migration lịch sử. Nếu đổi collection/index/schema runtime thì tạo migration mới và reconciliation tương ứng.

#### RF-11A — Lập module graph và chốt disposition

1. Lập inventory cho từng module/thư mục/provider/schema/controller/gateway/job:
   - ai gọi nó và qua token/import nào;
   - nó sở hữu business rule, collection, route, event hoặc worker nào;
   - public API thực sự cần export;
   - disposition cuối: `KEEP`, `MERGE`, `MOVE_TO_INFRASTRUCTURE`, `DELETE` hoặc `DEFER`.
2. Dựng dependency graph từ `AppModule`, Nest `imports/exports/providers`, TypeScript imports, `InjectModel`, BullMQ worker, Socket gateway, migration/seed và test.
3. Ghi baseline OpenAPI, realtime schema, DI bootstrap, unit/integration/E2E và query performance trước khi di chuyển.
4. Chốt owner cho collection. Một collection chỉ có một module owner đăng ký model; context khác dùng port/facade.

Không bắt đầu move file hàng loạt khi chưa có disposition và target owner. Empty directory có thể xóa ngay sau khi xác nhận không chứa generated/runtime artifact cần giữ.

#### RF-11B — Topology đích và mapping nguồn → đích

Mapping dưới đây là mặc định từ audit hiện tại; RF-11A được phép điều chỉnh khi dependency graph chứng minh một owner khác hợp lý hơn.

| Nguồn hiện tại                                                              | Đích/owner đề xuất                                                        | Cách phân bổ                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`, phần xác thực trong `core/auth-core`                                | `modules/authentication`                                                  | Tách `sessions`, `credentials`, `otp`, `guards/strategies`; chỉ export auth facade/guards cần thiết. `auth-core` không tồn tại như module nghiệp vụ thứ hai sau cutover.                                                              |
| `users`, `patients`, `admins`                                               | `modules/users`                                                           | Một canonical User owner; chia `accounts`, `patient-profile`, `admin-profile`, `queries`. Admin workflow không được nhét vào User domain.                                                                                             |
| Doctor profile/directory/approval đang nằm trong `users`/`admin`            | `modules/users` + `modules/administration`                                | Audit xác nhận doctor profile là embedded phần canonical của User nên Users giữ profile/directory/update port; Administration chỉ orchestration approval. Không tạo Doctor model/module thứ hai hoặc alias `practitioner`.                                                                        |
| `ai-assistant`, `rag`, `ai-feedbacks`, `ai-documents`, `ai-document-chunks` | `modules/ai-advisory`                                                     | Một public AI module; chia `conversations`, `feedback`, `knowledge-base/ingestion`, `retrieval`, `providers` và persistence adapter. Document/chunk là persistence detail, không còn là top-level feature module.                     |
| `ai-sessions`, `ai-messages`, `ai-health-insights` rỗng                     | Xóa                                                                       | Đã cutover ở RF-10; boundary check ngăn tái xuất hiện tên/model cũ.                                                                                                                                                                   |
| `consultations`, `chat`, `reviews`                                          | `modules/consultations`                                                   | Chia `core`, `messaging`, `reviews`, `realtime`; Consultation sở hữu authorization và liên kết Message/Review. Doctor rating cần cho directory được cung cấp qua query port/projection, không cho Doctors đọc model Review trực tiếp. |
| `presence`                                                                  | `infrastructure/realtime/presence` hoặc internal adapter của Consultation | Chọn theo consumer graph: nếu chỉ phục vụ consultation thì đặt trong context; nếu dùng đa context thì là platform adapter với interface hẹp.                                                                                          |
| `health-metrics`                                                            | `modules/health-tracking`                                                 | Chia metrics/history/statistics; AI chỉ đọc qua health query port đã kiểm soát quyền và projection.                                                                                                                                   |
| `notifications`                                                             | `modules/notifications`                                                   | Sở hữu notification preference/history/delivery orchestration; không sở hữu generic outbox persistence.                                                                                                                               |
| `outbox`                                                                    | `infrastructure/outbox`                                                   | Platform concern dùng chung cho Notification, Billing và các context phát event; giữ API publish/claim hẹp và worker entrypoint riêng.                                                                                                |
| `blacklist-keywords`, `violations`                                          | `modules/moderation`                                                      | Chia policy/keyword management/violation workflow. AI advisory gọi moderation port, không import schema blacklist.                                                                                                                    |
| `admin`                                                                     | `modules/administration`                                                  | Chỉ chứa admin-facing application orchestration/read model; command thay đổi User/Doctor/Consultation gọi facade của owner, không đăng ký lại model.                                                                                  |
| `cloudinary`                                                                | `infrastructure/files`                                                    | Adapter triển khai file-storage port; business module không import Cloudinary SDK trực tiếp.                                                                                                                                          |
| `nodemailer`                                                                | `infrastructure/email`                                                    | Adapter gửi email; Notifications/Authentication phụ thuộc email port, không phụ thuộc Nodemailer trực tiếp.                                                                                                                           |

Topology cấp cao sau RF-11:

```text
apps/api/src/
├── common/                         # cross-cutting thuần, không chứa business rule
├── infrastructure/
│   ├── database/
│   ├── redis/
│   ├── cache/
│   ├── outbox/
│   ├── realtime/
│   ├── files/
│   └── email/
└── modules/
    ├── authentication/
    ├── users/
    ├── consultations/
    ├── health-tracking/
    ├── ai-advisory/
    ├── notifications/
    ├── moderation/
    ├── administration/
    └── billing/                    # tạo khi triển khai feature payment
```

Ví dụ phân tách bên trong context AI sau hợp nhất:

```text
ai-advisory/
├── ai-advisory.module.ts           # composition root, public exports tối thiểu
├── domain/
│   ├── conversations/
│   ├── feedback/
│   └── knowledge-base/
├── application/
│   ├── conversations/
│   ├── feedback/
│   ├── ingestion/
│   ├── retrieval/
│   └── ports/
├── infrastructure/
│   ├── mongoose/
│   ├── providers/
│   └── jobs/
└── presentation/
    └── http/
```

`AiAdvisoryModule` không đồng nghĩa có một `AiAdvisoryService` làm mọi việc. Mỗi use case vẫn có handler/service riêng; module gốc chỉ wire dependency và định nghĩa public boundary.

#### RF-11C — Trình tự hợp nhất an toàn

Thực hiện theo từng vertical slice, không move toàn bộ repository trong một PR:

1. Tạo target context, public facade/ports và architecture tests trước.
2. Chuyển domain policy/use case thuần, sau đó chuyển repository/schema/provider adapter.
3. Chuyển từng controller/gateway/worker sang target context và so sánh contract/baseline.
4. Chuyển consumer sang public facade; loại cross-context `InjectModel` và deep import.
5. Khi source module không còn consumer, bỏ khỏi `AppModule`, chạy DI bootstrap/test rồi mới xóa module file/thư mục.
6. Chạy migration mới chỉ khi physical schema/index/collection thực sự đổi; move TypeScript file đơn thuần không tạo migration.
7. Cập nhật responsibility map, OpenAPI/realtime docs, test paths và runbook ngay trong cùng slice.

Thứ tự ưu tiên:

```text
empty AI directories cleanup
 -> AI Advisory consolidation
 -> Users/Authentication/Doctors ownership cleanup
 -> Consultation/Chat/Review/Presence consolidation
 -> Moderation consolidation
 -> Files/Email/Outbox platform relocation
 -> Administration orchestration cleanup
 -> final dependency/package cleanup
```

Ưu tiên AI trước vì hiện có nhiều top-level module cùng một bounded context và các legacy directory rỗng. Users/Auth/Doctors thực hiện tiếp theo nhưng phải giữ separation giữa authentication, canonical user và doctor lifecycle; không gom cả ba thành một god module.

#### RF-11D — Điều kiện được xóa module/code

Một module/provider/schema/thư mục chỉ được xóa khi đồng thời đạt:

- Không còn import trong `AppModule`, worker composition root hoặc module khác.
- Không còn DI token, `InjectModel`, controller, gateway, scheduled job, queue processor hoặc event subscriber tham chiếu.
- Không còn canonical endpoint/event/worker chỉ được triển khai tại đó, hoặc implementation đã được chuyển và contract test pass.
- Collection/data lịch sử đã có owner mới hoặc retention/migration decision rõ; xóa module **không tự động cho phép drop collection**.
- Migration, seed, verifier, scripts và tests không còn phụ thuộc runtime path cũ. Migration lịch sử vẫn được giữ nguyên.
- `rg`/dependency graph không còn deep import; TypeScript, Nest bootstrap, unit, integration, E2E, OpenAPI và realtime diff đều pass.
- Package dependency chỉ được gỡ sau khi xác nhận không còn runtime/build/test consumer.

Tool phát hiện unused import/file/dependency chỉ là tín hiệu hỗ trợ. Không xóa tự động dựa riêng vào `knip`, ESLint hoặc coverage vì Nest DI, decorators, dynamic modules và worker entrypoints có thể không xuất hiện trong static graph đầy đủ.

#### RF-11E — Enforcement và exit gate

- `AppModule` chỉ import public bounded-context modules và platform modules cần bootstrap; không import module theo collection như AI document/chunk.
- Mỗi top-level business module có owner, public exports và allowed dependencies được ghi trong responsibility map.
- Không còn empty legacy directory; không còn `AiSessionsModule`, `AiMessagesModule`, `AiHealthInsightsModule`, `PatientsModule`, `AdminsModule`, module AI document/chunk/feedback độc lập hoặc compatibility alias tương đương.
- Không context nào inject Mongoose model do context khác sở hữu.
- Dependency-cycle và boundary checks pass; deep import vào `domain/internal/infrastructure` của context khác bị CI chặn.
- HTTP/Socket/OpenAPI contract không regression; critical query plan, pagination và indexes không xấu đi sau khi đổi repository ownership.
- Không xuất hiện god module/god service mới: capability có use case/repository riêng, public facade chỉ orchestration và không chứa toàn bộ business logic.
- Build API + worker, lint, typecheck, unit, integration, E2E và clean-checkout bootstrap đều pass.

Ước lượng RF-11: **8-14 person-days**. Đây là estimate cho consolidation có test/boundary cleanup; không bao gồm feature mới hoặc đổi business contract. Nếu deadline căng, ưu tiên theo thứ tự AI → User/Auth/Doctor → Consultation; platform relocation có thể chia nhỏ nhưng empty/unused module cleanup và boundary enforcement không được bỏ qua.

Trạng thái RF-11: **DONE — 2026-09-21** (`BE-RF-080` đến `BE-RF-086`). Đã hợp nhất các module theo bounded context, chuyển adapter dùng chung sang `infrastructure`, loại runtime schema/module trùng lặp, bỏ cross-context model registration, xóa orphan/empty module và bổ sung boundary enforcement. OpenAPI không có semantic diff; HTTP/Socket contract, API/worker bootstrap, build, lint, typecheck, unit, integration và E2E đều pass. Evidence chi tiết nằm tại `docs/current-state/rf11-module-consolidation.md`.

### RF-12 — Hardening bounded-context boundary và tách god service

Mục tiêu: hoàn thiện các điểm follow-up phát hiện sau audit RF-11 mà không thay đổi HTTP/Socket/OpenAPI contract. RF-12 là refactor backend độc lập; **không bao gồm staging/release evidence của RF-9/RF-10**.

Các bước:

1. Loại dependency ngược `Users → Administration`: application query của doctor application thuộc Users; HTTP DTO của Administration chỉ implement/map sang contract này.
2. Tạo `public-api.ts` cho các context có consumer bên ngoài. Cross-context code chỉ được import public API/application port; module composition root được phép import public `*.module.ts` của context khác.
3. Mở rộng `boundary:check` để resolve relative import và fail khi context A deep-import implementation của context B. Authentication và Users được khai báo cùng Identity context; các context khác không có implicit exception.
4. Bỏ `doctors`/`doctors.module.ts` khỏi allowlist vì canonical doctor profile thuộc User; việc tách Doctor thành context riêng trong tương lai cần ADR/migration mới.
5. Tách `AiAssistantService` thành facade, message/RAG orchestration, conversation query và conversation management service.
6. Tách Health Tracking thành facade/write orchestration, DB-native query/statistics service và alert evaluation/delivery service; `HEALTH_PROFILE_READER` trỏ trực tiếp vào query service.
7. Giữ controller/API response hiện tại; chạy typecheck, build, lint, unit, integration, E2E, boundary, OpenAPI và realtime contract checks.

Exit gate:

- Không còn dependency `Users → Administration`.
- Không còn cross-context deep import ngoài Identity group hoặc module composition root; CI boundary check cưỡng chế quy tắc này.
- Boundary allowlist không cho tạo lại `DoctorsModule`.
- `AiAssistantService` chỉ còn facade/compatibility orchestration, query và mutation đã có owner riêng.
- Health read/statistics và alert workflow có service riêng; controller contract không đổi.
- Tất cả quality gate và contract check pass.

Trạng thái RF-12: **DONE — 2026-09-21** (`BE-RF-090` đến `BE-RF-093`). Cycle Users–Administration đã được loại bỏ; cross-context imports đi qua public API và được boundary check cưỡng chế; `doctors` đã bị loại khỏi allowlist. AI/Health god service đã tách theo orchestration/query/management/alert responsibility. Build, lint, typecheck, unit, integration, E2E, boundary, OpenAPI và realtime checks đều pass. Evidence nằm tại `docs/current-state/rf12-boundary-hardening.md`; staging evidence RF-9/RF-10 tiếp tục là release task riêng và không thuộc RF-12.

### RF-13 — Chuẩn hóa capability Doctor/Patient trong Users

Mục tiêu: hoàn tất physical organization còn lệch sau RF-11 và loại hai implementation patient profile song song. Đây vẫn là một Identity/Users bounded context; không tạo lại `DoctorsModule`, `PatientsModule` hoặc collection `doctors`.

Các bước:

1. Gom doctor directory, DTO và embedded profile schema vào `users/doctors`; giữ registration của doctor profile trong canonical `User` schema.
2. Đổi capability patient thành `PatientProfileController`/`PatientProfileService` và đặt schema, DTO trong `users/patients`.
3. Đặt embedded admin-profile schema cùng capability `users/admins`; chỉ giữ shared User/address schema trong `users/entities`.
4. Xóa Patient model dependency cùng CRUD patient khỏi `UsersService`/`UsersController`.
5. Chốt self-profile API tại `POST|GET|DELETE /patients/me`; xóa `/users/profile`, `/patients/profile` và `PATCH` rỗng.
6. Kiểm tra `User.role = patient` trước khi tạo profile; giữ unique `userId` và physical collection `patients` để không cần migration dữ liệu.
7. Không export patient implementation nếu chưa có cross-context consumer; cập nhật OpenAPI và characterization test.
8. Xóa feature-level `UserRole` re-export; core/infrastructure/Users cùng dùng enum canonical trong `core/domain`.

Trạng thái RF-13: **DONE — 2026-09-21** (`BE-RF-094` đến `BE-RF-095`). Frontend mới phải dùng `/patients/me`; runtime collection vẫn là `patients`. Evidence nằm tại `docs/current-state/rf13-user-capability-normalization.md`.

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
| BE-RF-080 | Module/dependency graph + disposition        | BE-RF-070                                             | Mọi module/provider/schema có owner và KEEP/MERGE/MOVE/DELETE/DEFER decision             |
| BE-RF-081 | Hợp nhất AI Advisory                         | BE-RF-080, BE-RF-051                                  | Một public AI module; conversation/feedback/knowledge/retrieval còn tách capability      |
| BE-RF-082 | Hợp nhất User/Auth/Doctor ownership          | BE-RF-080, BE-RF-030, BE-RF-031                       | Không còn Patients/Admins/AuthCore nghiệp vụ trùng; model ownership và public facade rõ  |
| BE-RF-083 | Hợp nhất Consultation collaboration          | BE-RF-080, BE-RF-040 đến BE-RF-044                    | Chat/Review/Presence nằm đúng owner; không cross-context model injection                 |
| BE-RF-084 | Hợp nhất Moderation và platform adapters     | BE-RF-080, BE-RF-061                                  | Moderation owner rõ; files/email/outbox/presence đặt đúng infrastructure/context         |
| BE-RF-085 | Xóa orphan module/provider/dependency        | BE-RF-081 đến BE-RF-084                               | Không empty/unused module; DI bootstrap và full regression pass                          |
| BE-RF-086 | Enforce context boundaries và contract diff  | BE-RF-081 đến BE-RF-085                               | CI chặn cycle/deep import/foreign model; OpenAPI/realtime diff đã duyệt                  |

---

# PHẦN B — PHÁT TRIỂN BACKEND FEATURE MỚI

> Quyết định sản phẩm ngày 23/09/2026: DA2 ưu tiên **HealthAI Chronic Care**. Phần A về refactor được giữ nguyên làm lịch sử kỹ thuật và bằng chứng hoàn tất. Từ Phần B trở đi, kế hoạch thực thi phải theo `plan/PROJECT_OVERVIEW_DA2.md`, `plan/chronic-care-plan.md`, `docs/overview.md` và `docs/BUSINESS_RULES.md`. Khi có xung đột, business rules và Chronic Care P0 được ưu tiên; các NF cũ chỉ được nhận nếu phục vụ hành trình cốt lõi hoặc sau khi P0 đạt gate.
>
> `docs/db-template-v8.dbml` là schema draft cho phần feature mới. Không sửa migration lịch sử hoặc triển khai collection/index v8 trước khi design review chốt; DB v7 vẫn là baseline của phần refactor đã hoàn tất.

## 8. Điều kiện bắt đầu feature mới

Không cần đợi toàn bộ refactor hoàn tất, nhưng mọi feature đều phụ thuộc `BE-RF-006` (query/pagination convention) và `BE-RF-007` (query catalog/performance baseline), sau đó mới xét dependency domain trực tiếp dưới đây.

| Feature                | Refactor bắt buộc hoàn thành trước                 |
| ---------------------- | -------------------------------------------------- |
| Care Program/Enrollment | BE-RF-020, BE-RF-030, BE-RF-050, BE-RF-061, BE-RF-082, BE-RF-084 |
| Monitoring task/reminder | Care Program, BE-RF-050, BE-RF-061, BE-RF-084 |
| Rule/Evaluation/Alert | Monitoring task, BE-RF-050, BE-RF-060, BE-RF-061 |
| Doctor Priority Inbox | Care Alert, BE-RF-031, BE-RF-052, BE-RF-082 |
| Báo cáo xác định/AI summary | BE-RF-050 đến BE-RF-052, BE-RF-081, Care Program/Alert |
| Entitlement/consultation limit | BE-RF-030, BE-RF-040, BE-RF-061, BE-RF-082 đến BE-RF-084 |
| Người thân đồng hành P1 | Monitoring task, Notification/Outbox, consent policy |
| Tìm cơ sở y tế P1 | Care Program, Admin capability, location/privacy policy |
| OAuth                  | BE-RF-030, BE-RF-011, BE-RF-082                    |
| AvailabilitySlot       | BE-RF-020, BE-RF-031, BE-RF-082                    |
| Scheduled booking      | BE-RF-040, BE-RF-083 và AvailabilitySlot           |
| Queue/check-in/no-show | BE-RF-040, BE-RF-043, BE-RF-083 và business rules  |
| Reminder/FCM           | BE-RF-061, BE-RF-084                               |
| AI quota               | BE-RF-051, BE-RF-022, BE-RF-081                    |
| Payment                | BE-RF-030, BE-RF-061, BE-RF-082, BE-RF-084         |
| Refund                 | Payment basic đã pass sandbox/IPN gate             |
| Moderation             | BE-RF-030, BE-RF-040, BE-RF-042, BE-RF-084         |
| WebRTC/TURN mở rộng    | BE-RF-043, BE-RF-083 và Consultation authorization |

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

Quy tắc bổ sung cho AI/Health: feature chỉ được code sau khi chốt metric/unit/timezone, nguồn dữ liệu, phép tổng hợp xác định, rule version, authorization scope, structured output, fallback và bộ dữ liệu đánh giá. Không dùng prompt để thay thế business rule chưa được định nghĩa.

## 9. Các feature backend mới

### CC-1 — Care Program, phiên bản và Enrollment

Ưu tiên: **P0**.

1. Tạo `CarePrograms`, giữ `taskTemplates` nhúng theo từng phiên bản; phiên bản bất biến sau publish và có trạng thái `draft|published|retired`.
2. Admin và Doctor được tạo/chỉnh draft theo quyền; chỉ Admin quản lý nguồn, publish/retire rule/ngưỡng.
3. Tạo `PatientCarePrograms` với snapshot Program version, consent, timezone, baseline và Doctor `active + approved` bắt buộc trước khi active.
4. Trạng thái enrollment: `pending|active|paused|completed|cancelled`; chỉ active sinh task/evaluation mới.
5. MVP có hai template dùng chung engine: tăng huyết áp và tiểu đường; không fork luồng theo từng bệnh.
6. Mọi chuyển version, pause/complete/cancel và patient-specific override phải có actor, reason, effective time và audit.

Done khi authorization, consent/version/state E2E pass và hai Program chạy chung một domain model.

### CC-2 — Monitoring Task, baseline và check-in

Ưu tiên: **P0**.

1. Task type P0 gồm `metric`, `check_in`, `education`, `appointment`, `doctor_review`.
2. Task template có schedule, time window, completion rule, reminder policy, required/optional và version.
3. Worker chỉ sinh task trong rolling window, dùng timezone snapshot và idempotency key ổn định.
4. HealthMetric là nguồn dữ liệu gốc; task `metric` chỉ tham chiếu bản ghi phù hợp patient/type/window.
5. Adherence chỉ đo mức hoàn thành theo dõi; không mô tả là tuân thủ điều trị.
6. Quiet hours, frequency cap, trạng thái task/enrollment và deduplication được kiểm tra trước khi nhắc.

Done khi timezone, retry, duplicate generation, source edit/delete và adherence tests pass.

### CC-3 — Rule Evaluation, Care Alert và Doctor Priority Inbox

Ưu tiên: **P0**.

1. Rule set version hóa, allowlist operator và chỉ chạy version active đã duyệt.
2. Evaluation xác định trả `normal|attention|urgent`, `reasonCodes`, input references và rule version; AI không tham gia severity.
3. Alert có deduplication key và vòng đời `open|acknowledged|resolved|dismissed`; resolve/dismiss lưu actor/reason.
4. `urgent` dùng safety template đã duyệt, không chờ AI hoặc cam kết Doctor phản hồi tức thời.
5. Priority Inbox là projection bounded từ alert/enrollment, sort theo severity, detectedAt và `_id`; chỉ Doctor được assign mới truy cập.
6. Doctor có thể acknowledge, liên kết consultation, ghi follow-up và resolve trong phạm vi quyền.

Done khi boundary/repeat/missing-data/dedupe/authorization/query-plan/concurrency tests pass.

### CC-4 — Báo cáo xác định và AI đọc HealthMetrics

Ưu tiên: **P0**.

AI summary là chuỗi xử lý, không phải một lời gọi LLM trực tiếp:

```text
HealthMetrics
 -> MetricNormalizer
 -> DeterministicReportAggregator
 -> CareRuleEvaluation
 -> SummaryInputSnapshot
 -> AiNarrativeGenerator
 -> SummaryOutputGuard
 -> CareSummary hoặc deterministic fallback
```

#### CC-4A Chuẩn hóa và tổng hợp

1. Chuẩn hóa metric type, unit, timezone, source, report window; không tự sửa giá trị bất thường.
2. Backend tính expected/completed count, adherence, min/max/average/median, period delta, trend, missing windows, alert count và consultation/follow-up references.
3. Tạo `SummaryInputSnapshot` bất biến có `dataCutoff`, source refs, statistics, missing data, evaluations, rule version và input hash.
4. Patient/Doctor report dùng chung facts; chỉ khác presentation policy và trường được phép hiển thị.

#### CC-4B Sinh nội dung và kiểm soát đầu ra

1. Provider nhận snapshot tối thiểu đã authorize, không nhận toàn bộ hồ sơ hoặc raw history không cần thiết.
2. Structured output gồm `overview`, `observations`, `missingData`, `alertsToMention`, `questionsForDoctor`, `disclaimer`.
3. Guard kiểm tra schema, mọi con số/tuyên bố có nguồn, citation tồn tại, không diagnosis/prescription/dose change/stop-medication và không thay đổi severity.
4. Guard/provider/evidence fail trả deterministic fallback; báo cáo số và reason codes vẫn hoạt động.
5. Lưu `generated|fallback|failed`, window, data cutoff, input hash/source refs, model/prompt/rule version, validation result, token/latency và Doctor review status.
6. Generation idempotent theo `(enrollmentId, reportWindow, dataCutoff, summaryVersion)`; dữ liệu thay đổi tạo version mới, không ghi đè report đã review.
7. RAG chỉ bổ sung nội dung giáo dục approved/citation; không tính số liệu hoặc chọn ngưỡng.

Done khi numerical-grounding, unsupported-claim, safety, authorization, fallback, idempotency và fixed evaluation dataset pass cho cả tăng huyết áp/tiểu đường.

### CC-5 — Consultation link và follow-up

Ưu tiên: **P0 trong phạm vi phục vụ Chronic Care**.

1. Consultation vẫn hoạt động độc lập với Care Program.
2. Alert/report có thể tạo hoặc liên kết scheduled/on-demand consultation đã authorize.
3. Doctor ghi follow-up note/task sau consultation; không mở chat 24/7 ngoài consultation.
4. Chỉ triển khai phần slot/check-in/queue/reminder NF-2 đến NF-4 cần cho critical journey; WebRTC mở rộng là P1.

### CC-6 — Gói Free/Plus/Care, AI quota và giới hạn consultation

Ưu tiên: **P0**.

1. Entitlement lấy từ Plan/Subscription snapshot phía backend; không hard-code theo tên tier.
2. `aiTokenLimit` là quota chính cho chat AI; `aiRequestLimit` chống spam. Summary job có budget token riêng và không dùng consultation counter.
3. `consultationLimitPerCycle` mặc định Free 1, Plus 3, Care 6; scheduled/on-demand dùng chung `ConsultationUsages`. Mỗi Consultation có một bản ghi cập nhật nguyên tử theo `reserved → counted|released|expired`; mỗi lần đổi trạng thái ghi bất biến trong `AuditLogs` với `domain = billing`.
4. Downgrade/hết hạn không xóa HealthMetrics/report/alert và không tắt safety alert.
5. Paid tier không thay đổi severity, ưu tiên lâm sàng hoặc quyền truy cập dữ liệu cơ bản của Patient.
6. Free vẫn tạo một `Subscriptions` với `source = free_grant` và chu kỳ 30 ngày; không tạo PaymentOrder và không tạo Subscription mới ở mỗi chu kỳ.

### CC-7 — Payment VNPAY và quyết định không dùng Saga trong DA2

Ưu tiên: **P0 theo quyết định sản phẩm hiện tại**.

DA2 là modular monolith với một MongoDB và một cổng thanh toán ngoài, vì vậy không triển khai Saga framework. Dùng state machine + Mongo transaction + transactional outbox + idempotent worker + reconciliation:

```text
PaymentOrder pending
 -> VNPAY
 -> verified IPN
 -> transaction: PaymentTransaction + order paid + OutboxEvent
 -> worker idempotent cấp Subscription
 -> reconciliation xử lý trạng thái chưa rõ
```

1. Return URL chỉ hiển thị/truy vấn; không cấp quyền.
2. IPN xác minh signature, merchant, order reference, amount và currency; provider transaction/reference có unique index.
3. Trong một Mongo transaction: upsert transaction, conditional transition order và ghi một outbox grant event. Không gọi provider trong transaction.
4. Worker cấp Subscription idempotent theo order/grant key; lỗi cấp quyền được retry, không tạo payment mới.
5. `created|pending|processing|paid|failed|expired|cancelled|refund_pending|refunded` là state machine; cancel-vs-IPN có policy/audit xác định.
6. Job/command đối soát query provider cho order `processing` hoặc mismatch; timeout/unknown không tự đánh dấu failed.
7. Saga chỉ xem xét sau DA2 khi Payment, Subscription, Booking, Invoice thuộc các service/database độc lập và cần compensation liên dịch vụ.

### CC-8 — Người thân đồng hành

Ưu tiên: **P1, chỉ sau P0 ổn định**.

Số người thân active lấy từ `familyLinkLimit`. Người thân phải có tài khoản Patient bình thường, đăng nhập rồi xác nhận liên kết; không tạo role `family` hoặc `FamilyGroups` trong DA2. Invite/accept/consent/revoke ghi vào `AuditLogs` với `domain = care`. Patient luôn được nhắc trước; người thân chỉ nhận thông báo chung khi task missed sau grace period, không mặc định xem HealthMetrics, Care Alert, AI hoặc consultation. `urgent` không biến người thân thành kênh cấp cứu.

### CC-9 — Tìm cơ sở y tế

Ưu tiên: **P1, ưu tiên đầu tiên sau P0**.

Admin quản lý `MedicalFacilities` đã xác minh và `DiseaseSpecialties`; truy vấn lọc chuyên khoa/khu vực rồi sắp xếp xác định theo mức khớp chuyên khoa và khoảng cách. Khi danh mục nội bộ chưa đủ, backend gọi API bản đồ; Admin chọn kết quả để tạo bản nháp, kiểm tra nguồn chính thức rồi mới đánh dấu đã xác minh. AI chỉ chuẩn hóa truy vấn thành bộ lọc/giải thích, không suy luận bệnh hoặc xếp hạng chất lượng cơ sở. Tích hợp lịch trống bệnh viện để sau DA2.

### Các feature hỗ trợ kế thừa

Các NF dưới đây không còn là roadmap độc lập. Chỉ nhận slice phục vụ CC-1 đến CC-9 hoặc khi Chronic Care P0 đã qua release gate.

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
10. Snapshot `bookingSettings`, `expectedDurationMinutes` và `bufferMinutes`; `scheduledEndAt` không tự complete consultation.

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
6. Không accept/bắt đầu on-demand nếu thời lượng dự kiến + buffer đè lên scheduled consultation sắp tới; nếu accepted thì vào waiting với ETA.

#### NF-3B Check-in

1. Chốt cửa sổ check-in sớm/muộn cho scheduled consultation.
2. On-demand accepted có thể vào waiting theo rule riêng, không cần giả slot.
3. Transition chỉ hợp lệ khi consultation confirmed và chưa cancelled/completed.
4. Lưu `checkedInAt` và `queuePriorityAt` phía server.

#### NF-3C Queue và call-next

1. Queue là query/projection từ Consultations; không tạo BullMQ job cho từng bệnh nhân trong hàng đợi.
2. Scheduled và on-demand dùng chung queue: scheduled quá giờ, scheduled tới cửa sổ phục vụ, rồi on-demand theo `queueJoinedAt`; mọi sort có tie-breaker ổn định.
3. Atomic `call-next` chỉ chuyển đúng một patient sang called/invited state.
4. Repeated call-next hoặc retry phải idempotent.
5. Chỉ doctor owner hoặc admin có quyền xem/thao tác queue.
6. Phát `queue.v1.changed` và consultation update event.
7. Một Doctor chỉ có một `in_consultation`; không preempt phiên đang chạy. `call-next` dùng conditional update và partial unique index.
8. `scheduledEndAt` chỉ tạo overtime/ETA update. Doctor tự complete; heartbeat timeout chuyển `interrupted`, không chuyển completed.

#### NF-3D No-show

1. Delayed job kiểm tra lại trạng thái tại thời điểm chạy.
2. Không mark no-show nếu consultation đã started/cancelled/completed.
3. Job retry không tạo transition hoặc notification trùng.

Done khi:

- Scheduled và on-demand đều có đường vào Consultation hợp lệ.
- Check-in/call-next/no-show state tests pass.
- Race test chứng minh không gọi hai patient cho cùng một lượt.
- Overlap test chứng minh on-demand không đè scheduled, overtime không auto-complete và interrupted có thể resume/finalize.
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

Ưu tiên: **P0**, phục vụ gói Free/Plus/Care; triển khai theo CC-7 và không dùng Saga framework trong DA2.

Các bước payment:

1. Spike VNPAY Sandbox cho create/query/IPN và quyền merchant.
2. Tạo Plans, PaymentOrders, PaymentTransactions và Subscriptions migrations.
3. Plans version hóa `draft|published|retired`; Admin chỉ sửa draft. Order snapshot giá, currency, duration, quota và features của version published tại thời điểm mua.
4. Tiền VND dùng integer; không dùng floating point.
5. Tạo signed payment URL phía server.
6. Return URL chỉ hiển thị/truy vấn trạng thái; không cấp subscription.
7. IPN verify signature, amount, currency, reference và merchant data.
8. Xử lý IPN idempotent trong transaction:
   - ghi/upsert PaymentTransaction;
   - order chuyển sang paid;
   - tạo đúng một `SubscriptionGrantRequested` OutboxEvent;
   - tạo Notification/OutboxEvent cần thiết.
9. Unique provider transaction/reference indexes.
10. Worker cấp Subscription idempotent ngoài IPN request path; retry không tạo grant trùng.
11. Tạo reconciliation command cho pending/paid/grant mismatch và trạng thái provider timeout/unknown.

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
- Payment `paid` nhưng grant chưa hoàn tất được worker/reconciliation phục hồi mà không cần Saga.

Ước lượng: payment **9-13**, cancel **1-2 person-days**.

### NF-7 — Full refund có admin duyệt

Ưu tiên: **P1, feature flag, chỉ bắt đầu sau NF-6 đạt gate**.

Phạm vi MVP:

- Chỉ full refund một lần cho một paid order.
- Không partial refund, multiple refund, chargeback hoặc auto-approve.
- Không tự động refund khi consultation bị hủy.
- Không dùng phần trăm sử dụng chung: AI token, consultation đã tính lượt/no-show, Doctor review, báo cáo và nhiệm vụ Care trả phí có ngưỡng riêng trong `refundPolicy`.
- Policy thuộc phiên bản Plan đã publish và được snapshot vào PaymentOrder; Admin sửa policy chỉ ảnh hưởng order mới.

Các bước:

1. Tạo PaymentRefunds migration với unique order lifecycle, provider request ID, policy snapshot, usage snapshots và eligibility reason codes.
2. Patient tạo request; backend kiểm tra ownership/thời hạn, chụp mức sử dụng và phân loại `eligible|review_required|ineligible`.
3. Transaction request chuyển order `paid -> refund_pending`, tạo refund/outbox và tạm dừng hành động trả phí mới; dữ liệu, quyền Free và safety alert vẫn hoạt động.
4. Giải phóng consultation reservation chưa sử dụng theo consultation policy; lượt đã `counted`/`no_show` không tự hoàn lại để lách điều kiện.
5. Admin approve/reject. Trước approve, backend chụp `finalUsageSnapshot` và kiểm tra lại eligibility để xử lý race với việc sử dụng dịch vụ.
6. Trường hợp thu trùng, paid-without-grant hoặc cấp sai quyền vào `review_required`; Admin override phải có lý do và audit, không vượt invariant số tiền/giao dịch/idempotency.
7. Worker claim approved refund và gọi provider ngoài Mongo transaction; giữ stable `providerRequestId` khi retry.
8. Timeout/unknown chuyển `manual_review`; query/reconcile trước khi retry provider.
9. Chỉ khi provider xác nhận thành công mới transactionally:
   - refund `succeeded`;
   - order `refunded`;
   - subscription grant của order `cancelled`;
   - audit + notification/outbox.
10. Reject/failure có kết luận đưa order về `paid` và mở lại quyền lợi trả phí; không revoke grant sớm.
11. Tạo reconciliation command và admin audit endpoints.
12. E2E cho eligibility theo từng quyền lợi, request-vs-usage race, approve/reject, pause/resume entitlement, override, retry/unknown, duplicate và entitlement rollback.

Cấu hình:

- Admin UI quản lý `refundPolicy` trong Plan draft/publish: thời hạn yêu cầu và ngưỡng sử dụng của từng quyền lợi.
- ENV chỉ giữ `VNPAY_REFUND_ENABLED`, provider timeout, retry và hard ceiling kỹ thuật.
- Seed nghiêm ngặt để review: cửa sổ 168 giờ, các ngưỡng quyền lợi trả phí bằng 0 và luôn cần Admin duyệt; chủ sản phẩm phải xác nhận trước release.

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
- Với Health/AI: phép chuẩn hóa/tổng hợp có unit tests, SummaryInput snapshot truy vết được, structured output qua schema/numerical-grounding/safety guard và fallback không phụ thuộc provider.
- Với Care rule/alert: severity chỉ do rule engine version hóa; test boundary, repeated condition, missing data, dedupe và audit pass.
- Với payment: IPN không trực tiếp phụ thuộc frontend; order transition, transaction, outbox grant, worker và reconciliation đều idempotent. Không yêu cầu Saga framework cho DA2.
- Với P1 người thân/cơ sở y tế: consent/location privacy, source label, feature flag và khả năng tắt mà không ảnh hưởng P0 phải được kiểm thử.

## 11. Backlog feature backend

Backlog Chronic Care dưới đây là phạm vi điều khiển release; `plan/chronic-care-plan.md` là nguồn chi tiết. `BE-NF-*` phía sau chỉ là capability hỗ trợ và không được ưu tiên cao hơn `BE-CC-*` P0.

| ID | Feature | Ưu tiên | Phụ thuộc | Done khi |
|---|---|---:|---|---|
| BE-CC-001 | Care Program + Enrollment + consent | P0 | Identity, Doctor capability | State/version/authorization E2E pass |
| BE-CC-002 | Monitoring schedule/tasks | P0 | BE-CC-001, Health | Timezone/idempotent generation pass |
| BE-CC-003 | Versioned rule engine/evaluation | P0 | BE-CC-001, Health | Boundary/repeat/missing-data tests pass |
| BE-CC-004 | Care Alert lifecycle | P0 | BE-CC-003, Outbox | Dedupe/audit/retry tests pass |
| BE-CC-005 | Doctor Priority Inbox | P0 | BE-CC-004 | Auth/pagination/sort/query-plan pass |
| BE-CC-006 | Deterministic report + SummaryInput snapshot | P0 | BE-CC-002/004 | Normalize/aggregate/timezone/provenance pass |
| BE-CC-007 | AI narrative + output guard/fallback | P0 | BE-CC-006, AI/RAG | Schema/grounding/safety/privacy/evaluation pass |
| BE-CC-008 | Consultation link/follow-up | P0 | BE-CC-004, NF-2/NF-3 slice | Critical journey E2E pass |
| BE-CC-009 | Product/clinic metrics | P0 | BE-CC-001..008 | Bounded KPI queries verified |
| BE-CC-010 | Medication adherence | P1 | BE-CC-001/002 | Reminder/log/privacy tests pass |
| BE-CC-011 | Diabetes Program | P0 | BE-CC-001..007 | E2E pass, shared engine |
| BE-CC-012 | Free/Plus/Care entitlement | P0 | Plans/Subscriptions, AI quota | Enforcement/downgrade/safety tests pass |
| BE-CC-013 | Consultation usage/reservation ledger | P0 | BE-CC-012, Consultation | Limit/count/reserve/release/race pass |
| BE-CC-014 | Baseline/check-in schema engine | P0 | BE-CC-001 | Validation/version/privacy tests pass |
| BE-CC-015 | Program Builder Lite + simulation | P1 | BE-CC-001/003/014 | Draft/preview/publish/audit pass |
| BE-CC-016 | Education journey/content progress | P1 | BE-CC-001, AI/RAG | Approved-content/auth/progress pass |
| BE-CC-017 | Người thân đồng hành | P1 | BE-CC-001/002, Notification | Invite/consent/revoke/privacy/dedupe pass |
| BE-CC-018 | Tìm cơ sở y tế | P1 | Care Program, Admin, location | Verified directory/map/ranking/privacy pass |

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
| BE-NF-050 | VNPAY payment/subscription/outbox grant | P0 | BE-RF-030, BE-RF-061 | Signature/IPN/grant/reconcile idempotency pass |
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
9. Care Program/Enrollment/Task/Alert/Report/Summary DTO và reason-code catalog; AI facts, narrative và validation status phải phân biệt rõ.
10. Entitlement response trả riêng AI quota, consultation limit/usage/reservation và quyền Doctor review; frontend không tự suy ra từ tên tier.
11. Nếu P1 bật, contract cho contact consent/revoke và facility result source/reason/distance; không trả raw location history.

Frontend repository chịu trách nhiệm:

- Generate API client và query hooks.
- State management/cache invalidation.
- Web/Admin/Mobile pages và components.
- UI loading/error/empty/offline/reconnect.
- Browser/mobile E2E.

Điều kiện phối hợp duy nhất chặn xóa legacy backend: frontend xác nhận không còn gọi legacy endpoint/event. Đây không phải công việc implement frontend trong plan này.

## 13. Lịch thực hiện backend đến 31/12

Phần refactor RF-0 đến RF-13 được giữ nguyên và đã hoàn tất theo evidence trong Part A. Lịch dưới đây là lịch sản phẩm thống nhất từ 01/09 đến 31/12; `BE-CC-*` điều khiển release, còn `BE-NF-*` chỉ được lấy theo dependency của từng lát Chronic Care.

| Thời gian | Nhóm việc | Kết quả bắt buộc |
|---|---|---|
| 01/09-14/09 | Khảo sát và nền tảng | Audit DA1, chốt overview/business rules, luồng nghiệp vụ, dữ liệu/API; chuẩn bị và thực hiện các gate refactor nền tảng. |
| 15/09-28/09 | Refactor hoàn tất + Care Program foundation | RF-0..RF-13 có evidence; Program Template/version, Doctor assignment, consent, baseline/check-in, monitoring task và Program tăng huyết áp. |
| 29/09-12/10 | Rule, alert và reminder | Versioned rule engine, Care Evaluation, Care Alert, outbox/reminder, audit, boundary/repeat/missing-data tests. |
| 13/10-26/10 | Doctor workflow và consultation link | Priority Inbox, deterministic report 7/30 ngày, authorization, scheduled/on-demand slice, follow-up và queue/check-in cần thiết. |
| 27/10-09/11 | Diabetes và AI summary | Program tiểu đường dùng chung engine; MetricNormalizer, report aggregator, SummaryInput snapshot, structured AI output, guard, RAG citation, fallback và evaluation dataset. |
| 10/11-23/11 | Subscription, consultation limit và VNPAY | Free/Plus/Care entitlement, AI quota, consultation reservation ledger, VNPAY Sandbox payment/cancel, outbox grant và reconciliation; không dùng Saga framework. |
| 24/11-07/12 | Tích hợp và bằng chứng | KPI, contract, E2E, concurrency, performance, security, migration/reconciliation và demo data. Chỉ khi P0 ổn định mới lấy P1 theo thứ tự: tìm cơ sở y tế, Người thân đồng hành. |
| 08/12-13/12 | Đóng băng tính năng và kiểm thử người dùng | Chỉ hoàn thiện P0/P1 đã nhận, sửa lỗi ưu tiên cao, chốt báo cáo và contract. |
| 14/12-23/12 | Bản ứng viên phát hành | Full regression, load/security, backup/restore, demo rehearsal và tài liệu bàn giao. |
| 24/12-31/12 | Dự phòng | Chỉ blocker, security và lỗi demo; không thêm feature. |

Quy tắc cut-line:

- Feature freeze tuyệt đối từ 08/12.
- Không nhận toàn bộ OAuth + refund + moderation + WebRTC cùng lúc.
- VNPAY Sandbox payment/subscription và cancel unpaid order là P0 theo overview hiện tại; full refund vẫn P1.
- Nếu payment được giữ, refund chỉ làm khi payment basic pass trước 29/11.
- FCM và campaign không được làm chậm in-app notification/reminder P0.
- P1 tìm cơ sở y tế/Người thân đồng hành chỉ được nhận khi hai Program, alert, report/AI fallback, entitlement và payment đã qua critical E2E.

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
| Bounded-context module consolidation và orphan cleanup                  |        8-14 |
| **Tổng RF thô nếu làm cả cache P1**                                     |  **78-118** |

Cache là P1 có thể cắt mà không ảnh hưởng tính đúng đắn. Nếu bỏ cache khỏi deadline, tổng RF thô là **76-114 person-days**; vẫn giữ Redis vì OTP, throttling phân tán, presence, quota và BullMQ cần Redis.

### 14.2 Chronic Care và thương mại hóa

| Feature | Person-days | Cut-line |
|---|---:|---|
| Care Program/Enrollment/baseline | 8-12 | P0 |
| Monitoring task/reminder | 6-9 | P0 |
| Rule Evaluation/Care Alert | 8-12 | P0 |
| Priority Inbox + deterministic report | 6-9 | P0 |
| AI SummaryInput/generator/guard/fallback/evaluation | 7-11 | P0 |
| Diabetes Program trên engine chung | 4-6 | P0 |
| Free/Plus/Care + consultation ledger | 6-9 | P0 |
| VNPAY payment/cancel/outbox grant/reconciliation | 10-15 | P0 |
| Product/clinic metrics + release evidence | 4-6 | P0 |
| Tìm cơ sở y tế cơ bản | 4-7 | P1 |
| Người thân đồng hành cơ bản | 5-8 | P1 |

Các ước lượng này giả định tái sử dụng refactor foundation và capability NF hiện có; không cộng lại cùng một phần việc ở hai bảng.

### 14.3 Feature hỗ trợ kế thừa

| Feature                                   | Person-days | Cut-line       |
| ----------------------------------------- | ----------: | -------------- |
| OAuth                                     |         3-5 | P1             |
| Slot + scheduled                          |       12-17 | P0             |
| On-demand v2 + check-in + queue + no-show |       10-15 | P0             |
| Reminder                                  |         3-5 | P0             |
| FCM                                       |         3-5 | P1             |
| Campaign                                  |         3-5 | P2             |
| AI quota                                  |         4-6 | P0             |
| Payment + cancel                          |       10-15 | P0, đã tính ở 14.2 |
| Full refund                               |         6-9 | P1             |
| Manual moderation                         |         5-8 | P1             |
| AI moderation draft                       |         2-4 | P2             |
| WebRTC/TURN backend                       |         4-7 | P1             |

Với hai thành viên học tập song song, không nhận toàn bộ NF cũ. Committed scope là RF đã hoàn tất + `BE-CC-*` P0; chỉ lấy lát Slot/Scheduled, Queue, Reminder và AI quota thật sự cần cho Chronic Care. Payment/cancel là P0 theo overview; refund, OAuth, moderation mở rộng và WebRTC production-grade không được làm chậm Care Program, alert, AI fallback hoặc entitlement.

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
- Care Program publish/version, Doctor assignment, consent và enrollment transition.
- Monitoring task timezone/idempotent generation/completion/adherence.
- Rule boundary/repeated attention/missing data/urgent safety template.
- Care Alert dedupe/acknowledge/resolve và Priority Inbox authorization/sort/pagination.
- Deterministic report normalization/aggregation/source change/provenance.
- AI SummaryInput snapshot, numerical grounding, unsupported claim, safety guard, Patient/Doctor policy, provider failure và deterministic fallback.
- Hypertension và diabetes chạy chung Program engine nhưng giữ rule/content version riêng.
- Old on-demand request compatibility.
- Scheduled double booking.
- Check-in/call-next/no-show races.
- Scheduled/on-demand shared-queue priority, overtime, heartbeat interruption/resume và one-active-session race.
- Message room authorization/idempotency.
- Review unique/rating transaction.
- Outbox crash/retry/dead job.
- AI quota reserve/commit/release.
- Consultation limit reserve/count/release và cycle/add-on race.
- VNPAY signature/duplicate-IPN/cancel race/outbox grant/reconciliation.
- Refund unknown/reconcile nếu refund bật.
- Người thân invite/consent/revoke/dedupe và location/facility source/ranking/privacy nếu P1 bật.
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
6. Load test riêng cho message history, doctor search, health history/statistics, Care task list, Doctor Priority Inbox, consultation list/queue, facility search và notification history.
7. AI evaluation không assert văn phong cố định; kiểm tra schema, facts/numbers có nguồn, forbidden medical claims, fallback và latency/token budget trên dataset version hóa.

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
- SummaryInput/AI log chỉ chứa ID/hash/metadata allowlist; không log prompt chứa raw HealthMetrics. Provider chỉ nhận snapshot tối thiểu theo policy và authorization.
- Room authorization luôn kiểm tra participant phía server.
- Payment/refund verify signature và idempotency server-side.
- Vị trí chính xác dùng cho facility search chỉ được lấy khi Patient chủ động cho phép và không lưu lịch sử mặc định.
- Tài khoản Patient của người thân không kế thừa quyền xem dữ liệu của Patient được hỗ trợ; phạm vi quyền và việc thu hồi được kiểm tra tại mọi query/notification.
- Dùng một `AuditLogs` chung, phân vùng logic bằng `domain` và truy vấn theo `entityType/entityId`; `expiresAt` cho phép retention khác nhau mà không cần nhiều collection.
- Ghi nhật ký cho hành động quản trị, duyệt bác sĩ, khóa/mở khóa, thay đổi gói, thanh toán/hoàn tiền, publish Program/rule, sửa chỉ số, patient-specific override, summary review, xác minh cơ sở và quyền người thân.
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
  - AI summary generated/fallback/failed, schema/grounding/safety rejection và evaluation pass rate;
  - monitoring task completion, alert acknowledgment/follow-up, nhưng không gắn nhãn outcome lâm sàng;
  - payment invalid/duplicate IPN;
  - payment paid-without-grant, processing age và reconciliation result;
  - refund pending/manual-review nếu bật.
- Theo dõi Mongo slow query, operation/route, documents examined/returned, pool wait và query timeout; không log filter chứa dữ liệu sức khỏe nhạy cảm.
- Dashboard p95/p99 cho các query ID P0 và cảnh báo khi pagination endpoint trả vượt hard cap.
- Alert staging/demo cho worker dead jobs, outbox backlog, payment mismatch và migration version mismatch.
- Có reconciliation commands cho rating, outbox, monitoring tasks, Care summary source drift, AI usage và payment/subscription/refund.

## 18. Feature flags và rollback

```text
CONSULTATIONS_V2_ENABLED
SCHEDULED_BOOKING_ENABLED
ON_DEMAND_QUEUE_ENABLED
OUTBOX_DELIVERY_ENABLED
CARE_PROGRAM_ENABLED
CARE_RULE_EVALUATION_ENABLED
CARE_AI_SUMMARY_ENABLED
CARE_AI_SUMMARY_PROVIDER_ENABLED
CARE_SUPPORT_CONTACT_ENABLED
HEALTHCARE_FACILITY_SEARCH_ENABLED
EXTERNAL_MAP_FALLBACK_ENABLED
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
- Tắt AI provider vẫn phải trả deterministic report/fallback; không tắt rule evaluation hoặc safety alert.
- Tắt external map fallback vẫn giữ facility directory nội bộ; tắt P1 contact/facility không ảnh hưởng Care Program P0.
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
| Hợp nhất module tạo god bounded context mới            | Cao        | Một public module nhưng tách capability/use case; facade không chứa toàn bộ business logic   |
| Xóa nhầm module dùng qua Nest dynamic DI/worker        | Cao        | Runtime consumer graph, bootstrap API/worker và deletion gate RF-11D                         |
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
| Scope payment/refund quá lớn                           | Cao        | Payment/cancel/outbox grant P0 có state machine; không Saga framework; refund P1 gate 29/11   |
| WebRTC thất bại qua NAT                                | Trung bình | TURN spike; backend-only scope; P1                                                           |
| AI quota/cost                                          | Trung bình | Redis reserve + daily reconciliation                                                         |
| AI tóm tắt sai số hoặc thêm dữ kiện                    | Cao        | Backend tính số; SummaryInput snapshot; schema/numerical grounding/safety guard; fallback     |
| AI làm thay đổi severity/chẩn đoán                     | Cao        | Rule engine là nguồn duy nhất; forbidden-claim tests; provider kill switch không tắt safety   |
| Rule/ngưỡng thiếu nguồn hoặc đổi lịch sử               | Cao        | Admin publish, version bất biến, simulation/evidence/audit và enrollment snapshot             |
| Task/reminder gửi sai giờ hoặc gửi lặp                 | Cao        | Timezone snapshot, rolling window, idempotency, quiet hours/frequency cap                      |
| Payment đã thu nhưng chưa cấp quyền                    | Cao        | Transactional outbox, idempotent grant worker, paid-without-grant metric và reconciliation    |
| Dữ liệu cơ sở y tế lỗi thời/quảng cáo ảnh hưởng xếp hạng | Trung bình | Verified source/date, deterministic rank, source label; không trả phí để đổi clinical order   |
| P1 người thân/cơ sở y tế làm trễ P0                    | Cao        | Chỉ nhận sau critical E2E; feature flag; thứ tự facility rồi contact; cut tại feature freeze  |
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
  - Care Program/rule versioning và Doctor assignment;
  - AI SummaryInput/structured output/guard/fallback boundary;
  - OAuth/session rotation;
  - VNPAY state machine/outbox/reconciliation và quyết định chưa dùng Saga;
  - Facility directory/external map data policy nếu P1 bật.
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
10. [x] Refactor Identity/Doctor và query của chúng (`BE-RF-030` đến `BE-RF-032`) — 2026-09-17.
11. [x] Chuyển old request flow, Message/Review/Realtime và tối ưu query (`BE-RF-040` đến `BE-RF-044`) — core done 2026-09-18; follow-up exit gates được ghi ở RF-7.
12. [x] Refactor Health/AI cùng query aggregation/search (`BE-RF-050` đến `BE-RF-052`) — implementation/migration/cutover complete 2026-09-18; staging performance evidence là release gate vận hành.
13. [x] Refactor Notification/Outbox cùng cursor/bounded claims (`BE-RF-060` đến `BE-RF-062`) — 2026-09-19.
14. [x] Triển khai cache-aside có chọn lọc (`BE-RF-063`) sau query baseline — 2026-09-17; không cache state nhạy cảm.
15. [ ] Chỉ sau các gate tương ứng mới nhận `BE-NF-010` trở đi.
16. [ ] Không tạo task Web/Admin/Mobile trong repository hoặc board backend.
17. [x] Hoàn thành RF-11 (`BE-RF-080` đến `BE-RF-086`) ngày `2026-09-21`; bounded-context topology, ownership, cleanup, boundary và contract exit gate đều pass.
18. [x] Hoàn thành RF-12 (`BE-RF-090` đến `BE-RF-093`) ngày `2026-09-21`: public API, cross-context enforcement và AI/Health service decomposition; staging evidence RF-9/RF-10 vẫn là release gate riêng.
19. [x] Hoàn thành RF-13 (`BE-RF-094` đến `BE-RF-095`) ngày `2026-09-21`: chuẩn hóa Doctor/Patient capability, xóa patient CRUD trùng và chốt `/patients/me`.
20. [ ] Chốt schema/migration/API cho `BE-CC-001`, `BE-CC-002`, `BE-CC-014`; seed Program tăng huyết áp và consent/Doctor assignment scenario.
21. [ ] Chốt rule source/version/simulation và test matrix normal/attention/urgent/missing/repeated trước `BE-CC-003`.
22. [ ] Chốt `SummaryInputSnapshot`, phép tổng hợp, structured output, output guard, fallback và evaluation dataset trước khi nối AI provider (`BE-CC-006/007`).
23. [ ] Tạo VNPAY state machine/outbox grant/reconciliation design; không thêm Saga framework (`BE-NF-050/051`, CC-7).
24. [ ] Chỉ tạo task P1 facility/contact sau khi critical E2E của hai Program, alert, report/AI fallback, entitlement và payment xanh.

## 23. Tóm tắt quyết định

1. Chỉ backend được thực hiện theo tài liệu này; frontend nằm ở repository và kế hoạch khác.
2. Refactor và feature mới nằm ở hai phần riêng, có ID và Definition of Done riêng.
3. Luồng request/accept/decline/chat cũ được giữ và refactor thành Consultation `on_demand`.
4. Slot, scheduled booking, check-in, queue và no-show là feature mới.
5. Mongoose tiếp tục là ODM; database mới được dựng bằng migration versioned.
6. Redis + BullMQ + Outbox được dùng; Kafka chưa cần.
7. Notification worker foundation là refactor; reminder/FCM/campaign là feature mới.
8. AI/RAG consolidation là refactor; AI quota và Chronic Care summary pipeline là feature mới.
9. AI không tự đọc dữ liệu thô để tính toán: backend chuẩn hóa/tổng hợp/rule evaluation, LLM chỉ diễn đạt SummaryInput snapshot qua structured output, guard và fallback.
10. Payment/cancel/refund đều là feature mới; payment/cancel là P0, refund là P1 có gate.
11. VNPAY dùng state machine, Mongo transaction, transactional outbox, idempotent grant worker và reconciliation; không cần Saga framework trong modular monolith DA2.
12. Backend bàn giao OpenAPI, realtime schemas và `fe-integration.md`; không implement frontend.
13. Feature freeze ngày 08/12; 24/12-31/12 chỉ dành cho buffer và blocker.
14. Deadline 31/12 chỉ khả thi khi giữ `BE-CC-*` P0 và không nhận đồng thời toàn bộ OAuth, refund, moderation và WebRTC.
15. P1 ưu tiên sau P0 là tìm cơ sở y tế cơ bản rồi Người thân đồng hành; cả hai phải có feature flag và không làm chậm release.
16. Service dài/rải rác được refactor theo capability và ownership; không dùng LOC làm tiêu chí tách máy móc.
17. Mọi list/history query phải bounded, có pagination chuẩn, projection, sort allowlist và index được xác minh bằng query catalog/explain.
18. Giữ Swagger, Passport/JWT và ValidationPipe hiện có; chuẩn hóa thay vì thay framework.
19. Thêm P0: Helmet, Throttler, Redis/ioredis, BullMQ và Terminus; dùng structured JSON logging/correlation ID không cần package mới ở vòng đầu.
20. Cache manager là P1, chỉ dùng cache-aside có chọn lọc sau tối ưu query; không cache state nhạy cảm của auth, booking/queue, health, payment/refund hoặc AI quota.
21. Dev tools/APM/OAuth strategy chỉ thêm khi có use case và owner rõ; Kafka, CQRS package, Saga framework, Elasticsearch, Prisma và GraphQL không thuộc scope deadline này.
22. Module được hợp nhất theo bounded context và ownership, không theo collection; một public module vẫn phải chia capability/use case và không được trở thành god service.
23. Module/provider/schema chỉ bị xóa sau khi qua consumer, DI, data-retention, contract và regression gates; migration lịch sử không bị sửa hoặc xóa theo source module.
