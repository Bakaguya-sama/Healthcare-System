# RF-2B — Pagination và query contract

Status: **DONE — 2026-09-16** (`BE-RF-006`).

## Phạm vi

RF-2B đặt boundary dùng chung cho list/query của backend. Phase này không đổi hàng loạt response public của API cũ và không thực hiện projection, `lean()`, aggregation, index hay `explain`; các phần đó thuộc RF-2C, RF-2D và các task tối ưu theo domain.

Runtime primitives nằm tại `apps/api/src/common/pagination`:

- `PageQueryDto`, `CursorQueryDto`, `LimitQueryDto` và các biến thể có sort order;
- `PageRequest`, `CursorRequest`, `PageResult<T>`, `CursorResult<T>`;
- normalize nội bộ với default `page = 1`, `limit = 20`, hard max `100`;
- opaque cursor codec có version và chỉ nhận `{ sortValue, id }`;
- page/cursor result builder, Mongo sort direction mapper và legacy pagination mapper;
- sort field resolver theo allowlist, không truyền field tùy ý từ client vào Mongo query.

## Contract chuẩn

Page pagination chỉ dùng khi consumer cần nhảy trang hoặc cần `total`:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

Cursor pagination dùng cho feed/timeline có cardinality tăng liên tục:

```json
{
  "items": [],
  "nextCursor": null,
  "hasNextPage": false
}
```

Quy tắc cursor:

1. Query theo `limit + 1`, chỉ trả tối đa `limit` item.
2. Cursor được backend encode/decode; payload client không được chuyển thành raw Mongo filter.
3. Sort luôn có `_id` cùng chiều làm tie-breaker.
4. Cursor không hợp lệ phải được map thành HTTP `400` tại adapter/controller của domain.
5. Message, Notification, HealthMetric và audit/event timeline sẽ chuyển sang cursor trong `BE-RF-044`, `BE-RF-052`, `BE-RF-062` sau khi canonical owner/query service được tạo.

## Validation và allowlist đã áp dụng

Các query DTO hiện hữu của Session, Message, Review, HealthMetric, Notification, Admin, Patient, Violation, AI conversation/session/message/document/chunk/feedback/insight và Blacklist đã dùng shared page/limit validation. Các field sort động đã được chuyển sang allowlist theo domain.

Các controller Chat và AI Assistant trước đây tự đọc `page`, `limit`, `sortBy`, `sortOrder` đã chuyển sang validated DTO. Endpoint lookup `GET /reviews/top-doctors` có DTO limit riêng với hard max `100` và default tương thích `10`.

Mọi sort list đã chỉnh trong RF-2B đều có `_id` tie-breaker. Index phù hợp chưa được giả định tại đây; RF-2D phải đo baseline và tạo index theo query shape thực tế.

## Compatibility policy

API cũ hiện dùng nhiều envelope (`pagination.pages`, `pagination.totalPages`, nested `data`). RF-2B cung cấp canonical result và `toLegacyPagination()` để code mới không phát sinh thêm format mới, nhưng giữ response cũ trong giai đoạn characterization.

Khi refactor từng domain:

1. query service trả `PageResult<T>` hoặc `CursorResult<T>`;
2. adapter legacy dùng compatibility mapper trong thời gian cutover;
3. endpoint canonical/OpenAPI chỉ công bố một trong hai contract chuẩn;
4. xóa mapper khi consumer cũ đã được thay thế, theo `BE-RF-070`.

Không được thêm endpoint list mới trả `{ data, total }`, `{ count }` hoặc một pagination shape khác.

## Verification

- Unit tests kiểm tra transform/default/max limit, normalize request, sort allowlist, page result, legacy mapper, cursor `limit + 1`, cursor round-trip và reject payload không hợp lệ.
- Domain DTO tests chứng minh sort field ngoài allowlist bị từ chối.
- Typecheck, lint, build và toàn bộ test suite là exit gate của RF-2B.

Kết quả ngày 2026-09-16:

| Gate        | Kết quả                                                  |
| ----------- | -------------------------------------------------------- |
| Typecheck   | Pass                                                     |
| Build       | Pass                                                     |
| Lint        | Pass, 401 warning legacy trên budget tối đa 402 của RF-1 |
| Unit        | 4 suites, 35 tests pass                                  |
| Integration | 1 suite, 2 tests pass với Mongo replica set và Redis     |
| E2E         | 1 suite, 2 tests pass                                    |
