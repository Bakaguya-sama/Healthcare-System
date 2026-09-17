# RF-0 — REST endpoint inventory

Ngày chụp baseline: **2026-09-15**

Source: `apps/api/src/**/*.controller.ts` tại branch `huy/refactor`

Prefix runtime: `/api/v1`; Swagger UI mặc định ngoài production: `/api/docs`

## 1. Phạm vi và độ tin cậy

Source hiện có **173 operations trên 121 path**, thuộc 21 controller tags. Danh sách machine-readable đầy đủ, gồm method, path, guard, role, DTO và vị trí source nằm ở `openapi-baseline.json`; `postman-baseline.collection.json` chứa cùng 173 requests để kiểm tra thủ công sau RF-1.

Đây là source-derived baseline của RF-0. Contract runtime hiện tại đã được RF-3 thay bằng `apps/api/openapi/openapi.json`; snapshot này chỉ còn dùng để đối chiếu legacy route và consumer.

## 2. Bootstrap và convention hiện tại

| Thuộc tính     | Hiện trạng                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------- |
| API prefix     | `/api/v1`                                                                                           |
| Validation     | Global `ValidationPipe`: `whitelist`, `forbidNonWhitelisted`, `transform`                           |
| Authentication | Passport JWT qua `JwtAuthGuard`; một số controller/method không guard                               |
| Authorization  | `RolesGuard` + `@Roles`; khi không có metadata role thì guard cho qua                               |
| CORS           | HTTP và Socket dùng chung allowlist `CORS_ORIGINS`; không còn wildcard trong gateway                |
| Response       | Phần lớn service tự trả `{statusCode,message,data}`; pagination/envelope không thống nhất           |
| Error          | Global error envelope có correlation ID; `HttpExceptionFilter` được đăng ký qua `APP_FILTER`        |
| Swagger        | Mặc định bật ngoài production; production bắt buộc tắt bằng validation môi trường                  |

## 3. Inventory theo controller

`JWT` nghĩa là controller/method có `JwtAuthGuard`; `Role` nghĩa là có role metadata thực sự. Bảng dưới gom path có cùng resource; operation chính xác nằm trong OpenAPI baseline.

| Tag/module           | Số operation | Route/capability hiện có                                                                        | Access nổi bật                                                 |
| -------------------- | -----------: | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `auth`               |            9 | register, login, refresh, logout, me, change-password, forgot-password, send-otp, confirm-otp   | Public cho entry/reset flow; JWT cho me/logout/change-password |
| `users`              |           12 | list users, doctor directory/detail, me, user/profile CRUD                                      | Trộn public, JWT và admin role trong cùng controller           |
| `patients`           |            5 | create/list và profile get/update/delete                                                        | JWT; list yêu cầu admin                                        |
| `admins`             |            4 | admin account create/list/update/delete                                                         | JWT + admin                                                    |
| `admin`              |            8 | doctor applications verify/reject, lock/unlock user, session list/detail, dashboard             | JWT + admin                                                    |
| `sessions`           |           12 | create/list/upcoming/detail/update, confirm/reject/start/complete/cancel/reschedule/delete      | JWT; quyền participant/doctor chủ yếu kiểm tra trong service   |
| `chat`               |            6 | send, list session messages, list all, message detail/update/delete                             | JWT; read endpoints thiếu participant filtering nhất quán      |
| `reviews`            |           12 | create/list/by-doctor/rating/top/by-session/detail/update/helpful/flag/delete                   | JWT toàn controller; `flag` không có admin role                |
| `health-metrics`     |            8 | create/list/statistics/alerts/detail/update/review/delete                                       | JWT; role/ownership kiểm tra rải trong service/controller      |
| `notifications`      |            7 | create/list/mark-all/unread/detail/update/delete                                                | JWT; create có `RolesGuard` nhưng không có `@Roles`            |
| `presence`           |            1 | batch status lookup                                                                             | Không guard                                                    |
| `violations`         |            8 | create/list/detail/by-user/update/resolve/delete/stats                                          | JWT + role metadata                                            |
| `blacklist-keywords` |            6 | CRUD + check content                                                                            | JWT + roles ở controller/method                                |
| `upload`             |            8 | single/multiple/info/debug/delete/delete-multiple/avatar/doctor-verification                    | Mixed JWT/admin; Cloudinary                                    |
| `ai-sessions`        |            8 | create/my/list/detail/update/complete/archive/delete                                            | JWT + mixed roles                                              |
| `ai-messages`        |            7 | create/by-session/my/list/detail/update/delete                                                  | JWT + mixed roles                                              |
| `ai-feedbacks`       |           10 | create/my/by-session/stats/list/detail/update/helpful/verify/delete                             | JWT + mixed roles                                              |
| `ai-documents`       |           10 | create/list/search/detail/update/index/usage/archive/delete/RAG ingest                          | Read/metering mixed; mutations chủ yếu admin                   |
| `ai-document-chunks` |           10 | create/batch/by-document/search/list/detail/update/usage/delete                                 | Read/metering mixed; mutations chủ yếu admin                   |
| `ai-health-insights` |            9 | create/my/stats/list/detail/update/acknowledge/notify/delete                                    | JWT + patient/doctor/admin role combinations                   |
| `ai-assistant`       |           13 | conversation start/message/list/detail/favorite/archive/rate/update/delete/stats/summary/search | JWT; canonical AI path được client dùng                        |

## 4. Path inventory cô đọng

Các path dưới dùng prefix `/api/v1`.

