# Evidence — E2 Family Companion (2026-11-23)

## Review bổ sung — trạng thái hiện hành

- Các đoạn evidence cũ khẳng định đã có điểm tuyến tính hóa cho read/revoke
  chỉ mô tả mục tiêu, không đủ chứng minh runtime: link, grant và subscription
  được đọc riêng và có thể bị thay đổi xen giữa. Cần atomic authorization
  snapshot và integration race test trước khi đóng gate; không có response barrier.
- Reminder dispatch trước đây không kiểm tra lại permission record gắn với
  reminder. Đã bổ sung kiểm tra record còn active và có đúng permission, tránh
  gửi reminder cũ sau khi đổi/revoke consent; nội dung in-app dùng tiếng Việt.
- Review reminder tìm thấy các thiếu sót trước thay đổi: không có quota liên
  worker theo Companion, không kiểm tra enrollment ngay trước dispatch, scan có
  thể dừng sau 200 task và FamilyReminder/outbox chưa cùng transaction. Các mục
  đó đã được sửa và được ghi evidence riêng ở phần cuối file.
- Reminder được refactor theo use case + application ports + Mongoose adapters;
  repository reminder không trả HTTP response. Điều này chỉ xác nhận ranh giới
  của reminder; repository/workflow FamilyLink và atomic authorization snapshot
  vẫn cần review riêng, không coi toàn module đã đạt DDD.
- Custom range mới yêu cầu datetime kèm `Z` hoặc timezone offset; input v1
  from/to không có period tiếp tục theo compatibility cũ.
- Evidence và kết quả mới nhất của reminder được ghi ở mục
  “Khắc phục reminder E2 — 24/11/2026” bên dưới; kết quả trước đó ở các mục
  lịch sử không thay cho lượt xác minh này.

## Kết quả kiểm tra tiếp theo — 24/11/2026

- Sau khi thêm kiểm thử không cho phép receipt `accept_invitation` của một
  `invitationVersion` được phát lại vào vòng mời kế tiếp và retry create đồng
  thời chỉ reveal artifact một lần, integration suite chạy trên Atlas test
  database PASS: 1 suite / 19 tests. Suite tự tạo database
  tổng hợp `fc_<32 hex>` và xóa database đó trong `afterAll`; không có dữ liệu
  bệnh nhân thật trong fixture.
- Integration cục bộ: 1 suite / 19 tests PASS; unit Family Companion:
  9 suites / 20 tests PASS; E2E HTTP contract: 1 suite / 2 tests PASS.
- Integration limiter riêng PASS 1/1 với hai Redis client connection độc lập;
  quota actor dùng chung và request thứ sáu bị 429. Đây là local Redis, không
  phải load test multi-host.
- `pnpm --filter api typecheck`, `build`, `openapi:check`, `realtime:check`,
  `boundary:check`, `database:verify`, migration `--expect-noop` và
  `git diff --check` PASS trong phiên này. Verifier trên DB test cấu hình
  `healthcare`: version `202611241030`, 50 collections, 126 managed indexes.
- Replay accept hiện gắn fingerprint với `invitationVersion`; khi cùng actor
  tái sử dụng key cũ cho invitation mới, request bị từ chối bằng
  `IDEMPOTENCY_KEY_CONFLICT` thay vì trả projection của vòng trước.
- Regression test đồng thời phát hiện và sửa response lệch shape khi retry
  `create`: cả response đầu và replay đều có `data.link` + `data.artifacts`;
  chỉ response đầu có raw link/QR/code, retry báo `available: false`; audit,
  outbox và FamilyLink chỉ tạo một lần.
- Transition accept đã được biểu diễn trong domain lifecycle thuần với kiểm tra
  state/actor và thời điểm; Mongo adapter giữ vai trò điều phối transaction,
  quota lock, persistence, audit và outbox. Rà soát xác nhận domain không import
  Nest/Mongoose, controller không đặt workflow, adapter trả safe projection và
  không tạo HTTP response envelope. Adapter vẫn chứa transaction orchestration
  cần thiết để commit aggregate/audit/outbox nguyên tử; đây là persistence
  boundary, không phải lý do để coi domain logic đã được dồn vào controller.
- FE types bổ sung kiểu response regenerate có nhánh artifacts reveal-once;
  hướng dẫn FE nêu rõ retry không thể lấy lại raw link/QR/code và phải tạo
  regenerate mới bằng idempotency key mới.
