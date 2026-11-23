# Evidence đóng exit gate E1 — Consultation policy

**Ngày:** 23/11/2026 (Asia/Ho_Chi_Minh)
**Người thực hiện:** release/backend engineer (Codex)
**Phạm vi:** release rehearsal cục bộ của API, worker/outbox và cơ sở dữ liệu thử nghiệm. Không tuyên bố đã deploy staging/production; môi trường bên ngoài không được cấp quyền trong phiên này.

## Kết luận

E1 đạt exit gate ở mức implementation/release-rehearsal. Các kiểm tra migration, policy snapshot, race/idempotency, worker/outbox, OpenAPI, realtime và build đều có kết quả PASS. Số liệu pilot hiện có được lấy dưới dạng aggregate, không chứa user ID, lịch khám, PHI hoặc payload nhạy cảm.

Production/staging vẫn cần owner vận hành chạy lại cùng checklist sau khi có quyền deploy. Đây là điều kiện phát hành môi trường thật, không phải lý do giữ E1 implementation ở trạng thái mở.

## Bảng evidence

| Hạng mục | Môi trường | Lệnh/kiểm tra | Kết quả |
|---|---|---|---|
| Migration forward-only/no-op | MongoDB Atlas hiện hành | `pnpm --filter api database:migrate -- --expect-noop` | PASS; không còn migration pending, version `202611231300` |
| Schema/index verifier | MongoDB Atlas hiện hành | `pnpm --filter api database:verify` | PASS; 45 collections, 122 managed indexes |
| Policy/unit | local runner | `pnpm --filter api test:unit -- doctor-booking-settings.policy.spec.ts` | PASS; 3 tests |
| Booking/queue integration | local runner | `pnpm --filter api test:integration -- scheduled-booking.integration-spec.ts consultation-queue.integration-spec.ts` | PASS; 18 tests |
| Worker/outbox integration | local runner + Docker Mongo/Redis | `pnpm --filter api test:integration -- cc003a-worker.integration-spec.ts` | PASS; 5 tests |
| Worker process liveness | Docker Mongo/Redis (`27018`, `16379`) | `pnpm --filter api worker:outbox` với test env; quan sát process 40 giây | PASS; worker khởi động, không lỗi startup |
| OpenAPI generated contract | local Mongo/Redis, timeout kết nối 1 giây | `pnpm --filter api openapi:check` với `MONGODB_URI=...127.0.0.1...`, `REDIS_URL=...127.0.0.1...` | PASS; exit code 0 |
| TypeScript | local runner | `pnpm --filter api typecheck` | PASS |
| Build | local runner, command runner cho phép >30 giây | `pnpm --filter api build` | PASS; `nest build` hoàn tất |
| Realtime contract | local runner | `pnpm --filter api realtime:check` | PASS |
| Boundary contract | local runner | `pnpm --filter api boundary:check` | PASS |
| Lint phạm vi E1 | local runner | ESLint các file E1 bằng root `.bin/eslint.cmd` | PASS; không còn lỗi trong phạm vi thay đổi |
| Diff hygiene | local runner | `git diff --check` | PASS |

## Số liệu pilot aggregate

Truy vấn chỉ trả về số đếm/trung bình, không xuất ID hay nội dung hồ sơ:

| Chỉ số | Giá trị |
|---|---:|
| Scheduled consultations | 4 |
| Lead time trung bình (created → scheduled start) | 948.39 phút |
| Mẫu có queue wait | 4 |
| Queue wait trung bình | 0.81 phút |
| Có overtime marker | 4 |
| Completed/no-show/cancelled theo trường status hiện có | 0/0/0 |
| Stale review cần xử lý | 0 |

Mẫu pilot còn nhỏ, vì vậy chưa dùng để chốt chính sách unified on-demand queue/ETA. E1 chỉ chốt canonical booking settings, snapshot bất biến và transition an toàn; việc thiết kế queue/ETA tiếp tục ở CARE-02 sau khi có thêm dữ liệu.

## Outbox và rủi ro vận hành

Worker/outbox đã được chứng minh bằng integration test và release rehearsal cục bộ. Aggregate Atlas hiện hành trước rehearsal có backlog/dead-letter cũ (71 pending, 12 dead); các bản ghi này không được tự ý xoá hoặc replay trong gate này. Owner vận hành phải triage chúng trước khi phát hành production và lưu link dashboard/log đã redaction. Không có raw PHI, payment payload, token hoặc secret trong evidence này.

## Hướng dẫn owner deploy thật

1. Chạy migration/no-op và verifier trên staging bằng service account đã phê duyệt.
2. Chạy worker với feature flag mặc định tắt, phát một outbox event synthetic không chứa PHI, xác nhận delivered/retry/DLQ và dashboard alert.
3. Chạy OpenAPI/realtime check trong runner có timeout tối thiểu 5 phút.
4. Bật từng feature theo canary, ghi error rate, queue lag, retry/dead-letter và rollback rehearsal.
5. Đính kèm log đã redaction vào release record; không ghi URI, credential, callback payload hoặc document URL.
