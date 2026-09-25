# DB template v8 — Ghi chú duyệt thiết kế

## Trạng thái

- File thiết kế: `docs/db-template-v8.dbml`.
- Trạng thái: **Draft for review**.
- `db-template-v7.dbml` vẫn là baseline hiện tại; v8 chưa đại diện cho collection/index đã tồn tại.
- Chỉ tạo migration sau khi các quyết định trong tài liệu này được duyệt.

## Thay đổi chính so với v7

V8 có 42 collections, bổ sung dữ liệu Chronic Care và dùng một nhật ký chung có phân vùng logic theo `domain`.

| Nhóm | Collection mới/chính | Mục đích |
|---|---|---|
| Chương trình chăm sóc | `CarePrograms`, `CareRules`, `PatientCarePrograms` | Phiên bản chương trình, bộ quy tắc và chương trình mà bệnh nhân đang tham gia. |
| Theo dõi | `CareTasks`, `HealthEvaluations`, `CareAlerts` | Nhiệm vụ, kết quả đánh giá bằng quy tắc và vòng đời cảnh báo. |
| Báo cáo/AI | `CareReports`, `CareSummaries` | Tách số liệu do backend tính khỏi nội dung AI. |
| Gói dịch vụ | `ConsultationUsages`, `SubscriptionAddOns` | Giữ lượt tư vấn, ghi nhận đã dùng/hoàn lại và quyền mua thêm. |
| Người thân | `FamilyLinks`, `FamilyPermissions`, `FamilyReminders` | Liên kết hai tài khoản, quyền do bệnh nhân cấp và lịch sử nhắc người thân. |
| Cơ sở y tế | `MedicalFacilities`, `DiseaseSpecialties` | Cơ sở được Admin duyệt từ kết quả bản đồ và ánh xạ bệnh sang chuyên khoa. |
| Nhật ký | `AuditLogs` | Một collection chung; phân biệt nhóm bằng `domain`, đối tượng bằng `entityType/entityId`. |

Các collection được mở rộng:

- `Consultations`: liên kết tùy chọn với enrollment/alert và follow-up.
- `AiUsageDaily`: quota chat theo token, request cap chống spam và ngân sách summary được theo dõi riêng.
- `AiDocumentChunks`: metadata lọc nguồn, vị trí trang/section, parent chunk, version ingestion và citation snapshot theo `rag-upgrade-blueprint.md`.
- `HealthMetrics`: provenance, validation, timezone và append-only correction.
- `Plans`/`Subscriptions`: entitlement và chu kỳ sử dụng rõ ràng.
- `PaymentOrders`: thêm trạng thái `processing`.
- `Notifications`/`OutboxEvents`: bổ sung resource/event Chronic Care và subscription grant.

## Quy ước đặt tên dễ hiểu

- Tên collection nói thẳng dữ liệu đang lưu: `CarePrograms`, `PatientCarePrograms`, `CareTasks`, `HealthEvaluations`, `FamilyLinks`, `MedicalFacilities`, `ConsultationUsages`.
- Tránh các từ khó hiểu như `template`, `enrollment`, `ledger` trong tên collection. Khi cần ý nghĩa kỹ thuật, giải thích ở note hoặc business rule thay vì đưa vào tên chính.
- Tên field mô tả trực tiếp quan hệ/hành động, ví dụ `patientCareProgramId`, `careRuleId`, `replacesMetricId`, `limitAtTime`, `familyUserId`, `selectedFromMapAt` và `dataSources`.
- Giữ các tên chuẩn đã có của hệ thống như `HealthMetrics`, `Consultations`, `Subscriptions` để không tạo thêm khái niệm trùng.
- Nhật ký dùng tên chung `AuditLogs`; các domain ghi cùng schema và truy vấn qua compound index `(domain, entityType, entityId, createdAt)`.

## Quyết định đã chốt

### 1. Tách CareReports và CareSummaries

- `CareReports` là nguồn facts: thống kê, xu hướng, dữ liệu thiếu, alert counts, source references và input hash do backend tính.
- `CareSummaries` là phần diễn đạt theo audience, model/prompt version và validation result.
- Khi AI lỗi, `CareReports` vẫn dùng được và `CareSummaries.status = fallback|failed` không làm mất báo cáo số liệu.

