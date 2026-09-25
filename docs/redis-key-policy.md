# Redis key, TTL và data-class policy

## 1. Ownership

Mọi API/worker phải import `RedisModule`; không feature nào tự gọi `createClient()` hoặc tạo Redis URL riêng. Key được tạo qua `RedisKeyService` theo dạng:

```text
{REDIS_NAMESPACE}:{dataClass}:{scope}:{opaqueId}
```

Các segment được URL-encode. Không đưa email, số điện thoại, tên, nội dung tư vấn, access token hoặc dữ liệu sức khỏe vào key. ID phải là opaque internal ID hoặc hash ổn định.

## 2. Data classes

| Class      | Dữ liệu được phép                                      | TTL policy                                                  | Source of truth                |
| ---------- | ------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------ |
| `otp`      | OTP hash, attempts, challenge metadata tối thiểu       | Bắt buộc 5–10 phút                                          | Không; hết TTL là hết hiệu lực |
| `throttle` | Counter/block marker theo tracker đã chuẩn hóa         | Bằng rate-limit window/block duration                       | Không                          |
| `presence` | User/socket presence tối thiểu, không chứa message     | 30–90 giây và heartbeat gia hạn                             | Không                          |
| `quota`    | Counter theo ngày/kỳ                                   | Đến hết boundary + tối đa 48 giờ đệm                        | Mongo usage ledger là bền vững |
| `cache`    | Read model không nhạy cảm đã được cache registry duyệt | Theo `docs/current-state/cache-policy.md`; bắt buộc hữu hạn | MongoDB                        |
| `queue`    | BullMQ-managed job metadata                            | Theo retention của queue; không tự sửa key                  | Outbox/MongoDB theo workflow   |

## 3. Rules

1. Mọi key trừ BullMQ internal key phải có TTL hữu hạn.
2. Không lưu plaintext OTP, refresh token, access token hoặc secret.
3. Cache không được trở thành nguồn dữ liệu chính và phải có invalidation owner.
4. Key/value chứa dữ liệu nhạy cảm phải mã hóa hoặc hash theo threat model của feature owner.
5. Không dùng `KEYS`; cleanup dùng TTL, `SCAN` có namespace hoặc queue API chính thức.
6. Tăng counter cần atomic command/Lua; read-modify-write trong application code không được chấp nhận.
7. `REDIS_NAMESPACE` phải khác nhau giữa local, test, staging và production.
