# Google OAuth mobile và email account — runbook

## Phạm vi

Google OAuth chỉ dành cho Patient OAuth-only và mặc định bị tắt. Local email/password
không phụ thuộc Google hoặc Redis OAuth handoff. Browser login dùng Passport, state,
Google PKCE và HttpOnly cookie của browser bắt đầu luồng. Mobile dùng thêm app verifier
proof; không thay thế hoặc làm yếu browser binding.

## Cấu hình và bật provider

1. Lưu `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, callback URL và
   `OAUTH_STATE_ENCRYPTION_SECRET` trong secret manager của đúng môi trường. Secret
   mã hóa phải đủ mạnh (validation yêu cầu tối thiểu 32 ký tự). Không đưa giá trị vào
   ticket, chat, log, docs hay `.env.example`.
2. `GOOGLE_OAUTH_CALLBACK_URL` phải khớp callback đã đăng ký ở Google Console.
   `GOOGLE_OAUTH_MOBILE_REDIRECT_URL` là cấu hình cố định cho custom scheme
   `healthcare://...`, universal link HTTPS hoặc localhost dev; URL được parse và
   không được lấy từ request. Không bật provider nếu app chưa sở hữu/kiểm thử redirect.
3. Redis phải là dịch vụ dùng chung của mọi API instance. OAuth state, Google PKCE
   verifier và mobile attempt/ticket được đặt TTL và consume nguyên tử. Redis lỗi sẽ
   khiến OAuth từ chối, không fallback sang memory.
4. Triển khai cùng browser/mobile consumer đã pin OpenAPI và đã kiểm thử collision,
   state mismatch, PKCE, instance routing, replay, mất verifier và error UI. Môi trường
   test không thay cho staging provider smoke.
5. Bật `GOOGLE_OAUTH_ENABLED=true` và `GOOGLE_OAUTH_ALLOW_SIGNUP=true` riêng theo
   change approval. Rollback bằng cách tắt flag và restart/rollout API; local login
   vẫn hoạt động.

## Luồng mobile và incident triage

- App tạo verifier ngẫu nhiên RFC 7636, gửi challenge, giữ verifier tạm an toàn và mở
  relative `authorizationPath` bằng system browser. Attempt hết hạn sau 5 phút.
- Callback phát ticket tối đa 60 giây và không vượt thời hạn còn lại của attempt
  cho app-link; ticket không phải session. App exchange
  `{ attemptId, ticket, verifier }`; chỉ request đầu tiên có proof đúng nhận session.
- Nếu app mất verifier, ticket hết hạn, replay hoặc Redis unavailable: không retry
  session exchange bằng attempt cũ; khởi tạo login mới. Không manual-edit Redis records.
- Khi điều tra, dùng correlation/request ID và error code an toàn; không copy URL
  callback, deep link, query ticket, state, authorization code, verifier, token, email
  hay raw provider response vào ticket/log. Không có session được phát ở callback
  mobile; session được tạo sau exchange hợp lệ.
- `AUTH_GOOGLE_LOCAL_ACCOUNT_EXISTS`: hướng người dùng đăng nhập bằng password;
  không merge account. `AUTH_GOOGLE_IDENTITY_EXISTS`: yêu cầu dùng Google account ban
  đầu hoặc liên hệ hỗ trợ. Không cho phép tạo account thứ hai theo email.

## Email từ Google và verification OTP

- New User và OAuth identity được ghi trong cùng transaction. Chuẩn hóa email bằng
  trim/lowercase. Chỉ Google OIDC `email_verified=true` mới đặt `emailVerifiedAt`;
  login theo provider subject không đồng bộ email mới từ provider vào User.
- Session response trả `user.emailVerified`. Nếu false, frontend không dùng email
  làm bằng chứng ownership. `POST /auth/request-email-verification` trả response
  generic và có thể queue OTP cho account active chưa verify; `POST /auth/verify-email`
  xác minh email mà không đổi account status active. OTP hết hạn/one-time theo policy
  Auth hiện có.
- OAuth account không có email vẫn có thể xác thực bằng provider subject, nhưng không
  có kênh nhận OTP và không đủ điều kiện cho chức năng yêu cầu verified email. Không
  tự gán email thay thế hoặc merge. Quy trình authenticated add/change email cần API
  riêng nếu sản phẩm mở rộng trường hợp này.

## Backfill OAuth account cũ

Lệnh chỉ chạy từ operator terminal kết nối đúng database; giá trị credential không
được truyền qua chat hoặc lệnh lưu trong shell history nếu policy môi trường cấm.

```powershell
pnpm --filter api auth:backfill-google-emails -- --limit=100
pnpm --filter api auth:backfill-google-emails -- --verify
```

`--limit` tối đa 500; dùng `--after=<ObjectId>` tiếp tục batch sau. Dry-run là mặc
định và chỉ in số lượng/reason counts/cursor, không in email hoặc User. Review report,
collision và backup/restore plan trước khi apply. Khi được owner ủy quyền rõ ràng:

```powershell
pnpm --filter api auth:backfill-google-emails -- --apply --limit=100
```

Lệnh chỉ gán email còn thiếu cho Google OAuth-only Patient có identity phù hợp; update
có điều kiện và transaction cùng AuthEvent. Collision, identity thiếu/sai hoặc record
đổi đồng thời bị bỏ qua. Không merge/xóa user và không đặt `emailVerifiedAt`; người
dùng có thể verify bằng OTP. Chạy lại an toàn; xem lại số `changedDuringApply` rồi chạy
`--verify`. Verifier chỉ báo counts của orphan identity, OAuth-only Patient thiếu
identity, normalized email collisions và provider verification mismatch; không sửa data.

Không chạy `--apply` trên production chỉ dựa vào local evidence. Cần operator owner,
định danh target qua deployment secret manager, backup đã xác nhận và maintenance
window; ghi timestamp/operator/schema version/evidence counts, không ghi email.
