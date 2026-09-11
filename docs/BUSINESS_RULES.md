# Healthcare Business Rules

## Mục đích và phạm vi

Tài liệu này mô tả các quy tắc nghiệp vụ có thể điều chỉnh trong quá trình phát triển. Hệ thống phục vụ tư vấn trực tuyến; AI chỉ hỗ trợ thông tin, tóm tắt hoặc truy xuất tài liệu, không đưa ra chẩn đoán.

## Khái niệm chính

- AvailabilitySlot là khoảng thời gian bác sĩ mở cho bệnh nhân đặt lịch.
- Consultation là một yêu cầu hoặc một lịch tư vấn giữa bệnh nhân và bác sĩ.
- On-demand là bệnh nhân gửi yêu cầu tư vấn nhanh; bác sĩ quyết định chấp nhận hoặc từ chối.
- Scheduled là bệnh nhân chủ động chọn slot bác sĩ đã mở.
- Request status thể hiện kết quả xử lý yêu cầu hoặc quyền truy cập tư vấn.
- Session status thể hiện trạng thái thực tế của phiên tư vấn.

## Quy tắc tài khoản và bác sĩ

1. Chỉ tài khoản active được tư vấn, đặt lịch hoặc thanh toán.
2. Chỉ user có role doctor và hồ sơ được approved mới được mở slot, nhận yêu cầu hoặc tư vấn.
3. Presence online dùng Redis và Socket.IO. MongoDB chỉ lưu lastSeenAt.
4. Một OAuth account chỉ liên kết với một user. Một user chỉ có một account cho mỗi OAuth provider.
5. Refresh token chỉ lưu dạng hash trong AuthSessions, có expiry và rotation. OTP chỉ tồn tại trong Redis với TTL, giới hạn số lần thử và rate limit gửi lại.

## Lịch trống và đặt lịch chủ động

1. Bác sĩ tạo AvailabilitySlots với start time, end time và timezone. Một bác sĩ không được có hai slot cùng start time.
2. Slot có các trạng thái available, booked, blocked hoặc expired.
3. Mặc định booking policy là instant: bệnh nhân đặt thành công thì lịch được xác nhận ngay, không cần bác sĩ duyệt lại.
4. Phiên bản sau có thể hỗ trợ approval required. Khi đó booking tạo consultation có request status pending.
5. Bệnh nhân chỉ thấy slot available, chưa qua giờ bắt đầu và thỏa min notice minutes của bác sĩ.
6. Bệnh nhân chỉ được đặt trong max advance days tính từ hiện tại.
7. Booking là thao tác atomic: backend chỉ tạo Consultation khi đổi thành công slot từ available sang booked. Nếu tạo consultation lỗi, slot phải được trả về available.
8. Khi bệnh nhân hủy đúng hạn cancellation deadline, slot quay lại available. Slot bị bác sĩ block hoặc đã hết giờ không được mở lại.
9. Slot qua giờ mà không có consultation hợp lệ chuyển expired.

## Tư vấn nhanh theo yêu cầu

1. Bệnh nhân tạo consultation on-demand với request status pending, session status not started và không có availability slot.
2. Bác sĩ có thể accept hoặc decline yêu cầu; trường declined reason là tùy chọn.
3. Yêu cầu chưa xử lý chuyển expired tại request expires at. Giá trị MVP đề xuất là 24 giờ.
4. Một bệnh nhân chỉ có tối đa một yêu cầu pending tới cùng bác sĩ để hạn chế spam.
5. Chỉ khi request được accepted, hai bên mới truy cập ConsultationMessages hoặc phòng tư vấn.
6. Bác sĩ có thể accept nhiều yêu cầu nhưng chỉ được có một consultation in consultation tại một thời điểm.

## Trạng thái Consultation

### Request status

| Trạng thái | Ý nghĩa |
|---|---|
| pending | Chờ bác sĩ duyệt. |
| accepted | Có thể bắt đầu hoặc chờ tới giờ tư vấn. |
| declined | Bác sĩ từ chối. |
| cancelled | Bệnh nhân hoặc bác sĩ hủy. |
| expired | Không được xử lý trước hạn. |

### Session status

| Trạng thái | Ý nghĩa |
|---|---|
| not started | Chưa check-in hoặc chưa bắt đầu. |
| waiting | Bệnh nhân đã check-in và đang chờ. |
| in consultation | Bác sĩ đang tư vấn. |
| completed | Phiên tư vấn đã kết thúc. |
| no show | Bệnh nhân không xuất hiện đúng quy định. |