- Các lệnh build/contract không cần sửa OpenAPI runtime sau thay đổi mới nhất;
  OpenAPI check được chạy lại và PASS.
- Phạm vi môi trường vẫn là DB Atlas test và local worker rehearsal. Chưa có
  staging/production endpoint, credential hay quyền deploy/smoke trong phiên;
  vì vậy không có claim staging/production. E2 vẫn chưa đóng exit gate.
- Đọc metric có lần kiểm tra quyền cuối sau projection/audit; revoke commit trước
  lần kiểm tra này làm read fail-closed (đã có race integration test). Một request
  đã vượt điểm kiểm tra cuối trước khi revoke commit được xếp trước revoke dù
  socket có thể flush sau. Nếu yêu cầu sản phẩm là không có byte nào được giao
  sau khi revoke response thành công, cần một distributed response barrier để
  revoke đợi các response đang bay kết thúc; cơ chế đó chưa triển khai và cần
  chốt thêm semantics/latency trước khi bật.
- Read-only inventory sau lượt integration cuối xác nhận còn 0 database test
  theo pattern `fc_<32 hex>` hoặc `fc_e2_runtime_YYYYMMDD` trên Atlas.
- Lệnh chạy toàn bộ integration trên Atlas không PASS: các suite ngoài E2 tạo
  tên dạng `healthcare_<suite>_<uuid>` vượt giới hạn 38 byte của MongoDB URI
  hiện tại. Lượt được dừng sau khi xác nhận đây là lỗi setup suite không thuộc
  E2; inventory sau lượt chạy không còn database test theo các pattern được
  kiểm tra. Atlas E2-focused integration 19/19 vẫn PASS độc lập.
- Targeted ESLint trên domain lifecycle, repository và integration spec trả
  0 errors / 48 warnings (chủ yếu test fixture và unsafe typing). Theo quyết
  định trước, lint không chặn exit gate; cảnh báo vẫn được ghi nhận, không che.

## Bổ sung review 2026-11-24 — phạm vi HealthMetric

E2 đang mở lại để nghiệm thu quyền chia sẻ HealthMetric. API, consent, repository,
summary/trend và outbox notification đã được nối; không sử dụng evidence cũ bên
dưới để suy ra toàn bộ phạm vi mới đã đạt gate. Health Tracking là chủ sở hữu
`MetricType` và thuật toán summary; đường đọc sharing cho phép toàn bộ lịch sử.

Review tìm thấy và đã sửa: decline invitation dạng share sau redeem; giữ consent
reminder khi pause/resume; ánh xạ `missed_task` sang permission
`missed_task_reminder` trước dispatch. Policy domain cho scope HealthMetric đã
được nối vào authorization của đường đọc sharing.

Các việc còn lại gồm mở rộng kiểm thử authorization/race/redaction và review
DDD. Repository lifecycle đã bỏ response HTTP và đưa policy actor về domain,
nhưng vẫn còn điều phối nghiệp vụ trong infrastructure; chưa khẳng định DDD
hoàn chỉnh. Short-code attempt
lock hiện chỉ tăng khi tìm thấy đúng hash nhưng artifact không hợp lệ; endpoint
redeem có throttle HTTP theo IP khi `THROTTLE_ENABLED=true`, và short-code còn
có limiter riêng theo actor ở Redis, độc lập với cờ HTTP; Redis lỗi trả 503.
Integration với Redis cấu hình trong `.env` PASS: hai adapter dùng chung counter,
lần thứ sáu trả 429; key test ngẫu nhiên đã được xóa. Cần smoke tại môi trường
deploy và tiếp tục rà soát các tấn công phân tán qua nhiều actor.

Đã nối schema/migration `202611241020`, API sharing, port summary/trend và
adapter transaction. Integration Mongo synthetic kiểm tra tạo, replay/conflict,
rollback khi outbox lỗi, race grant/revoke link và đọc/thu hồi. Migration chưa
apply trên database Atlas ứng dụng. API/worker local đã rehearsal như dưới đây;
chưa có smoke staging/production.
Unit test policy, grant, projection và Redis limiter: 4 suite/8 test PASS.
Lượt local sau đó: 10 suite/21 unit PASS, 2 suite/17 integration PASS; ca HTTP
invitation → redeem → accept → grant → trend → pause/resume → revoke PASS với
JWT/role guard và Mongo thật, billing và limiter dùng test double. Lượt suite
Family Companion mới nhất: 16/16 PASS; kiểm tra accept đồng thời chỉ tạo một
link active khi limit là 1, kiểm tra subscription hiện hành khi accept và
redeem short code đồng thời chỉ thành công một lần và regenerate vô hiệu
redemption trước đó.
Migration `202611241020` đã apply trong database synthetic mới; gọi lại hàm
migration và `verifyDatabase(..., 202611241020)` đều PASS trong integration
test. Đây không phải evidence migration trên database ứng dụng.

