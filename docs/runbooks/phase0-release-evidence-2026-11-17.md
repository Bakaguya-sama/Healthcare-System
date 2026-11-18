# Phase 0 release evidence — 17/11/2026

> **Kết luận:** **BLOCKED cho deploy/enablement**, dù rehearsal local đạt. Evidence
> này chỉ chứng minh source và dependency local; không phải xác nhận staging hay
> production đã smoke. Không có secret, token, PHI/PII, callback body hoặc private
> artifact URL trong tài liệu này.

## Phạm vi và người thực hiện

| Thuộc tính               | Giá trị                                                                |
| ------------------------ | ---------------------------------------------------------------------- |
| Thời điểm                | 17/11/2026 (Asia/Saigon)                                               |
| Người thực hiện          | Release operator — Codex, local workspace                              |
| Commit source tham chiếu | `6a12436`                                                              |
| Môi trường đã kiểm chứng | Docker local: MongoDB `mongo:8.0.30`, Redis `redis:8.2.9`              |
| Database rehearsal       | `healthcare_phase0_release_20261117_a1e85e` trên `localhost:27018`     |
| Ngoài phạm vi            | Staging/production, provider credentials/callback, frontend repository |

`apps/api/.env` tồn tại và được `.gitignore`; nội dung không được đọc ra tài liệu
hay terminal. Kiểm tra redacted cho thấy URI MongoDB/Redis của file này **không
phải endpoint local**, nên không command nào dưới đây dùng URI đó để migrate, probe
hoặc chạy worker.

## Checklist evidence

| Hạng mục                    | Trạng thái | Evidence an toàn                                                         | Kết quả / giới hạn                                                                                                                                              |
| --------------------------- | ---------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker MongoDB/Redis local  | PASS       | `docker compose ps`                                                      | Cả hai service `healthy`; port local `27018`/`16379`                                                                                                            |
| Migration rehearsal         | PASS       | `database:migrate` với URI local explicit                                | Schema đạt `202611171200`                                                                                                                                       |
| Schema verifier             | PASS       | `database:verify` cùng URI rehearsal                                     | 37 collections, 117 managed indexes                                                                                                                             |
| Migration no-op             | PASS       | `database:migrate -- --expect-noop` cùng URI rehearsal                   | Tất cả migration được skip; không có migration mới                                                                                                              |
| API liveness/readiness      | PASS       | API local tạm trên port `3100`                                           | `GET /api/v1/health/live` = `ok`; `GET /api/v1/health/ready` = `ok`; process đã dừng sau smoke                                                                  |
| Outbox worker startup       | PASS       | Worker local với DB rehearsal + Redis local                              | Process còn sống sau 10 giây; đã dừng sau smoke; không có event/provider test payload                                                                           |
| Typecheck/build             | PASS       | `typecheck`, `build`                                                     | Hoàn tất không lỗi                                                                                                                                              |
| Consumer contracts          | PASS       | `openapi:check`, `realtime:check`                                        | Generated artifacts không drift source                                                                                                                          |
| Boundary policy             | PASS       | `boundary:check`                                                         | Backend boundary check passed                                                                                                                                   |
| VNPAY + reconciliation      | BLOCKED    | Callback host public không reachable; chưa có signed IPN/reconcile smoke | Cấu hình hiện hữu báo `VNPAY_ENABLED=true` và `PAYMENT_RECONCILIATION_ENABLED=true`; không được enable ở môi trường deploy trước khi hoàn tất smoke có evidence |
| SMTP transport              | PASS       | Nodemailer `verify()`                                                    | Xác thực/kết nối SMTP pass; không gửi email                                                                                                                     |
| Gemini provider             | PASS       | Một generate-content và một embedding kỹ thuật tối thiểu                 | Không gửi PHI/PII, không ghi response/vector                                                                                                                    |
| Private export storage      | PASS       | Upload → expiring signed download → expired download → delete            | Artifact PDF rỗng; download hợp lệ `200`, expired `401`, cleanup pass; không in URL/key                                                                         |
| Queue retry/dead-letter     | PASS local | `cc003a-worker.integration-spec.ts`                                      | Retry, dead-letter, requeue và crash recovery pass trên MongoDB/Redis local                                                                                     |
| Queue lag/dead-letter alert | BLOCKED    | Source có `outbox.health`, nhưng chưa quan sát deployment log/alert      | Cần dashboard/query/alert của môi trường deploy và event traffic                                                                                                |
| Rollback/kill switch        | BLOCKED    | Flag source đã tồn tại, chưa có rehearsal deploy                         | Chưa xác minh thao tác enable/disable trên môi trường được deploy                                                                                               |
| Frontend contract pin       | BLOCKED    | Backend artifact check PASS                                              | Frontend repository/owner chưa cung cấp pin và Web E2E evidence                                                                                                 |

## Cấu hình và rollback gate

