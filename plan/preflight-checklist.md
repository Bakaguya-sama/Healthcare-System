# Backend Refactor Preflight — Decision Checklist

> Mục đích: chốt các lựa chọn cần thiết trước khi bắt đầu `BE-RF-001` trong `plan/refactor-plan.md`.
>
> Deadline hiện tại: **31/12/2026**. Feature freeze đề xuất: **14/12/2026**.

## 1. Cách sử dụng

1. Mỗi nhóm có nhãn **Chọn một** chỉ được đánh dấu `[x]` đúng một phương án.
2. Mục có nhãn **Có thể chọn nhiều** được đánh dấu tất cả phương án cần thiết.
3. Phương án **Khuyến nghị** là mặc định an toàn theo deadline, nhưng vẫn cần người phụ trách xác nhận.
4. Điền đầy đủ phần owner, ngày quyết định và ghi chú đối với lựa chọn làm thay đổi P0.
5. Không bắt đầu `BE-RF-002` hoặc thay cấu trúc source trước khi tất cả mục **BLOCKER** ở phần 15 hoàn tất.

Trạng thái tài liệu — **Chọn một**:

- [ ] `DRAFT` — đang lựa chọn, chưa được dùng làm căn cứ triển khai.
- [x] `APPROVED` — đã chốt, mọi thay đổi tiếp theo phải ghi vào Decision Log.

Thông tin phê duyệt:

| Thuộc tính                   | Giá trị                                             |
| ---------------------------- | --------------------------------------------------- |
| Người chốt scope             | Huy                                                 |
| Người chốt kiến trúc/backend | Huy                                                 |
| Ngày chốt                    | `2026-09-15`                                        |
| Deadline                     | `2026-12-31`                                        |
| Link board/issues            | N/A — dùng backlog ID trong `plan/refactor-plan.md` |

---

## 2. Scope sản phẩm đến deadline

### 2.1 Phạm vi repository — Đã chốt

- [x] Chỉ triển khai backend trong repository này.
- [x] Frontend được triển khai ở repository khác.
- [x] Backend bàn giao OpenAPI, realtime event schemas và `docs/fe-integration.md`.

### 2.2 Gói phạm vi — Chọn một

- [x] **Core P0 — Khuyến nghị:** refactor bắt buộc + Consultation on-demand cũ + Slot/Scheduled + Check-in/Queue/No-show + Reminder + AI quota.
- [ ] **Core + Payment:** toàn bộ Core P0 và payment/cancel; refund vẫn P1.
- [ ] **Mở rộng:** Core + Payment + OAuth + Refund + FCM + WebRTC. Phương án này có rủi ro cao không kịp deadline.

Lý do chọn: _Ưu tiên hoàn tất luồng tư vấn, đặt lịch và hàng đợi trước các tích hợp mở rộng._

### 2.3 Payment — Chọn một

- [ ] Payment/cancel là P0 vì bắt buộc trong đề cương hoặc demo.
- [x] **Payment/cancel là P1 — Khuyến nghị nếu demo không bắt buộc.**
- [ ] Loại payment hoàn toàn khỏi release 31/12.

Điều kiện để đưa Payment lên P0: _Đính kèm yêu cầu đề cương/demo xác nhận payment là bắt buộc._

### 2.4 Refund — Chọn một

- [x] **P1 có gate — Khuyến nghị:** chỉ làm sau khi payment sandbox, IPN và reconciliation pass trước `2026-11-29`.
- [ ] Chỉ hỗ trợ cancel trước thanh toán; chưa hỗ trợ refund sau thanh toán.
- [ ] Full refund là P0. Phải cắt một feature P0 khác và ghi rõ ở Decision Log.

### 2.5 OAuth — Chọn một

- [x] **P1 — Khuyến nghị:** hoàn thiện local auth/session rotation trước; sau đó mới thêm một provider OAuth.
- [ ] OAuth là P0 và provider đã chốt ở dưới.
- [ ] Không làm OAuth trong release này.

Provider nếu bật — Chọn một:

- [x] Google.
- [ ] Facebook.
- [ ] Apple.

### 2.6 Những feature mặc định không thuộc P0

- [x] FCM push notification: P1.
- [x] Notification campaign: P2.
- [x] AI moderation draft: P2.
- [x] WebRTC/TURN mở rộng: P1.
- [x] Caching: P1 và chỉ làm khi có query baseline chứng minh cần.

