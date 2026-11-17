# DA2 release-readiness and consumer handoff

> Evidence date: **2026-11-17**. This is the canonical DA2 release artifact.
> It records local, reproducible evidence only; it is not authority to migrate a
> staging or production database.

## Release status

**Backend repository work complete; conditionally ready for backend consumer
handoff and deterministic DA2 demo.**

The source, local replica-set migration rehearsal, generated API contracts,
full local regression gates, target-test schema verification, and approved
backup/restore rehearsal pass. The configured Atlas test database was brought
to schema `202611171200` using forward-only reconciliation migrations; no
historical migration was edited. Production deployment still requires a release
operator to supply and smoke-test its own non-secret worker/provider/storage
configuration. Do not use this runbook to modify an unknown database.

Accepted DA2 limits are deliberate, not blockers:

- Queue/check-in/call-next apply only to scheduled consultations. On-demand
  consultations keep their existing accept/start flow; a unified queue is
  post-DA2.
- Queue position is authoritative; `estimatedWaitMinutes` may be `null` with
  `ETA_POLICY_NOT_CONFIGURED`. The client must not infer ETA from queue position.
- Pilot policy is buffer `15`, minimum notice `60`, cancellation/reschedule
  cutoff `60`, and check-in early window `15` minutes. Booking snapshots remain
  authoritative for existing consultations.
- `CC-OPS-001`, refund, Admin billing dashboard, cursor history pagination and
  payment-history export are post-DA2.

## Critical-journey traceability

| Journey | Route / worker / event authority | Actor and boundary | Evidence | Release state |
| --- | --- | --- | --- | --- |
| Plan → order → Sandbox IPN → Subscription | Billing command/IPN plus outbox grant/reconciliation | Patient initiates; signed IPN is authority; browser return never grants | unit, integration/E2E regression; `docs/runbooks/billing-payment-evidence.md` | Conditional: only enable Sandbox after callback/reconciliation smoke test |
| Patient billing read | `/plans`, `/subscriptions/me`, `/subscriptions/me/usage`, `GET /billing/payments/orders`, BILL-05 | JWT owner scope; Doctor/Admin denied on Patient self-service routes; BILL-05 shares BILL-04 bounded immutable projection | Billing read and PaymentOrder tests; generated OpenAPI | Ready for handoff |
| Scheduled booking → queue | Availability/booking, `/consultations/:id/check-in`, `/consultations/:id/queue`, `/doctors/me/queue`, `call-next` | Doctor owns slots/queue; Patient owns booking and own queue projection | scheduled booking/check-in/queue integration tests | Ready for scheduled-only handoff |
| Chronic Care evaluation | CareTask/HealthMetric commands → outbox → active Rule evaluation → CareAlert | Patient owns task; assigned Doctor review; Admin has no Enrollment/CareTask clinical read | CareTask policy and worker integration tests | Ready when outbox worker is running |
| Appointment task lifecycle | canonical Consultation transition synchronizes linked `careTaskId` | Consultation is canonical; no synthetic consultation | CareTask policy/consultation regression tests | Ready |
| Report export | export job → outbox worker → private storage → owner signed URL → expiry cleanup | Patient/assigned Doctor participant scope; Admin denied by default | export authorization/race tests; migration `202611061000` | Conditional: storage, worker and cleanup smoke test required |
| CareRule read | `GET /care-programs/:id/rules` | Patient denied; active+approved Doctor gets active summary; Admin projection is sanitized | CareRule read integration tests | Ready for handoff |
| Realtime | `apps/api/contracts/realtime-events.json` | authenticated room membership; REST/database remains source of truth | `realtime:check`; reconnect contract | Ready for handoff |

## Reproducible local release gates

Run from repository root on Node `24.9.0` and pnpm `9.0.0`. On Windows, use
`pnpm.cmd` if PowerShell blocks `pnpm.ps1`.

```powershell
docker compose up -d mongo redis
pnpm.cmd --filter api typecheck
pnpm.cmd --filter api build
pnpm.cmd --filter api test:unit
pnpm.cmd --filter api test:integration
pnpm.cmd --filter api test:e2e
pnpm.cmd --filter api openapi:generate
pnpm.cmd --filter api openapi:check
pnpm.cmd --filter api realtime:check
pnpm.cmd --filter api boundary:check
pnpm.cmd --filter api lint
git diff --check
```

Evidence on 2026-11-17: all commands above passed locally. Integration requires
the Compose MongoDB replica set on port `27018` and Redis on `16379`; a missing
replica set is an infrastructure failure, not evidence that business tests pass.
The current lint command allows the repository baseline (`--max-warnings 402`);
this release work adds no lint warning.

