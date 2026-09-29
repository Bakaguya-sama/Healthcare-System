# Documentation map

## Start here for Chronic Care implementation

Read these documents in order. Do not use the legacy refactor history or a backlog row as an implementation contract.

1. [ADR-0002](adr/0002-chronic-care-program-rule-enrollment.md) — canonical Program/Rule/Enrollment command contract: authority, lifecycle, error code, idempotency and public ports.
2. [Business rules](BUSINESS_RULES.md) — product and safety invariants.
3. [Data model v8](db-template-v8.dbml) — target persistence model; runtime changes also require migration, schema manifest and database verifier updates.
4. [Implementation roadmap](../plan/chronic-care-plan.md) — slice order, scope, explicit non-goals and exit gates.
5. [Frontend integration contract](fe-integration.md) — consumer/API mapping; update it with OpenAPI/realtime artifacts in the same slice.

## Document roles

| Document | Role | Use it for |
| --- | --- | --- |
| `adr/0002-*` | Accepted decision and command contract | behavior, authorization, state, transaction, idempotency, ports |
| `BUSINESS_RULES.md` | Product/safety rules | invariants and prohibited behavior |
| `db-template-v8.dbml` | Target schema | fields, relations and indexes |
| `overview.md` | Architecture/product orientation | onboarding only; it does not override ADR-0002 |
| `fe-integration.md` | Consumer integration design | route/page/DTO planning |
| `current-state/` | Historical refactor evidence | investigation and release evidence, never new feature design |
| `local-development.md`, `redis-key-policy.md`, `realtime-events.md` | Operational contracts | local runbook and platform behavior |

The roadmap and archive map live in [plan/README.md](../plan/README.md).