Quyết định: **giữ tách hai collection** để có thể kiểm tra số liệu và chạy lại AI mà không tính lại toàn bộ báo cáo.

### 2. Task template được nhúng trong Program version

`CarePrograms.taskTemplates` được giữ theo từng phiên bản; nhiệm vụ thực tế nằm trong `CareTasks`. Chưa tạo collection riêng cho từng task template để giảm số quan hệ và model trước deadline.

Quyết định: giữ dạng nhúng trong DA2; chỉ tách khi cần quản trị từng task template độc lập với phiên bản chương trình.

### 3. Sửa HealthMetric theo append-only

Không sửa âm thầm dữ liệu cũ. Bản ghi mới dùng `replacesMetricId`; bản ghi cũ chuyển `superseded|voided`, sau đó kích hoạt lại task/evaluation/report liên quan.

Quyết định: dùng append-only correction. Cần xác nhận khả năng cập nhật trạng thái trên MongoDB time-series version đang dùng; nếu bị giới hạn thì chuyển metadata sửa đổi sang collection riêng.

### 4. Subscription miễn phí

`Subscriptions.sourceOrderId` nullable vì Free/admin demo không có PaymentOrder; paid grant vẫn dùng sparse unique index theo `sourceOrderId`.

Quyết định: tạo Subscription Free, chu kỳ 30 ngày và `source = free_grant`. Không tạo PaymentOrder cho Free và không tạo một Subscription mới ở mỗi chu kỳ; cập nhật `currentPeriodStart`, `currentPeriodEnd` khi bắt đầu chu kỳ tiếp theo.

### 5. Consultation quota

`ConsultationUsages` giữ một lifecycle `reserved → counted|released|expired` cho mỗi consultation, kèm chu kỳ, giới hạn tại thời điểm giữ lượt và khóa chống xử lý trùng. Không dùng chung với quota token AI.

Quyết định: cập nhật nguyên tử một record theo lifecycle; mọi chuyển trạng thái được lưu bất biến trong `AuditLogs` với `domain = billing`. Không xây event sourcing riêng.

### 6. Người thân đồng hành

- Người thân phải đăng ký tài khoản Patient bình thường; không thêm role `family`.
- `FamilyLinks` liên kết `patientId` với `familyUserId`; hai giá trị không được trùng nhau.
- Người thân đăng nhập bằng cơ chế xác thực sẵn có rồi xác nhận liên kết.
- Cấu trúc hiện tại hỗ trợ nhiều người thân cho một Patient; số liên kết active do `familyLinkLimit` quyết định. Không cần `FamilyGroups` trong DA2.
- `FamilyPermissions` chỉ gồm `missed_task_reminder` và tùy chọn `weekly_progress`; dữ liệu sức khỏe/AI/consultation chi tiết nằm ngoài P1.
- Bệnh nhân có thể thu hồi quyền ngay lập tức; liên kết và quyền cũ vẫn được giữ để kiểm tra lịch sử.

### 7. Tìm cơ sở y tế

- Backend gọi API bản đồ khi danh mục nội bộ chưa đủ kết quả.
- Admin chọn một kết quả bản đồ để tạo `MedicalFacilities.status = draft`, kiểm tra nguồn chính thức rồi chuyển sang `verified`.
- `DiseaseSpecialties` do Admin duyệt và version hóa.
- `externalPlaceId` chỉ cho biết nguồn bản đồ, không đồng nghĩa cơ sở đã được kiểm duyệt.
- Geo index `2dsphere` và unique/partial index phải được tạo bằng migration, không dựa vào DBML.

### 8. Payment không dùng Saga trong DA2

IPN hợp lệ ghi transaction, đổi order sang paid và tạo `subscription.grant_requested` trong cùng Mongo transaction. Worker cấp Subscription idempotent; reconciliation xử lý paid-without-grant. Vì Payment/Subscription/Outbox dùng chung ứng dụng và MongoDB, chưa cần Saga framework.

### 9. Một collection nhật ký chung

Dùng một `AuditLogs` cho auth, user, health, consultation, care, AI, billing, facility, notification và moderation. `domain` phục vụ phân vùng logic; `entityType/entityId` xác định đối tượng; `userId/actorId` xác định người bị ảnh hưởng và người thực hiện. `expiresAt` cho phép retention khác nhau qua TTL index; bản ghi không có `expiresAt` được giữ lâu dài. Log chỉ lưu ID, trạng thái, lý do và trường thay đổi an toàn; không sao chép raw HealthMetrics, prompt AI, tin nhắn, refresh token hoặc khóa bí mật.

