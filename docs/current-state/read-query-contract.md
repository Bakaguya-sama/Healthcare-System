# RF-2C — Projection, lean và aggregation contract

Status: **DONE — 2026-09-16**.

## Mục tiêu và phạm vi

RF-2C chuẩn hóa cách backend đọc MongoDB sau khi RF-2B đã ổn định pagination/query contract. Phase này thay đổi query shape nhưng không thêm feature, không tạo index và không thay đổi database schema. Index chỉ được chọn sau query catalog và `explain('executionStats')` ở RF-2D.

## Quy tắc runtime

1. List/detail read model phải có projection rõ ràng; không mặc định serialize toàn bộ document.
2. Read model dùng `.lean()` khi không cần document methods, virtuals, middleware hoặc `.save()`.
3. Populate luôn khai báo field cần thiết; không populate toàn bộ User hay document lớn.
4. Data query và count độc lập chạy bằng `Promise.all()`.
5. Count, average, min, max và distribution chạy trong MongoDB thay vì tải toàn bộ documents về Node.js.
6. Query dùng để thực thi command được phép giữ hydrated document khi cần `.save()` hoặc middleware. Đây không phải read model và không được chuyển sang `.lean()` máy móc.
7. Query lookup/config không phân trang phải có hard cap hoặc contract riêng.
8. Không chọn denormalization khi chưa có owner và reconciliation strategy.

## Read paths đã chuẩn hóa

18 service owners hiện có projection dành riêng cho list/read response:

- User, Patient, Admin và doctor verification;
- Session, Message và Review;
- HealthMetric, Notification và Violation;
- AI Conversation, AI Session, AI Message, AI Feedback, AI Document, AI Document Chunk và AI Health Insight;
- Blacklist keyword/config lookup.

Các list query trên dùng projection và `lean()`. Các populate path chỉ lấy field được khai báo. Trường nội bộ như password, avatar public ID, AI document public ID, chunk embedding và conversation internal notes không còn bị trả ngầm từ các list read model đã chuyển đổi.

## Aggregation và orchestration

### HealthMetric statistics

`HealthMetricsService.getStatistics()` dùng một pipeline `$match -> $sort -> $facet`:

- nhánh `stats` project numeric value rồi tính count/average/min/max;
- nhánh `latest` chỉ trả một metric mới nhất với projection rõ ràng;
- metric type được validate trước khi dựng field path động.

Backend không còn hydrate toàn bộ lịch sử metric chỉ để tính thống kê.

### AI Health Insight statistics

`AiHealthInsightsService.getStatsByPatient()` group trực tiếp theo `riskLevel`. Node.js chỉ map số nhóm hữu hạn sang response cũ.

### Doctor rating distribution

Profile doctor lấy doctor record, review list và rating groups song song. Rating distribution dùng `$group` thay vì loop toàn bộ review để đếm.

### AI Message theo user

`AiMessagesService.findByUserId()` dùng `$lookup` có pipeline ownership, sau đó `$facet` data/count. Flow cũ tải tối đa 1.000 AI sessions rồi dựng `$in` trong memory đã được loại bỏ.

### Independent queries

Các list/count query ở AI Session, AI Message, AI Feedback, AI Document, AI Document Chunk và Blacklist chạy song song. Core Session, Message, Review, Notification, HealthMetric và admin lists tiếp tục dùng `Promise.all()`.

## Hydrated-document exceptions

Các command path như approve/reject doctor, update session/message/review/metric, mark notification read và archive document vẫn giữ hydrated document vì còn mutate rồi `.save()` hoặc phụ thuộc middleware. Khi tách command/query service theo domain, mỗi command query phải thu hẹp projection đến đúng field cần cho authorization, transition và persistence.

Không dùng exception này cho controller GET/list hoặc statistics path.

## Verification

- Characterization test xác nhận HealthMetric list gọi projection + lean nhưng giữ response envelope cũ.
- Aggregation tests xác nhận HealthMetric statistics và AI Health Insight risk counts không hydrate toàn history.
- AI Message test xác nhận user history dùng `$lookup` + `$facet` và không gọi flow tải danh sách session IDs.
- `typecheck` và `build`: pass.
- `lint`: pass với 398 warnings, thấp hơn budget 402 và không có error.
- Unit: 4 suites, 38 tests pass; integration: 1 suite, 2 tests pass; E2E: 1 suite, 2 tests pass.

## Việc chuyển sang RF-2D

RF-2C không khẳng định query mới đã nhanh hơn nếu chưa đo. RF-2D phải ghi mỗi P0 query vào query catalog, tạo representative fixtures, chạy `explain('executionStats')`, sau đó mới quyết định compound index hoặc điều chỉnh aggregation order.
