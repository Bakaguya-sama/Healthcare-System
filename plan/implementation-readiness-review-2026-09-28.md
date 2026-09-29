# Rà soát mức sẵn sàng triển khai — 28/09/2026

## Kết luận

Trạng thái: **READY WITH GATES**.

Có thể bắt đầu code `BE-CC-000A` ngay. Chưa nên bắt đầu đồng thời Care Task, Alert, AI Summary hoặc Payment vì source hiện chưa có module/migration Chronic Care/Billing và một số input theo phase vẫn chưa có owner/evidence. Gate này không chặn việc dựng contract, boundary, migration foundation và seed harness.

## Phạm vi đã rà soát

- Tài liệu sản phẩm/kỹ thuật chính: `docs/overview.md`, `docs/BUSINESS_RULES.md`, `docs/fe-integration.md`, `docs/db-template-v8.dbml`, `docs/db-template-v8-review.md`, local development, realtime/Redis policy và ADR.
- Toàn bộ `docs/current-state/*` để đối chiếu baseline/refactor/cutover.
- Toàn bộ `plan/*`: refactor, Chronic Care, RAG, preflight và project overview.
- Runtime source tree, migration registry, schema manifest, package scripts/version và sự tồn tại của Chronic Care/Billing code.
- Contract hiện hành: OpenAPI và realtime artifact.

Các JSON/Postman/OpenAPI lớn được xem là artifact máy sinh/baseline; việc rà soát tập trung vào metadata, ownership, operation surface và vai trò của chúng thay vì coi nội dung baseline cũ là contract feature DA2.

## Nguồn chuẩn sau rà soát

1. `docs/BUSINESS_RULES.md` — state, policy, authorization và safety.
2. `docs/db-template-v8.dbml` — target schema; v7 là baseline lịch sử.
3. `plan/chronic-care-plan.md` — committed scope, dependency, gate, thứ tự PR và lịch rebaseline.
4. `plan/refactor-plan.md` Phần B/C — kế hoạch backend tổng hợp.
5. `docs/fe-integration.md` — bề mặt contract cho frontend; chỉ trở thành contract runtime khi OpenAPI/realtime artifact được cập nhật cùng implementation.

`docs/current-state/*` và `plan/preflight-checklist.md` là evidence/decision record lịch sử. Không lấy endpoint/state legacy trong đó để thiết kế feature mới.

## Phát hiện và xử lý

| Mức     | Phát hiện                                                                                     | Xử lý                                                                                          |
| ------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Blocker | Timeline ghi Care Program foundation kết thúc 28/09 nhưng source chưa có Chronic Care/Billing | Rebaseline từ 29/09; thêm `BE-CC-000` và đánh dấu carry-over rõ ràng                           |
| Blocker | Chưa có bước contract/migration foundation trước `BE-CC-001`                                  | Thêm `CC-000A/B`, migration/verifier/no-op gate và public port boundary                        |
| High    | Entitlement Free/Plus/Care vừa được ghi P1 vừa là P0 bắt buộc cho VNPAY                       | Chốt P0; seed chỉ là công cụ dev/test, không thay payment acceptance                           |
| High    | OAuth được ghi P0 ở overview nhưng P1 ở execution plan                                        | Chuyển overview về P1 feature-gated                                                            |
| High    | Preflight 15/09 còn ghi Payment P1 và feature freeze 14/12                                    | Giữ làm lịch sử, thêm decision log supersede và trỏ sang gate hiện hành; freeze 08/12          |
| High    | Kế hoạch chỉ có epic lớn, chưa đủ thứ tự PR/exit gate                                         | Thêm bảng vertical slice `CC-000A` → `CC-7`, parallelization và phase gate                     |
| High    | Ước lượng chưa phản ánh migration foundation và capacity chưa điền                            | Thêm 4–6 person-days; tổng P0 còn lại ước tính 88–132 person-days và capacity gate             |
| Medium  | Quy tắc PR không cho prefix `BE-CC`                                                           | Bổ sung `BE-CC`                                                                                |
| Medium  | Rollback còn nhắc legacy adapter dù RF-10 đã canonical-only                                   | Không khôi phục adapter; frontend mới theo generated contract                                  |
| Medium  | README trùng nội dung, Node 18+, mô tả AI “preliminary diagnosis” trái safety scope           | Viết lại README ngắn gọn, Node/pnpm đúng manifest và nguồn tài liệu chuẩn                      |
| Medium  | Hai bản `PROJECT_OVERVIEW_DA2.md` ngoài/trong repo không đồng bộ                              | Bản trong `plan/` là canonical; bản ở workspace root không được dùng làm implementation source |

