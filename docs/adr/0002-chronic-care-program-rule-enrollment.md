# ADR-0002 — Care Program, Care Rule và Care Enrollment foundation

- Status: Proposed — awaiting review
- Date: 2026-09-28
- Scope: `BE-CC-000A`; prerequisite for `BE-CC-000B` and `BE-CC-001`
- Related: `docs/BUSINESS_RULES.md`, `docs/db-template-v8.dbml`, `docs/chronic-care-contract-v1.md`

## Context

DA2 adds Chronic Care to a backend that already owns Users, HealthMetrics, Notifications and Consultations in separate bounded contexts. The target schema is approved, but no Chronic Care collection, module, migration or public contract exists in runtime source yet.

The implementation must preserve three invariants:

1. A published program or active clinical rule cannot silently change the history of an enrollment already in progress.
2. An enrollment never starts producing tasks or evaluations until every eligibility and consent guard passes.
3. Chronic Care may use other capabilities, but must not reach across boundaries by injecting their Mongoose models.

## Decision

### 1. Versioned Program and Rule policy

`CarePrograms` is the versioned source of program configuration. A logical program has a stable `programCode`; every material change creates a new document/version. `(programCode, version)` is unique.

| Entity       | States                        | Immutable rule                                                            |
| ------------ | ----------------------------- | ------------------------------------------------------------------------- |
| Care Program | `draft → published → retired` | A published version is never edited. A change starts a new draft version. |
| Care Rule    | `draft → active → retired`    | An active version is never edited. A change starts a new draft version.   |

An Admin with program-management permission owns Program draft editing, publishing and retirement. Admin owns Rule draft editing and explicit Rule retirement through rule-management permission. Every Doctor whose account is `active` and whose verification status is `approved` may activate a Rule; no extra rule-management permission or separate human-review, approval, source or simulation gate is required. The server validates the declarative schema, operator allowlist and Program-version relationship before activation.

Each active Program version has at most one active Care Rule. `BE-CC-000B` must enforce this with a partial unique index for active rules scoped to the Program version. A Rule may only become `active` when its Program is `published` and its declarative structure passes server validation. Activation atomically retires the previous active Rule for that Program version and writes audit records for both changes. `dataSources`, `testResults` and simulation remain optional evidence fields for later quality improvement; they do not block activation in DA2.

No rule executes arbitrary JavaScript, prompt, expression string or user-provided function. `rules` is declarative JSON interpreted by an allowlisted operator set in the future rule-engine slice.

### 2. Enrollment ownership and snapshots

`PatientCarePrograms` is owned by `chronic-care`. It references a Patient, exactly one assigned Doctor, a Program version and a Rule version. At activation it stores the reproducible Program configuration/version, Rule identifier/version, consent version, baseline answers, timezone and allowed Doctor customizations.

The source documents remain authoritative for catalog/history, but task generation, report aggregation and evaluation must read the enrollment snapshot. New Program/Rule versions affect new enrollments only. Moving an existing enrollment to a new version is a future explicit audited command; it is not part of `BE-CC-001`.

### 3. Enrollment state machine and activation gate

```text
pending
  -> active      system transition after all activation guards pass
  -> cancelled   Patient withdraws consent, or assigned Doctor cancels with reason

active
  -> paused      assigned Doctor pauses with reason
  -> completed   assigned Doctor or approved completion worker records reason
  -> cancelled   Patient withdraws consent, or assigned Doctor cancels with reason

paused
  -> active      assigned Doctor resumes after rechecking all activation guards
  -> completed   assigned Doctor or approved completion worker records reason
  -> cancelled   Patient withdraws consent, or assigned Doctor cancels with reason

completed | cancelled
  -> terminal
```

The application, not a client-supplied `status`, performs transitions. `pending → active` happens only when all of the following are true in the same command/transaction boundary as needed:

