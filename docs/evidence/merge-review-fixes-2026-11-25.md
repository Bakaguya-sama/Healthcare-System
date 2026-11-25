# Evidence — sửa các vấn đề sau merge (25/11/2026)

## Phạm vi và giới hạn evidence

Thực hiện trên worktree local, MongoDB replica set và Redis chạy bằng Docker trên
máy phát triển. Database kiểm thử dùng tên riêng và chỉ chứa dữ liệu tổng hợp;
không dùng Atlas ứng dụng, staging hay production. Không chạy backfill `--apply`.
Evidence local chứng minh code/test/migration runner hoạt động, không thay thế
Google provider smoke, FE/mobile consumer validation hoặc deploy API/worker lên
staging.

Tại thời điểm kiểm tra `git ls-files -u` không trả unmerged entry. Không tạo merge
commit và không commit các thay đổi.

## Findings và cách xử lý

| Finding | Thay đổi | Invariant sau sửa |
| --- | --- | --- |
| Mobile OAuth dựa vào trạng thái cục bộ/attempt ID có thể dùng như khóa lấy session; callback có nguy cơ phát session trước khi app chứng minh possession. | `GoogleMobileOAuthService` điều phối qua port; Redis adapter lưu challenge/attempt/ticket dùng chung giữa instance. Callback chỉ ghi principal đã mã hóa và ticket hash; exchange cần `attemptId + ticket + app verifier`, consume nguyên tử rồi mới gọi Authentication tạo session. | Không có fallback attempt-only hoặc memory. TTL attempt 5 phút, ticket 60 giây; Redis lỗi fail-closed; callback không phát token. Browser tiếp tục dùng Passport state, Google PKCE và HttpOnly state cookie. |
| User/OAuthIdentity có thể được ghi lệch khi signup đồng thời hoặc identity insert lỗi. | Adapter Mongo tạo User và OAuthIdentity trong cùng transaction; login tra provider subject; duplicate-key được phân loại/recheck; collision không merge account. | Không để User OAuth-only mồ côi khi transaction rollback; email không phải khóa login. |
| Chỉ có email trong profile bị coi như bằng chứng verified; login có thể cập nhật email theo provider. | Chỉ claim OIDC `email_verified=true` từ profile đã xác thực mới đặt `emailVerifiedAt`; email được normalize; lần login tiếp theo không ghi đè email User. | Email attribute và email ownership là hai trạng thái riêng; response session có `emailVerified`. |
| GET User/login có side effect hydrate email lịch sử. | Bỏ mutation khỏi `UsersService`; thêm lệnh backfill riêng, dry-run mặc định, giới hạn batch, collision-safe, conditional update, audit tối thiểu; verifier chỉ báo cáo. | Không merge/xóa account, không gán `emailVerifiedAt`, không in email; `--apply` cần thao tác vận hành tường minh. |
| Enrollment đổi trạng thái nhưng tạo/hủy CareTask bằng best-effort request side effect, khiến task lệch và không retry được. | Enrollment, revision, audit, idempotency và `care.enrollment.tasks.sync.v1` được ghi trong transaction. Worker đọc trạng thái/revision hiện tại, xử lý idempotent; reconciliation dùng keyset batches. Task command/review/evaluation/reminder kiểm tra enrollment active và fail-closed. | Event cũ không đảo trạng thái mới; khi worker trễ, Enrollment là source of truth, đồng bộ task eventual-consistent và được sửa qua retry/reconciliation. |
| Validator catalog chấp nhận số phiên bản khác nhau giữa database mới và database đã chạy migration lịch sử. | Thêm migration forward-only `202611251000` dùng `collMod`, registry/schema manifest/verifier; migration CC000 trong worktree không đổi so với HEAD merge hiện tại. | Hỗ trợ BSON int/long/double và giữ minimum/constraint; migration chạy lại an toàn. |

## Kiến trúc và trách nhiệm

- Authentication `application` sở hữu use case/handoff orchestration và ports;
  `infrastructure` sở hữu Passport/Redis/Mongoose/crypto/config adapters;
  controller/DTO chỉ map HTTP. Backfill là command vận hành riêng, không gắn vào
  query User. Use case mobile OAuth không đọc Nest `ConfigService` trực tiếp.
- Chronic Care ghi outbox qua application port; adapter outbox và worker xử lý
  persistence/delivery. Worker lấy Enrollment hiện hành, không tin event cũ như
  source of truth.
- Giới hạn còn lại: các service Chronic Care cũ vẫn có phần truy cập Mongoose
  trực tiếp; đợt này tách phần sync mới và không tuyên bố toàn bộ bounded context
  đã thuần domain/application. Cần giữ refactor mở rộng ngoài scope để tránh đổi
  nghiệp vụ hiện có.

## Kết quả kiểm tra local

Thời điểm ghi evidence: 25/11/2026 12:11 UTC. Actor: phiên Codex trong workspace.
MongoDB/Redis: Docker `healthcare-mongo` (replica set, host port 27018) và
`healthcare-redis` (host port 16379); chỉ test data tổng hợp.