Rehearsal local 2026-11-24 (Asia/Ho_Chi_Minh): Mongo replica set và Redis Docker,
database synthetic `healthcare_e2_ops_20261124`; migrate + no-op + verifier PASS
version `202611241020`, 45 collections, 124 managed indexes. API `health/live`
và `health/ready` HTTP 200; worker thực tế xử lý event synthetic tạo notification
in-app một lần, và khi tắt feature flag event được giữ pending. Các record smoke
có ID sinh riêng đã được dọn; database test để lại. Đây không phải staging hay
production. Worker từng không khởi động do thiếu import FamilyCompanionModule;
đã sửa và chạy lại thành công.

Atlas cấu hình trong `.env` báo hết quota 500 collection khi tạo database test
mới. Các lần test trước đã để lại database synthetic tên `fc_<random>` trên Atlas;
chưa xóa vì cần xác định chính xác sở hữu và phạm vi. Owner cần kiểm tra quota
và dọn các database synthetic đã xác nhận hoặc cấp môi trường test riêng trước
khi dùng Atlas cho rehearsal tiếp theo. Không ghi URI/credential vào evidence.

**Không đóng E2:** cần kiểm thử race thay đổi Subscription đồng thời với accept;
idempotency/retry của mọi command invitation cũ, logic nghiệp vụ
còn nằm trong repository, coverage E2E/redaction/race đầy đủ và bằng chứng
trong môi trường deploy. Quyền đọc được kiểm tra lại trước khi trả, nhưng vẫn
còn khe hở giữa lần kiểm tra cuối và lúc HTTP response được gửi; chưa chứng minh
tính tuyến tính tuyệt đối với revoke đồng thời. Retry reminder đã được chuyển
sang đánh dấu dispatched sau tạo notification và có unit test, vẫn cần test
crash/retry thực tế. Lint toàn repository FAIL: 3 lỗi ở RAG ingestion và
719 warning; lint không là blocker theo quyết định đã chốt. Các PASS cũ dưới
đây chỉ phản ánh phạm vi/lượt chạy tương ứng.

Kiểm tra cục bộ 2026-11-24: unit policy sharing 2/2 PASS; integration
invitation 9/9 PASS dùng Mongo cấu hình trong `.env`, database `fc_<random>`
riêng và dữ liệu synthetic; HTTP controller test 2/2 PASS với use case mock
(không phải E2E toàn hệ thống). Không có test nào trong số này chứng minh API
HealthMetric sharing hoặc smoke worker/deploy. Lần thử integration mặc định
localhost thất bại do không kết nối được; lần thử Atlas đầu tiên phát hiện tên
database test quá dài, đã sửa bộ test và chạy lại thành công.

## Phạm vi và môi trường

- Repository: HealthcareApp monorepo, API package.
- Môi trường kiểm tra: MongoDB replica set và Redis local Docker (`healthcare_e2`),
  dữ liệu synthetic; không dùng production, PHI, raw payment/provider payload hoặc
  credential thật.
- Feature flag: `FAMILY_COMPANION_ENABLED=false` mặc định. Rehearsal bật cờ ở port
  local `3012`, app boot thành công và đăng ký FamilyCompanionModule/worker; process
  được dừng ngay sau kiểm tra. Đây không phải smoke production.
- Thời điểm ghi evidence: 2026-11-23 (Asia/Ho_Chi_Minh).

## Checklist exit gate

