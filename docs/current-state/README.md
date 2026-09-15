# RF-0 current-state baseline

Status: **DONE — 2026-09-15** (`BE-RF-001`).

| Artifact                           | Nội dung                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `endpoints.md`                     | REST inventory, guards/DTO findings, consumers và integrations                   |
| `openapi-baseline.json`            | 173 source-derived operations/121 paths; runtime blocker được ghi trong metadata |
| `postman-baseline.collection.json` | 173 requests để replay sau khi RF-1 làm app bootstrap được                       |
| `realtime-events.md`               | Namespace, event, payload, consumer và risk                                      |
| `database-inventory.md`            | Schema/collection/index/cross-model access và disposition dữ liệu                |
| `legacy-behavior.md`               | Session/Chat/Review/Notification behavior/status mapping                         |
| `module-disposition.md`            | Keep/refactor/replace/consolidate/defer cho mọi module legacy                    |
| `known-defects.md`                 | Defect/technical debt tách riêng khỏi feature request                            |
| `baseline-commands.md`             | Build/unit/e2e/OpenAPI baseline results                                          |
| `rf-backlog.md`                    | Owner, dependency, estimate và next ready task                                   |
| `rf1-verification.md`              | Build/test/CI results và characterization coverage sau RF-1                      |

Generator `scripts/rf0-openapi-baseline.cjs` có thể tái tạo OpenAPI/Postman source snapshot. Không dùng snapshot generator này thay cho runtime OpenAPI CI artifact mục tiêu ở `BE-RF-011`.

## Exit gate

- [x] Mỗi module legacy có disposition.
- [x] REST/Socket/schema/index/integration/consumer đã inventory.
- [x] Session, Chat, Review và Notification có behavior/status mapping.
- [x] Known defects tách khỏi feature requests.
- [x] Backlog có owner/dependency/estimate.
- [x] Baseline failure được ghi lại mà không sửa runtime source.

RF-1 (`BE-RF-002` đến `BE-RF-004`) đã hoàn tất ngày 2026-09-15. Next: **RF-2A / BE-RF-005** — lập service responsibility/dependency map, chưa di chuyển source hàng loạt.