## Check-in và hàng đợi

1. Hàng đợi chỉ chứa consultation accepted có session status waiting.
2. Bệnh nhân có lịch được check-in sớm tối đa check in early minutes; giá trị MVP đề xuất là 15 phút.
3. Hàng đợi sắp theo scheduled start time, sau đó theo queue joined time. Vị trí hiển thị chỉ là snapshot, không phải nguồn dữ liệu chuẩn.
4. Khi bác sĩ gọi người tiếp theo, backend atomically đổi một consultation từ waiting sang in consultation.
5. Nếu bệnh nhân không xuất hiện sau no show after minutes tính từ giờ hẹn, session chuyển no show. Giá trị MVP đề xuất là 10 phút.
6. Một consultation on-demand đã accepted cũng có thể vào waiting khi bác sĩ đang tư vấn cho người khác.

## Chat, video và quyền truy cập

1. ConsultationMessages thuộc đúng một consultation và chỉ patient hoặc doctor của consultation đó mới xem hoặc gửi message.
2. Room ID chỉ tạo sau khi consultation được accepted và phải unique.
3. WebRTC signaling đi qua Socket.IO. Không lưu signaling message vào MongoDB.
4. File đính kèm lưu trên Cloudinary; database chỉ giữ metadata, URL và public ID.
5. Bệnh nhân phải xác nhận consent với phiên bản chính sách hiện hành trước audio hoặc video consultation.

## Review và vi phạm

1. Một consultation có tối đa một review, được bảo vệ bằng unique index của consultation ID.
2. Chỉ patient thuộc consultation accepted và completed mới được review.
3. Khi tạo, sửa, ẩn hoặc xóa review, cập nhật rating sum, review count và average rating của doctor profile trong cùng transaction.
4. Admin không xóa cứng review vi phạm; chuyển status sang hidden hoặc removed để giữ audit.
5. Violation report có bốn trạng thái pending, processing, resolved, dismissed; severity gồm low, medium, high.
6. Evidence phải tham chiếu message, consultation hoặc file Cloudinary. AI classification chỉ hỗ trợ phân loại, không tự động khóa tài khoản.

## Gói dịch vụ, quota AI và VNPAY

1. Giá, quyền lợi và quota tại lúc mua phải được snapshot trong PaymentOrders và Subscriptions.
2. Tiền VND lưu dưới dạng integer, không dùng số thực.
3. Return URL chỉ hiển thị kết quả. Chỉ IPN có chữ ký hợp lệ mới chuyển payment order sang paid và kích hoạt subscription.
4. IPN lặp phải idempotent: cùng transaction reference không được kích hoạt subscription hai lần.
5. Redis kiểm quota AI realtime theo ngày; AiUsageDaily là dữ liệu bền vững cho thống kê và đối soát.
6. Khi subscription hết hạn, API AI áp dụng quota Free ở request tiếp theo. Worker chỉ hỗ trợ thông báo hết hạn.

## Notification, Outbox và worker

1. Notifications là inbox hiển thị trong app; OutboxEvents là hàng đợi sự kiện bền vững để worker gửi Socket.IO, FCM hoặc email.
2. Thay đổi nghiệp vụ quan trọng phải tạo entity chính, notification và outbox event trong cùng MongoDB transaction.
3. Worker claim OutboxEvents theo status pending và available at, gửi theo channel phù hợp, sau đó đánh dấu completed, retry failed hoặc dead khi hết số lần thử.
4. BullMQ dùng Redis cho delayed jobs: nhắc lịch 24 giờ và 15 phút trước cuộc hẹn, gửi campaign theo batch và retry tác vụ ngoài hệ thống.
5. Broadcast campaign phải được worker fan-out theo batch; không tạo toàn bộ notification trong HTTP request của admin.

## Quy tắc vận hành và dữ liệu

1. MongoDB transaction cần Atlas hoặc MongoDB replica set. Local development phải chạy replica set để test transaction.
2. Redis là cache, presence, quota và hàng đợi job; MongoDB là nguồn dữ liệu nghiệp vụ chính.
3. Không lưu secret, plaintext refresh token, OTP plaintext hoặc khóa VNPAY trong database.
4. Tất cả thời gian lưu UTC; timezone chỉ dùng để hiển thị và kiểm tra lịch của bác sĩ hoặc bệnh nhân.
5. Các enum, thời hạn và limit trong tài liệu này phải được đặt thành cấu hình, không hard-code rải rác trong service.
