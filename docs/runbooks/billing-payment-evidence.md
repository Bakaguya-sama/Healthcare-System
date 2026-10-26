# Billing payment evidence and Atlas connectivity

## Read-only payment evidence

An authenticated Admin can inspect one payment flow without exposing VNPAY's raw callback, secure hash, or outbox error text:

```text
GET /api/v1/billing/payments/orders/:orderId/evidence
```

The projection reports the server-side order, sanitized transaction result, outbox delivery state, and immediate/queued subscription grant. It is an operational endpoint, not a Patient endpoint and not a substitute for the VNPAY callback signature check.

## Atlas connectivity probe

Run from `apps/api`:

```bash
pnpm database:probe
```

The command loads the API `.env` without replacing CI values, pings MongoDB with an 8-second connection timeout, and prints only the cluster host and latency. It never prints credentials or the full URI.

If it fails while the API process is connected:

1. In Atlas **Network Access**, add the current egress public IP of the terminal/runner.
2. Confirm the runner permits outbound DNS and TCP/TLS to Atlas. An IDE or agent sandbox may have a different egress policy from the already-running API process.
3. Re-run `pnpm database:probe`; do not broaden the allowlist permanently. Remove any temporary entry after diagnosis.

Do not use a public or Patient-facing endpoint to expose `PaymentTransaction.gatewayPayload`, VNPAY hashes, raw provider errors, or arbitrary database documents.

## Payment QR delivery

`POST /api/v1/billing/payments/orders` returns both the signed `paymentUrl` and
`paymentQrDataUrl`. The latter is an in-memory PNG data URL whose payload is exactly
the former; the client can render it directly as an image for another device to scan.

The API generates a QR only while an order is payable. Paid, cancelled, expired, or
newly expired orders return `paymentUrl: null` and `paymentQrDataUrl: null`. The QR
image and the signed URL are never persisted, logged, or returned by the read-only
order endpoint. A retry using the same `Idempotency-Key` while the order remains
payable receives a newly generated image for that order's currently valid signed URL.