---

## 3. Database và dữ liệu

### 3.1 Database đích — Đã chốt

- [x] MongoDB + Mongoose.
- [x] Tạo database mới hoàn toàn.
- [x] Database schema/index/validator được quản lý bằng versioned migration files.
- [x] Không dùng Prisma/TypeORM.
- [x] Không dùng `autoIndex`, `syncIndexes()` hoặc thao tác Mongo shell thủ công làm cơ chế deploy staging/demo.

### 3.2 Xử lý database cũ — Chọn một

- [x] **Giữ read-only để đối chiếu — Khuyến nghị.** Backend v2 dùng database mới; không dual-write.
- [ ] Import một phần dữ liệu demo đã ẩn danh vào database mới.
- [ ] Viết migration toàn bộ dữ liệu thật từ database cũ. Phương án này phải có reconciliation và rehearsal riêng.

Thông tin cần điền:

| Môi trường        | Database/cluster                                                                  | Owner      | Đã backup? |
| ----------------- | --------------------------------------------------------------------------------- | ---------- | ---------- |
| Legacy            | `UITHealthCare` legacy cluster; URI chỉ lưu trong secret store/biến `MONGODB_URI` | Khang      | [x]        |
| Local development | _Điền tên_                                                                        | _Điền tên_ | N/A        |
| Automated test    | _Điền tên_                                                                        | _Điền tên_ | N/A        |
| Staging/demo      | _Điền tên_                                                                        | _Điền tên_ | [ ]        |

### 3.3 Dữ liệu test — Có thể chọn nhiều

- [ ] Có reference seed idempotent.
- [ ] Có demo seed idempotent.
- [ ] Có representative performance dataset.
- [ ] Không dùng raw health data, email, phone hoặc token thật trong seed/fixture.
- [ ] Có script verify collection validators và indexes.
- [ ] Local/CI MongoDB chạy replica set để test transaction.

---

## 4. Git và bảo toàn baseline

### 4.1 Baseline — BLOCKER

- [x] Commit riêng tài liệu đã chốt: overview, DB v7, business rules, FE integration và plan.
- [x] Working tree không còn thay đổi không rõ owner.
- [x] Tạo baseline tag cho phiên bản backend cũ.
- [x] Ghi commit SHA baseline vào bảng dưới.
- [x] Không thực hiện refactor trực tiếp trên nhánh demo/release đang ổn định.

| Thuộc tính          | Giá trị                                    |
| ------------------- | ------------------------------------------ |
| Baseline commit SHA | `030b3e001737f79275cd93192f65b40bc1c65df3` |
| Baseline tag        | `backend-legacy-baseline`                  |
| Integration branch  | `huy/refactor`                             |
| Release branch      | `huy/release`                              |

### 4.2 Cách chia PR — Chọn một

- [x] **Vertical/capability slice — Khuyến nghị:** schema/repository/use case/API/test của một phần nhỏ đi cùng nhau.
- [ ] Chia hoàn toàn theo technical layer. Không khuyến nghị vì tạo nhiều PR dở dang phụ thuộc nhau.
- [ ] Big-bang rewrite rồi merge một lần. Không chấp nhận cho dự án này.

---

## 5. Runtime và package management

### 5.1 Runtime baseline — BLOCKER

| Thành phần     | Version đã chốt | Cách khóa version                                                           |
| -------------- | --------------- | --------------------------------------------------------------------------- |
| Node.js        | `24.9.0`        | `.nvmrc` và root `package.json#engines`                                     |
| pnpm           | `9.0.0`         | `packageManager` trong root `package.json`                                  |
| NestJS         | `11.1.16`       | Version resolved hiện tại trong `pnpm-lock.yaml`; không upgrade ở preflight |
| MongoDB Driver | `7.1.0`         | Version resolved hiện tại trong `pnpm-lock.yaml`                            |
| MongoDB Server | `8.0.30`        | Docker image `mongo:8.0.30`; Atlas dùng major release `8.0`                 |
| Mongoose       | `9.3.0`         | Version resolved hiện tại trong `pnpm-lock.yaml`                            |
| Redis Server   | `8.2.9`         | Docker image `redis:8.2.9`; nhánh Extended Support `8.2`                    |
| TypeScript     | `5.9.3`         | Version resolved hiện tại trong `pnpm-lock.yaml`                            |