- Identity/profile: `/auth/*`, `/users`, `/users/me`, `/users/doctors`, `/users/doctor/{email}`, `/users/{id}`, `/users/{id}/profile`, `/users/profile`, `/patients`, `/patients/profile`, `/admins`, `/admins/{id}`.
- Admin operations: `/admin/doctors/applications`, `/admin/doctors/{id}/verify|reject`, `/admin/users/{id}/lock|unlock`, `/admin/sessions`, `/admin/sessions/{id}`, `/admin/dashboard/stats`.
- Consultation/chat/review: `/sessions`, `/sessions/upcoming`, `/sessions/{id}`, `/sessions/{id}/confirm|reject|start|complete|cancel|reschedule`, `/chat`, `/chat/send`, `/chat/session/{sessionId}`, `/chat/{id}`, `/reviews`, `/reviews/doctor/{doctorId}`, `/reviews/doctor/{doctorId}/rating`, `/reviews/top/doctors`, `/reviews/session/{id}`, `/reviews/{id}`, `/reviews/{id}/helpful|flag`.
- Health: `/health-metrics`, `/health-metrics/statistics/{type}`, `/health-metrics/alerts`, `/health-metrics/{id}`, `/health-metrics/{id}/review`.
- Notification/presence/moderation: `/notifications`, `/notifications/mark-all-as-read`, `/notifications/unread/count`, `/notifications/{id}`, `/presence/status`, `/violations`, `/violations/user/{userId}`, `/violations/stats/overview`, `/violations/{id}`, `/violations/{id}/resolve`, `/blacklist-keywords`, `/blacklist-keywords/check`, `/blacklist-keywords/{id}`.
- Upload: `/upload/single|multiple|avatar|doctor-verification|delete-multiple`, `/upload/info`, `/upload/debug/list`, `/upload/delete`.
- Legacy AI resources: `/ai-sessions`, `/ai-messages`, `/ai-feedbacks`, `/ai-documents`, `/ai-document-chunks`, `/ai-health-insights` cùng các subroutes được ghi đầy đủ trong snapshot.
- Canonical client AI flow hiện tại: `/ai-assistant/conversations/start`, `/ai-assistant/conversations`, `/ai-assistant/conversations/{conversationId}` cùng message/favorite/archive/rate/stats, `/ai-assistant/summary|search`, `/ai-assistant/conversations/summary`.

## 5. DTO và contract findings

- DTO có `class-validator`, nhưng query number transformation không đồng đều. Ví dụ `QuerySessionDto` có `@Type(() => Number)` và min/max; `QueryNotificationDto` không transform/validate page và limit.
- Nhiều endpoint nhận primitive `@Query()`/inline body thay vì DTO, nên Swagger và validation không đầy đủ.
- `sortBy` ở nhiều query là string tự do, có thể đưa field tùy ý vào Mongo sort.
- Multipart được dùng cho chat attachments, AI images, document upload và profile/verification documents.
- Pagination envelope hiện có ít nhất ba dạng: `{data,pagination:{pages}}`, `{data:{notifications,pagination:{totalPages}}}` và `{data,count}`.
- `DELETE /chat/{id}` khai báo HTTP 204 nhưng service trả response body `{statusCode,message}`.

## 6. Consumer map cũ

Audit này chỉ đọc frontend cũ; không sửa `apps/client` hoặc `apps/admin`.

| Consumer   | Các API được xác nhận sử dụng                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web Client | auth/reset/OTP; doctor lookup/directory; profile/upload; sessions create/list/confirm/reject/complete; chat send/history; reviews create/by-session/update; health metrics CRUD/list; notifications list/read/delete; presence status; violations create; toàn bộ conversation flow của `ai-assistant` |
| Admin      | auth/reset/OTP; profile/upload; doctor applications verify/reject; user/doctor/admin lists; account lock/unlock; violations list/update; AI documents; blacklist keyword CRUD; sessions và dashboard data                                                                                              |
| Mobile     | Không tìm thấy source/app mobile trong repository; consumer chưa xác minh                                                                                                                                                                                                                              |

API source có nhiều operation không thấy call site trực tiếp trong hai frontend cũ, đặc biệt các CRUD legacy của `ai-sessions`, `ai-messages`, `ai-feedbacks`, `ai-document-chunks`, `ai-health-insights`, nhiều upload debug/admin endpoints và một số chat/review CRUD. “Không tìm thấy consumer” không đồng nghĩa được xóa; cần access log hoặc xác nhận owner trước cutover.

## 7. External integration và background work

| Nhóm                        | Hiện trạng                                                    |
| --------------------------- | ------------------------------------------------------------- |
| MongoDB                     | Mongoose direct models; chưa có migration runner/verifier     |
| Cloudinary                  | Upload/delete avatar, verification docs, chat/AI documents    |
| SMTP                        | Nodemailer gửi OTP, approve/reject, ban/unban                 |
| Google Gemini               | LLM và embeddings                                             |
| MongoDB Atlas Vector Search | RAG vector store/search                                       |
| LlamaParse/Llama Cloud      | Trích xuất tài liệu                                           |
| Socket.IO                   | chat/session/notification/presence                            |
| Redis/BullMQ/Kafka          | Chưa có                                                       |
| Cron/scheduler/worker       | Chưa có; `setTimeout` chỉ phục vụ retry/timeout nội bộ AI/RAG |
| OAuth/payment/refund/queue  | Chưa có trong runtime source; là feature mới                  |

## 8. Baseline follow-up

- RF-1 giữ nguyên route/hành vi đủ để viết characterization tests, chỉ sửa blocker khiến build/test không chạy.
- `BE-RF-011` đã thay source snapshot bằng OpenAPI runtime có request/response/error schemas và contract diff trong CI.
- Route chỉ được xóa sau khi có disposition, consumer/access-log evidence và adapter/cutover tương ứng.
