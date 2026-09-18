# RF-9 — Notification và Outbox

## Core implementation

- Notification creation persists an idempotent `notification.created` outbox event in the same MongoDB transaction (replica-set deployment) instead of emitting Socket synchronously.
- `outboxevents` has bounded claim/lease, exponential retry, dead-event state and unique idempotency keys.
- The dedicated `worker:outbox` process schedules BullMQ dispatch every five seconds, claims at most 50 events, then creates one delivery job per event using its idempotency key as `jobId`.
- The API notification gateway subscribes to the Redis channel and emits only in the API process that owns Socket.IO.
- Notification history supports stable cursor pagination; upload ownership is moved from Notifications to `CloudinaryModule`.

## Operations before release

Run the worker alongside the API and monitor pending/dead outbox events. Production MongoDB must be a replica set so the Notification + Outbox transaction is active; the local standalone database cannot prove rollback behavior. Before release, add the worker crash/retry integration suite and operational metrics/readiness dashboard.
