# Chronic Care Contract v1 — BE-CC-000A

- Status: Proposed — awaiting review
- Date: 2026-09-28
- Owner: `chronic-care`
- Applies before: `BE-CC-000B`, `BE-CC-001`, `BE-CC-002`

This document turns ADR-0002 into reviewable implementation rules. It intentionally defines behavior and module boundaries, not HTTP routes, schemas or database migrations.

## 1. Authorization matrix

| Command                      | Admin                                      | Assigned Doctor (`active + approved`)                 | Other Doctor                 | Enrolled Patient                                    | System worker                                            |
| ---------------------------- | ------------------------------------------ | ----------------------------------------------------- | ---------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| Create/edit Program draft    | Allowed with template-authoring permission | Allowed with template-authoring permission            | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Publish/retire Program       | Allowed with program-management permission | Forbidden                                             | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Create/edit Rule draft       | Allowed with rule-management permission    | Allowed with explicit rule-management permission      | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Activate Rule                | Allowed                                    | Allowed for every active + approved Doctor            | Allowed if active + approved | Forbidden                                           | Forbidden                                                |
| Retire Rule                  | Allowed with rule-management permission    | Allowed with explicit rule-management permission      | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Create Enrollment `pending`  | Forbidden                                  | Allowed                                               | Forbidden                    | Forbidden                                           | Forbidden                                                |
| Submit consent               | Read/audit only                            | Read only                                             | Forbidden                    | Allowed for self                                    | Forbidden                                                |
| Submit baseline              | Read/audit only                            | Read only                                             | Forbidden                    | Allowed for self                                    | Forbidden                                                |
| Activate Enrollment          | Read/audit only                            | Triggered by activation guard; no direct override     | Forbidden                    | Triggered indirectly by consent/baseline completion | Allowed only as approved activation worker               |
| Pause/resume/complete/cancel | Read/audit only                            | Allowed only for assigned enrollment, reason required | Forbidden                    | May request pause; may withdraw consent to cancel   | Complete only when an approved completion policy applies |
| Read Enrollment              | Audit scope only                           | Assigned enrollment only                              | Forbidden                    | Own enrollment only                                 | Minimum data required by job                             |

Admin cannot become a substitute for the assigned Doctor in clinical workflow. A Patient cannot select `doctorId`, `status`, Rule version or entitlement from a request as authorization evidence.

## 2. State contracts

### Program

| From        | To          | Actor            | Required condition                                            |
| ----------- | ----------- | ---------------- | ------------------------------------------------------------- |
| `draft`     | `published` | Authorized Admin | Complete configuration, `dataSources`, version conflict check |
| `published` | `retired`   | Authorized Admin | Reason + audit; no modification of historical version         |

No transition returns to `draft`. To amend a published Program, create a new draft version with the same `programCode` and incremented version.

### Rule

| From     | To        | Actor                                                      | Required condition                                                                                                             |
| -------- | --------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `draft`  | `active`  | Admin or any active + approved Doctor                      | Parent Program published; declarative schema/operator allowlist passes; activation atomically retires the previous active Rule |
| `active` | `retired` | Authorized Admin or Doctor with rule-management permission | Reason + audit                                                                                                                 |

No transition returns to `draft`. A new Rule version is required for any semantic change.

### Enrollment

| From              | To          | Actor                           | Required condition                                                                 |
| ----------------- | ----------- | ------------------------------- | ---------------------------------------------------------------------------------- |
| —                 | `pending`   | Assigned Doctor                 | Patient active; Doctor active/approved; published Program and active Rule selected |
| `pending`         | `active`    | Activation guard                | All six activation guards in ADR-0002 pass                                         |
| `pending`         | `cancelled` | Patient or assigned Doctor      | Consent withdrawal, or Doctor reason                                               |
| `active`          | `paused`    | Assigned Doctor                 | Reason                                                                             |
| `paused`          | `active`    | Assigned Doctor                 | All activation guards rechecked                                                    |
| `active`/`paused` | `completed` | Assigned Doctor/approved worker | Completion policy + reason                                                         |
| `active`/`paused` | `cancelled` | Patient or assigned Doctor      | Consent withdrawal, or Doctor reason                                               |

`completed` and `cancelled` are terminal. Invalid transitions return `CARE_ENROLLMENT_INVALID_STATE` without writing audit/outbox state.

## 3. Error contract

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
| `CARE_DOCTOR_OVERRIDE_FORBIDDEN`     | 403        | Doctor tries to change a field outside `doctorEditableFields`            |
| `CARE_FORBIDDEN`                     | 403        | Actor is not authorized for the resource/action                          |
| `CARE_IDEMPOTENCY_CONFLICT`          | 409        | Idempotency key was reused with a different request hash                 |

## 4. Command idempotency contract

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

## 5. Public port contract

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

## 6. Review checklist for CC-000A

- [ ] Program/Rule lifecycle and immutable-version policy are accepted.
- [ ] Exactly one active Rule per Program version is accepted.
- [ ] Six enrollment activation guards are accepted.
- [ ] Admin/Doctor/Patient authority matrix is accepted.
- [ ] Error and idempotency contract is accepted.
- [ ] Proposed public ports expose only minimum data and no cross-module models.
- [ ] No unresolved decision blocks the `CC-000B` migration design.
