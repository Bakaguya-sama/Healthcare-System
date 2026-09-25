# RF-10C — Release evidence

Ngày hoàn tất: **2026-09-21**
Phạm vi: source hiện tại trên branch `huy/refactor`, MongoDB `8.0.30` replica set `rs0`, Redis `8.2.9`.

## Quyết định cutover

- Frontend được xây mới ở repository khác và chỉ dùng canonical Consultation API.
- Không có frontend legacy production cần giữ; access-log/observation window được đánh dấu **N/A theo owner decision**.
- Backup legacy đã được xác nhận trong preflight.
- Không chạy migration destructive lên URI bên ngoài local rehearsal trong lần thực hiện này.

## Safety gate và physical cleanup

Migration `202609202100-rf10c-physical-cleanup` gọi reconciliation trước khi thay đổi dữ liệu. Migration fail nếu có bất kỳ blocker nào:

- Session chưa có Consultation cùng `_id`;
- AI Session chưa có conversation theo `legacyAiSessionId`;
- AI Message chưa có canonical message theo provenance key;
- Message/Review còn legacy link nhưng thiếu `consultationId`;
- AI Feedback còn legacy link nhưng thiếu `aiConversationId`.

Khi không còn blocker, migration:

- drop `sessions`, `aisessions`, `aimessages`, `aihealthinsights`;
- unset `doctorSessionId`, `aiSessionId`, `legacyAiSessionId`, `legacySourceKey`;
- drop các index legacy tương ứng;
- giữ nguyên migration lịch sử và checksum đã áp dụng.

Thứ tự cleanup là reconcile → drop source collections đã xác nhận → drop index/unset provenance. Nếu process dừng giữa chừng, các collection nguồn còn lại vẫn giữ khóa provenance để lần chạy sau đối soát và resume an toàn.

Integration test đã chứng minh cả hai nhánh: dữ liệu thiếu bị chặn trước drop; dữ liệu đã ánh xạ được cleanup hai lần an toàn.

## Database rehearsal

Database riêng: `healthcare_rf10c_rehearsal_v2` trên local compose replica set.

| Gate | Kết quả |
|---|---|
| First migration | Applied 10 migrations, latest `202609202100` |
| Database verify | Pass, 15 collections, 36 managed indexes |
| Second migration | No-op, skip đủ 10 migrations |
| RF-10C reconciliation | `ready=true`, 0 ở toàn bộ blocker |

## Regression evidence

| Check | Kết quả |
|---|---|
| Boundary canonical/contract audit | Pass |
| TypeScript typecheck | Pass |
| Nest build | Pass |
| ESLint error gate | Pass |
| Unit | 13 suites, 56 tests pass |
| Integration | 5 suites, 13 tests pass |
| E2E | 1 suite, 4 tests pass |
| OpenAPI drift | Pass |
| Realtime contract drift | Pass |
| `git diff --check` | Pass |

## Local infrastructure correction

Máy phát triển có MongoDB standalone ở cổng `27017`, làm integration test kết nối nhầm topology. Compose MongoDB replica set được chuyển host port sang `27018`; container vẫn dùng `27017` nội bộ. `.env.example`, local-development docs và default integration URI đã được cập nhật tương ứng. CI tiếp tục dùng URI `27017` do service CI độc lập.

## Lệnh deploy bắt buộc

```bash
pnpm --filter api rf10c:reconcile
pnpm --filter api database:migrate
pnpm --filter api database:verify
pnpm --filter api database:migrate -- --expect-noop
```

Không chạy các lệnh trên nếu URI đích, backup hoặc reconciliation report chưa được xác nhận.
