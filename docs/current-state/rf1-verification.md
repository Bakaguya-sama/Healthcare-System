# RF-1 verification — build, tests and CI safety net

Recorded: **2026-09-15** on branch `huy/refactor`, Node `24.9.0`, pnpm `9.0.0`.

## Outcome

| Gate                       | Command                              | Result                                   |
| -------------------------- | ------------------------------------ | ---------------------------------------- |
| Locked install             | `pnpm install --frozen-lockfile`     | PASS, lockfile unchanged                 |
| Lint                       | `pnpm --filter api lint`             | PASS; 0 errors, 402 legacy warnings      |
| Typecheck                  | `pnpm --filter api typecheck`        | PASS                                     |
| Build                      | `pnpm --filter api build`            | PASS                                     |
| Unit/characterization      | `pnpm --filter api test:unit`        | PASS, 3 suites/18 tests                  |
| Infrastructure integration | `pnpm --filter api test:integration` | PASS, Mongo replica set + Redis, 2 tests |
| HTTP contract E2E          | `pnpm --filter api test:e2e`         | PASS, 2 tests                            |
| Compose validation         | `docker compose config --quiet`      | PASS                                     |

The 402 lint warnings are recorded legacy debt, mainly unsafe `any`, unchecked query filters and unused values. RF-1 keeps the corresponding rules enabled as warnings instead of disabling them and sets `--max-warnings 402` so the baseline cannot grow unnoticed. All ESLint errors remain fail-fast; TypeScript correctness remains enforced by `typecheck` and `build`. Warning reduction and lowering this budget belong to the capability refactors from RF-2 onward.

## Characterization coverage

The stable fixture layer uses generated MongoDB ObjectIds, fake accounts and mocked provider boundaries; it never uses production data or secrets.

| Legacy behavior                                            | Test evidence                   |
| ---------------------------------------------------------- | ------------------------------- |
| Patient registration, doctor registration/profile creation | `auth.service.spec.ts`          |
| Login, refresh and logout                                  | `auth.service.spec.ts`          |
| Doctor approval                                            | `legacy-critical-flows.spec.ts` |
| Session request, accept and decline                        | `legacy-critical-flows.spec.ts` |
| Chat participant authorization                             | `legacy-critical-flows.spec.ts` |
| Review creation/rating projection                          | `legacy-critical-flows.spec.ts` |
| Health metric create and paginated query                   | `legacy-critical-flows.spec.ts` |
| AI conversation and RAG happy path                         | `legacy-critical-flows.spec.ts` |
| Notification create and read                               | `legacy-critical-flows.spec.ts` |
| HTTP login envelope and validation                         | `app.e2e-spec.ts`               |

These tests intentionally describe legacy behavior. They are regression guards, not approval of known defects such as unverified refresh tokens or incomplete authorization.

## CI behavior

`.github/workflows/ci.yml` now uses the pinned runtime, installs from the lockfile and has no `continue-on-error` or `--passWithNoTests`. The integration job starts Compose and only runs after lint, typecheck, build and unit tests pass. A non-zero exit from any mandatory command stops its job; service logs are printed only on integration failure.

## Infrastructure note

Compose publishes Redis at host port `16379` because port `6379` on the verification machine was already occupied by an authenticated Redis-compatible service. The container still uses its standard internal port `6379`. MongoDB is a single-node replica set named `rs0`.

## Deferred by design

- Versioned database migrations and `database:migrate`/`database:verify`: completed in RF-4 (`BE-RF-020/021`).
- Runtime OpenAPI generation/diff: RF-3 (`BE-RF-011`).
- Resolving the remaining lint warning debt: RF-2 and each domain refactor.
- Fixing known security/business defects captured by characterization tests: their assigned backlog tasks.