| Hạng mục                                 | Kết quả | Bằng chứng                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cập nhật contact search (2026-11-24)     | PASS    | `GET /api/v1/users/family-companion/contacts` dùng tìm gần đúng + pagination; FE chọn Patient record có ID; POST family link xác thực lại ID.                                                                                                                                                                                                                                                                                                     |
| DDD runtime organization                 | UPDATED | Mỗi command của Family Companion có use case riêng trong `application/use-cases`; controller chỉ chuyển actor, DTO và idempotency key. Use case xác thực input/policy, băm token và điều phối qua application port. `MongooseFamilyLinkRepository` đảm nhiệm transaction, persistence, audit và outbox; query nằm riêng trong `application/queries`. Không còn `application/models/family-companion.commands.ts` hay service lifecycle god-class. |
| Plan/Subscription snapshot               | PASS    | `familyLinkLimit` canonical trên Plan; snapshot dùng khi create invitation; FREE/PLUS/CARE = 1/3/5, ceiling 10                                                                                                                                                                                                                                                                                                                                    |
| Migration forward-only                   | PASS    | Lịch sử migration được giữ nguyên; migration `202611241000-e2-remove-contact-lookup` xóa collection tạm; `202611241010-e2-family-delivery-name` đổi `direct_lookup` thành `selected_contact`.                                                                                                                                                                                                                                                     |
| Migration no-op/verifier                 | PASS    | Apply migration và no-op rehearsal đều thành công; `database:verify` → version `202611241010`, 48 collections, 122 managed indexes.                                                                                                                                                                                                                                                                                                               |
| Link/QR/short code                       | PASS    | Opaque token + QR payload, code 6 số; hash-only persistence; TTL 7 ngày/15 phút; regenerate tăng version                                                                                                                                                                                                                                                                                                                                          |
| Contact search/direct invitation         | UPDATED | `GET /users/family-companion/contacts` dùng partial match/pagination, trả user record có ID để Patient chọn; `POST /family-links` nhận ID và xác thực lại Patient active + verified. Không lưu contact lookup vào collection riêng.                                                                                                                                                                                                               |
| Signup/verification/redeem               | PASS    | Redeem yêu cầu Patient active + email verified; integration lifecycle cover redeem → consent → accept                                                                                                                                                                                                                                                                                                                                             |
| Accept/reject/pause/resume/revoke/expiry | PASS    | State policy unit + integration transaction; worker-facing `expirePendingInvitations` test; terminal re-invite tái sử dụng link, tăng version                                                                                                                                                                                                                                                                                                     |
| Entitlement                              | PASS    | Integration chứng minh snapshot limit và reject over-limit; client không truyền limit                                                                                                                                                                                                                                                                                                                                                             |
| Consent/permission fail-closed           | PASS    | Allowlist chỉ `missed_task_reminder`, `weekly_progress`; permission snapshot tạo/revoke cùng transition                                                                                                                                                                                                                                                                                                                                           |
| Patient-first/grace/quiet hours          | PASS    | Missed path enqueue canonical `care.task.reminder`; contact schedule sau 60 phút, patient timezone 21:00–08:00                                                                                                                                                                                                                                                                                                                                    |
| Weekly cap/deduplication                 | PASS    | Worker job `family-weekly-progress`, unique key theo link + tuần                                                                                                                                                                                                                                                                                                                                                                                  |
| Audit/outbox transaction                 | PASS    | Create/accept/transition/permission/expiry ghi audit + outbox trong transaction; payload không raw secret/PHI                                                                                                                                                                                                                                                                                                                                     |
| Worker retry/DLQ/kill switch             | PASS    | Outbox event dùng retry/backoff hiện hữu; worker có job expiry, missed-task, weekly-progress; feature flag loại event/job family khi tắt; local boot rehearsal flag bật                                                                                                                                                                                                                                                                           |
| Redaction                                | PASS    | Integration assertion audit/outbox không chứa short code/token; projection không trả raw artifact                                                                                                                                                                                                                                                                                                                                                 |
| Unit                                     | PENDING | Existing delivery-name expectation was updated; unit suite was not rerun in this correction pass.                                                                                                                                                                                                                                                                                                                                                 |
| Integration                              | PENDING | Integration setup was changed from reference lookup to selected user ID; must rerun before claiming this revised flow passes.                                                                                                                                                                                                                                                                                                                     |
| E2E HTTP                                 | PENDING | HTTP contract test now sends `contactUserId` and calls explicit accept/reject use cases; must rerun after the contract update.                                                                                                                                                                                                                                                                                                                    |
| Typecheck/build                          | PASS    | `pnpm --filter api typecheck`; `pnpm --filter api build` (2026-11-24).                                                                                                                                                                                                                                                                                                                                                                            |
| OpenAPI                                  | PASS    | `pnpm --filter api openapi:generate` and `pnpm --filter api openapi:check` (2026-11-24); new Users search and selected-contact schema are present.                                                                                                                                                                                                                                                                                                |
| Realtime/boundary                        | NOT RUN | Not part of this contact-search correction pass.                                                                                                                                                                                                                                                                                                                                                                                                  |
| FE contract/docs                         | PASS    | `docs/fe-integration/fe-api-integration.md`, `fe-api-types.ts`, generated `apps/api/openapi/openapi.json`                                                                                                                                                                                                                                                                                                                                         |
| Diff hygiene                             | PASS    | `git diff --check`                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Redaction assertion