### 10. Quota AI theo token

`Plans.aiTokenLimit` là quota chính cho chat AI và được tính bằng input + output token đã commit. `aiRequestLimit` vẫn giữ làm giới hạn phụ chống spam; `AiUsageDaily` tách token chat khỏi token sinh summary. Trước khi gọi model, Redis giữ chỗ theo input ước tính + output tối đa, sau đó commit số thực tế và trả phần dư. Cách này bám sát chi phí hơn đếm số câu hỏi, nhưng giao diện nên quy đổi thành phần trăm quota còn lại thay vì buộc Patient hiểu token.

### 11. Đăng ký hoặc đổi gói khi đang có gói hiệu lực

- Chỉ một Subscription `active` cho mỗi user.
- Request tạo order trùng trả lại order đang chờ thay vì tạo mới.
- Free → paid: kích hoạt ngay và thay Free.
- Paid → cùng gói/gói khác: lên lịch cho chu kỳ sau bằng `nextPlan*`; chỉ được có một thay đổi chờ.
- DA2 không cộng quyền lợi nhiều Plan, không prorate và không đổi gói giữa chu kỳ.

### 12. Notification cho một người, nhóm và tất cả

- Một người: tạo trực tiếp một `Notifications` cùng OutboxEvent.
- Nhóm/tất cả: `NotificationCampaigns` giữ `targetType`, `targetFilter`, `audienceSnapshotAt`; worker fan-out theo batch thành một Notification cho mỗi user.
- `uniqueKey` chống trùng; `delivery` lưu trạng thái từng kênh. Mỗi người có `isRead/readAt` riêng.

### 13. Cơ chế tạo Care Program và dữ liệu liên quan

1. Admin/Doctor tạo `CarePrograms.status = draft`; `taskTemplates` vẫn nhúng trong version này. Tạo/sửa `CareRules.status = draft` tham chiếu đúng `careProgramId`.
2. Admin duyệt nguồn/test, publish Program và active Rule. Việc publish không tạo `CareTasks` hay dữ liệu Patient.
3. Khi Doctor gán chương trình cho Patient, hệ thống tạo một `PatientCarePrograms.status = pending`, tham chiếu Program/Rule đã duyệt và lưu snapshot cấu hình, baseline, consent, timezone, Doctor.
4. Sau khi consent/baseline/Doctor hợp lệ, bản ghi chuyển `active`; worker đọc `taskTemplates` snapshot để tạo `CareTasks` trong rolling window.
5. HealthMetric/check-in hoàn thành task. Rule engine tạo `HealthEvaluations`; chỉ kết quả cần chú ý mới tạo `CareAlerts`.
6. Job báo cáo tạo `CareReports` bằng phép tính backend, sau đó mới tạo `CareSummaries` nếu gói cho phép AI. Consultation chỉ liên kết khi Patient/Doctor chủ động tạo hoặc xử lý alert.
7. Program/Rule có version mới không tự đổi chương trình đang chạy. Việc nâng version phải là thao tác riêng, tạo snapshot mới và ghi `AuditLogs`.

### 14. User online, refresh token và bookingSettings

- `Users.lastOnlineAt` là thời điểm online gần nhất đã ghi bền vững; trạng thái online realtime nằm trong Redis/Socket.IO. `UserDevices.lastSeenAt` vẫn giữ vì đây là lần thiết bị/push token hoạt động, khác ý nghĩa user online.
- `AuthSessions.refreshTokenHash` tiếp tục nằm trong MongoDB. Hash không thể dùng để khôi phục token gốc, nhưng cho phép rotation, replay detection, logout-all và tồn tại qua Redis restart. Redis chỉ cache session/revocation để đọc nhanh.
- `bookingSettings` là chính sách mặc định của Doctor. `bookingPolicy`, thời gian báo trước, số ngày đặt trước, hạn hủy, cửa sổ check-in và mốc no-show được backend kiểm tra; cấu hình áp dụng phải được snapshot vào Consultation khi đặt lịch.

