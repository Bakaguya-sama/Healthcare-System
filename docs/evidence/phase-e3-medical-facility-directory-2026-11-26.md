# Evidence — Phase E3 Medical Facility Directory

- Ngày ghi nhận: 2026-11-26 (Asia/Ho_Chi_Minh)
- Trạng thái tổng: **BLOCKED for release; implementation and local checks complete**
- Commit: không tạo.

## Baseline và phạm vi

Worktree có các thay đổi E3 mới; giữ nguyên các mục không liên quan `apps/api/tmp/`,
`docs/progress-audit-2026-11-03.md` và `tmp/`. E2 vẫn giữ các gate vận hành/FE
consumer đang mở; E3 core được làm song song nhưng không đánh dấu E2 hoàn tất.

E3 runtime gồm bounded context `care-directory`: domain aggregate/policy thuần,
application use-cases/ports, Mongoose adapters, Google Places adapter,
presentation DTOs/controllers; Chronic Care được gọi qua public application
port. Aggregate giữ lifecycle invariant; infrastructure adapter thực hiện ghi
optimistic/transactional nhưng không quyết định transition nghiệp vụ. Feature
flags đều mặc định tắt. Place ID được lưu bền vững; tọa độ Places chỉ hiển thị trong preview; tên/địa chỉ không được ghi vào draft,
receipt, audit hoặc cache.

## Môi trường và dữ liệu

- Local Docker Mongo replica set `127.0.0.1:27018` và Redis `127.0.0.1:16379` đã
  được dùng bởi integration tests. Mongo database là tên ngẫu nhiên `e3_<uuid>`;
  test chỉ xóa đúng database test đó.
- Migration/verifier chạy trong database test cô lập, không áp dụng database
  ứng dụng trong `.env`.
- Không tìm thấy cấu hình E3 credential/enable flag trong key names của
  `apps/api/.env` và process environment; không đọc/in giá trị credential. Vì vậy
  chưa có Google provider smoke thật.
- Chưa có corpus TP.HCM từ nguồn chính thức được `super_admin` duyệt; synthetic
  fixtures chỉ tồn tại trong test database và không được Patient production
  search.
- Không có staging URL/deploy authority/worker smoke evidence hoặc FE consumer
  trong workspace backend.
- Người thực hiện kiểm chứng local: Codex trong workspace do người dùng cung cấp;
  test chỉ dùng synthetic data. Vòng kiểm chứng cuối được ghi nhận trong khoảng
  `2026-11-26 00:52–01:02` `Asia/Saigon`; đây không phải staging/production evidence.

## Lệnh và kết quả

| Hạng mục | Lệnh/thao tác | Kết quả |
| --- | --- | --- |
| Unit | `pnpm --filter api exec jest --runInBand src/modules/care-directory` | PASS — 7 suites, 21 tests; includes disabled-by-default and canonical super_admin adapter checks |
| Mongo/Redis integration | `pnpm --filter api exec jest --config ./test/jest-integration.json --runInBand test/care-directory.integration-spec.ts test/google-map-provider-rate-limit.integration-spec.ts` | PASS — 2 suites, 8 tests; local replica set + Redis; synthetic data |
| HTTP/E2E | `pnpm --filter api exec jest --config ./test/jest-e2e.json --runInBand test/care-directory.e2e-spec.ts` | PASS — 1 suite, 4 tests; real Nest route/role guard/use-case wiring, provider mocked |
| API typecheck | `pnpm --filter api typecheck` | PASS — final E3 source state |
| API build | `pnpm --filter api build` | PASS — exit code 0 on final E3 source state |
| OpenAPI | `pnpm --filter api openapi:check` | PASS — generated contract matches runtime |
| Realtime contract | `pnpm --filter api realtime:check` | PASS |
| Boundary check | `pnpm --filter api boundary:check` | PASS — includes care-directory dependency-direction rules |
| FE type definitions | `pnpm --filter api exec tsc --noEmit --strict --target ES2020 --moduleResolution node --skipLibCheck ../../docs/fe-integration/fe-api-types.ts` | PASS |
| Diff whitespace | `git diff --check` | PASS |
| Scoped lint | `pnpm --filter api exec eslint src/modules/care-directory src/modules/chronic-care/application/ports/care-program-directory-reader.port.ts src/modules/chronic-care/infrastructure/adapters/mongoose-care-program-directory-reader.adapter.ts test/care-directory.e2e-spec.ts test/care-directory.integration-spec.ts test/google-map-provider-rate-limit.integration-spec.ts` | 0 errors, 37 warnings; advisory per project policy |