Version policy:

- Dependency cũ dùng đúng version resolved trong lockfile để không trộn nâng cấp dependency vào refactor.
- Node dùng đúng runtime đã chạy project trên máy hiện tại; `.nvmrc` và `engines` ngăn môi trường nhóm lệch major/minor.
- MongoDB chọn major release `8.0` có vòng đời hỗ trợ dài và khóa patch hiện tại `8.0.30`; không dùng floating tag `latest`.
- Redis chọn `8.2.9` thuộc nhánh Extended Support `8.2`; không dùng floating tag `latest` hoặc nhánh Standard có chu kỳ nâng cấp ngắn hơn.
- Khi có security patch mới trong cùng release line, nâng patch bằng PR riêng, chạy lại integration/transaction/queue tests và cập nhật bảng này.

Lựa chọn package manager — Chọn một:

- [x] **pnpm — Khuyến nghị và phù hợp monorepo hiện tại.**
- [ ] npm.
- [ ] yarn.

- [x] Clean install từ lockfile thành công ngày `2026-09-15`.
- [x] Ghi lại lỗi lint/typecheck/build/test hiện tại mà chưa sửa trong `docs/current-state/baseline-commands.md`; lint legacy có `--fix` nên được ghi nhận nhưng không chạy ở RF-0.

---

## 6. Local development và CI

### 6.1 Hạ tầng local — Chọn một

- [x] **Docker Compose: MongoDB replica set + Redis — Khuyến nghị.**
- [ ] Dùng MongoDB Atlas development + managed Redis development.
- [ ] Dùng MongoDB local không replica set. Không chấp nhận nếu cần transaction tests.

### 6.2 Các command bắt buộc — BLOCKER

- [x] `lint`.
- [x] `typecheck`.
- [x] `build`.
- [x] `test:unit`.
- [x] `test:integration`.
- [x] `test:e2e`.
- [ ] `db:migrate`.
- [ ] `db:verify`.
- [ ] `openapi:generate`.

Chính sách CI — Chọn một:

- [x] **Fail-fast — Khuyến nghị:** lint, typecheck, build và critical tests không có `continue-on-error`.
- [ ] CI chỉ cảnh báo trong giai đoạn refactor. Không khuyến nghị vì không tạo baseline đáng tin cậy.

---

## 7. Environment và secrets

### 7.1 Quản lý cấu hình — BLOCKER

- [x] Có `.env.example` chỉ chứa tên biến và giá trị giả an toàn.
- [x] Không commit `.env` hoặc credential thật; tracked-files scan ngày `2026-09-15` không phát hiện credential pattern.
- [x] Đã tìm JWT, MongoDB, Redis, email, Cloudinary, AI và payment secrets bị lộ trong Git history.
- [x] Đã rotate mọi secret từng bị commit hoặc chia sẻ không an toàn — owner xác nhận ngày `2026-09-15`.
- [x] Chốt danh sách biến bắt buộc hiện tại trong `apps/api/.env.example`; biến feature mới bổ sung cùng phase tương ứng.
- [ ] Production/staging không dùng default secret fallback.

Environment validation — Chọn một:

- [x] **Custom `validate()` với `class-validator`/`class-transformer` hiện có — Khuyến nghị.**
- [ ] Joi.
- [ ] Zod.

Không thêm Joi/Zod nếu chỉ dùng để lặp lại khả năng validation đã có.

---

## 8. API và realtime baseline

### 8.1 Contract hiện tại — BLOCKER

- [x] Inventory toàn bộ 173 REST operations/121 paths trong `docs/current-state/endpoints.md` và OpenAPI baseline.
- [x] Inventory 4 Socket namespaces cùng event/success/error payload trong `docs/current-state/realtime-events.md`.
- [x] Lưu source-derived OpenAPI snapshot; runtime snapshot được ghi rõ là blocked vì API chưa compile.
- [x] Lưu Postman request collection gồm 173 requests.
- [x] Ghi lại HTTP status/error envelope theo source; runtime verification chuyển sang RF-1 sau khi bootstrap được.
- [x] Đánh dấu Web Client/Admin consumer; repository không có Mobile source để xác minh.
- [x] Ghi rõ disposition cho toàn bộ module legacy trong `docs/current-state/module-disposition.md`.

### 8.2 Swagger/OpenAPI — Chọn một

