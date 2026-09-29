# Planning map

## Canonical execution route

For any Chronic Care slice, use [chronic-care-plan.md](chronic-care-plan.md), section 9.1. It is the only implementation roadmap. Its required input packet is ADR-0002, Business Rules, DBML/migrations and the current slice's exit gate.

`refactor-plan.md` is retained for completed RF-0..RF-13 evidence, platform dependencies, non-functional cut-lines and legacy feature context. It is not a source for command behavior, permissions, state transitions or HTTP DTO design.

## File roles

| File | Role |
| --- | --- |
| `chronic-care-plan.md` | Current implementation roadmap and release gates |
| `refactor-plan.md` | Refactor history, platform dependency summary and cut-line context |
| `PROJECT_OVERVIEW_DA2.md` | Scope narrative for the DA2 project |
| `implementation-readiness-review-2026-09-28.md` | Historical readiness assessment |
| `preflight-checklist.md` | Historical RF decision record |
| `rag-upgrade-blueprint.md` | Specialized AI/RAG design input for the later AI slice |

When a file conflicts with ADR-0002 or `chronic-care-plan.md`, it is a documentation defect to fix before coding—not a choice for the implementer.
