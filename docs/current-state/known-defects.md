# RF-0 — Known defects vs feature requests

Ngày audit: **2026-09-15**. Severity ở đây dùng để sắp thứ tự refactor, chưa thay thế security review.

## 1. Known defects / technical debt hiện hữu

| ID     | Severity | Hiện tượng có bằng chứng source/baseline                                                                            | Task xử lý                                 |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| KD-001 | Blocker  | Backend build fail 50 TypeScript errors; Mongo shell `createIndex.ts` bị compile như app code                       | BE-RF-002                                  |
| KD-002 | Blocker  | `Doctor`, `DoctorSchema`, `DoctorDocument` được import nhưng `doctorProfile.schema.ts` chỉ export embedded profile  | BE-RF-002, BE-RF-031                       |
| KD-003 | Blocker  | Unit/e2e bootstrap fail vì Mongoose không suy ra runtime type của `auth User.role`                                  | BE-RF-002                                  |
| KD-004 | Critical | `GET /chat/session/{id}`, `GET /chat`, `GET /chat/{id}` không enforce participant/ownership tương đương socket path | BE-RF-004, BE-RF-041                       |
| KD-005 | High     | Hai incompatible `UserSchema` cùng nhắm collection `users`; runtime modules vẫn dùng auth legacy schema             | BE-RF-030                                  |
| KD-006 | High     | JWT có fallback `default_secret_change_in_production`; config không fail-fast                                       | BE-RF-012, BE-RF-013                       |
| KD-007 | High     | Review create không xác minh patient/doctor thuộc session, không yêu cầu completed, không unique theo session       | BE-RF-004, BE-RF-042                       |
| KD-008 | High     | Review helpful/unhelpful/flag trả success nhưng không persist; flag không có admin role metadata                    | BE-RF-042                                  |
| KD-009 | High     | Socket gateways cho mọi origin; presence/connected-user state chỉ ở memory nên sai khi scale nhiều instance         | BE-RF-043                                  |
| KD-010 | High     | Notification DB write và socket/email side effects không có outbox/retry/idempotency                                | BE-RF-060, BE-RF-061                       |
| KD-011 | Medium   | Session cancel persist/emit như rejected và luôn gửi nội dung “rejected by doctor”; start/reschedule không emit     | BE-RF-004, BE-RF-040                       |
| KD-012 | Medium   | Session state/event action dùng hai vocabulary khác nhau; `start` cho phép pending -> active bỏ qua confirm         | BE-RF-040, BE-RF-043                       |
| KD-013 | Medium   | Notification read operations cập nhật `isRead`/`readAt` không nhất quán; `expiresAt` không có TTL index             | BE-RF-060, BE-RF-062                       |
| KD-014 | Medium   | Notification create gắn `RolesGuard` nhưng không có `@Roles`, do đó mọi JWT hợp lệ đều qua                          | BE-RF-004, BE-RF-060                       |
| KD-015 | Medium   | REST và Socket send-message phát tập event khác nhau                                                                | BE-RF-041, BE-RF-043                       |
| KD-016 | Medium   | Nhiều list/statistics query unbounded hoặc pagination/sort không validate; envelope không thống nhất                | BE-RF-006, BE-RF-007 và domain query tasks |
| KD-017 | Medium   | Review + doctor rating projection dùng multi-write rollback thủ công, không transaction                             | BE-RF-042                                  |
| KD-018 | Medium   | `DELETE /chat/{id}` khai báo 204 nhưng trả body/statusCode 200 từ service                                           | BE-RF-011, BE-RF-041                       |
| KD-019 | Medium   | Swagger UI luôn bật; error/response DTO coverage không đủ để coi OpenAPI là contract                                | BE-RF-011, BE-RF-013                       |
| KD-020 | Low      | Legacy AI có AiConversation và AiSession/AiMessage song song; owner/canonical path không rõ                         | BE-RF-051                                  |

Resolution note: `KD-001`, `KD-002` và `KD-003` đã được xử lý trong RF-1 ngày 2026-09-15. Các dòng được giữ lại để bảo toàn lịch sử audit; những defect còn lại chưa được sửa chỉ vì đã có characterization test.

## 2. Feature requests — không được sửa lẫn trong RF defect task

| Feature                                                   | Loại                               | Backlog                 |
| --------------------------------------------------------- | ---------------------------------- | ----------------------- |
| Patient đặt lịch từ slot doctor công bố                   | New domain feature                 | BE-NF-010, BE-NF-011    |
| On-demand request v2, check-in, queue, call-next, no-show | New domain feature                 | BE-NF-020 đến BE-NF-023 |
| Appointment reminder, FCM/user devices/campaign           | New delivery feature               | BE-NF-030 đến BE-NF-032 |
| OAuth login/linking                                       | New identity feature               | BE-NF-001               |
| AI daily quota                                            | New product/control feature        | BE-NF-040               |
| VNPAY payment, cancel and full refund                     | New billing feature                | BE-NF-050 đến BE-NF-052 |
| Manual/AI moderation workflow mới                         | Product feature trên foundation cũ | BE-NF-060, BE-NF-061    |
| WebRTC/TURN signaling                                     | New realtime feature               | BE-NF-070               |

## 3. Triage rule

- Sửa compile, security/ownership hole hoặc endpoint tuyên bố success nhưng không làm gì là defect/refactor.
- Thêm state/entity/business outcome chưa từng tồn tại là feature, kể cả khi có thể “gắn nhanh” vào Session legacy.
- Nếu một RF fix làm thay đổi response/event/status được frontend cũ quan sát, phải có characterization test và compatibility decision; không tự đổi contract dưới nhãn cleanup.