- [x] **Giữ `@nestjs/swagger` hiện có — Khuyến nghị.** Bổ sung schema, operation ID, auth, pagination và CI artifact.
- [ ] Thay bằng công cụ tài liệu API khác. Phải có ADR và lợi ích đo được.

Swagger UI theo môi trường — Chọn một:

- [x] **Chỉ bật local/staging — Khuyến nghị.**
- [ ] Bật production nhưng có authentication/network restriction.
- [ ] Public Swagger UI ở production. Không khuyến nghị.

---

## 9. Authentication và authorization

### 9.1 Auth framework — Đã chốt

- [x] Giữ Passport + JWT cho HTTP authentication.
- [x] Gom `JwtModule`, `JwtStrategy`, verifier và guard về Identity-Access.
- [x] Socket dùng token verifier/policy chung, không tái sử dụng máy móc HTTP guard.
- [x] Refresh token chỉ lưu dạng hash trong AuthSessions.
- [x] OTP lưu hash + attempts + TTL trong Redis.

Guard policy — Chọn một:

- [x] **Global JWT guard + `@Public()` allowlist — Khuyến nghị nếu phần lớn endpoint là private.**
- [ ] Guard khai báo tại từng controller/route.

Authorization account status — Chọn một:

- [x] **Giữ DB check ban/status ở bước đầu — Khuyến nghị; tối ưu sau khi có session/account version cache và revoke tests.**
- [ ] Bỏ DB check để giảm query. Không chấp nhận vì ban/logout-all có thể mất hiệu lực tức thời.

---

## 10. Platform technology choices

### 10.1 Package P0 — Có thể chọn nhiều

- [x] `helmet@8.3.0` — HTTP security headers.
- [x] `@nestjs/throttler@6.5.0` — HTTP rate limiting.
- [x] `ioredis@5.11.1` — Redis client/lifecycle dùng chung.
- [x] `@nestjs/bullmq@11.0.5` + `bullmq@5.81.5` — background jobs.
- [x] `@nestjs/terminus@11.1.1` — health endpoints.

Các dấu `[x]` ở đây là lựa chọn kiến trúc, không có nghĩa package đã được cài.

Lý do không chọn major mới nhất:

- Project đang ở NestJS `11.1.16`, nên dùng `@nestjs/bullmq` và `@nestjs/terminus` major 11 thay vì major 12.
- BullMQ 6, ioredis 6 và các Nest integration major 12 mới phát hành gần thời điểm preflight; giữ maintenance line BullMQ/ioredis 5 giảm thay đổi breaking trong deadline.
- Cache là P1 nên version `@nestjs/cache-manager`, `cache-manager` và Keyv adapter chỉ được khóa khi `BE-RF-063` được nhận, dựa trên compatibility tại thời điểm đó.

Nguồn kiểm tra version ngày `2026-09-15`: Node.js release schedule, MongoDB release/versioning, Redis version management, Docker Official Images và package release pages chính thức. Không tự động nâng major theo tag `latest`.

### 10.2 Logging — Chọn một

- [x] **Nest structured JSON logger + correlation ID + `AsyncLocalStorage` — Khuyến nghị vòng đầu.**
- [ ] `nestjs-pino` ngay từ đầu. Chỉ chọn nếu cần transport/redaction/throughput chuyên biệt.

### 10.3 Throttling storage — Chọn một

- [x] **Local/test dùng memory; staging/multi-instance dùng Redis-backed storage — Khuyến nghị.**
- [ ] Memory cho mọi môi trường. Không chấp nhận khi chạy nhiều instance.

Rate-limit policy phải tách bucket cho:

- [ ] Login/refresh.
- [ ] OTP send/verify.
- [ ] AI request.
- [ ] Upload.
- [ ] Payment/IPN nếu bật.
- [ ] Consultation request.
- [ ] Socket message/signaling.

### 10.4 Caching — Chọn một

- [x] **P1, chỉ triển khai sau query catalog/explain baseline — Khuyến nghị.**
- [ ] P0 ngay từ đầu. Phải chỉ rõ query, baseline và feature P0 bị cắt để bù thời gian.
- [ ] Không dùng cache trong release này.

Nếu cache được bật — Có thể chọn nhiều:

- [ ] Doctor directory/search facets.
- [ ] Plan/subscription catalog.
- [ ] Active blacklist/moderation keywords.
- [ ] Reference/config data.

