# RF-6 — Consultation core và Session compatibility

RF-6 chuyển runtime on-demand consultation sang collection `consultations`, nhưng giữ nguyên `/sessions` để frontend cũ chưa phải đổi ngay.

## Canonical state

- `requestStatus`: `pending -> accepted|declined|cancelled|expired`.
- `sessionStatus`: `not_started -> confirmed -> in_progress -> completed|cancelled`.
- `mode = on_demand` cho flow hiện tại; scheduled booking/AvailabilitySlot chưa thuộc phase này.
- `ConsultationsService` sở hữu commands request, accept, decline, start, complete, cancel, reschedule và remove.
- `SessionsService` là compatibility adapter, map `Consultation` về legacy `status`: `pending`, `active`, `completed`, `rejected`.

## Data migration and query policy

- Migration `202609182100-rf6-consultations` copies legacy `sessions` into `consultations` idempotently.
- Consultation list dùng projection, `lean()`, stable `_id` tie-breaker và bounded page.
- Upcoming query giới hạn tối đa 31 ngày và 100 items.
- Compound indexes theo doctor/patient + request/session status + thời gian được tạo trong migration.
- Chat session lookup có fallback sang Consultation để flow tư vấn cũ không mất room/message access trước RF-7.

## Compatibility mapping

| Legacy Session | Canonical Consultation |
|---|---|
| `PENDING` | `requestStatus=pending`, `sessionStatus=not_started` |
| `ACTIVE` | `requestStatus=accepted`, `sessionStatus=confirmed/in_progress` |
| `COMPLETED` | `sessionStatus=completed` |
| `REJECTED` | `requestStatus=declined` hoặc `cancelled` |

AvailabilitySlot, queue position, check-in/no-show và reminder vẫn để các phase sau.
