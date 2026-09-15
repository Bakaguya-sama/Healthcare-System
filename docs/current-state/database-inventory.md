# RF-0 — Database inventory

Ngày chụp baseline: **2026-09-15**. Inventory này mô tả model đang được source đăng ký, không phải DB v7 mục tiêu.

## 1. Connection và lifecycle

- Một global Mongoose connection lấy `MONGODB_URI` từ `ConfigService`.
- Chưa có environment validation, migration runner, schema version, migration lock, index verifier, transaction policy hoặc health indicator.
- Chưa cấu hình rõ `autoIndex`/`autoCreate`; hành vi phụ thuộc Mongoose/environment.
- Seed script lấy model bằng token toàn cục và giả định có model `Doctor` riêng.

## 2. Schema/collection hiện tại

Tên collection “suy ra” dưới đây theo Mongoose pluralization vì schema không khai báo `collection`.

| Model/schema                       | Collection                    | Trường chính                                                                                                            | Index khai báo                                                         |
| ---------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `User` (auth legacy)               | `users` (suy ra)              | email, password, fullName, role, accountStatus, profile primitives, otpCode/otpExpiresAt, banReason                     | email `unique` qua prop; không có compound index                       |
| `User` (users canonical draft)     | `users` (explicit)            | fullName, email, passwordHash, role, accountStatus, address, embedded doctorProfile/adminProfile                        | email unique; role+accountStatus; doctor specialty/verification/rating |
| `DoctorProfile` embedded           | trong `users`                 | specialty, workplace, verificationDocuments, experience, rating projection, verification state                          | Index ở parent `UserSchema`                                            |
| `Address`, `AdminProfile` embedded | trong `users`                 | address fields; admin role                                                                                              | Không                                                                  |
| `Patient`                          | `patients` (suy ra)           | userId                                                                                                                  | userId unique qua prop                                                 |
| `Admin`                            | `admins` (suy ra)             | userId, adminRole                                                                                                       | userId unique; adminRole; createdAt desc                               |
| `Session`                          | `sessions` (suy ra)           | patientId, doctorId, scheduledAt, startedAt/endedAt, status, notes, lastMessage\*                                       | patient+scheduled; doctor+scheduled; status+scheduled; scheduledAt     |
| `Message`                          | `messages` (suy ra)           | doctorSessionId, senderId/type, content, attachments, sentAt                                                            | session+sentAt; sender+sentAt; sentAt                                  |
| `Review`                           | `reviews` (suy ra)            | patientId, doctorId, optional doctorSessionId, rating, comment                                                          | doctor+createdAt; patient+createdAt; rating                            |
| `Notification`                     | `notifications` (suy ra)      | userId, type, title/message, isRead/readAt, attachments, metadata, expiresAt                                            | user+createdAt; user+isRead                                            |
| `HealthMetric`                     | `healthmetrics` (suy ra)      | patientId, type, mixed value, unit, recordedAt                                                                          | patient+recordedAt; patient+type+recordedAt                            |
| `Violation`                        | `violations` (suy ra)         | reporter/reported user, report type, description, status/resolution                                                     | Không có explicit index                                                |
| `BlacklistKeyword`                 | `blacklistkeywords` (suy ra)  | keyword và trạng thái/config                                                                                            | keyword unique + text                                                  |
| `AiConversation`                   | `aiconversations` (suy ra)    | userId, type, embedded messages, title/summary/healthContext, token/message counts, favorite/archive/rating/status/tags | user+createdAt/type/status/favorite; createdAt                         |
| `AiSession`                        | `aisessions` (suy ra)         | patientId, status, title/summary                                                                                        | patient+status; patient+createdAt; status+createdAt                    |
| `AiMessage`                        | `aimessages` (suy ra)         | aiSessionId, senderType, content, attachments, sentAt                                                                   | session+sentAt; sentAt                                                 |
| `AiFeedback`                       | `aifeedbacks` (suy ra)        | patientId, aiSessionId, rating/feedback fields                                                                          | patient+createdAt; aiSessionId                                         |
| `AiDocument`                       | `aidocuments` (suy ra)        | title, content/source/file fields, status, uploadedBy                                                                   | title text; status; uploadedBy+createdAt                               |
| `AiDocumentChunk`                  | `aidocumentchunks` (explicit) | documentId, chunkIndex, content, metadata, isActive, usage                                                              | document+chunk; content text; document+isActive                        |
| `AiHealthInsight`                  | `aihealthinsights` (suy ra)   | patientId, healthData, riskLevel, recommendation/ack flags                                                              | patient+createdAt; patient+riskLevel                                   |