Evidence chỉ ghi mã định danh migration, số lượng index/collection và reason code. Không
ghi raw invitation token, short code, email/phone, PHI, notification payload, stack
trace hoặc provider secret. Artifact chỉ trả một lần từ API create/regenerate và không
được persist/log.

## Hạn chế còn lại

- Chưa có quyền smoke production/staging thật; owner phải lặp checklist trên môi
  trường deploy với secret manager và consumer frontend trước khi bật cờ rộng.
- Full-repository lint tiếp tục là debt theo quy ước các phase trước, không phải
  exit-gate blocker của E2; không thay đổi budget hoặc che giấu warning.

## Bổ sung evidence 24/11/2026

- Người thực hiện: Codex release engineering trong phiên này. Mốc giờ địa phương
  Asia/Ho_Chi_Minh; command runner: Windows PowerShell.
- Đã liệt kê Atlas database chỉ theo tên/collection metadata. Có 10 database synthetic
  mang đúng pattern `fc_` + 32 ký tự hex, là database integration suite dùng để tạo
  dữ liệu test; sau khi đối chiếu với test setup, đã xóa đúng 10 database này. Kiểm tra
  sau xóa: còn 0 database theo pattern đó.
- Atlas database test được cấu hình là `healthcare`: migration
  `202611241020-e2-family-health-metric-sharing` và
  `202611241030-e2-family-command-receipts` đã apply; rerun với `--expect-noop` không
  áp dụng migration mới; `database:verify` PASS version `202611241030`, 50 collections,
  126 managed indexes.
- Integration suite chạy trên Atlas bằng `TEST_MONGODB_URI` đã PASS: 2 suites/18 tests.
  Database `fc_<32 hex>` do suite tạo đã được kiểm tra và dọn tự động; sau khi chạy còn
  0 database theo pattern này.
- Isolated Atlas test database `fc_e2_runtime_20261124` đã migrate/no-op/verifier PASS.
  API `pnpm start` trên database này: `/api/v1/health/live` và `/api/v1/health/ready`
  đều HTTP 200. Worker `pnpm worker:outbox` trên cùng DB: khi
  `FAMILY_COMPANION_ENABLED=false`, synthetic sharing event giữ pending; khi bật cờ,
  event tạo đúng một notification in-app. Record smoke đã được dọn trong script; sau
  no-op/verifier, toàn bộ isolated database đã được xóa.
- Trong một lần chuẩn bị smoke, worker từng khởi động khoảng 4 giây với `.env` database
  `healthcare` do lệnh lấy nhầm đường dẫn env. Feature Family Companion tắt; worker đã
  dừng ngay. Kiểm tra metadata `outboxevents` trong khoảng thời gian đó cho kết quả 0
  record được cập nhật; không thấy side effect của worker.
- Sau thay đổi idempotency/race mới: unit Family Companion 9 suites/19 tests PASS;
  integration Mongo/Redis 2 suites/18 tests PASS; E2E controller/authorization 2
  suites/4 tests PASS; typecheck PASS. Integration suite đã được chạy local; lượt Atlas
  trước đó pass trước test in-flight revoke mới, vì vậy lượt Atlas mới sau thay đổi
  này vẫn cần chạy để evidence đồng nhất.
- API redeem giờ yêu cầu `Idempotency-Key`. Receipt lưu actor, operation, hash key,
  request hash và response projection tối đa 7 ngày. Artifact raw vẫn reveal-once;
  retry regenerate trả trạng thái artifact không còn khả dụng thay vì phát mã mới sai
  lệch.

**Trạng thái vẫn chưa đóng:** cần chạy lại toàn bộ integration suite mới nhất trên
Atlas sau test in-flight revoke, hoàn tất OpenAPI/build/boundary/realtime/diff checks,
đồng bộ FE types cho replay reveal-once và xác nhận khả năng deploy ở môi trường thật.
Smoke ở đây là Atlas test, không phải staging/production. Repository vẫn còn điều
phối transaction/audit/outbox trong adapter Mongoose; DDD chưa thể xem là đã review
xong cho toàn module.

## Xác nhận tiếp theo — 24/11/2026