| Hạng mục | Kết quả thực tế |
| --- | --- |
| Unit | PASS — 86 suites, 312 tests sau khi thêm unit kiểm tra feature availability port và proof handoff. |
| Mongo/Redis integration | PASS — 7 suites, 43 tests trên MongoDB replica set và Redis local: OAuth account transaction/backfill; Redis handoff đa adapter/replay/expiry, concurrent exchange và callback thiếu cookie khởi tạo; enrollment/outbox/stale event/reconciliation >200; validator migration; task/read và merge-related scheduled booking. Callback thiếu cookie không chứng minh toàn bộ các biến thể session fixation. |
| HTTP E2E | PASS — 7 suites, 23 tests, chạy lại sau khi thêm config availability adapter; có OAuth attempt/error mapping và regression HTTP liên quan. Đây là E2E local, không phải mobile browser/provider E2E. |
| `pnpm --filter api typecheck` | PASS sau khi sửa kiểu `Request` trong test controller. |
| `pnpm --filter api build` | PASS trên source triển khai hiện tại; thay đổi sau build chỉ là test assertion. |
| `pnpm --filter api openapi:check` | PASS sau lần rà cuối với MongoDB/Redis local; OpenAPI generated contract có mobile-attempt/exchange và `emailVerified`. |
| `pnpm --filter api realtime:check` và `pnpm --filter api boundary:check` | PASS. |
| Migration | PASS trên database local cô lập `healthcare_merge_review_20261125`: apply tới `202611251000`, lần chạy thứ hai no-op; verifier PASS, 47 collections/128 managed indexes. DB test đã được kiểm tra rồi xóa; không tác động database ứng dụng. |
| Email backfill verify/dry-run | PASS trên DB local riêng `healthcare_backfill_review_20261125b`: verifier ghi nhận 0 orphan OAuth identity, 0 OAuth-only Patient thiếu identity, 0 nhóm collision và 0 verification mismatch; dry-run quét 0 record, apply=0. Không có dữ liệu ứng dụng và không chạy `--apply`. |
| Worker local boot | PASS — outbox worker khởi động, health probe báo pending=0, scheduler đăng ký tác vụ reconciliation; worker được dừng thủ công sau smoke. Đây không phải staging/production worker smoke. |
| Lint | Full API lint FAIL — 897 findings (7 errors, 890 warnings) với ngưỡng 402; repository lint debt, không dùng làm exit-gate blocker theo quy ước đã chốt. Các file auth/Chronic Care/migration liên quan được lint riêng: 0 error, 239 warning; controller spec mới được sửa để không còn lint error. |
| `git diff --check` | Chạy lại trước bàn giao; xem trạng thái cuối worktree. |

Integration/E2E dùng Mongo replica set và Redis local thật, không phải mock-only.
Không có Google client secret/provider smoke, app binary/device, FE consumer repo
hoặc staging deploy trong phạm vi kết nối phiên này.

## Gate còn mở — không đánh dấu hoàn tất

| Gate | Trạng thái | Việc cần owner/consumer |
| --- | --- | --- |
| Mobile/Web consumer validation | BLOCKED | FE/mobile owner tích hợp contract trong `docs/fe-integration/fe-api-integration.md` và `fe-api-types.ts`; xác thực loading/error/collision, lưu verifier an toàn, universal/custom link, mất verifier và exchange một lần trên app/browser thật. Không tìm thấy consumer mobile trong workspace này. |
| Google provider smoke | BLOCKED | Operator chạy authorize/callback với Google OIDC credentials từ secret manager ở staging; kiểm tra `email_verified`, redirect allowlist, collision và browser state trên domain thực. Không chuyển secret qua chat và chưa có provider evidence trong phiên. |
| Staging API + worker | BLOCKED | Platform owner deploy cùng Redis namespace dùng chung và Mongo replica-set transaction; chạy OAuth multi-instance, outbox retry/reconciliation và migration/verifier; ghi timestamp, actor và redacted logs. Local Docker không thay thế staging. |
| Emailless Google account | OPEN product/API limitation | Hiện có thể login theo provider subject nhưng không có kênh OTP; chưa có authenticated add/change-email use case. Cần product/API decision và consumer trước khi mở rộng; hệ thống không tự gán email/verified. |
| Full lint | NON-BLOCKING debt | 7 errors/890 warnings trên toàn API; không chặn theo quyết định lint hiện hành. Các file liên quan scope không có ESLint errors. |

Do các gate consumer/provider/staging chưa có evidence, Phase A và E2 vẫn ở trạng
thái đang thực hiện trong `plan/roadmap-v2.md`. Không suy ra đạt exit gate từ test
local.

## Review bổ sung — 25/11/2026

Đã giới hạn ticket theo thời gian còn lại của attempt, không đánh dấu email trống
là verified, khôi phục task còn window khi resume sau pause, và bỏ query string
khỏi HTTP log/error path để không ghi OAuth code/state. Kiểm thử Mongo/Redis liên
quan: 3 suites/17 tests PASS; kiểm thử redaction và scheduler unit liên quan:
4 suites/8 tests PASS. Việc đọc enrollment và ghi task không có transaction chung;
event/reconciliation có thể sửa projection lệch sau race, nhưng không bảo đảm
transition đồng thời luôn được tuần tự hóa theo revision.

Test cookie hiện kiểm tra callback từ browser khác không có cookie khởi tạo; chưa
kiểm chứng trường hợp URL bắt đầu OAuth do attacker tạo được victim mở ngay từ
đầu. Khi attacker cũng kiểm soát verifier của attempt và nhận được ticket qua
custom-scheme interception, verifier không chứng minh được intent của victim.
Cần consumer/device review và ưu tiên universal/app link được hệ điều hành xác
nhận trước khi coi biến thể session fixation này đã được xử lý.

## File evidence chính

- `docs/adr/2026-11-18-phase-a-identity-boundaries.md`
- `docs/adr/2026-11-25-care-enrollment-task-sync.md`
- `docs/runbooks/google-oauth-mobile-and-email-maintenance.md`
- `docs/runbooks/care-monitoring-automation.md`
- `docs/fe-integration/fe-api-integration.md`
- `docs/fe-integration/fe-api-types.ts`
- `apps/api/openapi/openapi.json`