### Empty-database migration rehearsal

Never rely on the API `.env` for this rehearsal: it can point to a remote
environment. Set a unique local database URI for the child command. The result
on 2026-11-17 was schema version `202611062000`, `37` collections and `117`
managed indexes; the second migration was a no-op.

```powershell
$env:MONGODB_URI = 'mongodb://localhost:27018/healthcare_release_readiness_<unique>?replicaSet=rs0&directConnection=true'
pnpm.cmd --filter api database:migrate
pnpm.cmd --filter api database:verify
pnpm.cmd --filter api database:migrate -- --expect-noop
```

The database-foundation integration test has a local 30-second timeout for this
full migration/verification/no-op path. It is intentionally not a global Jest
timeout because the migration set creates and verifies the complete manifest.

## Backup and restore rehearsal

The repository has no automated `mongodump`/`mongorestore` script. The following
is the required deployment rehearsal on a named staging/rehearsal database, never
on production and never against an unclear URI:

1. Record the approved target URI host/database (without credentials), release
   commit, schema version and operator.
2. Create an encrypted backup with the organization-approved MongoDB backup tool;
   record its object/version and restore test timestamp. Do not store credentials
   or backup paths with patient data in Git.
3. Restore that backup to a *different* rehearsal database/cluster.
4. Run `rf10c:reconcile` if the restored data contains RF-10 legacy data. Continue
   only with `ready=true` and zero blockers.
5. Run `database:migrate`, `database:verify`, then `database:migrate -- --expect-noop`.
6. Compare document counts and managed index/validator verification with the
   restored source; run the critical demo matrix below.
7. Retain the command output and destroy only the approved rehearsal database
   under the environment retention policy.

### Evidence recorded 2026-11-17

With explicit approval to use the configured **Atlas test** source, a full
`mongodump --gzip` archive was restored into the isolated local database
`healthcare_release_readiness_20261117`. The restore completed with **1,541
documents and 0 failures**. Post-restore metadata checks found 43 collections,
44 applied migration records with latest version `202611171200`, the
Consultation/CareProgram/CareRule validators, and the DA2 booking, usage,
export, and PaymentOrder indexes.

Two forward-only migrations made this rehearsal possible without changing
business semantics:

1. `202611171100-consultation-null-timestamp-reconciliation` removes BSON
   `null` only from optional Consultation timestamps. Missing and `null` both
   mean “timestamp absent”; no timestamp is invented.
2. `202611171200-care-catalog-version-type-reconciliation` converts legacy
   BSON `int` CareProgram/CareRule `version` values to BSON `double`, preserving
   the same numeric version required by the canonical validator.

The archive is temporary operational evidence, not a Git artifact. Retain or
destroy it under the test-data retention policy.

## Privacy and authorization review

| Actor | Allowed | Must be denied or redacted |
| --- | --- | --- |
| Patient | Own enrollment/task/queue, own billing/order history, entitled own report export | Other Patient data, Rule data, raw provider/IPN/payment transaction data, other queue identities |
| Assigned Doctor | Assigned enrollment/task and own queue; permitted Rule active summary; participant report export | Unassigned Patient clinical data, draft/raw Rule logic, other Doctor queue |
| Admin | Program/Rule administrative projection where specified | Enrollment and CareTask clinical read, Patient self-service billing route, raw task/metric/check-in/review-note data |
| Worker/system | Transactional outbox processing and bounded event payloads | Raw clinical declaration in outbox/realtime/log-facing payload; provider secrets/callback body in consumer response |

Release review must reject any new endpoint/event/log that violates this table.
For realtime, `apps/api/contracts/realtime-events.json` is the versioned contract;
events are hints after persistence, not durable state. On reconnect, clients refetch
REST state and rejoin only authorized rooms.

## Feature flag and worker matrix

