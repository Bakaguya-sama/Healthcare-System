# ADR-0001 — MongoDB, Mongoose, transaction và Redis foundation

- Status: Accepted
- Date: 2026-09-17
- Scope: RF-4 (`BE-RF-020` đến `BE-RF-022`)

## Context

Backend đang dùng MongoDB/Mongoose nhưng trước RF-4 chưa có một connection owner rõ ràng, migration metadata chỉ lưu ID, cache tự tạo Redis connection và không có readiness phản ánh dependency bắt buộc. Database mới phải dựng lại từ source control mà không dùng Mongoose auto-index ở môi trường triển khai.

## Decision

### MongoDB và Mongoose

- MongoDB local/CI được pin ở `8.0.30`; Mongoose được pin ở `9.3.0`; `@nestjs/mongoose` dùng dòng 11.x hiện có của project.
- `DatabaseModule` là nơi duy nhất gọi `MongooseModule.forRootAsync`.
- `development/test` mặc định cho phép `autoIndex` và `autoCreate`; `staging/production` mặc định tắt cả hai. Mọi schema change triển khai phải đi qua migration.
- `MIN_SCHEMA_VERSION` mặc định bằng migration mới nhất ở staging/production và `0` ở development/test. API từ chối bootstrap nếu database thấp hơn minimum.
- MongoDB replica set là bắt buộc ở local/CI để hành vi transaction giống production.

### Transaction policy

- Chỉ dùng transaction cho invariant cần ghi từ hai document/collection trở lên; thao tác một document tiếp tục dùng atomic update.
- Application service mở transaction; repository nhận `ClientSession`. Không mở transaction bên trong repository độc lập.
- Không gọi SMTP, Cloudinary, Gemini, HTTP hoặc publish queue trong transaction. Side effect dùng outbox ở phase tương ứng.
- Transaction phải ngắn, query có index và không chờ tương tác người dùng. Driver được phép retry transient transaction error.
- Migration DDL/index không bọc trong transaction vì MongoDB có giới hạn với catalog/index operation.

### Migration ownership

- `_schema_migrations` lưu `version`, `name`, `checksum`, `running/applied/failed` và timestamps.
- `_migration_lock` cung cấp global lease để chỉ một process migrate tại một thời điểm.
- Migration đã `applied` không được sửa; checksum drift làm command thất bại.
- `database:verify` kiểm infrastructure validators, managed indexes, migration metadata và minimum version.
- Canonical collections của Auth, Consultation, Billing và feature mới vẫn thuộc phase owner tương ứng; RF-4 không tạo AvailabilitySlots, Payments hoặc Refunds.

### Redis

- Redis server local/CI được pin ở `8.2.9`; application client dùng `redis@5.12.1`, tương thích với `@keyv/redis@5.1.6` hiện có.
- `RedisModule` sở hữu duy nhất client, reconnect policy, connect/command timeout và graceful quit. Cache, health, HTTP throttle và Socket throttle dùng chung client này.
- Redis là dependency readiness bắt buộc. `/api/v1/health/live` không kiểm dependency; `/api/v1/health/ready` kiểm cả MongoDB và Redis.
- HTTP/Socket throttle dùng Redis atomic script để hoạt động đúng khi chạy nhiều API replica.

## Consequences

- Deploy phải chạy `database:migrate` và `database:verify` trước khi nâng `MIN_SCHEMA_VERSION`/khởi động release mới.
- Redis outage làm readiness fail; cache vẫn có fallback ở từng operation nhưng API replica không được nhận traffic mới khi dependency bắt buộc mất kết nối.
- Atlas Vector Search index không phải regular MongoDB index; definition được version-control riêng và phải apply qua Atlas tooling trong môi trường Atlas.
