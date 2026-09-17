# Healthcare API

Backend NestJS có thể cài đặt, build và chạy độc lập với source frontend. REST contract được xuất bằng OpenAPI; Socket.IO contract được xuất thành JSON riêng.

## Yêu cầu

- Node.js theo `.nvmrc` ở repository root.
- pnpm theo trường `packageManager` của root `package.json`.
- MongoDB replica set và Redis. Môi trường local có thể dùng `compose.yaml` ở repository root.

## Cấu hình

Sao chép `.env.example` thành `.env` và thay các placeholder. Ứng dụng fail-fast nếu cấu hình bắt buộc hoặc kiểu dữ liệu không hợp lệ. Tối thiểu cần:

```env
MONGODB_URI=mongodb://localhost:27017/healthcare_v2_local?replicaSet=rs0&directConnection=true
REDIS_URL=redis://localhost:16379
JWT_SECRET=replace-with-at-least-32-characters
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

Production không chấp nhận wildcard/allowlist CORS rỗng, JWT secret ngắn hoặc Swagger UI được bật.

## Chạy ứng dụng

Từ repository root:

```powershell
pnpm.cmd install --frozen-lockfile
docker compose up -d mongo redis
pnpm.cmd --filter api start:dev
```

- REST API mặc định: `http://localhost:3000/api/v1`
- Swagger UI mặc định ngoài production: `http://localhost:3000/api/docs`
- Socket.IO transport path mặc định: `/socket.io`

Các giá trị trên có thể đổi bằng `API_PREFIX`, `API_VERSION`, `SWAGGER_PATH` và `SOCKET_PATH`.

## Quality gates

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

`boundary:check` ngăn backend phụ thuộc frontend/workspace package. Hai contract check tạo document từ source hiện tại và fail nếu artifact đã commit bị drift.

Khi thay đổi API hoặc realtime contract có chủ đích, review breaking change rồi cập nhật artifact:

```powershell
pnpm.cmd --filter api openapi:generate
pnpm.cmd --filter api realtime:generate
```

Không sửa trực tiếp `openapi/openapi.json` hoặc `contracts/realtime-events.json`.

## Database lifecycle

Khởi tạo database local/CI rỗng từ source control:

```powershell
pnpm.cmd --filter api database:bootstrap
```

Các command riêng gồm `database:migrate`, `database:verify`, `database:seed:reference` và `database:seed:demo`. Demo seed không thuộc production deployment. Staging/production mặc định tắt Mongoose `autoIndex/autoCreate` và kiểm tra `MIN_SCHEMA_VERSION` khi bootstrap.

- Liveness: `GET /api/v1/health/live`
- Readiness MongoDB + Redis: `GET /api/v1/health/ready`

## Runtime policy

- HTTP và Socket dùng cùng `CORS_ORIGINS`.
- REST dùng bearer JWT; OAuth/cookie chưa phải runtime contract hiện tại.
- Mọi response lỗi có `x-correlation-id` và error envelope ổn định.
- `THROTTLE_ENABLED` mặc định tắt ở development/test và bật ở staging/production; khi bật, HTTP và Chat Socket dùng distributed counters trên shared Redis.
- Swagger chỉ phục vụ local/staging đã cho phép; production bị cấu hình chặn.

Chi tiết RF-3 nằm trong `docs/current-state/rf3-platform-contract.md`.
