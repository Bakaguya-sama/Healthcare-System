# RF-2D — Query catalog, index và performance baseline

Status: **DONE — 2026-09-16** (`BE-RF-007`).

## Phạm vi và nguyên tắc

Catalog này ghi nhận các read query P0 của Users/Practitioners, Consultations, Messages, HealthMetrics, Notifications và AI conversations. Kết quả chỉ chứng minh query shape và index trên fixture cục bộ; không được diễn giải thành production SLA.

- Default list sort luôn có `_id` cùng chiều làm tie-breaker.
- Index được chọn theo equality prefix, sau đó sort/range của query thực tế.
- Page fixture là 20; các endpoint legacy đều có pagination hoặc hard cap 100.
- Không thêm cache để che query chưa tối ưu.
- Regex search được escape, giới hạn 2–100 ký tự và vẫn là ngoại lệ chưa có search index.

## Representative dataset

Script: `pnpm --filter api perf:rf2d`.

Mỗi lần chạy tạo database tạm có tên ngẫu nhiên `healthcare_rf2d_perf_<ObjectId>`, seed dữ liệu xác định, đo trước/sau rồi chỉ xóa database do chính lần chạy đó tạo.

| Collection        | Documents | Cardinality đại diện                               |
| ----------------- | --------: | -------------------------------------------------- |
| `doctors`         |     2.000 | 1.500 approved, 500 pending                        |
| `sessions`        |    12.000 | 40 patients, 40 doctors, khoảng 300 sessions/actor |
| `messages`        |    20.000 | 100 sessions, khoảng 200 messages/session          |
| `healthmetrics`   |    12.000 | 40 patients, 2 metric types                        |
| `notifications`   |    12.000 | 40 users, read/unread và nhiều notification types  |
| `aiconversations` |     8.000 | 40 users, status/type/archive combinations         |

Mỗi p95 bên dưới gồm 25 lần chạy warm local cho cùng query, không gồm HTTP/network/serialization. Budget local fixture là **p95 ≤ 10 ms**, không `COLLSCAN`, không blocking `SORT`, và `keysExamined/docsExamined ≤ 20` cho page 20. Budget staging tạm thời là **p95 ≤ 100 ms** cho tới khi có dữ liệu và topology staging đại diện.

## P0 query catalog

| Query ID    | Caller/API                           | Collection        | Filter chính                                  | Sort mặc định                | Projection chính                                       | Pagination    | Expected cardinality | Index                                                      | Budget            |
| ----------- | ------------------------------------ | ----------------- | --------------------------------------------- | ---------------------------- | ------------------------------------------------------ | ------------- | -------------------- | ---------------------------------------------------------- | ----------------- |
| `Q-PRC-001` | `GET /users/doctors`                 | `doctors`         | `verificationStatus = approved`               | `userId ASC`                 | `userId`, `specialty`                                  | hard cap 100  | 1.500/2.000          | `verificationStatus_1_userId_1`                            | local p95 ≤ 10 ms |
| `Q-CON-001` | `GET /sessions` — patient            | `sessions`        | `patientId`, optional `status`/date           | `scheduledAt DESC, _id DESC` | session list fields + selected actor fields            | page, max 100 | ~300/actor           | `patientId_1_status_1_scheduledAt_-1__id_-1` or base index | local p95 ≤ 10 ms |
| `Q-CON-002` | `GET /sessions` — doctor             | `sessions`        | `doctorId`, optional `status`/date            | `scheduledAt DESC, _id DESC` | session list fields + selected actor fields            | page, max 100 | ~300/actor           | `doctorId_1_scheduledAt_-1__id_-1`                         | local p95 ≤ 10 ms |
| `Q-MSG-001` | `GET /chat/sessions/:id/messages`    | `messages`        | `doctorSessionId`                             | `sentAt DESC, _id DESC`      | sender, content, attachments, timestamps               | page, max 100 | ~200/session         | `doctorSessionId_1_sentAt_-1__id_-1`                       | local p95 ≤ 10 ms |
| `Q-HLT-001` | `GET /health-metrics`                | `healthmetrics`   | `patientId`, optional `type`/recordedAt range | `recordedAt DESC, _id DESC`  | type, values, unit, recordedAt                         | page, max 100 | ~300/patient         | `patientId_1_type_1_recordedAt_-1__id_-1` or base index    | local p95 ≤ 10 ms |
| `Q-NOT-001` | `GET /notifications?unreadOnly=true` | `notifications`   | `userId`, `isRead = false`                    | `createdAt DESC, _id DESC`   | type, title, message, read state, metadata, timestamps | page, max 100 | ~200 unread/user     | `userId_1_isRead_1_createdAt_-1__id_-1`                    | local p95 ≤ 10 ms |
| `Q-AIC-001` | `GET /ai-assistant/conversations`    | `aiconversations` | `userId`                                      | `createdAt DESC, _id DESC`   | conversation list projection, không messages/internal  | page, max 100 | ~200/user            | `userId_1_createdAt_-1__id_-1`                             | local p95 ≤ 10 ms |
| `Q-AIC-002` | Conversation list với `isArchived`   | `aiconversations` | `userId`, `isArchived`                        | `createdAt DESC, _id DESC`   | conversation list projection                           | page, max 100 | ~200/user            | `userId_1_isArchived_1_createdAt_-1__id_-1`                | local p95 ≤ 10 ms |

`Q-CON-001` và `Q-HLT-001` dùng base actor index khi không có status/type; compound equality index được dùng khi filter tương ứng tồn tại. Date range đứng sau equality prefix và trước tie-breaker theo query shape.

## Explain baseline trước/sau

Kết quả ngày 2026-09-16, MongoDB cục bộ, page 20:

