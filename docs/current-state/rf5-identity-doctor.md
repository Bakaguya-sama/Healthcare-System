# RF-5 — Canonical Identity và Doctor Directory

RF-5 chuyển runtime User sang `users` với `passwordHash`, bổ sung session refresh độc lập và đưa OTP ra Redis.

## Identity

- `AuthSession` lưu SHA-256 refresh-token hash, `familyId`, expiry và revoke/replacement metadata.
- Refresh rotation dùng `jti`; replay token đã revoke sẽ revoke toàn bộ family.
- OTP password-reset dùng Redis với hash, attempt counter và TTL 5 phút; không lưu OTP trong User.
- `AuthEvent` ghi các sự kiện bảo mật quan trọng.
- Migration `202609172100-rf5-canonical-identity` backfill password/profile, xóa secret legacy và tạo index canonical.

## Doctor directory

- `doctorProfile` embedded trong canonical User là read source cho `GET /users/doctors/search`.
- `DoctorDirectoryService.searchDoctors()` dùng `QueryDoctorsDto`, projection, stable sort và pagination bounded.
- Approval/rejection đồng bộ `doctorProfile` canonical; các endpoint admin cũ vẫn chạy qua compatibility bridge trong observation window.
- Doctor collection cũ được giữ tạm trong observation window; migration đã backfill dữ liệu sang User.

## Verification

- TypeScript typecheck, build và 12 unit suites / 58 tests pass.
