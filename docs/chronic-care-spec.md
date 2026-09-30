# ADR-0002 — Care Program, Care Rule và Care Enrollment foundation

- Status: Accepted
- Date: 2026-09-29
- Scope: `BE-CC-000A`; prerequisite for `BE-CC-000B` and `BE-CC-001`
- Related: `docs/BUSINESS_RULES.md`, `docs/db-template-v8.dbml`, `plan/chronic-care-plan.md`

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

#### Baseline schema v1

`baselineForm` is an allowlisted, versioned contract: `{ schemaVersion: "v1", fields[] }`. Every field has a unique snake_case `key`, a primitive `type` (`number`, `integer`, `boolean`, `string`, or `date`), optional `unit` and numeric `range`, `required`, and `visibility` (`patient` or `care_team`). Executable expressions, unknown properties, nested workflow definitions and arbitrary fields are rejected. At enrollment creation, the complete form and `baselineSchemaVersion` are copied inside `programConfig`; later Program drafts do not affect its validation. Validation errors expose only field keys and stable reason codes, while audit records never contain answer values or consent payloads. A patient-facing projection excludes `care_team` fields.

#### Care task schedule v1

`taskTemplates` is also snapshotted inside `programConfig`. The current P0 contract accepts only a unique snake_case `key`, a supported type (`metric`, `check_in`, `education`, `appointment`, `doctor_review`), and `schedule: { frequency: "daily", time: "HH:mm", windowMinutes }`. The scheduler resolves that IANA-local time to UTC, creates tasks for a rolling seven-day window, and uses `enrollment + template + scheduleVersion + local date` as its idempotent unique key. A task moves `scheduled → due → completed|missed|cancelled`; terminal tasks are never reopened by late metric input. Metric tasks query Health Tracking through its public `HEALTH_METRIC` port and persist only the matching metric ID. Reminder work is an idempotent outbox event, never a provider call in the task transaction.

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

## Implementation contract

The following sections are the normative command contract for `BE-CC-001+`. They define behavior and module boundaries, not HTTP routes, schemas or database migrations.

### Authorization matrix

| Command                      | Admin                                      | Assigned Doctor (`active + approved`)                 | Other Doctor                 | Enrolled Patient                                    | System worker                                            |
| ---------------------------- | ------------------------------------------ | ----------------------------------------------------- | ---------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| Create/edit Program draft    | Allowed with program-management permission | Forbidden                                             | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Publish/retire Program       | Allowed with program-management permission | Forbidden                                             | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Create/edit Rule draft       | Allowed with rule-management permission    | Forbidden                                             | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Activate Rule                | Allowed                                    | Allowed for every active + approved Doctor            | Allowed if active + approved | Forbidden                                           | Forbidden                                                |
| Retire Rule                  | Allowed with rule-management permission    | Forbidden                                             | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Create Enrollment `pending`  | Forbidden                                  | Allowed                                               | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Submit consent               | Read/audit only                            | Read only                                             | Forbidden                    | Allowed for self                                    | Forbidden                                                |
| Submit baseline              | Read/audit only                            | Read only                                             | Forbidden                    | Allowed for self                                    | Forbidden                                                |
| Activate Enrollment          | Read/audit only                            | Triggered by activation guard; no direct override     | Forbidden                    | Triggered indirectly by consent/baseline completion | Allowed only as approved activation worker               |
| Pause/resume/complete/cancel | Read/audit only                            | Allowed only for assigned enrollment, reason required | Forbidden                    | May request pause; may withdraw consent to cancel   | Complete only when an approved completion policy applies |
| Read Enrollment              | Audit scope only                           | Assigned enrollment only                              | Forbidden                    | Own enrollment only                                 | Minimum data required by job                             |

Admin cannot become a substitute for the assigned Doctor in clinical workflow. A Patient cannot select `doctorId`, `status`, Rule version or entitlement from a request as authorization evidence.

### State contracts

#### Program

| From        | To          | Actor            | Required condition                                            |
| ----------- | ----------- | ---------------- | ------------------------------------------------------------- |
| `draft`     | `published` | Authorized Admin | Complete configuration, `dataSources`, version conflict check |
| `published` | `retired`   | Authorized Admin | Reason + audit; no modification of historical version         |

No transition returns to `draft`. To amend a published Program, create a new draft version with the same `programCode` and incremented version.

#### Rule

| From     | To        | Actor                                 | Required condition                                                                                                             |
| -------- | --------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `draft`  | `active`  | Admin or any active + approved Doctor | Parent Program published; declarative schema/operator allowlist passes; activation atomically retires the previous active Rule |
| `active` | `retired` | Authorized Admin                      | Reason + audit                                                                                                                 |

No transition returns to `draft`. A new Rule version is required for any semantic change.

#### Enrollment

| From              | To          | Actor                           | Required condition                                                                 |
| ----------------- | ----------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| â€”               | `pending`   | Assigned Doctor                 | Patient active; Doctor active/approved; published Program and active Rule selected |
| `pending`         | `active`    | Activation guard                | All six activation guards in ADR-0002 pass                                         |
| `pending`         | `cancelled` | Patient or assigned Doctor      | Consent withdrawal, or Doctor reason                                               |
| `active`          | `paused`    | Assigned Doctor                 | Reason                                                                             |
| `paused`          | `active`    | Assigned Doctor                 | All activation guards rechecked                                                    |
| `active`/`paused` | `completed` | Assigned Doctor/approved worker | Completion policy + reason                                                         |
| `active`/`paused` | `cancelled` | Patient or assigned Doctor      | Consent withdrawal, or Doctor reason                                               |

