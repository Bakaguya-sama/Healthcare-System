# ADR — E2 Family Companion invitation và account discovery

## Trạng thái

Đã chốt cho implementation E2. Pilot entitlement là FREE = 1, PLUS = 3 và CARE = 5; hard ceiling kỹ thuật là 10, chưa mở add-on.

## Quyết định

Family invitation có một lifecycle dùng chung cho người nhận đã có hoặc chưa có
tài khoản. API tạo invitation phát hành cùng một invitation version dưới ba dạng:

- deep-link chứa opaque token;
- QR chứa cùng deep-link;
- short code 6 chữ số để nhập thủ công.

Link/QR có hiệu lực 7 ngày. Short code chỉ có hiệu lực 15 phút, one-time, có
rate-limit/attempt lock và chỉ lưu dạng hash. Artifact raw chỉ trả một lần khi tạo
hoặc regenerate; không ghi vào log, audit metadata, outbox hay database.

Người nhận chưa có account phải đăng ký role Patient, hoàn tất email verification
và đăng nhập trước khi xem consent hoặc accept. Người đã có account chỉ cần đăng
nhập và redeem invitation.

Patient tìm contact qua GET trong Users module, bằng like trên tên/email/số điện
thoại đã xác minh, có pagination. Kết quả gồm Patient active đã verify email và
`id` để Patient chọn. `POST /family-links` nhận `contactUserId` đã chọn hoặc
`share: true`; backend tải lại và xác minh role, account status, email verification
và self-invite trước khi tạo link. Không có collection hoặc token trung gian cho
contact search. Share invitation vẫn unclaimed cho tới khi người nhận redeem/accept.

## Lý do

Link/QR/mã giúp người chưa đăng ký và người đã đăng ký đi qua cùng một consent
flow, không cần tạo role `family` hoặc account tự động. Opaque token tránh đưa
PHI vào URL/QR. Short code có entropy thấp hơn token dài nên TTL ngắn và attempt
lock là bắt buộc. Partial search là thao tác đọc đã xác thực, chỉ trả các trường
nhận diện tối thiểu để Patient chọn đúng record; search không tạo invitation và
không cấp quyền xem hồ sơ.

## Hệ quả

- FE phải hỗ trợ màn hình tạo/chia sẻ link, QR và code; code không được lưu lâu
  hơn phiên hiển thị.
- FE phải hỗ trợ redeem sau signup/verify và trạng thái invitation pending.
- E2 chỉ gửi reminder in-app; invitation delivery qua email/FCM không thuộc E2.
- Migration/model chỉ lưu trạng thái invitation và artifact hash/expiry/attempt
  counter; không có collection contact-lookup riêng.

## Bổ sung khi đóng E2

- Users contact search theo use-case → application port → Mongoose directory trong
  `users/infrastructure/mongoose`; family create validates contact ID qua
  application store. Accept/reject có use-case entry points; controller chỉ map
  DTO và gọi use case. Domain entity/policies giữ state transition và không phụ
  thuộc HTTP/Mongoose.
- Projection runtime không trả `familyUserId`, tên, avatar, email hoặc phone của contact; worker chỉ dùng ID nội bộ trong audit/outbox đã redacted.
- Job expiry chuyển invitation `pending` quá hạn sang `expired`; job weekly tạo tối đa một reminder/link/tuần. Missed-task contact chỉ được lập lịch sau reminder canonical của Patient và grace 60 phút.
- Migration `202611231400`, `202611231410`, `202611231420` và `202611231430`
  là forward-only; feature flag mặc định tắt và được rehearsal ở local trước khi
  owner chạy staging.

## Quyết định bổ sung: chia sẻ HealthMetric

Patient chủ động cấp quyền riêng theo FamilyLink và invitation version. Scope
mặc định `all`, hoặc danh sách metric được chọn; `all` bao gồm metric tương lai
khi Health Tracking có projection an toàn. Grant không tự hết hạn, bao gồm lịch
sử và dữ liệu mới; Patient có thể đổi hoặc thu hồi. Pause chặn đọc tạm thời;
revoke link thu hồi grant và re-invite không kế thừa. Companion chỉ đọc summary,
trend và giá trị/thời điểm đo, không nhận note hoặc dữ liệu lâm sàng khác.
Consent, audit và outbox độc lập với hai permission reminder. Phạm vi này còn
phải đạt toàn bộ exit gate và evidence trước khi promote.

## Quyết định revoke/read (2026-11-24)

Chọn semantics tuyến tính hóa tại lần kiểm tra quyền cuối của request đọc:

**Tình trạng implementation:** đây là quyết định mục tiêu, chưa được chứng minh.
Runtime hiện đọc link, grant và subscription bằng các thao tác riêng; revoke có
thể commit giữa các lần đọc đó. Cần atomic authorization snapshot và race test
trước khi tuyên bố đạt semantics này. Không có response barrier.

