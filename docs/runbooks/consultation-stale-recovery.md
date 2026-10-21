# Consultation stale recovery rollout

## Scope

CC-013B handles only consultations in `accepted` + `waiting` state. It never
marks an on-demand consultation as no-show. Scheduled consultations older than
24 hours are queued for Doctor review; they are not cancelled or released.

## Enablement

1. Deploy the API/worker version containing migration `202610201100`.
2. Run `database:migrate`, `database:verify`, then migration no-op rehearsal.
3. Keep `CONSULTATION_STALE_RECOVERY_ENABLED=false` until the worker is healthy.
4. Start exactly the intended worker deployment, then set the flag to `true`
   and restart that worker.
5. Confirm outbox delivery for `consultation.on-demand-timeout-warning`,
   `consultation.on-demand-timeout-extended`,
   `consultation.on-demand-timeout-cancelled`, and
   `consultation.scheduled-stale-review`.

The worker runs every minute. It requires Redis for BullMQ and for the
waiting-room presence lookup. A Redis timeout/error leaves the consultation
unchanged and logs `consultation.stale-recovery.deferred`; the next tick retries.

## Monitoring

Alert on `outbox.health.dead > 0`, sustained pending outbox lag, and repeated
`consultation.stale-recovery.deferred` events. Review audit actions
`on_demand_timeout_warning_queued`, `on_demand_timeout_extended`,
`on_demand_timeout_cancelled`, and `scheduled_stale_review_queued` when
investigating a consultation.

## Rollback

Set `CONSULTATION_STALE_RECOVERY_ENABLED=false` and restart the worker. Do not
delete recovery fields, outbox events, audit rows, or ledger rows. Existing
system cancellations are historical facts; investigate them through the audit
trail. Re-enabling is safe because transitions and notification keys are
idempotent.