| Query ID    | Trước: stage/index                    | Trước keys/docs | Trước p95 | Sau: managed index                           | Sau keys/docs |  Sau p95 |
| ----------- | ------------------------------------- | --------------: | --------: | -------------------------------------------- | ------------: | -------: |
| `Q-PRC-001` | `COLLSCAN + SORT`                     |         0/2.000 |  6,940 ms | `verificationStatus_1_userId_1`              |         20/20 | 3,691 ms |
| `Q-CON-001` | legacy patient-time + blocking `SORT` |         300/300 |  4,914 ms | `patientId_1_status_1_scheduledAt_-1__id_-1` |         20/20 | 4,254 ms |
| `Q-CON-002` | legacy doctor-time + blocking `SORT`  |         300/300 |  4,367 ms | `doctorId_1_scheduledAt_-1__id_-1`           |         20/20 | 3,934 ms |
| `Q-MSG-001` | legacy session-time + blocking `SORT` |         200/200 |  4,281 ms | `doctorSessionId_1_sentAt_-1__id_-1`         |         20/20 | 3,265 ms |
| `Q-HLT-001` | legacy patient/type/time + `SORT`     |         300/300 |  5,625 ms | `patientId_1_type_1_recordedAt_-1__id_-1`    |         20/20 | 3,893 ms |
| `Q-NOT-001` | legacy user/unread + blocking `SORT`  |         200/200 |  4,820 ms | `userId_1_isRead_1_createdAt_-1__id_-1`      |         20/20 | 3,412 ms |
| `Q-AIC-001` | legacy user/time + blocking `SORT`    |         200/200 |  4,084 ms | `userId_1_createdAt_-1__id_-1`               |         20/20 | 4,458 ms |
| `Q-AIC-002` | legacy user/time + filter + `SORT`    |         200/200 |  4,226 ms | `userId_1_isArchived_1_createdAt_-1__id_-1`  |         20/20 | 4,053 ms |

Planner tự chọn managed index trong benchmark sau tối ưu; không dùng `hint`. Integration regression test dùng `hint` để chứng minh từng index support đầy đủ filter/sort shape và fail nếu xuất hiện `COLLSCAN`, `SORT`, hoặc examine quá page limit.

## Versioned index migration

Migration `202609162200-rf2d-query-indexes` tạo 14 managed indexes:

- practitioner approval: 1;
- session patient/doctor base và status variants: 4;
- message timeline: 1;
- health metric patient base và type variant: 2;
- notification base và unread variant: 2;
- AI conversation base, type, status và archive variants: 4.

Chạy bằng `pnpm --filter api migration:up` với `MONGODB_URI` rõ ràng. Runner ghi `_migrations.id` unique và idempotent. Mongoose schemas dùng cùng index name cho database mới.

Các index legacy đã tồn tại trên database cũ không bị drop trong RF-2D. Chỉ xóa sau khi quan sát `indexStats` trên staging/production đủ một release window và xác nhận không còn caller ngoài catalog; đây là cleanup có chủ đích, không phải thiếu sót migration.

## Search exception

`Q-AIC-S01` và doctor-application search dùng contains regex trên topic/summary/tags hoặc user name/email. RF-2D đã:

- escape toàn bộ regex metacharacters từ client;
- validate input AI search từ 2 đến 100 ký tự;
- giữ pagination; doctor prefilter có hard cap 500 IDs;
- không tạo text index sai semantics hoặc thêm Elasticsearch theo cảm tính.

Contains regex không có anchored prefix vẫn có thể scan actor slice. Đây là ngoại lệ P1 được chấp nhận; khi dữ liệu staging vượt budget, ưu tiên Atlas Search hoặc normalized prefix field và tạo query ID/baseline riêng.

## Cache decision record

| Query                        | RF-2E decision                                              | Lý do                                                                |
| ---------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| `Q-PRC-001` doctor directory | Candidate duy nhất cho vòng cache đầu, chưa bật trong RF-2D | Reuse cao; cần invalidation sau doctor approval/profile/rating write |
| Consultation/message history | Không cache hiện tại                                        | Dữ liệu theo user, thay đổi liên tục, yêu cầu freshness cao          |
| Health metric history        | Không cache hiện tại                                        | Dữ liệu nhạy cảm và append thường xuyên                              |
| Notification timeline        | Không cache hiện tại                                        | Read/unread mutation làm invalidation dày đặc                        |
| AI conversation list         | Không cache hiện tại                                        | User-specific, archive/message writes thay đổi thường xuyên          |

RF-2E chỉ được bật cache doctor directory sau khi có metric hit ratio, key version, TTL, invalidation owner và Redis fallback test.

## Regression và vận hành

- `test/query-performance.integration-spec.ts` tạo database test ngẫu nhiên, apply migration hai lần để kiểm tra idempotency, rồi kiểm tra 8 P0 plans.
- Test database chỉ chứa fixture của test và được xóa trong `afterAll`.
- Script benchmark fail nếu planner sau tối ưu không tự chọn đúng managed index.
- Alternative sorts `updatedAt`/`lastMessageAt`, multi-filter combinations và Atlas Search phải có query ID mới trước khi thêm index.
- Mọi index mới sau RF-2D phải đi qua catalog → fixture → explain → migration → regression test.

## Exit gate

- Typecheck và build: pass.
- Lint: pass với 398 warnings trên budget 402, không có error và không tăng lint debt.
- Unit: 6 suites, 41 tests pass.
- Integration: 2 suites, 4 tests pass với MongoDB replica set, Redis và index-plan regression.
- E2E: 1 suite, 2 tests pass.
- `git diff --check`: pass.