## Baseline source ngày 28/09

- Có foundation: Users/Auth, Consultations/Chat/Review, Health Tracking, AI/RAG, Notification/Outbox, Redis/cache/health, migration runner/verifier/seed và boundary check.
- Chưa có: module/schema/migration/controller/service Chronic Care, Billing, Plan/Subscription/PaymentOrder hoặc ConsultationUsage.
- DB v8 được duyệt về thiết kế nhưng chưa phải physical runtime schema.
- RF staging evidence còn là release/deployment gate riêng; không chặn `CC-000A`, nhưng phải hoàn tất trước release candidate.

## Verification đã chạy khi rà soát

| Check                   | Kết quả                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| API typecheck           | Pass                                                                                              |
| Unit tests              | Pass — 14 suites, 59 tests                                                                        |
| API build               | Pass                                                                                              |
| Backend boundary check  | Pass                                                                                              |
| OpenAPI check           | Pass                                                                                              |
| Realtime contract check | Pass                                                                                              |
| ESLint                  | Pass theo ngưỡng hiện tại — 0 errors, 267 warnings; warning debt không được tăng trong feature PR |
| `git diff --check`      | Pass                                                                                              |

Integration/E2E/database bootstrap không được chạy trong lượt rà soát tài liệu này; chúng vẫn là gate bắt buộc của `CC-000B` và từng vertical slice có persistence/worker.

## Gate cần chủ dự án điền/xác nhận

| Gate                                               | Chặn từ task            | Trạng thái 28/09                                       |
| -------------------------------------------------- | ----------------------- | ------------------------------------------------------ |
| Owner/reviewer và capacity thực của hai thành viên | `CC-000B` merge         | Chưa điền trong preflight                              |
| Nguồn + người duyệt rule tăng huyết áp/tiểu đường  | `CC-003`                | Chưa có evidence được liên kết                         |
| Metric/unit/timezone allowlist và DST cases        | `CC-002`                | Cần chốt thành contract/test fixture                   |
| SummaryInput v1 + fixed evaluation dataset         | `CC-007`                | Mới có yêu cầu, chưa có artifact version hóa           |
| VNPAY sandbox credential/callback                  | `CC-7`                  | Chưa xác nhận trong preflight                          |
| GenAI/Atlas credential và approved document set    | `CC-007`/RAG acceptance | Chưa xác nhận; mock/provider port dùng được trước gate |

## Việc bắt đầu ngay

Status update 28/09: `BE-CC-000A` is now prepared for review. Its ADR and contract are proposed only; no application schema, migration, API route or worker has been added.

1. Tạo branch/issue `BE-CC-000A`.
2. Viết ADR cho Program/rule versioning, enrollment activation và module ownership.
3. Chốt permission matrix, state transition, error code và command idempotency cho Program/Rule/Enrollment.
4. Chốt public ports tối thiểu; không inject `User`, `HealthMetric`, `Notification` hoặc `Consultation` model xuyên module.
5. Sau review ADR mới mở `CC-000B` cho schema/migration/verifier/seed.

Không cần VNPAY hoặc GenAI credential để bắt đầu năm bước trên.