- Chạy lại `read-family-health-metrics.spec.ts` trên local: PASS, 1 suite / 2
  tests. Chạy lại `family-companion.integration-spec.ts` trên Mongo replica-set
  Docker local (`localhost:27018`): PASS, 1 suite / 19 tests. Suite dùng database
  synthetic `fc_<32 hex>` và tự dọn khi kết thúc. Có thêm xác nhận HTTP trend
  rỗng trả `200 { items: [], nextCursor: null }`; authorization suite cũng kiểm
  tra grant thiếu, metric ngoài scope, pause, revoke và read đang chờ projection.
- Đã chọn semantics tuyến tính hóa tại lần kiểm tra authorization cuối; không
  dùng distributed response barrier. Read đã vượt điểm đó trước revoke được xếp
  trước revoke, dù mạng có thể giao response muộn. Request mới sau revoke bị
  từ chối. Lý do và giới hạn được ghi trong ADR; hợp đồng FE yêu cầu xóa state/
  cache khi quyền thay đổi. Không có claim rằng payload đã giao có thể bị thu hồi.
- Consumer FE loading/empty/error/forbidden chưa được kiểm thử bằng ứng dụng FE:
  trong workspace hiện có không tìm thấy app frontend, chỉ có `apps/api`.
  `docs/fe-integration/fe-api-integration.md` đã bổ sung ma trận trạng thái và
  expected behavior để FE owner thực thi; đây là checklist, không phải evidence
  chạy trên FE.
- Docker Compose đang hoạt động với hai dependency `healthcare-mongo` và
  `healthcare-redis`, cấu hình project `healthcare-local`. Không có staging
  service/URL/deploy profile trong Compose. `apps/api/.env.production` có
  `NODE_ENV=production`; không dùng file này cho staging smoke hoặc test ghi dữ
  liệu. Không deploy hay chạy worker lên production.
- Do không có staging endpoint/deploy authority/worker target được xác định,
  staging API+worker smoke vẫn BLOCKED. Docker local, Atlas test và kiểm thử HTTP
  tích hợp không được tính thay cho staging. E2 vẫn 🚧.
- Sau lần test, inventory local phát hiện một database synthetic đúng pattern
  `fc_<32 hex>` còn sót; đã xác nhận tên/prefix và collection thuộc bộ schema test,
  xóa đúng database đó rồi kiểm tra lại: không còn database theo pattern `fc_`.
  Không đụng tới các database `healthcare_*` khác.

## Cập nhật HealthMetric period/summary/trend — 24/11/2026

- Companion mặc định xem tuần hiện tại theo `Asia/Ho_Chi_Minh`; đã bổ sung
  `week|month|quarter|year|all|custom`, `anchor`, cửa sổ UTC `[start,end)` và
  metadata `data.window` có anchor đã chuẩn hóa để FE tái sử dụng cùng kỳ. Anchor
  tương lai bị từ chối; custom range yêu cầu cả
  hai đầu mút và `from < to`. Request v1 chỉ truyền `from/to` giữ upper bound
  inclusive; request mới dùng `period=custom` để có end-exclusive rõ ràng.
- Trend query/sort/cursor nằm trong adapter infrastructure
  `MongooseSharedHealthMetricReader`, dùng lifecycle `valid` và tie-breaker
  `recordedAt + _id`. Projection chỉ trả metric type, unit, allowlisted values
  và recordedAt. Summary gọi cùng thống kê canonical của Health Tracking; Patient
  API giữ semantics `$lte`, Companion dùng `$lt` cùng start/end chuẩn hóa.
- Summary tính toàn cửa sổ, không theo trang trend. `blood_pressure` giữ quy tắc
  canonical: primary summary value là systolic, còn điểm latest/trend cho cả
  systolic và diastolic. Trend không có điểm trả 200 với danh sách rỗng; summary
  không có số liệu giữ response 404 hiện tại để FE hiển thị empty state.
- Không đổi schema, index hoặc persistence; không cần migration.
- Unit: 4 suites / 12 tests PASS (period boundary/leap-year/future anchor,
  validation/compatibility, end-exclusive vs Patient inclusive, safe projection
  và authorization query). MongoDB integration: `family-companion.integration-spec.ts`
  1 suite / 19 tests PASS trên replica-set test database tổng hợp `fc_<32 hex>`;
  HTTP/JWT test xác nhận điểm đúng tại đầu tuần được trả, điểm đúng tại cuối tuần
  bị loại, summary và trend có cùng tuần, cùng dữ liệu và response window.
