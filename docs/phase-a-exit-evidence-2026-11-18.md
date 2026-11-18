# Phase A exit-gate evidence — 2026-11-18

## Result

Phase A functional/security/database gates are **PASS** through migration
`202611181220`. The phase is not marked complete because the repository-wide lint
gate is **BLOCKED** by existing warning debt: 635 warnings against the configured
budget of 402. There are no ESLint errors, and the Phase A auth files lint with zero
warnings. The warning budget was not raised to manufacture a pass.

## Verified evidence

Latest database evidence: `pnpm --filter api database:verify` passed at schema
version `202611181220` with 44 collections and 122 managed indexes, after applying
`202611181220-oauth-provider-email-uniqueness`.

| Gate | Command / evidence | Result |
| --- | --- | --- |
| Schema migration | `pnpm --filter api database:migrate` | PASS — applied `202611181200-auth-event-redaction` and `202611181210-oauth-identity-owner-uniqueness` |
| Schema verifier | `pnpm --filter api database:verify` | PASS — version `202611181210`, 44 collections, 121 managed indexes |
| Type safety | `pnpm --filter api typecheck` | PASS |
| Build | `pnpm --filter api build` | PASS |
| Unit regression | `pnpm --filter api test -- --forceExit` | PASS — 51 suites, 183 tests |
| Integration regression | `pnpm --filter api test:integration` | PASS — 23 suites, 115 tests (rerun after an isolated pre-existing order/state flake) |
| HTTP E2E | `pnpm --filter api test:e2e` | PASS — 4 suites, 16 tests |
| API contract | `pnpm --filter api openapi:generate && pnpm --filter api openapi:check` | PASS |
| Realtime/boundary | `pnpm --filter api realtime:check && pnpm --filter api boundary:check` | PASS |
| Phase A lint | targeted ESLint over changed auth service, worker email adapter and Phase A tests | PASS — zero warnings |
| Full lint | `pnpm --filter api lint` | BLOCKED — 635 warnings > configured 402; 0 errors |

## Security assertions exercised

- OTP delivery outbox payload contains only `userId` and `purpose`; it contains no
  recipient address, OTP, password, document URL or provider credential.
- Email verification OTP consumption is atomic and one-time; state mismatch and
  cookie replay for OAuth PKCE are rejected.
- OAuth collision with a local password account is rejected; provider email is not
  an account-merge key. Google OAuth is limited to Patient OAuth-only accounts;
  there is no link, unlink or OAuth re-authentication surface. Migration
  `202611181220-oauth-provider-email-uniqueness` conditional
  `(provider, providerEmail)` index prevents a
  second OAuth-only Patient for the same Google email.
- The persisted `AuthEvent` schema has no paths for email, IP address, user agent,
  OTP, token or document URL. Migration `202611181200` removes legacy persisted
  email/IP/user-agent values.

## Remaining owner action

The platform owner must either reduce the full-repository warning count to at most
402 without weakening lint rules, or explicitly approve a time-bounded lint-debt
remediation plan. Until then the roadmap remains `🚧`, even though the functional
Phase A checks pass.
