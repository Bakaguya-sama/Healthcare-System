# Backend refactor backlog — RF-0 baseline

Owner mặc định: **Huy (backend/architecture owner theo preflight đã duyệt)**. Estimate là person-days, chưa gồm feature `BE-NF-*`. Dependency dùng backlog ID trong `plan/refactor-plan.md`.

| ID        | Work item                                      | Owner | Dependency                  | Estimate | Status          |
| --------- | ---------------------------------------------- | ----- | --------------------------- | -------: | --------------- |
| BE-RF-001 | Audit endpoint/event/schema/consumer           | Huy   | Không                       |     2-3d | Done 2026-09-15 |
| BE-RF-002 | Sửa API build/typecheck                        | Huy   | BE-RF-001                   |     1-2d | Ready           |
| BE-RF-003 | CI fail-fast và test commands                  | Huy   | BE-RF-002                   |     1-2d | Planned         |
| BE-RF-004 | Characterization tests                         | Huy   | BE-RF-002                   |     3-5d | Planned         |
| BE-RF-005 | Service responsibility/dependency map          | Huy   | BE-RF-001, 004              |     2-3d | Planned         |
| BE-RF-006 | Pagination/query/response conventions          | Huy   | BE-RF-005                   |     2-3d | Planned         |
| BE-RF-007 | Query catalog + explain baseline               | Huy   | BE-RF-006                   |     4-6d | Planned         |
| BE-RF-010 | Backend standalone boundary                    | Huy   | BE-RF-002                   |     1-2d | Planned         |
| BE-RF-011 | OpenAPI/realtime generation                    | Huy   | BE-RF-010                   |     2-3d | Planned         |
| BE-RF-012 | Config/bootstrap hardening                     | Huy   | BE-RF-010                   |     2-3d | Planned         |
| BE-RF-013 | Passport/JWT + Swagger exposure                | Huy   | BE-RF-011, 012              |     2-3d | Planned         |
| BE-RF-014 | HTTP/Socket throttling + correlation logging   | Huy   | BE-RF-012, 013              |     3-4d | Planned         |
| BE-RF-020 | DatabaseModule + migration runner              | Huy   | BE-RF-003                   |     3-4d | Planned         |
| BE-RF-021 | Verifier/index/validator/seed                  | Huy   | BE-RF-020                   |     2-3d | Planned         |
| BE-RF-022 | RedisModule + Terminus lifecycle               | Huy   | BE-RF-012, 020              |     2-3d | Planned         |
| BE-RF-030 | Canonical User/AuthSessions/Redis OTP          | Huy   | BE-RF-022, 013, 004         |     4-6d | Planned         |
| BE-RF-031 | Canonical Practitioner                         | Huy   | BE-RF-030                   |     3-4d | Planned         |
| BE-RF-032 | User/Practitioner/Admin query optimization     | Huy   | BE-RF-006, 007, 031         |     2-3d | Planned         |
| BE-RF-040 | Consultation core + Session adapter            | Huy   | BE-RF-020, 004              |     4-6d | Planned         |
| BE-RF-041 | Message migration                              | Huy   | BE-RF-040                   |     3-4d | Planned         |
| BE-RF-042 | Review/rating refactor                         | Huy   | BE-RF-040                   |     2-3d | Planned         |
| BE-RF-043 | Socket auth/CORS/presence                      | Huy   | BE-RF-014, 030, 040         |     3-4d | Planned         |
| BE-RF-044 | Consultation/Message/Review query optimization | Huy   | BE-RF-006, 007, 040-042     |     3-5d | Planned         |
| BE-RF-050 | Health Tracking refactor                       | Huy   | BE-RF-020, 004              |     3-4d | Planned         |
| BE-RF-051 | AI/RAG consolidation                           | Huy   | BE-RF-020, 004              |     5-7d | Planned         |
| BE-RF-052 | Health/AI query optimization                   | Huy   | BE-RF-006, 007, 050, 051    |     3-4d | Planned         |
| BE-RF-060 | Notification ownership                         | Huy   | BE-RF-020, 004              |     2-3d | Planned         |
| BE-RF-061 | Outbox/BullMQ cho effect cũ                    | Huy   | BE-RF-022, 060, 021         |     4-6d | Planned         |
| BE-RF-062 | Notification/Outbox query optimization         | Huy   | BE-RF-006, 007, 060, 061    |     2-3d | Planned         |
| BE-RF-063 | Cache-aside khi baseline chứng minh cần        | Huy   | BE-RF-007, 022, query owner |     2-4d | Optional P1     |
| BE-RF-070 | Legacy cutover/cleanup                         | Huy   | Tất cả RF bắt buộc          |     2-3d | Planned         |

## Next ready work

`BE-RF-002` là task kế tiếp duy nhất sẵn sàng. Không bắt đầu feature `BE-NF-*` trong RF-1; build/test safety net phải xanh trước.