Không có schema runtime cho AvailabilitySlot, Consultation v7, QueueEntry, AuthSession, OAuthIdentity, Payment, Refund, OutboxEvent hoặc UserDevice. Đây là feature/database foundation mới, không phải thiếu sót cần vá trong RF-0.

## 3. Mismatch/blocker model

### 3.1 Hai `UserSchema` cùng nhắm `users`

`modules/auth/entities/user.schema.ts` lưu `password`, OTP plaintext-like fields và flat profile. `modules/users/entities/user.schema.ts` lưu `passwordHash` và embedded profiles. Tuy nhiên Auth/Users/Admin modules hiện import model `User` từ auth schema; canonical draft trong users gần như chưa trở thành runtime owner.

Hệ quả: cùng collection có hai contract không tương thích, login/profile/projection dễ đọc sai field; schema draft có index tốt hơn nhưng không chắc được tạo.

### 3.2 `Doctor` model không tồn tại đúng như consumer kỳ vọng

`doctorProfile.schema.ts` chỉ export embedded `DoctorProfile`/`DoctorProfileSchema`. Auth, Users, Admin và Reviews lại import `Doctor`, `DoctorDocument`, `DoctorSchema`, thậm chí `DoctorVerificationStatus` từ file này. Đây là blocker build và cũng làm seed/model registration không đáng tin cậy.

### 3.3 Rating projection không atomic theo transaction

Review document và doctor rating projection được update bằng hai write riêng với rollback thủ công. Không có transaction hoặc unique constraint cho một review trên một consultation; concurrent/retry có thể tạo duplicate hoặc drift.

### 3.4 TTL/index gaps

- `Notification.expiresAt` có field nhưng không có TTL index.
- Auth OTP lưu trong user document, không có TTL collection/index và không phải Redis policy mục tiêu.
- Session không có uniqueness/overlap constraint cho appointment/slot.
- Review thiếu unique index theo completed consultation.
- Violation thiếu index cho admin status/timeline và user lookup.

Các index mới chỉ được quyết định sau query catalog + `explain('executionStats')` ở RF-2; không thêm theo suy đoán trong RF-0.

## 4. Cross-module model access

| Consumer service/module | Models inject trực tiếp                         |
| ----------------------- | ----------------------------------------------- |
| Auth                    | User, Doctor, Admin                             |
| Users                   | User, Doctor, Patient, Admin, Review, Violation |
| Admin                   | User, Doctor, Session, Admin                    |
| Admins                  | Admin, User                                     |
| Reviews                 | Review, Doctor, Session                         |
| Chat                    | Message, Session                                |
| AI Assistant            | AiConversation, Message                         |
| AI Documents            | AiDocument, AiDocumentChunk                     |
| RAG                     | AiDocumentChunk                                 |
| Các module còn lại      | Chủ yếu model do chính module sở hữu            |

Đây là coupling cần giảm bằng facade/port/use case; không được tạo repository tổng quát biết mọi model.

## 5. Collection ownership/disposition

| Legacy data                             | Quyết định RF/NF                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Auth `User` + draft embedded `User`     | **Replace/consolidate** thành canonical User/AuthSession ở `BE-RF-030`; migration có version |
| `Patient`, `Admin`, missing `Doctor`    | **Refactor** theo ownership; practitioner canonical ở `BE-RF-031`                            |
| `Session`                               | **Adapter/refactor** sang Consultation core ở `BE-RF-040`; không gắn feature mới trực tiếp   |
| `Message`                               | **Refactor/migrate** ở `BE-RF-041`                                                           |
| `Review` + rating projection            | **Refactor** ở `BE-RF-042`                                                                   |
| `HealthMetric`                          | **Keep/refactor** ở `BE-RF-050`                                                              |
| AI legacy resources + AiConversation    | **Consolidate** ở `BE-RF-051`; dữ liệu không dùng cần retention decision                     |
| `Notification`                          | **Keep/refactor** owner ở `BE-RF-060`; Outbox/BullMQ là `BE-RF-061`                          |
| `Violation`, `BlacklistKeyword`         | **Keep/refactor** trong moderation scope                                                     |
| Availability/Queue/Payment/Refund/OAuth | **New feature**, chỉ tạo sau dependency RF tương ứng                                         |

## 6. Required evidence ở phase sau

- RF-1: sửa compile/test blocker mà chưa redesign schema.
- RF-2: query catalog, representative dataset và explain baseline trước khi thay index.
- RF-4: migration runner, `_schema_migrations`, lock/checksum, verifier, idempotent seed, replica-set integration tests và source-controlled index/search definitions.
- Mọi rename/drop collection cần migration forward, verification và rollback/restore procedure; không dùng startup sync để thay migration.
