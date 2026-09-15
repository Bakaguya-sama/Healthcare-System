# RF-0 — Baseline command results

Baseline branch: `huy/refactor`

Legacy tag: `backend-legacy-baseline` -> `030b3e001737f79275cd93192f65b40bc1c65df3`

Pre-RF-0 head: `0260e89`

Recorded: **2026-09-15**, Node `24.9.0`, pnpm `9.0.0`

| Check                                                | Result                                       | Kết luận                                                         |
| ---------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------- |
| API build (`nest build`)                             | FAIL, 50 TypeScript errors                   | Chủ yếu `createIndex.ts` và missing Doctor exports; RF-1 blocker |
| Unit (`jest --runInBand`)                            | FAIL, 2 suites không khởi động, 0 tests chạy | Mongoose schema metadata lỗi tại `User.role`                     |
| E2E (`jest --config test/jest-e2e.json --runInBand`) | FAIL, 1 suite không khởi động, 0 tests chạy  | Cùng Mongoose metadata blocker                                   |
| Endpoint source inventory                            | PASS                                         | 173 operations/121 paths được ghi vào OpenAPI source baseline    |
| Runtime OpenAPI capture                              | BLOCKED                                      | App không compile/bootstrap; không được giả là runtime snapshot  |
| Cron/worker scan                                     | PASS                                         | Không có scheduler/BullMQ/Kafka/Redis processor trong source     |
| Postman source collection                            | PASS                                         | 173 requests; chưa có runtime response examples                  |

`lint` hiện được định nghĩa với `--fix`, nên RF-0 không chạy để tránh sửa source trong audit-only phase. RF-1 phải tạo command lint read-only/fail-fast rồi mới ghi baseline đáng tin cậy.

RF-0 không sửa runtime source để làm xanh các check trên. Các failure này là đầu vào có chủ đích cho RF-1.