Integration evidence includes transaction rollback when audit append fails, mapping
version publish/retire, verified-only search, revision projection, `2dsphere`
explain index, migration apply/no-op/verifier and shared Redis actor/global quota.
This is local test evidence, not staging or provider smoke.

## Exit-gate status

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| DDD runtime, domain invariants, API/admin lifecycle | PASS in local checks | `apps/api/src/modules/care-directory/domain/entities/`; use cases coordinate; adapters persist; unit, integration, E2E, typecheck and boundary checks above |
| Specialty catalog + mapping precedence/version | PASS in local tests | mapping unit + Mongo integration; no approved clinical corpus |
| super_admin authorization, draft/revision/verify/retire | PASS in local tests | use-case policy tests and integration/E2E |
| Patient verified-only search/detail, pagination/projection/freshness | PASS in local tests | query integration and HTTP tests |
| Location privacy/redaction | PASS at source/local scope | body-only transport; request logger excludes body; no patient coordinates in persistence/audit; staging ingress logging still needs review |
| Google provider adapter/error handling/rate limiting | PASS with synthetic adapter tests | Real Google credential/Places smoke BLOCKED |
| Migration/index/explain/verifier/no-op | PASS in isolated Mongo test | Never applied to application DB |
| Audit/idempotency/concurrency | Local transaction/idempotency coverage | No deployed concurrency/operational evidence |
| FE contract/consumer validation | Contract/docs/types updated; consumer validation BLOCKED | FE app is not present in this workspace; FE owner must validate loading/empty/error/forbidden and map attribution states |
| HCMC corpus approved by super_admin | BLOCKED | Product/Admin data owner must supply official sources and review records |
| Staging deployment/smoke/rollback | BLOCKED | Staging endpoint, secret-manager binding and deploy/worker authority required |
| Google attribution/legal policy | Policy source reviewed; operational rendering BLOCKED | Confirm actual UI rendering and account/legal applicability before rollout |

No roadmap completion checkmark is justified until all blocked gates have real
owner-reviewed evidence.

### Follow-up review: draft validation

Manual Facility draft creation and replacement now accept incomplete `details`;
verification still enforces the complete verified checklist. An incomplete draft
returns `FACILITY_DETAILS_INCOMPLETE` instead of an internal type error and remains
hidden from Patient search. Specialty codes are normalized before duplicate
validation. Local Mongo integration: `test/care-directory.integration-spec.ts`,
8/8 tests passed; E3 unit tests 21/21 passed; API typecheck passed. The integration
test uses synthetic data and an isolated local Mongo replica set. These results do
not change the release blockers above.

### Follow-up: map candidate idempotency and HTTP authorization

The application now reads the actor/operation/key receipt and compares the
request fingerprint before calling Google; on upstream failure it checks once
more for a concurrent command already committed. Transactional receipt checking
still resolves races at write time. A mismatched Place ID returns conflict;
failed provider calls without a committed receipt can be retried. If the other
command has not yet committed when the second check happens, this request can
still return provider unavailable and the client should retry the same key.

`pnpm --filter api exec jest --config ./test/jest-integration.json --runInBand test/care-directory.integration-spec.ts`
passed 12/12 tests on the local isolated Mongo replica set. Coverage includes
receipt replay with Google down, payload conflict, retry after initial outage,
concurrent receipt committed during an upstream failure, and HTTP using the
actual JWT strategy, persisted user/sub-role lookup, controller, use case,
repository and Google adapter. The Google network call is stubbed at `fetch` and
the limiter is stubbed in that HTTP test; the Redis limiter was separately tested
with two real local Redis clients (1/1 tests passed). This is not a real Google
provider or deployment smoke. The test uses a synthetic JWT signing key and
synthetic records. Typecheck, build, boundary check and `git diff --check` passed.
Google credential and feature flags were not present by key-name inspection in
the process environment or `apps/api/.env`; no secret values were printed.

Local verification was rerun on the final source state by the actor above in
the recorded window: unit `7/7 suites, 21/21 tests`, Mongo/Redis integration
`2/2 suites, 8/8 tests`, and HTTP/E2E `1/1 suite, 4/4 tests`. The HTTP test
includes Patient routes and verifies that only an Admin actor accepted by the
super-admin authority can list the Admin directory; this HTTP test supplies a
deterministic authority-port fixture, while the Mongoose authority query is
covered separately by an adapter unit test. It is not an application-user DB
deployment test. The Mongo test
used an isolated random `e3_<uuid>` database on the local replica set and the
Redis integration used the local Redis instance. Only that generated test
database is eligible for cleanup by the test harness. No application database,
staging service, Google API credential, or Patient location was used.

