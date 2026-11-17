# Bản đồ tài liệu

> Cập nhật: 17/11/2026. Tài liệu active dùng tiếng Việt; tên code, API,
> enum và thuật ngữ kỹ thuật giữ nguyên tiếng Anh.

## Thứ tự đọc chuẩn

Đọc theo thứ tự dưới đây. Không dùng tài liệu trong `current-state/` hoặc
`plan/archive/` làm implementation contract mới.

1. [Chronic Care specification](chronic-care-spec.md) — canonical Program/Rule/Enrollment command contract: authority, lifecycle, error code, idempotency and public ports.
2. [Product specification](product-spec.md) — product and safety invariants.
3. [Luồng nghiệp vụ P0](business-flows.md) — actor, luồng chính, ngoại lệ, ràng buộc và trạng thái code.
4. [Data model](data-model.dbml) — target persistence model; runtime changes also require migration, schema manifest and database verifier updates.
5. [Implementation roadmap sau DA2](../plan/roadmap-v2.md) — ordered phases, decisions, requirements, execution sequence and exit gates.
6. [Implementation gap audit](implementation-gap-audit-2026-11-17.md) — source-derived gaps, intended features and evidence boundaries.
7. [Phase 0 release evidence](runbooks/phase0-release-evidence-2026-11-17.md) — local rehearsal outcome, deployment blockers and owner actions.
8. [Integration contract](integration-contract.md) — consumer/API mapping; update it with OpenAPI/realtime artifacts in the same slice.

## Document roles

| Document                                                            | Role                                 | Use it for                                                                 |
| ------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| `adr/0001-*`                                                        | Quyết định database/Redis foundation | ranh giới persistence và infrastructure                                    |
| `chronic-care-spec.md` (ADR-0002)                                   | Chronic Care command contract        | behavior, authorization, state, transaction, idempotency, ports            |
| `product-spec.md`                                                   | Product/safety rules                 | invariants and prohibited behavior                                         |
| `business-flows.md`                                                 | Luồng nghiệp vụ P0                   | actor, main flow, exception, constraint và implementation status           |
| `data-model.dbml`                                                   | Target schema                        | fields, relations and indexes                                              |
| `architecture.md`                                                   | Architecture orientation             | bounded contexts and cross-context rules                                   |
| `integration-contract.md`                                           | Consumer integration design          | route/page/DTO planning                                                    |
| `implementation-gap-audit-2026-11-17.md`                            | Rà soát source và backlog sau DA2    | phân biệt runtime, intended feature và quyết định còn mở                   |
| `runbooks/phase0-release-evidence-2026-11-17.md`                    | Evidence Giai đoạn 0                 | rehearsal local, blocker deploy và checklist smoke provider/rollback       |
| `project/da2-proposal.md`                                           | Đề cương DA2 hiện hành               | phạm vi và kế hoạch trình bày đồ án                                        |
| `project/da2-overview.md`                                           | Tổng quan nghiệp vụ DA2              | actor, luồng chính và định hướng sản phẩm                                  |
| `sequence/`                                                         | Sequence diagram                     | mô tả luồng; phải đọc trạng thái trong `sequence/README.md` trước khi dùng |
| `current-state/`                                                    | Historical refactor evidence         | investigation and release evidence, never new feature design               |
| `local-development.md`, `redis-key-policy.md`, `realtime-events.md` | Operational contracts                | local runbook and platform behavior                                        |

## Phân biệt active và lịch sử

- Tài liệu active: các file ở `docs/` ngoài `current-state/`, cùng
  [`plan/roadmap-v2.md`](../plan/roadmap-v2.md).
- [`plan/roadmap.md`](../plan/roadmap.md) là snapshot DA2 trước khi roadmap được
  chia lại theo dependency và exit gate.
- [`plan/roadmap.md`](../plan/roadmap.md) là snapshot DA2 được giữ để truy vết,
  không phải nơi nhận backlog mới.
- Bằng chứng refactor cũ: `docs/current-state/`.
- Kế hoạch/tracker đã được thay thế: `plan/archive/`.
- Runtime contract generated: `apps/api/openapi/openapi.json` và
  `apps/api/contracts/realtime-events.json`. Artifact generated phải khớp source
  trước khi bàn giao consumer.

Bản đồ kế hoạch và archive nằm tại [plan/README.md](../plan/README.md).
