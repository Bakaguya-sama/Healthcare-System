# Local backend development

Tài liệu này là entry gate cho RF-1. Backend dùng Node `24.9.0`, pnpm `9.0.0`, MongoDB `8.0.30` chạy single-node replica set và Redis `8.2.9`.

## 1. Yêu cầu

- Docker Desktop với Linux containers và Docker Compose v2.
- Node đúng `.nvmrc`.
- Corepack/pnpm đúng version trong root `package.json`.

Trên Windows PowerShell, nếu execution policy chặn `pnpm.ps1`, dùng `pnpm.cmd`.

## 2. Cài dependency

Từ repository root:

```powershell
corepack enable
pnpm.cmd install --frozen-lockfile
```

Không xóa hoặc tạo lại lockfile trong phase refactor.

## 3. Cấu hình API

Tạo local file từ template rồi thay các placeholder cần cho flow đang test:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

Local Mongo URI dùng `directConnection=true` để host process kết nối ổn định tới single-node replica set chạy trong Docker:

```env
MONGODB_URI=mongodb://localhost:27018/healthcare_v2_local?replicaSet=rs0&directConnection=true
REDIS_URL=redis://localhost:16379
JWT_SECRET=replace-with-at-least-32-characters
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

Không commit `.env` hoặc credential thật.

## 4. Khởi động và kiểm tra infrastructure

```powershell
docker compose up -d mongo redis
docker compose ps
docker compose exec mongo mongosh --quiet --eval "rs.status().ok"
docker compose exec redis redis-cli ping
```

Kết quả mong đợi: Mongo trả `1`, Redis trả `PONG`, cả hai service ở trạng thái healthy.

Xem log khi healthcheck lỗi:

```powershell
docker compose logs mongo redis
```

Dừng service nhưng giữ dữ liệu:

```powershell
docker compose down
```

Không dùng `docker compose down -v` trừ khi chủ động muốn xóa toàn bộ local database.

## 5. Chạy backend

Lần đầu tạo database hoặc sau khi pull migration mới:

```powershell
pnpm.cmd --filter api database:bootstrap
```

```powershell
pnpm.cmd --filter api start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/api/docs` khi `SWAGGER_ENABLED=true`
- Liveness: `http://localhost:3000/api/v1/health/live`
- Readiness: `http://localhost:3000/api/v1/health/ready`

## 6. Quality commands

```powershell
pnpm.cmd --filter api lint
pnpm.cmd --filter api typecheck
pnpm.cmd --filter api build
pnpm.cmd --filter api boundary:check
pnpm.cmd --filter api openapi:check
pnpm.cmd --filter api realtime:check
pnpm.cmd --filter api test:unit
pnpm.cmd --filter api test:integration
pnpm.cmd --filter api test:e2e
```

Integration test xác minh MongoDB replica set, Redis, migration/no-op, database verifier, idempotent seed, transaction rollback, readiness và graceful Redis shutdown.

## 7. Troubleshooting

- `server=` trống trong `docker version`: Docker Engine chưa chạy; mở Docker Desktop và chờ engine ready.
- Lỗi truy cập `docker_engine` named pipe: chạy Docker Desktop trong đúng Windows user/session.
- Mongo chưa primary: chờ healthcheck, rồi xem `docker compose logs mongo`.
- Port 27017/16379 bị chiếm: dừng Mongo/Redis local khác hoặc đổi cả port mapping và `.env`.
- Provider AI/Cloudinary/SMTP chưa cấu hình: chỉ các flow gọi provider đó mới cần credential; build/typecheck/unit test không được phụ thuộc credential thật.
