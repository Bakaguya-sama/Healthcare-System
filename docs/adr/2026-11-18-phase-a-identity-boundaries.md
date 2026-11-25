# ADR: Phase A identity boundaries

## Decisions

- Local public registration is split into Patient and Doctor commands. Neither accepts a role; privileged roles are provisioned outside the public boundary.
- A local account starts as `pending_verification`. It cannot receive a session or access protected capabilities until verified. A doctor also needs independent Admin approval.
- Refresh identity is derived exclusively from the signed refresh token (`sub`, `jti`). Replay revokes the token family. Normal logout revokes only the current session; `logout-all` is explicit.
- Email delivery is an outbox side effect. OTP is hashed for validation and encrypted only in Redis for worker delivery; event payloads have user id and purpose only, never an email, OTP, password or document URL.
- Google OAuth remains disabled by default and is available only to Patient OAuth-only accounts. The adapter is Nest Passport + OAuth2 PKCE/state with provider identity uniqueness; provider email is never an account-merge key. If Google returns an email owned by a local password account, signup is refused and the user is directed to password login; a second OAuth-only Patient is never created.

## Consequences

The old `POST /auth/register`, OTP delivery endpoints and refresh body `userId` are breaking legacy contracts and must not be used by new consumers. No compatibility window was retained because no frontend consumer exists in this repository; a frontend must pin the generated OpenAPI before rollout.

## OAuth boundary and outstanding enablement gate

Google OAuth uses a Nest Passport Google strategy, PKCE S256 and a one-time
five-minute Redis-backed state record encrypted at rest; the HttpOnly browser cookie
contains only an opaque random state handle. `OAuthAccounts` is the only
OAuth persistence table. Local password and Google OAuth are deliberately
separate authentication methods: Phase A exposes no link, unlink or OAuth
re-authentication operation. Legacy identity records attached to a local-password,
Doctor or administrative user are refused at Google sign-in rather than silently
grandfathered. A conditional unique `(provider, providerEmail)` index prevents a
second OAuth-only Patient when Google supplies the same email through another
provider subject. `GOOGLE_OAUTH_ENABLED` remains disabled by default until this
migration, provider credentials and browser E2E evidence are approved.

### Mobile handoff amendment — 2026-11-25

Mobile OAuth retains Authorization Code + Google PKCE and browser-bound state; it
adds a separate app-generated RFC 7636 verifier/challenge. The API generates a
random attempt ID (5-minute TTL); callback stores an encrypted pending Google
principal and a hash of a one-time ticket (60-second TTL) in shared Redis. The app
must exchange attempt ID + ticket + verifier. Redis atomically consumes a successful
exchange, and only then may Authentication create a session. There is no
attemptId-only compatibility path. If proof is lost/expired, the app starts over.
Configured mobile redirect is parsed/validated at startup and never accepted from a
request. Custom scheme is supported; HTTPS universal links are preferred when owned
and configured. Browser flow continues to require its HttpOnly cookie and Passport
state/PKCE. Redis errors fail closed; no process-memory state fallback exists.

### Google account email amendment — 2026-11-25

New OAuth User and OAuth identity are created in one MongoDB transaction. Google
profile email is normalized; `emailVerifiedAt` is set only when the authenticated
Google OIDC `email_verified` claim is true and evidence is recorded on the identity.
Provider subject, not email, is the login key; subsequent logins do not overwrite
User email. Session responses include `emailVerified`. Active unverified accounts
may use the existing generic email-OTP request/verify endpoints to prove the contact
address without changing account status. Legacy missing-email accounts are handled
only by the explicit dry-run-first backfill command; it never merges accounts or
marks an email verified from an untrusted historical attribute.

## Email action delivery flow

1. Patient/Doctor registration queues the first OTP. Later, the client explicitly calls `POST /auth/request-email-verification` to request a new verification OTP; `POST /auth/resend-verification` is only a deprecated alias. Password recovery uses `POST /auth/password-recovery`. Redis stores the six-digit code's SHA-256 hash, purpose, attempt counter and five-minute TTL; an AES-GCM encrypted delivery copy is stored beside it for the worker only.
2. The request enqueues `auth.otp-delivery.requested.v1` with `userId` and purpose only. It never includes the email address, OTP, password, provider payload or document URL. A unique delivery idempotency key makes resend retry-safe.
3. The outbox worker claims/retries/dead-letters as normal, loads the user, decrypts the OTP from Redis only in process memory and asks SMTP to send it. Logs use event/provider/error type rather than recipient or code.
4. `POST /auth/verify-email` and `POST /auth/reset-password` accept email plus OTP. Email identifies the challenge and OTP proves possession; this is not a request-and-verify combined API. Atomic Redis consume compares hash, bound purpose and attempt/TTL state, then deletes the key on success, so concurrent or replayed submits cannot both succeed.
5. A verified local account transitions `pending_verification → active`. A doctor remains unable to receive full access until the independent Admin doctor approval exists. Password reset updates the hash and revokes every active session.
6. Resend replaces the previous code. Retried delivery may send the same current code, which is harmless; after success, replay is rejected because the Redis key has been removed.

## Rejected Doctor reapplication

`POST /auth/doctor-reapplication/restore` verifies the existing local email and
password before returning the prior professional form data. It returns opaque
document metadata, never raw stored document URLs. Resubmission preserves the
server-owned existing documents and adds uploaded files; it does not accept a
client-controlled retained-URL list. A rejected Doctor whose account is already
`active` is moved only from Doctor `rejected` to `pending` approval and receives
no email-verification OTP. OTP is queued only if the account was still
`pending_verification`.