### Follow-up: Admin Place Search and Place Details draft preview

Verified locally on `2026-11-26 22:23` (`Asia/Saigon`) after reviewing the
current implementation, OpenAPI and FE contract. The Admin candidate endpoint
now supports exactly one selector: free-text `query` for facility/branch/address,
or an active internal `specialtyCode`. Query may optionally include area or a
location bias; specialty requires exactly one area/location. Optional `placeType`
uses the Google Text Search allowlist and does not set internal Facility type or
specialty. Patient `/external-search` remains specialty-only.

`POST /from-map-candidate` still checks authority and command receipt before
calling Place Details. A new request returns a transient attributed preview;
replay returns the committed Facility draft without requiring Google or replaying
preview. Facility persistence stores Place ID. Name/address remain response-only;
coordinates are returned only in the transient preview. Verify requires
explicit confirmation that the reviewer checked official sources independently.
No Google value is copied into draft `details`; specialty, facility type, official
source, contact and booking link are not inferred from Places.

Test results for this follow-up:

| Check | Command | Result |
| --- | --- | --- |
| E3 unit | `pnpm --filter api test:unit -- src/modules/care-directory` | PASS — 8 suites, 28 tests; includes Patient-search contract, Admin query/specialty selector, and missing-field preview |
| Mongo HTTP integration | `pnpm --filter api test:integration -- test/care-directory.integration-spec.ts` | PASS — 1 suite, 14 tests on isolated local replica set; includes role checks, query/specialty mode, invalid/ambiguous requests, duplicate Place ID, preview persistence policy, replay during Google failure, migration/no-op/verifier |
| HTTP E2E | `pnpm --filter api test:e2e -- test/care-directory.e2e-spec.ts` | PASS — 1 suite, 4 tests; provider remains simulated |
| Typecheck / build | `pnpm --filter api typecheck`; `pnpm --filter api build` | PASS |
| OpenAPI | `pnpm --filter api openapi:generate`; `pnpm --filter api openapi:check` | PASS; selector rules, allowlist, preview/create response and verify DTOs are current |
| Boundary / realtime | `pnpm --filter api boundary:check`; `pnpm --filter api realtime:check` | PASS |
| FE type definitions | `pnpm --filter api exec tsc --noEmit --strict --target ES2020 --moduleResolution node --skipLibCheck ../../docs/fe-integration/fe-api-types.ts` | PASS |
| Diff whitespace | `git diff --check` | PASS after all code and documentation updates |

The first test round exposed and fixed issues: unsafe attribution URIs were emitted without their URI, and the HTTP test kept its
simulated provider failure active for subsequent search requests. They are now covered by the passing checks. These are local
synthetic checks only. Google credentials/provider smoke, super_admin-approved
HCMC corpus, FE consumer validation, staging smoke and attribution rendering
remain release blockers; E3 stays open.

### Follow-up: duplicate review, Option A decision and manual Place ID link

**Thời điểm kiểm tra:** 2026-11-27 10:23 Asia/Saigon. Kiểm tra và test do
assistant thực hiện trong worktree local. Worktree ban đầu đã có nhiều thay đổi
chưa commit; các thay đổi ngoài phạm vi được giữ nguyên.

#### Source và ranh giới

- `MedicalFacility` là nguồn trạng thái/revision hiện hành; draft details ở
  `MedicalFacilityRevision`. `googlePlaceId` chỉ là tham chiếu provider trên
  Facility root. Một số draft có thể thiếu dữ liệu nên không được coi là đã rà
  hết trùng trước verify.
- Trước follow-up này có unique Place ID nhưng chưa có persistence cho xác nhận
  khả năng trùng, không có lần dò lại trong verify và không có command gắn Place
  ID vào Facility thủ công.
- Policy normalize/match/reason code và validation decision nằm trong
  `domain/policies/facility-duplicate-policy.ts`. Use case giữ authority, feature
  flag, receipt/provider ordering và error mapping. Mongoose adapter chạy bounded
  candidate query, lưu pair decision cùng Facility/AuditLog/receipt transaction.
  Controller chỉ nhận DTO và gọi use case.
