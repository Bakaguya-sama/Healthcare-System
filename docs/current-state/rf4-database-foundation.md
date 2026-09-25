# RF-4 — Mongoose, migration và Redis foundation

Status: **DONE — 2026-09-17** (`BE-RF-020` đến `BE-RF-022`).

## 1. Runtime ownership

- `DatabaseModule` sở hữu Mongoose root connection, environment-specific `autoIndex/autoCreate`, server selection timeout và minimum schema guard.
- `RedisModule` sở hữu một Redis client dùng chung cho cache, HTTP throttle, Socket throttle và readiness.
- `HealthModule` công bố liveness và readiness qua `/api/v1/health/live` và `/api/v1/health/ready`.
- Health endpoints bỏ qua global throttle để liveness không phụ thuộc Redis throttle storage; readiness tự kiểm Redis một cách tường minh.
- `enableShutdownHooks()` từ RF-3 kết hợp lifecycle provider để HTTP/Socket ngừng phục vụ và MongoDB/Redis đóng khi application shutdown. Worker lifecycle sẽ dùng cùng module khi worker được thêm ở RF-8.

## 2. Database commands

```powershell
pnpm.cmd --filter api database:migrate
pnpm.cmd --filter api database:verify
pnpm.cmd --filter api database:seed:reference
pnpm.cmd --filter api database:seed:demo
pnpm.cmd --filter api database:bootstrap
```

`database:bootstrap` chạy migrate, verify và reference seed. Demo seed tách riêng, không chạy ở production. `seed:legacy` còn giữ tạm seed cũ có tính phá hủy để audit/cutover; command `seed` mặc định đã chuyển sang demo seed idempotent an toàn hơn.

## 3. Migration contract

- Registry được sắp theo numeric version.
- Checksum được tạo từ immutable migration definition.
- Global lease nằm trong `_migration_lock`; metadata bền vững nằm trong `_schema_migrations`.
- Trạng thái `running`, `applied`, `failed` và error được lưu để điều tra/retry.
- Lần chạy thứ hai phải trả `applied=[]`; CI dùng `--expect-noop` để biến điều kiện này thành gate.
- Verifier kiểm collection validators, index key/options, migration name/checksum/status và `MIN_SCHEMA_VERSION`.

Migration RF-2D hiện được đăng ký thành version `202609162200`. RF-4 chỉ quản lý framework và index đã có; collection của feature mới không được tạo sớm.

## 4. Seed và transaction

- Reference seed dùng upsert cho blacklist keyword và chạy lặp không nhân bản.
- Demo seed dùng email ổn định và `$setOnInsert`; không xóa dữ liệu hiện có.
- Integration test dùng database ngẫu nhiên, chạy transaction cố ý lỗi và xác nhận toàn bộ write rollback trên replica set.

## 5. Atlas Vector Search

Definition `apps/api/database/atlas/ai-document-chunks-vector-index.json` quản lý index `vector_index` cho collection `aidocumentchunks`, vector `embedding` 3072 chiều/cosine và filter `isActive`. Đây là Atlas Search resource, không được tạo bởi regular MongoDB migration runner.

## 6. Redis behavior

- Client: `redis@5.12.1`; server local/CI: `8.2.9`.
- Namespace, connect timeout, command timeout và exponential reconnect được cấu hình tập trung.
- Cache dùng cùng client nhưng giữ fallback-to-source policy.
- HTTP và Socket throttle dùng atomic Lua counter có TTL/block marker; không còn process-local counter.
- Key/TTL/data classification nằm tại `docs/redis-key-policy.md`.

## 7. Verification

- Lint: 0 error/398 legacy warning; typecheck và production build pass.
- Unit: 12 suite/58 test pass.
- Integration: 5 suite/11 test pass, gồm migration/no-op/verifier, idempotent seeds, transaction rollback, readiness, Redis lifecycle và distributed throttle storage.
- E2E: 1 suite/4 test pass.
- Boundary, OpenAPI và realtime contract checks pass; CLI migrate/verify/no-op/reference-seed đã được chạy độc lập trên database rỗng.
