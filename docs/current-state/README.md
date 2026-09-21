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
| `service-responsibility-map.md`    | RF-2A inventory 32 services, method ownership và decomposition task map          |
| `pagination-query-contract.md`     | RF-2B shared pagination/cursor contract, allowlist và compatibility policy       |
| `read-query-contract.md`           | RF-2C projection, lean, aggregation và hydrated-command exception                |
| `query-catalog.md`                 | RF-2D P0 query shapes, explain trước/sau, managed indexes và cache decisions     |
| `cache-policy.md`                  | RF-2E cache registry, invalidation/failure policy và benchmark trước/sau         |
| `rf3-platform-contract.md`         | RF-3 boundary, config/bootstrap, auth, generated contract và throttling policy   |
| `rf4-database-foundation.md`       | RF-4 Mongo/Redis lifecycle, migration, verifier, seed và transaction evidence    |
| `rf5-identity-doctor.md`           | RF-5 canonical User, AuthSession, Redis OTP và doctor directory                    |
| `rf6-consultation-core.md`         | RF-6 historical Consultation migration và adapter tại thời điểm triển khai          |
| `migration-manifest.md`            | Registry migration hiện hành và retention rule                                      |
| `rf10-cutover.md`                  | Canonical-only contract, release checklist và rollback runbook                      |
| `rf10c-evidence.md`                | Reconciliation, migration rehearsal và full regression evidence                     |
| `rf11-module-consolidation.md`     | Bounded-context topology, ownership, deleted modules và verification evidence         |

Generator `scripts/rf0-openapi-baseline.cjs` có thể tái tạo OpenAPI/Postman source snapshot. Không dùng snapshot generator này thay cho runtime OpenAPI CI artifact mục tiêu ở `BE-RF-011`.

## Exit gate

- [x] Mỗi module legacy có disposition.
- [x] REST/Socket/schema/index/integration/consumer đã inventory.
- [x] Session, Chat, Review và Notification có behavior/status mapping.
- [x] Known defects tách khỏi feature requests.
- [x] Backlog có owner/dependency/estimate.
- [x] Baseline failure được ghi lại mà không sửa runtime source.

Các file RF-0/RF-6/RF-7 trong thư mục này là historical evidence. RF-10B đã xóa Session compatibility ngày 2026-09-20; contract hiện hành nằm ở `apps/api/openapi/openapi.json`, `apps/api/contracts/realtime-events.json` và `rf10-cutover.md`.