| Component | DA2 default | Enable only when | Smoke-test / rollback |
| --- | --- | --- | --- |
| Outbox worker (`pnpm --filter api worker:outbox`) | Required | Mongo replica set, Redis and worker health are available | Restart worker; expired leases must be reclaimed; inspect redacted `outbox.health`; do not delete events |
| Care monitoring automation | Disabled | `CARE_MONITORING_AUTOMATION_ENABLED=true`, scheduler/retry/dead-letter evidence and clinical owner approval | Use `docs/runbooks/care-monitoring-automation.md`; set false and restart worker to defer, not discard |
| VNPAY Sandbox | Disabled | `VNPAY_ENABLED=true`, secret-manager credentials, reachable IPN callback and reconciliation smoke test | Verify duplicate IPN does not duplicate grant; disable VNPAY/reconciliation flags and preserve order/audit evidence |
| Payment reconciliation | Disabled | VNPAY Sandbox is healthy and the reconciliation operator/runbook is available | Run bounded reconciliation evidence; never grant from browser return |
| CareReport export | Disabled until configured | storage credentials, `CARE_REPORT_EXPORT_ARTIFACT_TTL_MINUTES=1440`, `CARE_REPORT_EXPORT_SIGNED_URL_TTL_SECONDS=300`, outbox worker and cleanup smoke test | Verify owner-only status/download, expiry and stale lease recovery; missing config must fail closed |
| AI/RAG | Disabled unless demo evidence exists | knowledge base, provider credentials, citation and raw-payload safety smoke test pass | Disable feature; deterministic Chronic Care flows remain available |
| `CC-OPS-001` dashboards | Post-DA2 | Not a DA2 enablement | No release dependency |

All credentials belong in the deployment secret manager. Configuration documentation
may contain variable names and non-secret TTLs only; it must never contain secret
values, provider callback payloads or private artifact URLs.

## Demo matrix

| Scenario | Preconditions | Actor / action | Expected evidence | Cleanup |
| --- | --- | --- | --- | --- |
| Normal scheduled journey | published Plan, active Subscription and Doctor slot | Patient book/check-in; Doctor call-next/start/complete | quota reservation then count exactly once; scheduled queue only | Use isolated demo users/slot |
| Attention alert | active enrollment, active Rule, worker on | Patient submits valid check-in/metric | redacted outbox metadata, attention alert, assigned Doctor action | Close test alert through canonical flow |
| Urgent escalation | approved urgent rule/data fixture, worker on | Patient submits canonical check-in/metric | urgent alert/escalation; no raw clinical payload in event/log-facing output | Follow clinical demo policy; remove fixture only in rehearsal DB |
| Billing | Sandbox prerequisites satisfied | Patient lists BILL-04, opens BILL-05; provider sends retry IPN | owner-only bounded history; no duplicate grant | use Sandbox test order only |
| Export | storage/worker config present | participant creates PDF/CSV job, polls, downloads | owner-only signed URL; expiry blocks access; CareReport remains immutable | wait for expiry/cleanup or use isolated artifact prefix |
| Fail closed | omit one required config or use invalid owner/content/URL | invoke command/read | named policy/projection/ownership error, no side effect | restore configuration; no manual DB edits |

## Frontend consumer handoff

Provide the frontend repository with:

1. `apps/api/openapi/openapi.json`, generated from source and verified by
   `pnpm --filter api openapi:check` at the release commit.
2. `apps/api/contracts/realtime-events.json`, verified by
   `pnpm --filter api realtime:check`.
3. HTTP error semantics: authentication/forbidden, safe not-found, validation,
   conflict/idempotency replay, and fail-closed projection/policy errors in the
   generated OpenAPI and `docs/integration-contract.md`.
4. Explicit client behavior: refetch after reconnect/409, accept nullable ETA,
   handle no-current-subscription/unavailable projection/unavailable content/expired
   export artifacts, and never derive entitlement or ownership client-side.
5. DA2 boundaries: scheduled-only queue; no unified on-demand queue; no Admin
   Enrollment clinical read; no refund/Admin Billing dashboard; `CC-OPS-001` post-DA2.

Full Web E2E belongs to the frontend repository after it pins these two generated
artifacts and generates its client.

### 2026-11-17 handoff completion addendum

The final consumer-contract audit added curated DA2 frontend types and integration
notes in `docs/fe-integration/`. It also closed a real BILL-05 projection gap:
`GET /billing/payments/orders/:id` now uses the same owner-scoped, immutable,
redacted projection as BILL-04, with OpenAPI success/error DTOs and unit plus
replica-set ownership/redaction evidence. This completes the backend-repository
part of the release-readiness handoff; it does not constitute a smoke test of a
deployment's secrets, public IPN callback, storage, or workers.

## Deployment blockers and owners

| Blocker | Owner | Required resolution |
| --- | --- | --- |
| Production environment migration/rehearsal | Deployment/database owner | Repeat the approved backup, forward migration, verifier, no-op and restore procedure against the production-equivalent environment; the 2026-11-17 evidence covers Atlas test only. |
| Sandbox/provider worker smoke tests | Release operator | Enable only after non-secret configuration and callback/storage/provider health are verified. |
| Frontend generated-client/Web E2E | Frontend owner | Pin OpenAPI/realtime artifacts and run consumer contract/Web tests in the frontend repository. |