Không cache:

- [x] Slot claim, booking command và queue position/call-next.
- [x] Auth token, OTP và authorization decision dài hạn.
- [x] Payment/IPN/cancel/refund state.
- [x] AI quota mutations.
- [x] Raw/latest health data cần nhất quán.

### 10.5 Công nghệ không dùng trong deadline — Đã chốt

- [x] Không Kafka/RabbitMQ.
- [x] Không microservices split.
- [x] Không `@nestjs/cqrs` nếu chỉ để đổi tên class.
- [x] Không Elasticsearch trước khi Atlas Search/MongoDB được benchmark.
- [x] Không GraphQL.
- [x] Không generic `BaseRepository`.
- [x] Không global cache interceptor cho toàn API.

---

## 11. External services và sandbox accounts

Đánh dấu `N/A` nếu feature bị cắt khỏi release.

| Dịch vụ        | Dev/sandbox sẵn sàng? | Owner  | Secret đã lưu an toàn? | Ghi chú |
| -------------- | --------------------- | ------ | ---------------------- | ------- |
| Email/OTP      | [ ]                   | _Điền_ | [ ]                    |         |
| Cloudinary     | [ ]                   | _Điền_ | [ ]                    |         |
| Google GenAI   | [ ]                   | _Điền_ | [ ]                    |         |
| MongoDB Atlas  | [ ]                   | _Điền_ | [ ]                    |         |
| Redis          | [ ]                   | _Điền_ | [ ]                    |         |
| VNPAY          | [ ] / N/A             | _Điền_ | [ ] / N/A              |         |
| OAuth provider | [ ] / N/A             | _Điền_ | [ ] / N/A              |         |
| FCM            | [ ] / N/A             | _Điền_ | [ ] / N/A              |         |
| TURN           | [ ] / N/A             | _Điền_ | [ ] / N/A              |         |

Không để thiếu sandbox account trở thành blocker ở cuối dự án. Feature chưa có credential trước ngày bắt đầu phase tương ứng phải được hạ ưu tiên hoặc mock qua provider port.

---

## 12. Team, thời gian và ownership

### 12.1 Năng lực thực tế

| Thành viên   | Giờ/tuần đến 14/12 | Module chính | Module backup |
| ------------ | -----------------: | ------------ | ------------- |
| Thành viên 1 |             _Điền_ | _Điền_       | _Điền_        |
| Thành viên 2 |             _Điền_ | _Điền_       | _Điền_        |

- [ ] Đã trừ thời gian học, thi, báo cáo và demo khỏi capacity.
- [ ] Mỗi critical module có một owner và một reviewer/backup.
- [ ] Không tính 24/12-31/12 là thời gian phát triển feature mới.

### 12.2 Ownership đề xuất

| Area                             | Primary owner | Reviewer/backup |
| -------------------------------- | ------------- | --------------- |
| Build/CI/contracts               | _Điền_        | _Điền_          |
| Identity/Auth/Practitioner       | _Điền_        | _Điền_          |
| Consultation/Slot/Queue          | _Điền_        | _Điền_          |
| Chat/Realtime                    | _Điền_        | _Điền_          |
| Health/AI/RAG                    | _Điền_        | _Điền_          |
| Notification/Outbox/Worker       | _Điền_        | _Điền_          |
| Payment/Refund nếu bật           | _Điền_        | _Điền_          |
| Database migrations/verification | _Điền_        | _Điền_          |

---

## 13. Baseline hành vi cũ

Characterization scenarios cần ghi nhận trước khi refactor:

- [ ] Register/login/refresh/logout.
- [ ] Password reset/OTP.
- [ ] Doctor profile và approval.
- [ ] Patient gửi request tư vấn.
- [ ] Doctor accept/decline một hoặc nhiều request.
- [ ] Consultation chat authorization và message history.
- [ ] Review/rating.
- [ ] Health metric create/history/statistics.
- [ ] AI conversation/RAG happy path.
- [ ] Notification create/list/read.

Với mỗi scenario phải có ít nhất một trong các bằng chứng:

- automated characterization test;
- Postman request + expected response;
- Socket event transcript đã bỏ dữ liệu nhạy cảm;
- issue ghi rõ rằng behavior hiện tại đang lỗi và không được xem là contract cần giữ.

---

