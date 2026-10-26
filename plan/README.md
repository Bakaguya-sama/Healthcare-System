# Planning map

## Canonical execution route

For any Chronic Care slice, use [roadmap.md](roadmap.md), section 9.1. It is the only implementation roadmap. Its required input packet is `docs/chronic-care-spec.md`, `docs/product-spec.md`, DBML/migrations and the current slice's exit gate.

`archive/refactor-history.md` is retained for completed RF-0..RF-13 evidence, platform dependencies, non-functional cut-lines and legacy feature context. It is not a source for command behavior, permissions, state transitions or HTTP DTO design.

## File roles

| File | Role |
| --- | --- |
| `roadmap.md` | Current implementation roadmap and release gates |
| `archive/refactor-history.md` | Refactor history, platform dependency summary and cut-line context |
| `PROJECT_OVERVIEW_DA2.md` | Scope narrative for the DA2 project |
| `implementation-readiness-review-2026-09-28.md` | Historical readiness assessment |
| `preflight-checklist.md` | Historical RF decision record |
| `rag-upgrade-blueprint.md` | Specialized AI/RAG design input for the later AI slice |

When a file conflicts with `docs/chronic-care-spec.md` or `roadmap.md`, it is a documentation defect to fix before coding—not a choice for the implementer.