- Mongo test chạy trên Docker replica set local ở port 27018, với database ngẫu
  nhiên `e3_<uuid>`; suite drop database đó trong `afterAll`. Không chạy migration
  lên Atlas/database ứng dụng. Redis local ở port 16379 sẵn sàng nhưng không được
  dùng cho duplicate review. Google request trong test được stub; không có Google
  provider smoke thật hoặc staging deploy trong lượt này.

#### Thay đổi đã kiểm tra

- Tạo thủ công và từ Google đều dò candidate bounded ở status draft/verified/
  retired. Verify dò lại các Facility verified và bỏ qua chính Facility đang
  verify. `truncated=true` không cho xác nhận danh sách một phần.
- So khớp chỉ gợi ý khi tên gần giống và có thêm địa chỉ gần giống hoặc vị trí
  trong 100 m. Khác quận/huyện không thành địa chỉ gần chỉ vì cùng TP.HCM; branch
  number được giữ trong lookup tokens. Place ID trùng chính xác luôn chặn.
- Option A được lưu theo cặp Facility IDs cùng actor/time/reason. Candidate mới
  phải được review; candidate ID cũ/ngoài kết quả hiện tại bị từ chối. Verify
  HCMC dùng guard document trong transaction để tuần tự hóa các verify đồng thời.
  Draft create đồng thời không bị khóa; chúng vẫn chưa hiển thị với Patient và
  được kiểm tra khi verify.
- Thêm `POST /api/v1/admin/medical-facilities/{id}/google-place-link`: xác minh
  Place ID qua provider, kiểm tra owner/expected revision, lưu ID cùng audit và
  receipt transactionally. Không thay nội dung Facility; không replace/unlink.
- Migration `202611271000-e3-facility-duplicate-review` apply/no-op trên DB test,
  tạo decision/guard collections, derived internal lookup fields/indexes; verifier
  kiểm tra schema, indexes và migration record. Không persist Google preview.
- Integration ban đầu phát hiện false positive giữa “Minh An”/“Bình An” do
  character-level similarity và địa chỉ chỉ dựa trên token chung. Policy được sửa
  để so các từ phân biệt và đối chiếu district; test đảm bảo hai record đó không
  bị coi là candidate cùng khi ở quận khác. Thêm `$geoNear.key = location` vì
  migration duplicate thêm một geospatial index và MongoDB không cho chọn index
  mơ hồ.
- Sửa thứ tự khai báo `FacilityDuplicateReviewDto` sau integration phát hiện
  runtime TDZ; thay decorator độ dài chuỗi trên `reviewedFacilityIds` bằng
  `ArrayNotEmpty`/`ArrayMaxSize(50)`; stale/arbitrary candidate IDs bị từ chối.
- Sửa comment schema còn nói có TTL cache tọa độ, không còn đúng với policy
  preview-only.

#### Kết quả thực thi

| Check | Command | Kết quả |
| --- | --- | --- |
| Unit | `pnpm --filter api test:unit -- src/modules/care-directory` | PASS — 9 suites, 36 tests |
| Mongo integration | `pnpm --filter api test:integration -- care-directory.integration-spec.ts` | PASS — 1 suite, 19 tests; bao gồm migration apply/no-op/verifier, pair decision, stale candidate, verify recheck/race, link Place ID và preview redaction |
| HTTP/E2E | `pnpm --filter api test:e2e -- care-directory.e2e-spec.ts` | PASS — 1 suite, 7 tests; conflict response/DTO và Place ID route được kiểm tra; authority/provider trong suite này là fixture |
| Typecheck | `pnpm --filter api typecheck` | PASS |
| Build | `pnpm --filter api build` | PASS |
| OpenAPI | `pnpm --filter api openapi:generate`; `pnpm --filter api openapi:check` | PASS — bao gồm duplicateReview và google-place-link |
| Boundary / realtime | `pnpm --filter api boundary:check`; `pnpm --filter api realtime:check` | PASS |
| FE types | `pnpm --filter api exec tsc --noEmit --strict --target ES2020 --moduleResolution node --skipLibCheck ../../docs/fe-integration/fe-api-types.ts` | PASS |
| Lint các file E3 đã chọn | `pnpm --filter api exec eslint src/modules/care-directory/domain/policies/facility-duplicate-policy.ts src/modules/care-directory/domain/policies/facility-duplicate-policy.spec.ts src/modules/care-directory/infrastructure/mongoose/mongoose-medical-facility.repository.ts src/modules/care-directory/presentation/dto/facility-directory.dto.ts test/care-directory.e2e-spec.ts test/care-directory.integration-spec.ts` | Hoàn tất, 0 errors và 94 warnings; warnings gồm các unsafe-any/style warnings trong adapter/test hiện hữu và file đã sửa. Lint không chặn gate theo quyết định phase trước. |
| Whitespace | `git diff --check` | PASS |