## 14. Backlog bootstrap

Tạo task theo thứ tự:

- [x] `BE-RF-001` — endpoint/event/schema/consumer inventory hoàn tất ngày `2026-09-15`.
- [x] `BE-RF-002` — build/typecheck stabilization hoàn tất ngày `2026-09-15`.
- [x] `BE-RF-003` — CI fail-fast và commands hoàn tất ngày `2026-09-15`.
- [x] `BE-RF-004` — characterization tests hoàn tất ngày `2026-09-15`.
- [x] `BE-RF-005` — service responsibility/dependency map hoàn tất ngày `2026-09-16`.
- [x] `BE-RF-006` — pagination/query/response conventions hoàn tất ngày `2026-09-16`.
- [x] `BE-RF-007` — query catalog và explain baseline (RF-2D, 2026-09-16).

Không tạo task feature mới chỉ để né blocker của các task trên. Feature có thể được viết thành backlog, nhưng không chuyển sang `In Progress` trước dependency gate trong refactor plan.

---

## 15. Go/No-Go gate

### 15.1 BLOCKER trước `BE-RF-001`

- [x] Scope Core/Payment/OAuth/Refund đã chọn đúng một phương án.
- [x] Người chốt scope và backend architecture đã được điền.
- [x] Tài liệu DB v7, business rules, overview, FE integration và refactor plan không còn mâu thuẫn đã biết — owner xác nhận ngày `2026-09-15`.
- [x] Legacy database đã backup hoặc xác nhận không có dữ liệu cần giữ — owner xác nhận ngày `2026-09-15`.
- [x] Code/tài liệu hiện tại đã commit và có baseline SHA/tag.
- [x] Không có credential thật trong tracked files/staged diff; local `.env` được ignore và chỉ lưu trên máy phát triển.
- [x] Runtime/package manager versions đã chốt.

### 15.2 BLOCKER trước `BE-RF-002`

- [x] Endpoint/event/schema/consumer inventory của `BE-RF-001` hoàn tất ngày `2026-09-15`.
- [x] Build/test failures hiện tại đã được ghi thành baseline, chưa cần tất cả pass.
- [x] Có `.env.example` và local startup instructions (`docs/local-development.md`) ngày `2026-09-15`.
- [x] MongoDB replica set và Redis local/test khởi động được bằng `compose.yaml`; integration test pass ngày `2026-09-15`.
- [x] Critical old flows có expected-behavior artifact tại `docs/current-state/legacy-behavior.md`; tests được viết ở BE-RF-004 sau khi build xanh.

### 15.3 Quyết định cuối — Chọn một

- [x] **GO:** đủ blocker, bắt đầu `BE-RF-001`.
- [ ] **NO-GO:** checklist còn ở trạng thái draft hoặc còn blocker.

Người phê duyệt: Huy

Ngày phê duyệt: `2026-09-15`

Ghi chú/cut-line cuối cùng: GO cho `BE-RF-001`; giữ Core P0, Payment/Refund/OAuth ở P1 và không mở rộng scope nếu chưa qua dependency gate.

---

## 16. Decision Log

Mọi thay đổi sau khi trạng thái là `APPROVED` phải thêm một dòng, không sửa âm thầm quyết định cũ.

| Ngày         | Decision ID | Thay đổi                          | Lý do/evidence | Ảnh hưởng scope/thời gian | Người duyệt |
| ------------ | ----------- | --------------------------------- | -------------- | ------------------------- | ----------- |
| `YYYY-MM-DD` | `PRE-001`   | _Ví dụ: đưa Payment từ P1 lên P0_ | _Yêu cầu demo_ | _Cắt OAuth và FCM_        | _Tên_       |

## 17. Thứ tự sau khi GO

```text
BE-RF-001 audit
 -> BE-RF-002 build/typecheck
 -> BE-RF-003 CI fail-fast
 -> BE-RF-004 characterization tests
 -> BE-RF-005 service map
 -> BE-RF-006 pagination/query conventions
 -> BE-RF-007 query catalog/baseline
 -> tiếp tục theo plan/refactor-plan.md
```

Không bắt đầu bằng việc đổi tên/di chuyển hàng loạt, cài toàn bộ dependency P1 hoặc xóa legacy collection. Mỗi thay đổi chỉ được thực hiện khi task owner, dependency và rollback/verification tương ứng đã rõ.