- `pnpm --filter api typecheck`, `pnpm --filter api build`,
  `pnpm --filter api openapi:check`, `pnpm --filter api boundary:check`,
  `pnpm --filter api realtime:check` và `git diff --check` PASS sau cập nhật.
- OpenAPI runtime có schema cho period/anchor, response window, trend items và
  summary; FE types/docs tương ứng đã được đồng bộ.
- Lint toàn repository không PASS: 755 findings (3 errors, 752 warnings), ba
  errors đều nằm trong
  `apps/api/src/modules/ai-advisory/application/retrieval/rag-ingestion.service.ts`,
  ngoài phạm vi thay đổi E2; lint không là exit-gate blocker theo quyết định đã
  chốt.

E2 vẫn chưa đóng: integration local không thay thế staging deploy/worker smoke;
FE consumer thực tế vẫn cần kiểm tra loading/empty/error/forbidden và luồng chia
sẻ metric. Không thay đổi trạng thái exit gate vì cập nhật này.

## Review cấu trúc và hợp đồng metric — 24/11/2026

- DTO request của grant và query đã được tách từ controller sang
  `family-companion/presentation/dto`; route, validation fields và behavior không
  đổi.
- Mongoose reader của shared HealthMetric được chuyển từ
  `health-tracking/application/services` sang
  `health-tracking/infrastructure/mongoose`, phía Family Companion vẫn phụ thuộc
  vào application port public. Safe projection giữ allowlist numeric fields.
- Review phát hiện Patient API hiện có `GET /health-metrics` với from/to,
  pagination/cursor và `GET /health-metrics/statistics/:type`; chưa có endpoint
  bucket trend dùng chung. Shared trend hiện trả điểm gốc theo cursor và khi
  không có from/to đọc toàn lịch sử. Không forward raw Patient DTO vì có patient
  ID/source/validation metadata. Quyết định default tuần/timezone/bucket được để
  mở trong ADR trước khi đổi nghiệp vụ.
- Typecheck PASS; OpenAPI generate/check PASS; build PASS; adapter/auth unit
  suites PASS (2 suites/4 tests); integration trên source mới PASS (1 suite/19
  tests); `boundary:check` PASS. Mongoose hiện cảnh báo deprecated option `new`
  ở các integration writes; không làm fail test và chưa sửa vì không thuộc phạm
  vi review này.

## Khắc phục reminder E2 — 25/11/2026

### Kết quả review source và nghiệp vụ

- Source of truth: task lấy từ `CareTask.status`, `required`, `missedAt` và
  `patientCareProgramId`; trạng thái chương trình lấy từ
  `PatientCareProgram.status`. Chronic Care sở hữu cả hai lifecycle. Reader
  công khai qua application port; Family Companion không import Mongoose schema
  của Chronic Care.
- Patient reminder trong cửa sổ task dùng `care.task.reminder`, chỉ hợp lệ cho
  task `scheduled|due` trong cửa sổ và enrollment active. Vì vậy không thể xem
  event này là bằng chứng rằng Patient đã được nhắc khi task chuyển sang
  `missed`. Đã thêm event `care.task.missed-reminder.v1`, key theo task, xử lý
  qua worker và Notification in-app idempotent.
- Companion grace bắt đầu từ `CareTask.missedAt + 60 phút`, sau đó áp dụng quiet
  hours `21:00–08:00` theo timezone E2. Nếu task legacy không có `missedAt`,
  scheduler dùng thời điểm đầu lượt scan làm mốc tạm thời; idempotency key vẫn
  ổn định theo FamilyLink + task nên full scan không tạo reminder mới mỗi ngày.
- Scheduler chụp một `missedBefore` cho cả lượt, dùng keyset `_id` tăng dần và
  batch tối đa 200; mỗi trang lấy dư một record để tạo cursor. Các task mới
  miss sau mốc chụp được xét ở lượt sau; một task lỗi không dừng các task sau và
  sẽ được thử ở lượt scan kế tiếp.
- `PatientTaskReminderOutboxAdapter` phân biệt `notified`, pending/processing,
  dead, delivered-without-notification và chưa lập lịch. Companion chờ khi event
  Patient còn chạy; nếu event dead hoặc đã kết thúc mà không có Notification thì
  chuyển reminder sang `skipped` (`patient_reminder_not_dispatched`), không hoãn
  vô hạn. `notified` nghĩa là Notification in-app đã persist trong DB, không phải
  khẳng định Socket.IO đã tới thiết bị.