Đây là bằng chứng local/test bằng dữ liệu tổng hợp. Không chứng minh provider
Google thật, corpus TP.HCM đã duyệt, FE consumer đã xác nhận, staging rollout,
worker/deploy smoke hoặc rollback rehearsal. Các gate vận hành đó vẫn BLOCKED;
E3 không được đánh dấu hoàn tất.

### Follow-up: giảm persistence và API chuyên biệt — 2026-11-27 15:00 Asia/Saigon

Phần implementation cũ ở trên là lịch sử của lượt trước. Source hiện tại đã được
đơn giản hóa như sau:

- Xóa model/collection `facilityduplicatedecisions` và hai index riêng. Quyết
  định Option A được nhúng trong `medicalfacilities.duplicateReviews`, mỗi item
  gồm candidate Facility ID, reviewer, thời điểm và reason; tối đa 50 item trên
  một Facility. Facility mutation, AuditLog và receipt vẫn ở cùng transaction.
- Không cần data migration giữa hai dạng lưu: migration `202611271000` mới chỉ
  được apply trong database integration test ngẫu nhiên; test tự drop database.
  Không có bằng chứng migration đã chạy trên database ứng dụng. Migration chưa
  phát hành được cập nhật để tạo embedded field và chỉ giữ singleton
  `facilityduplicateguards`.
- Endpoint chuyên biệt `POST /admin/medical-facilities/:id/google-place-link`
  được thay bằng resource update `PATCH /admin/medical-facilities/:id` nhận
  `{ placeId, expectedRevision }`. `PUT /:id/draft` tiếp tục sửa nội dung draft;
  PATCH chỉ gắn Place ID lần đầu, provider xác minh trước khi ghi, không sửa
  details và không thay/gỡ ID. API cũ chưa được tìm thấy trong source consumer.
- Guard HCMC còn lại là điểm tuần tự hóa ngắn trong transaction verify. Không
  tìm thấy lock sẵn có phù hợp Directory; bỏ guard sẽ để hai verify có khả năng
  trùng cùng vượt qua vì write skew. Draft create có thể chạy đồng thời, nhưng
  chưa public và sẽ được kiểm tra lại khi verify.

| Check | Command | Kết quả |
| --- | --- | --- |
| Unit | `pnpm --filter api test:unit -- src/modules/care-directory` | PASS — 9 suites, 36 tests |
| Mongo integration | `pnpm --filter api test:integration -- care-directory.integration-spec.ts` | PASS — 1 suite, 19 tests trên replica set local; migration apply/no-op/verifier, embedded review, verify race, Place ID, idempotency/redaction |
| HTTP/E2E | `pnpm --filter api test:e2e -- care-directory.e2e-spec.ts` | PASS — 1 suite, 7 tests; kiểm tra PATCH resource update với authority/provider fixture |
| Typecheck / build | `pnpm --filter api typecheck`; `pnpm --filter api build` | PASS |
| OpenAPI | `pnpm --filter api openapi:generate`; `pnpm --filter api openapi:check` | PASS — PATCH resource update có mặt; endpoint chuyên biệt đã bỏ |
| FE types / boundary / realtime | Các lệnh typecheck FE, `boundary:check`, `realtime:check` | PASS |
| Formatting / whitespace | Prettier check; `git diff --check` | PASS trước khi bỏ một import thừa do lint phát hiện |
| Lint | ESLint các file E3 đã sửa | 0 errors, 100 warnings; chủ yếu unsafe-any và warning fixture/test hiện hữu. Đã bỏ import không dùng trong schema. Lint không chặn gate theo quyết định trước. |

Các kiểm tra dùng dữ liệu tổng hợp trên MongoDB replica set local. Không chạy
Google Places thật, không áp migration vào database ứng dụng và không có staging
smoke/FE consumer evidence. E3 vẫn mở cho corpus HCMC được duyệt, provider smoke,
FE validation, staging rollout và rollback rehearsal.