`completed` and `cancelled` are terminal. Invalid transitions return `CARE_ENROLLMENT_INVALID_STATE` without writing audit/outbox state.

### Error contract

All errors use the existing envelope: `code`, `message`, `details`, `correlationId`. `details` may contain safe field names/reason codes but never health values, consent contents or internal authorization data.

| Error code                           | HTTP class | Meaning                                                                  |
| ------------------------------------ | ---------- | ------------------------------------------------------------------------ |
| `CARE_PROGRAM_NOT_FOUND`             | 404        | Program/version does not exist or is outside actor scope                 |
| `CARE_PROGRAM_NOT_PUBLISHED`         | 409        | Enrollment/Rule activation references a non-published Program            |
| `CARE_RULE_NOT_FOUND`                | 404        | Rule/version does not exist or is outside actor scope                    |
| `CARE_RULE_NOT_ACTIVE`               | 409        | Activation references a non-active Rule                                  |
| `CARE_RULE_VERSION_CONFLICT`         | 409        | Draft/publish request uses a stale Program or Rule version               |
| `CARE_DOCTOR_NOT_APPROVED`           | 409        | Assigned Doctor is not active and approved                               |
| `CARE_PATIENT_NOT_ACTIVE`            | 409        | Patient cannot be enrolled because their account is inactive/banned      |
| `CARE_ENROLLMENT_NOT_FOUND`          | 404        | Enrollment does not exist or is outside actor scope                      |
| `CARE_ENROLLMENT_INVALID_STATE`      | 409        | Requested transition is not allowed from current state                   |
| `CARE_ENROLLMENT_ACTIVATION_BLOCKED` | 409        | At least one activation guard failed; returns safe blocking reason codes |
| `CARE_CONSENT_VERSION_MISMATCH`      | 409        | Submitted consent does not match the Program snapshot policy version     |
| `CARE_BASELINE_INCOMPLETE`           | 422        | Required baseline answer is missing or invalid                           |
| `CARE_BASELINE_SCHEMA_INVALID`       | 422        | Program baseline schema is not the allowlisted v1 contract               |
| `CARE_DOCTOR_OVERRIDE_FORBIDDEN`     | 403        | Doctor tries to change a field outside `doctorEditableFields`            |
| `CARE_FORBIDDEN`                     | 403        | Actor is not authorized for the resource/action                          |
| `CARE_IDEMPOTENCY_CONFLICT`          | 409        | Idempotency key was reused with a different request hash                 |

### Command idempotency contract

The following commands require `Idempotency-Key` after their HTTP adapters are introduced:

| Command                      | Idempotency scope                     | Successful retry behavior                                              |
| ---------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Create Enrollment            | actor + patient + program version     | Returns the original pending enrollment                                |
| Submit consent               | actor + enrollment + consent version  | Returns the stored consent result                                      |
| Submit baseline              | actor + enrollment + baseline version | Returns the stored baseline result                                     |
| Activate Enrollment          | enrollment + activation version       | Returns current active enrollment if same transition already succeeded |
| Pause/resume/complete/cancel | actor + enrollment + action           | Returns the original transition result                                 |
| Publish Program              | actor + program draft version         | Returns the published version                                          |
| Activate Rule                | actor + rule draft version            | Returns the active rule                                                |

The record key is scoped by actor and operation. The server hashes normalized request data; identical key/hash replays the stored response, while an identical key with another hash returns `CARE_IDEMPOTENCY_CONFLICT`. State-changing database updates also require an expected state/version predicate, so idempotency does not depend only on the request key.

### Public port contract

The following interfaces are the intended API surface. `BE-CC-000A` documents them only; `BE-CC-000B` introduces the module composition and `BE-CC-001+` implements adapters as needed.

```ts
// users/public-api.ts
export interface PatientCapabilityReader {
  getActivePatient(patientId: string): Promise<{
    id: string;
    isActive: boolean;
  } | null>;
}

export interface DoctorCapabilityReader {
  getApprovedActiveDoctor(doctorId: string): Promise<{
    id: string;
    isActive: boolean;
    verificationStatus: "approved";
  } | null>;
}

// health-tracking/public-api.ts
export interface HealthMetricReader {
  findAuthorizedMetrics(input: {
    patientId: string;
    metricTypes: string[];
    from: Date;
    to: Date;
  }): Promise<
    ReadonlyArray<{
      id: string;
      metricType: string;
      normalizedValue: number;
      normalizedUnit: string;
      measuredAt: Date;
      sourceVersion?: string;
    }>
  >;
}

// notifications/public-api.ts
export interface NotificationCommandPort {
  enqueue(input: {
    recipientId: string;
    type: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

// consultations/public-api.ts
export interface ConsultationLinkPort {
  getAuthorizedConsultation(input: {
    consultationId: string;
    patientId: string;
    doctorId: string;
  }): Promise<{ id: string; status: string } | null>;
}
```

`chronic-care` may not import/inject `User`, `HealthMetric`, `Notification` or `Consultation` Mongoose models, schemas, repositories or non-public service paths. Public port results use opaque IDs and the minimum fields needed by the caller. A Health Metric port may return normalized values required for deterministic rule evaluation, but never a Mongoose document, unrestricted patient history or unrelated profile fields.

### Accepted-decision checklist

- [x] Program/Rule lifecycle and immutable-version policy are accepted.
- [x] Exactly one active Rule per Program version is accepted.
- [x] Six enrollment activation guards are accepted.
- [x] Admin/Doctor/Patient authority matrix is accepted.
- [x] Error and idempotency contract is accepted.
- [x] Public ports expose only minimum data and no cross-module models.
- [x] No unresolved decision blocks the `CC-000B` migration design.
