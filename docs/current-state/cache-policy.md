# RF-2E — Cache policy và performance baseline

Status: **DONE — 2026-09-17** (`BE-RF-063`, phạm vi đầu tiên).

## Quyết định phạm vi

RF-2E chỉ cache `Q-PRC-001` (`GET /users/doctors`). Đây là read model dùng chung, có khả năng được nhiều người dùng đọc lại và đã có hard cap/index/baseline từ RF-2D. Consultation, message, health metric, notification và AI conversation không được cache vì dữ liệu theo người dùng, thay đổi thường xuyên hoặc có yêu cầu freshness cao.

Business service chỉ phụ thuộc `CachePort`. `CacheManagerAdapter` sở hữu cache-aside, timeout, fail-open, metric và single-flight; Keyv/Redis chỉ được khởi tạo trong `CacheModule`.

## Entry registry

| Thuộc tính       | `Q-PRC-001`                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| Key              | `v1:practitioners:directory`                                                                                       |
| Redis namespace  | `healthcare-api`                                                                                                   |
| TTL              | 60.000 ms                                                                                                          |
| Owner            | `UsersCacheService` với các method riêng cho practitioner directory                                                |
| Dữ liệu được lưu | Kết quả đã giới hạn tối đa 100 bác sĩ được duyệt, đang active; không có password, token hay verification documents |
| Invalidation     | Sau commit cập nhật hồ sơ bác sĩ/user; approve/reject; ban/unban; cập nhật rating                                  |
| Consistency      | Cache-aside, explicit invalidation, TTL là safety net                                                              |

Key có version để có thể đổi payload mà không tái sử dụng dữ liệu cũ. Không dùng wildcard delete. Mỗi mutation chỉ gọi owner của entry sau khi write tương ứng đã thành công. Các flow legacy có nhiều write nhưng chưa có transaction sẽ invalidate sau từng commit liên quan để không giữ snapshot nửa cũ/nửa mới.

## Failure và concurrency policy

- Mỗi thao tác cache có timeout 100 ms. Get lỗi/timeout được coi như miss; set/delete lỗi không làm hỏng business flow.
- Warning được rate-limit một lần mỗi 30 giây để Redis outage không làm ngập log.
- Các miss đồng thời cùng key trong một API process được gộp thành một loader call (single-flight).
- Generation guard không cho một loader đang chạy ghi lại dữ liệu cũ nếu invalidation xảy ra giữa lúc load.
- Single-flight hiện chỉ có hiệu lực trong từng process; chưa dùng distributed lock giữa nhiều replica. TTL ngắn và invalidation là giới hạn chấp nhận được cho vòng đầu.
- Metric là counter trong process: hit, miss, error, write, invalidation, loader và coalesced call. RF-3 sẽ đưa metric này vào hệ observability thay vì xem nó là nguồn số liệu bền vững.

## Benchmark cục bộ

Chạy `pnpm --filter api perf:rf2e`. Script tạo Mongo database và Redis namespace ngẫu nhiên, seed 2.000 bác sĩ, chạy 25 request cùng query rồi chỉ xóa tài nguyên do chính lần chạy đó tạo.

Kết quả ngày 2026-09-17 trên Docker local, directory hard cap 100:

| Mode        | DB loads / 25 reads | Hit ratio |      p50 |      p95 |
| ----------- | ------------------: | --------: | -------: | -------: |
| Không cache |                  25 |        0% | 4,633 ms | 9,531 ms |
| Cache-aside |                   1 |       96% | 1,378 ms | 3,166 ms |

Database load giảm 96%; p95 của fixture giảm khoảng 66,8%. Đây là baseline local, không phải production SLA. Benchmark fail nếu cached run gọi database khác 1 lần hoặc hit ratio dưới 90%.

## Kiểm thử và vận hành

- Unit test chứng minh hit/miss, single-flight, Redis unavailable fallback và invalidation trong khi loader đang chạy.
- Integration test dùng Redis thật để chứng minh round-trip, metric và explicit invalidation.
- Không thêm cache entry mới nếu query chưa có query ID, pagination/hard cap, projection/index và benchmark riêng.
- Gỡ entry nếu số liệu staging trong observation window không giảm DB load hoặc latency đủ đáng kể so với chi phí invalidation/serialization.

Exit gate ngày 2026-09-17: typecheck/build pass; lint pass với 400 warning legacy trong budget 402 và không có warning ở hạ tầng/test cache mới; 7 unit suites/45 tests, 3 integration suites/5 tests và 1 e2e suite/2 tests đều pass; `git diff --check` pass.
