# `CC-PAY-001` — Evidence lịch sử VNPAY Sandbox và Subscription grant

> **ARCHIVED — exit gate CLOSED ngày 03/11/2026.** Tên lịch sử của slice là
> `CC-7`; không dùng tên đó cho kế hoạch mới vì dễ nhầm với `CC-007`.
> Trạng thái hiện hành nằm ở `plan/roadmap.md`.

## Phạm vi đã đóng

- [x] `PaymentOrder` lấy amount/quyền lợi từ Plan snapshot phía server.
- [x] Signed Return/IPN verification; public IPN dùng
      `GET /api/v1/billing/payments/vnpay/ipn`.
- [x] Conditional late-IPN transition và duplicate callback idempotency.
- [x] Mongo transaction ghi PaymentTransaction, chuyển order `paid` và enqueue
      đúng một `subscription.grant.requested` event.
- [x] Worker cấp Subscription/queued renewal idempotent.
- [x] Paid-without-grant reconciliation.
- [x] Unpaid cancel và `VNPAY_ENABLED=false` chỉ chặn order mới, không chặn IPN
      hợp lệ của order đã tạo.
- [x] Payment QR mã hóa signed payment URL, không persist QR hoặc signed URL.

## Ranh giới nghiệp vụ đã chốt

- `CC-PAY-001` chỉ sở hữu mua/gia hạn Subscription; không sở hữu
  consultation charging hoặc refund.
- `quotaPolicy = care_program_included` cấm khoản phí consultation riêng.
- Source hiện không có consultation-charge path cần bypass. Nếu bổ sung path đó
  sau này, slice mới phải enforce/test invariant trên; không mở lại gate này.
- Full/automatic refund và Saga framework không thuộc phạm vi.

## Evidence đóng gate

- Public VNPAY Sandbox happy path có signed server-to-server IPN: order `paid`,
  transaction `succeeded`, outbox delivered và renewal queue đúng một lần.
- `test/cc7-payment.integration-spec.ts` chạy trên MongoDB replica set thật,
  mock duy nhất provider boundary; bao phủ invalid signature, late valid IPN,
  replay, paid-without-grant và queued renewal.
- Unit regression bao phủ amount, timezone, signature, evidence redaction và QR.
- Evidence ngày đóng ghi nhận build, lint, typecheck, unit, integration, E2E,
  migration, verifier và migration no-op đều exit 0; schema `202610231000`,
  39 collections và 99 managed indexes.

## Lưu ý khi tái kiểm chứng

- Không commit credential, signed URL hoặc raw callback query.
- OpenAPI artifact đã được regenerate ngày 03/11/2026 và contract check xanh;
  Billing/Plan routes hiện có trong artifact.
- Provider Sandbox evidence và deterministic integration regression là hai loại
  bằng chứng khác nhau; không dùng mock để tuyên bố public callback đã chạy.