### Cơ chế đồng thời và transaction

- `FamilyReminderQuota` có unique index theo `companionUserId`; conditional write
  so sánh `lastMissedTaskDispatchedAt` với `$$NOW - 24 giờ` bằng MongoDB server
  clock trong cùng một document. Không dùng bucket theo ngày, task hay FamilyLink.
  Nhiều transaction cùng Companion bị serialize/conflict tại record quota; chỉ
  một transaction được dispatch trong cửa sổ trượt.
- Reservation quota, `Notification`, `notification.created`, trạng thái
  `FamilyReminder.dispatched` và ack `family.reminder.dispatch.v1` cùng commit
  trong transaction. Lỗi ở bất kỳ bước nào rollback cả quota và notification.
  Transition `skipped` + ack event cũng nguyên tử; reschedule cập nhật
  `FamilyReminder.scheduledAt` và outbox `pending/nextAttemptAt` cùng transaction.
- Reminder + dispatch outbox lúc lập lịch cũng được upsert trong một transaction;
  unique key stable xử lý retry tuần tự/concurrent. Duplicate-key khi hai worker
  cùng tạo quota record được bắt và retry có giới hạn.
- Task/enrollment được đọc lại ngay trước quota/notification; FamilyLink và đúng
  FamilyPermission được kiểm tra trong transaction dispatch. Đọc Chronic Care
  hiện không cùng transaction/session với FamilyLink/outbox. Nếu task/enrollment
  đổi sau lần đọc cuối nhưng trước commit vẫn còn race giữa hai bounded context;
  không có lifecycle lock/barrier chung và không tuyên bố atomicity mạnh hơn.

### DDD và kiểm thử

- Workflow đã tách thành `ScheduleFamilyReminders` và `DeliverFamilyReminder`;
  application dùng ports cho CareTask eligibility/cursor, Patient reminder và
  Family reminder store. Query adapter Chronic Care cùng persistence adapter
  Family Companion nằm ở infrastructure. Controller không liên quan và không
  đổi API/DTO FE.
- Unit: 16 suites / 52 tests PASS trên source cuối, gồm grace/quiet hours,
  rolling cap, task/enrollment eligibility, Patient reminder pending/dead,
  pagination và stable idempotency.
- MongoDB replica-set local: 1 integration suite / 12 tests PASS. Suite tạo
  database tổng hợp `fc_<32 hex>`, chạy migration `202611241040` hai lần (lần
  sau no-op), gọi verifier, sau đó tự drop đúng database đó. Bao gồm 205 task có
  timestamp trùng; concurrent dispatch khác task/link nhưng chung Companion;
  quota chỉ có một notification; enrollment/task đổi sau schedule bị suppress;
  Patient missed event chạy qua `OutboxWorkerService` thật và retry không nhân
  notification; rollback khi Notification outbox hoặc ack event lỗi; create/defer/
  skip/dispatch reminder cùng outbox atomic.
- Checks sau cùng PASS: `tsc --noEmit -p tsconfig.json`, `nest build`, OpenAPI
  check, realtime contract check, backend boundary check và `git diff --check`.
  OpenAPI check boot app với `MONGODB_URI` trỏ tới DB local synthetic riêng;
  database `fc_openapi_20261125` đã được kiểm tra và dọn sau đó. Không chạy
  migration trên Atlas ứng dụng.
- Lint các file TS liên quan chạy thành công, 0 error / 50 warning; warning chủ
  yếu là `no-unsafe-*` ở worker/test và enum comparison. Hai lỗi
  `no-constant-condition` trong pagination loop đã sửa; không chạy full-repo lint.
- Test ghi nhận Mongoose deprecation warning hiện hữu về option `new` trong một
  số `findOneAndUpdate`; suite vẫn PASS. Những lần chạy từ sandbox không có quyền
  localhost bị `EACCES`; lần xác minh cuối được chạy với quyền kết nối tới Docker
  local và PASS.

### Trạng thái exit gate

Reminder-specific gates về quota 24 giờ, eligibility trước dispatch, pagination,
Patient-first, transaction/ack, retry và redaction được chứng minh bằng test local
ở trên. Đây không phải worker deploy smoke. E2 vẫn 🚧: không có staging target/
quyền deploy trong phiên; FE consumer validation chưa chạy trên ứng dụng FE; race
atomic giữa lifecycle Chronic Care và dispatch vẫn còn giới hạn đã nêu. Không bật
feature, không đánh dấu toàn Phase E2 hoàn tất.
