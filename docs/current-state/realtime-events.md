# RF-0 — Realtime event inventory

Ngày chụp baseline: **2026-09-15**. Tất cả gateway dùng Socket.IO và xác thực JWT từ `handshake.auth.token` hoặc bearer header, ngoại trừ HTTP presence lookup.

## 1. Namespace và authentication

| Namespace        | Gateway                | Room/connection state                                                                               | CORS hiện tại                      |
| ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `/chat`          | `ChatGateway`          | Map in-memory `userId -> socketIds`; client tự join room bằng raw `sessionId` sau participant check | `origin: '*'`                      |
| `/session`       | `SessionsGateway`      | Tự join `user_{userId}_session`                                                                     | `origin: '*'`                      |
| `/notifications` | `NotificationsGateway` | Tự join `user_{userId}_notifications`; map in-memory sockets                                        | `origin: '*'`; websocket + polling |
| `/`              | `PresenceGateway`      | `PresenceService` giữ active sockets trong memory                                                   | `origin: '*'`                      |

JWT verifier bị lặp: chat/notification/presence dùng `getUserIdFromSocket`, session tự parse/verify token. Connection không có rate limit và origin allowlist.

## 2. Client -> server events

| Namespace/event                | Payload hiện tại    | Success event                                     | Error event                            | Authorization                                                 |
| ------------------------------ | ------------------- | ------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| `/chat` `join_session`         | `sessionId: string` | `joined_session {sessionId}`                      | `join_session_error {message}`         | JWT + `ChatService.getSessionDetails` kiểm tra patient/doctor |
| `/chat` `leave_session`        | `sessionId: string` | `left_session {sessionId}`                        | `leave_session_error {message}`        | JWT + participant check                                       |
| `/chat` `send_message`         | `SendMessageDto`    | `message_sent <Message>`; room nhận `new_message` | `send_message_error {message}`         | JWT + participant/senderType check trong service              |
| `/chat` `get_session_messages` | `{doctorSessionId}` | `session_messages <paginated result>`             | `get_session_messages_error {message}` | JWT + participant check; page cố định 1, limit 50             |

Không có acknowledgement callback contract; success/error được phát bằng event riêng. Payload chưa có schema/version/idempotency key.

## 3. Server -> client events

| Namespace/event                      | Producer                                                     | Payload                                                                           |
| ------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `/chat` `new_message`                | REST `POST /chat/send` và socket `send_message`              | Message document                                                                  |
| `/chat` `message_sent`               | socket sender only                                           | Message document                                                                  |
| `/session` `session_changed`         | Session controller sau create/confirm/reject/complete/cancel | `{action,sessionId,patientId,doctorId}`                                           |
| `/notifications` `connected`         | Gateway connect                                              | `{message,userId,socketId,timestamp}`                                             |
| `/notifications` `notifications`     | Notification service create/read/read-all/delete             | `{userId,action,notification?}`; actions: send, mark_read, mark_all_read, deleted |
| `/notifications` `chat_notification` | Chat gateway                                                 | `{sessionId,lastMessageAt,lastMessageId,senderId,senderType}`                     |
| `/notifications` `account_banned`    | Admin service                                                | `null`                                                                            |
| `/` `userStatusChanged`              | Presence connect/disconnect                                  | `{userId,status}` với status online/offline                                       |

`session_changed.action` hiện là `created|confirmed|rejected|completed`. `start` và `reschedule` không emit; `cancel` emit `rejected`. Type tên `SessionStatus` trong gateway không trùng enum persisted `pending|active|completed|rejected`.

## 4. Consumer cũ

| Event                                                                                  |                    Web Client |                                                    Admin |
| -------------------------------------------------------------------------------------- | ----------------------------: | -------------------------------------------------------: |
| `join_session`, `leave_session`, `joined_session`, `join_session_error`, `new_message` |                            Có |                             Không thấy call site feature |
| `session_changed`                                                                      |                            Có | Socket được khởi tạo nhưng không thấy listener nghiệp vụ |
| `notifications`                                                                        |                            Có |                                                       Có |
| `chat_notification`                                                                    |                            Có |                            Không thấy listener nghiệp vụ |
| `account_banned`                                                                       |                            Có |                                                       Có |
| `userStatusChanged`                                                                    |                            Có | Socket được khởi tạo nhưng không thấy listener nghiệp vụ |
| `message_sent`, `send_message_error`, `session_messages`                               | Không thấy listener trực tiếp |                                               Không thấy |

## 5. Known realtime risks

- Presence và connection maps là in-memory; nhiều API instances cho kết quả sai nếu không có Redis adapter/shared state.
- Notification/event được emit trực tiếp sau database call, chưa có outbox; crash giữa commit và emit gây mất event, retry thủ công có thể trùng.
- Socket CORS mở toàn bộ origin và token validation không dùng một policy chung.
- REST chat emit `new_message` nhưng không phát `chat_notification`; socket chat có phát cả hai, nên hành vi phụ thuộc transport.
- Event payload lấy trực tiếp Mongoose document, không có stable public schema hoặc version.
- Không có throttling cho join/send/history events.
- Typing event chỉ là code comment, không phải capability đang hoạt động.

## 6. Disposition

- Giữ tạm event names làm compatibility baseline trong refactor.
- Refactor auth/origin/throttle/presence ở `BE-RF-043`.
- Refactor notification delivery qua outbox/worker ở `BE-RF-061`; Socket chỉ là một delivery adapter.
- Queue/check-in/WebRTC signaling là feature mới, không được thêm vào legacy event set trong RF phases.
- `BE-RF-011` phải xuất JSON Schema hoặc AsyncAPI-like contract và kiểm tra compatibility trong CI.
