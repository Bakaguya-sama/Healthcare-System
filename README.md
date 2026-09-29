# HealthAI Chronic Care

HealthAI là nền tảng theo dõi và hỗ trợ chăm sóc bệnh mạn từ xa, kết hợp Care Program, theo dõi chỉ số, tư vấn trực tuyến và AI/RAG có kiểm soát. Hệ thống không khám bệnh, không chẩn đoán, không kê đơn và không thay thế bác sĩ hoặc dịch vụ cấp cứu.

Repository hiện là Turborepo gồm:

- `apps/api`: NestJS modular monolith và worker;
- `apps/client`: Web cho Patient/Doctor;
- `apps/admin`: Web Admin;
- `packages/*`: UI, shared types và cấu hình dùng chung.

Refactor backend RF-0..RF-13 đã hoàn tất. Chronic Care/Billing là phase feature tiếp theo và chưa được xem là đã triển khai chỉ vì schema DB v8 đã được duyệt.

## Nguồn tài liệu chuẩn

Đọc theo thứ tự sau trước khi code feature DA2:

1. [`docs/README.md`](docs/README.md) — map tài liệu và thứ tự đọc chuẩn;
2. [`docs/chronic-care-spec.md`](docs/chronic-care-spec.md) — command contract chuẩn;
3. [`docs/product-spec.md`](docs/product-spec.md) — quy tắc nghiệp vụ/safety;
4. [`docs/data-model.dbml`](docs/data-model.dbml) — target schema;
5. [`plan/README.md`](plan/README.md) — map kế hoạch; [`plan/roadmap.md`](plan/roadmap.md) là roadmap implementation.

`docs/current-state/*` là bằng chứng lịch sử của refactor. Contract runtime hiện hành nằm ở `apps/api/openapi/openapi.json` và `apps/api/contracts/realtime-events.json`.

## Yêu cầu local

- Node.js `24.9.0` (khóa trong `.nvmrc`/`package.json#engines`);
- pnpm `9.0.0`;
- Docker Engine để chạy MongoDB replica set và Redis;
- credential provider chỉ cần cho flow thực sự gọi Cloudinary/Email/GenAI/VNPAY.

Hướng dẫn đầy đủ: [`docs/local-development.md`](docs/local-development.md).

```bash
pnpm install --frozen-lockfile
docker compose up -d
pnpm --filter api database:bootstrap
pnpm --filter api start:dev
```

## Quality gate backend

```bash
pnpm --filter api lint
pnpm --filter api typecheck
pnpm --filter api test:unit
pnpm --filter api test:integration
pnpm --filter api test:e2e
pnpm --filter api openapi:check
pnpm --filter api realtime:check
pnpm --filter api boundary:check
pnpm --filter api build
```

Migration phải chạy được trên database rỗng, `database:verify` phải pass và lần chạy migration thứ hai phải no-op. Không dùng `autoIndex`/`syncIndexes()` thay migration.

## Phạm vi DA2

P0 gồm hai Care Program (tăng huyết áp, tiểu đường) dùng chung engine; enrollment/consent/baseline; monitoring task; rule/evaluation/alert; Doctor Priority Inbox; báo cáo xác định và AI summary có guard/fallback; consultation link; entitlement Free/Plus/Care; VNPAY Sandbox payment/cancel và reconciliation.

OAuth, full refund, Mobile/FCM, WebRTC production-grade, người thân đồng hành, tìm cơ sở y tế và medication adherence là P1/cut-line theo kế hoạch. Chi tiết và thứ tự PR bắt đầu tại [`plan/roadmap.md`](plan/roadmap.md#91-thứ-tự-bắt-đầu-code-theo-vertical-slice).
