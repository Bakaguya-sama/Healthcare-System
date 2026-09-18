# Realtime contract

Machine-readable contract chính thức của backend được sinh tại `apps/api/contracts/realtime-events.json` từ `src/core/realtime/realtime-contract.ts`.

- Transport: Socket.IO.
- Path mặc định: `/socket.io`, cấu hình bằng `SOCKET_PATH`.
- Namespaces hiện tại: `/chat`, `/session`, `/notifications`, `/` (presence).
- RF-7 canonical chat events: `join_consultation`, `leave_consultation`, `get_consultation_messages`, `consultation.message.v1`; `*_session` events remain compatibility aliases.
- Message send accepts `consultationId` and optional `clientMessageId`; duplicate retries return the original message.
- Origin: dùng chung allowlist `CORS_ORIGINS`; không chấp nhận wildcard.
- Authentication: `handshake.auth.token` hoặc `Authorization: Bearer <token>`.
- Chat client events: mặc định tối đa 30 event/10 giây theo user và handler; vượt giới hạn nhận event `exception`.
- Sau reconnect, client phải refetch REST source of truth và join lại room đã được server xác minh quyền.

Commands:

```bash
pnpm --filter api realtime:generate
pnpm --filter api realtime:check
```

File `docs/current-state/realtime-events.md` giữ inventory/known risks của legacy behavior. Artifact JSON mới là contract kiểm tra trong CI.
