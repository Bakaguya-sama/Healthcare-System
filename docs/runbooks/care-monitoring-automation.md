# Care monitoring automation runbook

## Scope and safety boundary

`CARE_MONITORING_AUTOMATION_ENABLED` is disabled by default.  When enabled, the
outbox worker evaluates `health.metric.recorded` events and delivers
`care.task.reminder` events.  It never places raw metric values in an outbox
payload or operational log.

Enrollment status transitions also write `care.enrollment.tasks.sync.v1` in the
same MongoDB transaction as the Enrollment revision, audit and idempotency record.
The worker re-reads current Enrollment state: active schedules idempotent tasks;
paused/completed/cancelled or missing Enrollment cancels open tasks. With the
automation flag off, invalid-task cancellation still runs; active-task creation is
deferred to the periodic scheduler after the flag is enabled. Scheduler reconciliation
pages all active enrollments and all open tasks in stable `_id` batches. While worker
sync is pending, task commands and reminders re-check current Enrollment state and
fail closed.

The flag must only be enabled after migration `202610191000` has completed and
`database:verify` is successful against the intended environment.  MongoDB must
run as a replica set because metric creation/correction and its outbox event are
one transaction.

## Observe

The worker emits a structured `outbox.health` log at most once per minute with
only counts and `oldestPendingAgeMs`. Alert operations when either condition is
true:

- `dead > 0`: investigate and explicitly replay only the identified event.
- `oldestPendingAgeMs >= 300000`: investigate worker, Redis and MongoDB before
  the backlog grows.

The aggregate can also be obtained from `OutboxService.getMetrics()`; it does
not return payload data. Retain worker logs under the platform logging policy.

## Incident handling

1. Keep the feature flag enabled unless there is evidence that new automation
   itself is harmful. Disabling it defers metric/reminder events; it does not
   discard them.
2. Check worker process health, Redis connectivity, Mongo replica-set state and
   the event's `lastError`, `attemptCount` and aggregate ID.
3. Correct the dependency/configuration failure first. Events whose lease
   expires are claimable by a restarted worker; do not manually alter a
   `processing` event while its lease is valid.
4. For an event in `dead`, use the audited administrative recovery procedure to
   call `OutboxService.requeueDead(eventId)` once. Confirm it reaches
   `delivered`; idempotency keys prevent duplicate evaluation, alert and
   notification side effects.
5. For a clinical concern, have the assigned doctor review the patient's alert
   and record the action. This automation is not diagnostic guidance.

For `care.enrollment.tasks.sync.v1`, first verify the latest Enrollment revision and
status using the authorized operational database procedure, then inspect only event
ID, aggregate ID, revision, attempt count and safe error code. Do not inspect/log
baseline answers, consent payload, task response or HealthMetric values. Reconciliation
can repair missing schedules/cancellations; it does not change Enrollment state.

## Cutover and data review

Existing alerts are preserved and are not merged or closed. The daily
deduplication rule applies only to newly created alerts after cutover. No
historical metric without an outbox event is automatically evaluated. Export
those records for clinician-led review; queued events created while the flag was
off may be processed after enabling, provided the enrollment is still active.

## Rollback

Set `CARE_MONITORING_AUTOMATION_ENABLED=false`, restart the worker, and preserve
the outbox. Do not delete events, alerts or evaluations. Resolve the issue,
validate on a replica-set test environment, then re-enable the flag and monitor
the backlog.