### 15. Metadata và citation cho RAG chunk

Theo `plan/rag-upgrade-blueprint.md`, chunk lưu metadata đủ cho ba việc: lọc nguồn trước retrieval, lấy parent context và dựng citation. `AiDocuments.reviewStatus` là nguồn duyệt chuẩn; Admin/Doctor được cấp quyền duyệt một document, worker bulk-update trạng thái sao chép trên chunks để Atlas filter, không duyệt từng chunk. Các field lọc thường xuyên được để riêng (`reviewStatus`, `language`, `specialties`, `effectiveUntil`, `isActive`); `citation` là snapshot hiển thị ổn định. Chunk lỗi được exclude riêng. Chỉ chunk active, approved, chưa hết hạn mới được đưa vào context.

### 16. Kết thúc Consultation và xử lý chồng chéo

- `scheduledEndAt`/`expectedDurationMinutes` là mốc vận hành, không tự chuyển `completed`. Doctor kết thúc cuộc gọi và xác nhận hoàn tất; worker chỉ chuyển phiên mất heartbeat sang `interrupted`.
- Scheduled và on-demand dùng chung hàng đợi theo Doctor. Scheduled quá giờ/đã tới giờ ưu tiên hơn on-demand; on-demand chỉ chen vào khoảng trống nếu đủ `expectedDurationMinutes + bufferMinutes` trước lịch kế tiếp.
- Một Doctor chỉ có một `in_consultation`, bảo vệ bằng conditional update và partial unique index. Phiên quá giờ tạo `overtimeStartedAt` và ETA mới, không bị ngắt tự động.

### 17. Cấu hình Admin và ENV

- `Plans` có version và lifecycle `draft|published|retired`; Admin chỉ sửa draft. Subscription/PaymentOrder snapshot version đã publish.
- Giá, quota, số consultation, số Program, số người thân và feature benefits nằm trong database/Admin UI.
- Secret, provider URL, timeout, retry/batch và hard ceiling tuyệt đối nằm trong ENV/code config.
- Doctor booking settings nằm trong profile nhưng phải ở trong range hệ thống; Consultation snapshot các giá trị đã áp dụng.
- State transition, authorization và safety invariant nằm trong code/constraint, không phải cấu hình tùy ý.

### 18. Chính sách hoàn tiền

- `Plans.refundPolicy` là cấu hình có version gồm thời hạn gửi yêu cầu, các ngưỡng sử dụng theo từng quyền lợi và cờ bắt buộc Admin duyệt. `PaymentOrders.orderSnapshot` giữ policy của thời điểm mua nên thay đổi Plan không hồi tố.
- `PaymentRefunds` giữ `subscriptionId`, `policyVersion`, `policySnapshot`, `usageSnapshot`, kết quả đủ điều kiện và reason codes. Trước lúc duyệt, backend lưu `finalUsageSnapshot` và đánh giá lại để tránh người dùng phát sinh thêm quyền lợi trong lúc chờ.
- Khi request ở `refund_pending`, chỉ quyền lợi trả phí mới bị tạm dừng; dữ liệu cá nhân, quyền Free và safety alert vẫn hoạt động. Reject/failure có kết luận mở lại quyền trả phí; provider thành công mới hủy đúng grant.
- Không dùng một tỷ lệ sử dụng chung. AI token, consultation đã tính lượt/no-show, Doctor review, báo cáo và nhiệm vụ Care trả phí được so riêng với policy. Lỗi thu trùng hoặc cấp quyền sai đi vào `review_required` để Admin xử lý.
- Admin UI quản lý policy trong Plan draft/publish. ENV chỉ giữ feature flag, timeout/retry provider và hard ceiling; mọi quyết định/override được ghi vào `AuditLogs` domain `billing`.

## Sau khi duyệt

1. Chốt collection/field/index và quy tắc lưu dữ liệu nhạy cảm.
2. Viết migration additive từ v7 lên v8; không sửa migration lịch sử.
3. Cập nhật Mongoose schemas, repository ownership và public ports.
4. Bổ sung `database:verify`, index verification và rollback/feature flags.
5. Seed hai Program tăng huyết áp/tiểu đường, rule version, facility mẫu và Plan Free/Plus/Care.
6. Chạy integration, idempotency, authorization, query-plan và migration no-op tests.