1. Patient account is active.
2. Assigned Doctor exists, is active and has `verificationStatus = approved`.
3. Program version is `published` and referenced Rule is `active` for that Program version.
4. Patient holds a valid entitlement for the Program at that instant.
5. Consent has the required policy version, timestamp and scopes.
6. All required baseline fields validate against the Program snapshot.

If any guard fails, the enrollment remains `pending`; it returns a stable blocking reason and does not create tasks, evaluations, alerts or reminders. Resume repeats the same guards. Consent withdrawal changes a non-terminal enrollment to `cancelled` immediately and prevents new processing.

Only the assigned Doctor performs clinical workflow transitions. Admin may audit and administer Program/Rule lifecycle but may not acknowledge/resolve clinical alerts or alter a Patient enrollment as a substitute for the assigned Doctor. Patient may submit consent/baseline, withdraw consent and request a pause; a pause request is not itself a state transition.

### 4. Bounded-context ownership and public ports

`chronic-care` owns `CarePrograms`, `CareRules`, `PatientCarePrograms`, `CareTasks`, `HealthEvaluations`, `CareAlerts`, `CareReports` and `CareSummaries`.

| Provider context | What Chronic Care may request through a public port                                                                | What it must not import/inject                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Users            | Patient account state; Doctor active/approved capability; opaque identity/profile summary needed for authorization | `User` model/schema, Users repository or internal service files    |
| Health Tracking  | Authorized, normalized metric values required by a Rule plus metric-change notification by opaque IDs              | `HealthMetric` model/schema or direct collection query             |
| Notifications    | Queue an idempotent notification/outbox command                                                                    | `Notification` model/schema or Gateway as a persistence dependency |
| Consultations    | Verify/link an authorized consultation; receive lifecycle notification by opaque ID                                | `Consultation` model/schema or direct collection query             |

The reverse direction follows the same rule: another context accesses Care Enrollment only through `chronic-care/public-api.ts`, never through a future `PatientCareProgram` model. Cross-context source imports must pass the existing `boundary:check` rule.

### 5. Audit, transaction and side effects

Every Program/Rule lifecycle command and Enrollment state transition writes an `AuditLogs` record with actor, entity, action, reason, correlation ID and a redacted before/after summary. Health values, raw baseline answers, consent payloads and provider secrets are never written to logs.

Use a MongoDB transaction when an enrollment transition writes both the enrollment and audit/outbox record. Do not call Notification, AI, payment provider or external services inside that transaction. Outbox delivery is introduced only when the corresponding command begins producing side effects in a later slice.

### 6. Idempotency and concurrency

Create enrollment, submit consent, submit baseline, activate, pause, resume, complete, cancel, publish Program and activate Rule are retry-sensitive commands. Their API contract requires `Idempotency-Key`.

The server stores an actor- and operation-scoped key plus request hash and result reference. A retry with the same key and request hash returns the original result. Reusing a key with a different request hash returns `CARE_IDEMPOTENCY_CONFLICT`. State transitions use a conditional update on expected state/version; concurrent attempts must result in one successful transition and one deterministic conflict/replay, never two audit events for one transition.

## Consequences

- `BE-CC-000B` can create only the minimum Program/Rule/Enrollment/Audit foundation without prematurely creating Tasks, Reports, AI or Billing collections.
- `BE-CC-001` has a deterministic activation path and explicit authorization policy before an API is exposed.
- Rule changes remain versioned, schema-validated and auditable without imposing a separate human-approval workflow.
- Cross-context coupling stays visible and testable through public ports, at the cost of small adapter interfaces.

## Deferred decisions

- Exact metric/unit allowlist, timezone/DST behavior and baseline form JSON schema: `BE-CC-014` before `BE-CC-002`.
- Rule operator syntax and clinical threshold sources: `BE-CC-003`; source evidence is optional and does not block Rule activation.
- Entitlement implementation and Plan/Subscription persistence: `BE-CC-012`; `BE-CC-001` uses an entitlement port only.
- Task/reminder/outbox mechanics, AI summary, payment and consultation reservation are out of scope for this ADR.