Các giá trị dưới đây chỉ là trạng thái boolean/default redacted của file cấu hình
hiện hữu; chúng **không** chứng minh service nào đang được deploy:

| Control                               | Quan sát                           | Quyết định release                                                                                                                         |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `CARE_MONITORING_AUTOMATION_ENABLED`  | `false`                            | Giữ disabled cho đến khi có clinical-owner approval và scheduler/DLQ smoke                                                                 |
| `CONSULTATION_STALE_RECOVERY_ENABLED` | không đặt; runtime default `false` | Giữ disabled cho đến khi có stale-recovery rehearsal                                                                                       |
| `VNPAY_ENABLED`                       | `true`                             | Callback host hiện không reachable; đặt `false` trước release baseline, hoặc khôi phục callback và cung cấp Sandbox evidence trước khi bật |
| `PAYMENT_RECONCILIATION_ENABLED`      | `true`                             | Đặt `false` cho baseline; chỉ bật sau VNPAY IPN/reconcile smoke                                                                            |
| `THROTTLE_ENABLED`                    | không đặt                          | Với môi trường deploy phải đặt rõ/kiểm tra default staging-production và shared Redis                                                      |
| `SWAGGER_ENABLED`                     | không đặt                          | Production phải xác nhận runtime `false`                                                                                                   |

Rollback an toàn của các feature provider là đặt flag về `false`, restart API/worker
theo runbook, giữ nguyên order/outbox/audit evidence và **không** xóa event hoặc
sửa database thủ công. Đây là thiết kế/config evidence, chưa phải rehearsal đạt
gate.

## Commands đã chạy

Các command local dùng database rehearsal explicit; không in URI deploy hoặc bất kỳ
giá trị secret nào.

```powershell
pnpm.cmd --filter api typecheck
pnpm.cmd --filter api build
pnpm.cmd --filter api openapi:check
pnpm.cmd --filter api realtime:check
pnpm.cmd --filter api boundary:check

# Với MONGODB_URI trỏ explicit tới database rehearsal local:
pnpm.cmd --filter api database:migrate
pnpm.cmd --filter api database:verify
pnpm.cmd --filter api database:migrate -- --expect-noop
```

API smoke dùng `NODE_ENV=test`, MongoDB/Redis local và port `3100`; chỉ gọi hai
health endpoint. Worker smoke dùng cùng dependency local và được dừng sau 10 giây.
SMTP chỉ chạy `verify()` không gửi email. Gemini chỉ nhận payload kỹ thuật tối
thiểu. Cloudinary chỉ nhận PDF rỗng không PHI; mọi artifact test được xóa trong
`finally`. Không có command nào tạo VNPAY order, gọi IPN có chữ ký hoặc dùng dữ
liệu Patient.

## Sửa blocker source trong smoke

Cloudinary credential/connectivity pass nhưng private export download ban đầu trả
HTTP `400`. Root cause là `CloudinaryService` tạo delivery URL với
`flags: attachment:<filename>` và `expires_at`; cách này không tạo URL expiring
private download hợp lệ. Đã sửa service dùng
`cloudinary.utils.private_download_url` với `type=authenticated`, attachment
và `expires_at`. Regression test
`cloudinary.service.spec.ts` cùng build/typecheck pass. Smoke sau sửa xác minh
download khi còn hạn trả `200`, đã hết hạn trả `401` và cleanup pass.

## Hành động cần owner thực hiện để đóng Giai đoạn 0

1. **Deployment/database owner:** cung cấp môi trường staging hoặc production-equivalent,
   xác nhận URI mục tiêu bằng host/database đã redact, backup/restore rehearsal, rồi chạy
   forward migration → verifier → no-op theo
   [`da2-release-readiness.md`](da2-release-readiness.md).
2. **Release operator/VNPAY portal owner:** public callback host cấu hình hiện tại
   không reachable cho cả health và unsigned-IPN route. Khôi phục hoặc thay callback
   public, xác nhận URL IPN trong VNPAY portal, deploy với provider feature
   disabled-by-default, rồi thực hiện test order Sandbox, signed IPN, duplicate IPN,
   payment return không grant quyền, reconcile và rollback flag.
3. **Provider/storage owners:** thực hiện SMTP retry, AI/RAG citation/raw-payload,
   private export create/poll/download/expiry/cleanup; ghi log redacted, correlation ID,
   timestamp và người thực hiện.
4. **Operations owner:** chứng minh alert cho `outbox.health` dead event và pending lag,
   retry/DLQ dashboard hoặc query, cùng kill-switch rehearsal.
5. **Frontend owner:** pin `apps/api/openapi/openapi.json` và
   `apps/api/contracts/realtime-events.json`, sau đó chạy consumer/Web E2E ở repository
   frontend.

Chỉ khi toàn bộ hàng BLOCKED có evidence môi trường, actor, timestamp và kết quả
PASS thì mới đổi Giai đoạn 0 trong `plan/roadmap-v2.md` từ 🚧 sang ✅.