- Nếu revoke commit trước lần kiểm tra cuối, request đọc bị từ chối.
- Nếu request vượt lần kiểm tra cuối trước khi revoke commit, request đó được
  xếp trước revoke; response có thể đến client sau thời điểm revoke trả thành
  công.
- Mọi request đọc mới sau khi revoke hoàn tất đều bị từ chối.

Không triển khai distributed response barrier trong E2. Barrier sẽ phải đồng bộ
mọi API replica và chờ response socket đang bay kết thúc; nó tăng độ trễ, có thể
làm revoke chờ vô hạn khi client/network treo, và vẫn không thể thu hồi dữ liệu
đã nhận hoặc đã sao chép. FE phải xóa state/cache cục bộ khi revoke hoàn tất và
không dùng cache offline để vượt authorization. Nếu product/privacy owner yêu cầu
cam kết mạnh hơn này trong tương lai, cần ADR riêng về timeout, disconnect,
replica failure và hành vi revoke khi barrier không giải phóng được.

## Khuyến nghị ban đầu trước khi chốt — HealthMetric trend cho Companion

Runtime hiện có nhận `from`/`to` tùy chọn và trả các điểm đo đã allowlist theo
cursor; không có time bucket hoặc mặc định “tuần hiện tại”. Khi bỏ `from`/`to`,
trend đang đọc toàn bộ lịch sử theo thứ tự mới đến cũ. Chưa được đổi contract
cho đến khi chốt các lựa chọn sau:

1. Khoảng thời gian mặc định: khuyến nghị tuần lịch hiện tại, từ thứ Hai 00:00
   đến thứ Hai kế tiếp (end-exclusive). User hiện chưa có field timezone canonical
   trong schema; khuyến nghị pilot dùng cố định `Asia/Ho_Chi_Minh`, còn timezone
   tùy từng Patient chỉ mở sau khi có profile setting canonical. Đây chỉ là
   default truy vấn/UI, không làm giảm quyền xem lịch sử đã cấp.
2. “Mốc thời gian” có nghĩa là các điểm đo gốc trên timeline hay aggregate theo
   bucket ngày/tuần/tháng: khuyến nghị trả các điểm đo gốc như Patient view, FE
   tự vẽ chart; không tự tính trung bình bucket ở FE. API summary tiếp tục dùng
   thuật toán thống kê canonical của Health Tracking.
3. Các preset khoảng thời gian: khuyến nghị `week`, `month`, `quarter`, `year`
   và `custom`; server chuẩn hóa thành `from`/`to` UTC dựa trên timezone đã chốt.
   Cursor chỉ phân trang trong khoảng đã chọn.

Kế hoạch sau khi được duyệt: (a) kiểm tra Patient UI/API consumer thực tế để xác
nhận điểm đo và timezone; (b) thêm period/timezone policy và request DTO ở
presentation; (c) mở rộng `SharedHealthMetricPort` để nhận normalized window;
(d) tái sử dụng query/cursor/validity semantics canonical của Health Tracking
nhưng chỉ trả safe projection, không gọi lại controller Patient và không trả
`patientId`, `sourceRef`, note hoặc validation internals; (e) thêm OpenAPI/FE
types, migration chỉ nếu thật sự cần lưu timezone (ưu tiên không tạo migration),
unit/integration/E2E cho tuần biên, DST, pagination, empty, forbidden và revoke.

## Quyết định đã chốt và triển khai — 24/11/2026

- Mặc định tuần lịch hiện tại, thứ Hai 00:00 đến thứ Hai kế tiếp 00:00 theo
  `Asia/Ho_Chi_Minh`. User chưa có timezone canonical; profile timezone để ngoài
  E2. Ranh giới của preset là `[start,end)`.
- Preset gồm `week`, `month`, `quarter`, `year`, `all`, `custom`. `anchor` là
  ngày `YYYY-MM-DD` nằm trong kỳ cần xem; server tính biên trong timezone pilot,
  rồi chuyển sang UTC. Anchor ở tương lai bị từ chối. Custom range bắt buộc
  `from < to`, end-exclusive; custom range có thể hướng tới thời điểm tương lai
  và khi chưa có số đo thì trend rỗng, summary theo empty contract.
- Trend trả điểm đo gốc, không tổng hợp thành bucket. Summary và trend dùng cùng
  cửa sổ; summary tính trên toàn bộ cửa sổ, kể cả khi trend được phân trang.
  `all` cho phép duyệt lịch sử bằng cursor ổn định theo `recordedAt` rồi ID.
- Patient API hiện hữu giữ nguyên. Companion request v1 chỉ dùng `from/to` vẫn
  coi `to` inclusive tương thích hành vi cũ; FE mới dùng `period=custom` để có
  `[from,to)` minh bạch.
- Health Tracking giữ source of truth cho metric type, lifecycle, sort/cursor
  và thống kê. Family Companion giữ grant authorization và projection an toàn;
  không forward Patient DTO có `patientId`, `sourceRef` hay validation metadata.

Implementation không cần migration vì không lưu timezone hoặc period vào DB.
