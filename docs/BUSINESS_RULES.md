# Healthcare Business Rules

## Mục đích và phạm vi

Tài liệu này mô tả các quy tắc nghiệp vụ có thể điều chỉnh trong quá trình phát triển. Hệ thống phục vụ theo dõi và hỗ trợ chăm sóc bệnh mạn từ xa kết hợp tư vấn trực tuyến; AI chỉ hỗ trợ thông tin, tóm tắt hoặc truy xuất tài liệu, không đưa ra chẩn đoán.

## Khái niệm chính

- AvailabilitySlot là khoảng thời gian bác sĩ mở cho bệnh nhân đặt lịch.
- Consultation là một yêu cầu hoặc một lịch tư vấn giữa bệnh nhân và bác sĩ.
- On-demand là bệnh nhân gửi yêu cầu tư vấn nhanh; bác sĩ quyết định chấp nhận hoặc từ chối.
- Scheduled là bệnh nhân chủ động chọn slot bác sĩ đã mở.
- Request status thể hiện kết quả xử lý yêu cầu hoặc quyền truy cập tư vấn.
- Session status thể hiện trạng thái thực tế của phiên tư vấn.
- Care Program là chương trình theo dõi có thời hạn, loại chỉ số, lịch đo và bộ rule đã được duyệt.
- Care Enrollment là quan hệ Patient tham gia Care Program và Doctor được phân công theo dõi.
- Monitoring Task là nhiệm vụ đo chỉ số theo lịch; completion/adherence chỉ phản ánh hoạt động theo dõi.
- Care Evaluation là kết quả deterministic của rule engine; Care Alert là item cần Patient/Doctor chú ý và xử lý.

## Care Program và enrollment

1. MVP cam kết cả Care Program tăng huyết áp và tiểu đường; hai chương trình phải dùng chung domain model/rule engine.
2. Chỉ Patient active mới được enroll. Admin và Doctor có thể tạo/chỉnh draft Program Template theo permission; chỉ Doctor `active + approved` được khởi tạo enrollment cho Patient.
3. Patient phải xác nhận consent và mục đích sử dụng dữ liệu trước khi enrollment chuyển `active`; consent lưu version và timestamp.
4. Enrollment có trạng thái `pending`, `active`, `paused`, `completed`, `cancelled`. Chỉ enrollment `active` sinh Monitoring Task và Care Evaluation mới.
5. Mỗi enrollment phải tham chiếu đúng một Care Program version và bắt buộc có một Doctor `active + approved` phụ trách trước khi chuyển active.
6. Cập nhật template/rule set không được âm thầm đổi lịch sử. Enrollment đang chạy chỉ chuyển version theo thao tác có audit và effective time rõ ràng.
7. Patient có thể yêu cầu dừng chương trình; dữ liệu lịch sử được giữ theo chính sách retention/audit, không xóa cứng cùng enrollment.
8. Care Program không tạo quan hệ cấp cứu 24/7 và giao diện phải nêu rõ thời gian/phạm vi phản hồi của Doctor.
9. Program version đã publish là bất biến; chỉnh sửa tạo draft/version mới. Chỉ version published/active mới được dùng cho enrollment mới.
10. Baseline, eligibility, consent, task templates, reminder, rule set, review policy, content journey và completion criteria phải được snapshot hoặc tham chiếu version ổn định khi enrollment kích hoạt.
11. Doctor chỉ được tùy chỉnh các field được Program Template allowlist. Thay đổi patient-specific threshold hoặc review cadence phải có quyền, lý do và audit.
12. Admin là owner quản lý lifecycle, version, publish/retire của Program Template và Care Rule Set. Doctor được tạo/chỉnh draft nhưng không tự publish rule/ngưỡng ngoài policy của Admin.
13. Admin phải lưu nguồn/căn cứ, người duyệt, simulation/test evidence và audit cho mỗi rule/ngưỡng trước publish; AI không được tự tạo rồi tự động phát hành rule lâm sàng.
14. Doctor assignment bắt buộc ở mọi tier để xác định ownership và authorization; không mặc định tạo nghĩa vụ review định kỳ, SLA hoặc chat 24/7. Các quyền đó chỉ có khi Plan/Enrollment snapshot ghi rõ.

## Monitoring Task và mức độ hoàn thành

1. Monitoring Task được sinh từ schedule, timezone và version của Care Program; worker tạo task phải idempotent.
2. Task type P0 gồm `metric`, `check_in`, `education`, `appointment`, `doctor_review`; `medication` và `journal` chỉ bật khi feature tương ứng hoàn tất.
3. Mỗi task template phải có type, schedule, time window, completion rule, reminder policy, required/optional và version. LLM không được tự đánh dấu task hoàn thành.
4. Với task `metric`, HealthMetrics là source of truth; task chỉ tham chiếu metric dùng để hoàn thành, không nhân bản raw health value.
5. Một HealthMetric chỉ hoàn thành task `metric` khi đúng Patient, metric type và cửa sổ thời gian cho phép. Task type khác dùng response/progress/Consultation/DoctorReview canonical tương ứng.
6. Task có trạng thái `scheduled`, `due`, `completed`, `missed`, `cancelled`; task của enrollment paused/cancelled không tiếp tục nhắc.
7. Monitoring adherence bằng số task Patient-required đã completed chia số task Patient-required đến hạn hợp lệ; `doctor_review` không tính vào adherence của Patient.
8. Adherence chỉ phản ánh hoạt động theo dõi, không được mô tả là tuân thủ điều trị hoặc uống thuốc trừ khi medication module được định nghĩa riêng.
9. Sửa/xóa dữ liệu nguồn phải kích hoạt re-evaluation và điều chỉnh task/summary liên quan theo cơ chế có audit.
10. Mọi thời gian lưu UTC; việc xác định ngày và cửa sổ task dùng timezone snapshot của enrollment.
11. Worker chỉ materialize task trong rolling window cấu hình; không tạo toàn bộ task dài hạn ngay khi enroll nếu gây write amplification.
12. Quiet hours, giới hạn tần suất và trạng thái hoàn thành phải được kiểm tra trước khi gửi reminder để tránh notification fatigue.

## Người thân đồng hành và nhắc nhở hỗ trợ (P1)

1. Người thân đồng hành không phải là role `Patient`, `Doctor` hoặc `Admin`, không có quyền y tế và chỉ tồn tại sau khi Patient chủ động tạo lời mời.
2. Mỗi Patient có tối đa một contact active ở P1. Contact phải xác nhận lời mời qua kênh đã được xác thực trước khi nhận notification; lời mời có TTL và chỉ dùng một lần.
3. Consent phải tách bạch tối thiểu hai quyền: `missed_task_reminder` và `weekly_progress`. Các quyền xem HealthMetrics chi tiết, Care Alert, AI conversation, consultation, hồ sơ hoặc dữ liệu y tế nhạy cảm đều mặc định `false` và ngoài P1.
4. Patient luôn nhận reminder trước. Contact chỉ nhận reminder khi task Patient-required đã `missed`, enrollment còn `active`, contact đã consent và qua một grace period cấu hình. Notification chỉ nói Patient có một hoạt động theo dõi chưa hoàn thành; không chứa metric, severity, diagnosis, Doctor name, AI content hay lý do alert.
5. `urgent` không tự gửi cho contact và không biến contact thành emergency contact. Patient chỉ có thể bật một consent riêng cho notification `urgent` sau khi đọc cảnh báo; nội dung gửi vẫn không nêu chi tiết y khoa và phải theo safety policy đã duyệt.
6. Patient có thể revoke consent, pause contact hoặc xóa contact bất cứ lúc nào. Revoke có hiệu lực ngay cho notification/query mới; token và session liên quan phải bị vô hiệu hóa.
7. Invitation, acceptance, consent version, thay đổi scope, reminder event, delivery result, revoke và actor phải audit. Contact không được xem danh sách Doctor hoặc lịch sử alert chỉ vì được mời.
8. Reminder cho contact tuân thủ quiet hours, frequency cap và deduplication độc lập với notification của Patient. Không gửi reminder nếu task đã hoàn thành, bị hủy hoặc enrollment không còn active.

## Care rule, evaluation và alert

1. Rule set có lifecycle `draft`, `active`, `retired`; chỉ version active đã được duyệt mới áp dụng cho dữ liệu mới.
2. Rule engine phải deterministic và trả về `normal`, `attention` hoặc `urgent` cùng `reasonCodes`, `ruleSetVersion` và input references.
3. Rule có thể dùng giá trị hiện tại, số lần lặp, xu hướng ngắn hạn hoặc dữ liệu bị thiếu; không được trả về chẩn đoán/tên bệnh mới.
4. Ngưỡng và nội dung hành động không hard-code rải rác trong service. Mọi thay đổi phải có actor, lý do, version và audit log.
5. AI/LLM không được tạo, nâng/hạ severity hoặc ghi đè kết quả Care Evaluation.
6. Evaluation `urgent` dùng safety template đã duyệt để hướng Patient liên hệ cơ sở y tế/cấp cứu phù hợp; không chờ AI và không cam kết Doctor phản hồi tức thời.
7. Care Alert phải có deduplication key theo enrollment, rule và evaluation window để retry không tạo cảnh báo trùng.
8. Alert có trạng thái `open`, `acknowledged`, `resolved`, `dismissed`; acknowledge không đồng nghĩa đã giải quyết hoặc đã liên hệ Patient.
9. Chỉ Doctor được phân công, Patient sở hữu dữ liệu và Admin có quyền audit mới xem alert theo phạm vi tương ứng.
10. Resolve/dismiss phải lưu actor, timestamp và lý do; alert quan trọng không được hard-delete.

## Tìm cơ sở y tế theo nhu cầu theo dõi (P1)

1. `HealthcareFacility` là danh mục cơ sở y tế do Admin quản lý. Mỗi bản ghi active phải có tối thiểu tên, loại cơ sở, địa chỉ, tọa độ, tỉnh/thành, kênh liên hệ, danh sách specialty/service, `verificationStatus`, nguồn xác thực, `verifiedAt` hoặc `updatedAt` và audit.
2. `ConditionSpecialtyMap` ánh xạ condition/Care Program sang một hoặc nhiều specialty. Chỉ Admin có quyền tạo, duyệt, sửa hoặc retire map; mọi thay đổi phải version/audit và không được coi là diagnosis hoặc clinical guideline.
3. Tìm kiếm cần condition/Program đã chọn rõ ràng hoặc specialty đã duyệt, cùng khu vực hoặc vị trí do Patient chủ động cung cấp. Vị trí chính xác là dữ liệu nhạy cảm: chỉ dùng cho truy vấn hiện tại khi Patient cho phép, không lưu lịch sử mặc định.
4. Kết quả nội bộ chỉ lấy `HealthcareFacility` active và verified, lọc specialty/khu vực rồi sắp xếp xác định theo: khớp specialty, trạng thái xác thực và khoảng cách. Không dùng AI score, đánh giá sao, doanh thu hay phí quảng cáo để thay đổi thứ tự phù hợp y khoa.
5. Mỗi kết quả phải hiển thị source, ngày cập nhật, specialty khớp và reason code dễ hiểu. Hệ thống không tuyên bố “tốt nhất”, “phù hợp điều trị nhất” hoặc bảo đảm khả năng tiếp nhận/đặt lịch nếu không có xác nhận chính thức của cơ sở.
6. Dịch vụ bản đồ bên ngoài chỉ được gọi khi danh mục nội bộ thiếu kết quả hoặc Patient chủ động mở rộng tìm kiếm. Kết quả phải gắn nhãn nguồn bên ngoài, tuân thủ điều khoản/attribution/retention của nhà cung cấp và không tự chuyển thành `verified` hoặc được lưu lâu dài ngoài chính sách đó.
7. AI chỉ được chuẩn hóa văn bản tự nhiên thành bộ lọc condition/specialty/location trong allowlist và giải thích kết quả dựa trên dữ liệu đã trả về. AI không suy luận bệnh, xếp hạng chất lượng cơ sở, chẩn đoán hoặc xử lý tình huống `urgent`.
8. Trong luồng `urgent`, safety template luôn hiển thị trước. Tìm cơ sở y tế/chỉ đường là tác vụ bổ trợ và không được trì hoãn hướng dẫn liên hệ cấp cứu/cơ sở y tế phù hợp.
9. Liên kết đặt lịch chỉ xuất hiện khi cơ sở có tích hợp chính thức hoặc đường dẫn đã được Admin xác thực. Không mô phỏng còn chỗ, giá hoặc xác nhận lịch từ dữ liệu bản đồ.

## Doctor Priority Inbox và follow-up

1. Priority Inbox là projection/query từ Care Alerts và enrollments, không phải nguồn dữ liệu lâm sàng mới.
2. Thứ tự mặc định: severity, detectedAt và `_id` tie-breaker; AI score không tham gia quyết định thứ tự P0.
3. Mọi list phải pagination, projection và hard limit; Doctor không được truy vấn Patient ngoài assignment hợp lệ.
4. Doctor có thể acknowledge, ghi chú liên hệ, tạo/liên kết Consultation và resolve alert.
5. Consultation liên kết alert vẫn phải tuân thủ đầy đủ booking, participant authorization và session state hiện có.
6. Sau consultation, Doctor có thể ghi follow-up note hoặc thay đổi chương trình trong phạm vi được cấp quyền; hệ thống phải lưu audit.

## Báo cáo và AI summary Chronic Care

1. Báo cáo 7/30 ngày được tính xác định từ HealthMetrics, Monitoring Tasks, Care Alerts và Consultations trong phạm vi được authorize.
2. Backend tính thống kê, trend và adherence; LLM chỉ diễn đạt từ payload chuẩn hóa, không tự tính lại hoặc bổ sung dữ kiện.
3. Summary phải lưu window, data cutoff, model/prompt version, nguồn dữ liệu/provenance và trạng thái generation.
4. Nếu AI timeout, lỗi hoặc evidence không đủ, hệ thống vẫn trả báo cáo số liệu và reason codes; narrative chuyển `unavailable`.
5. Patient summary dùng ngôn ngữ tham khảo, không chẩn đoán. Doctor summary phải phân biệt dữ kiện, dữ liệu thiếu và nội dung AI sinh.
6. RAG chỉ sử dụng document/chunk active, approved, chưa hết hạn; citation trả về phải được backend kiểm tra tồn tại.
7. Dữ liệu Patient chỉ được đưa vào summary trong đúng authorization scope; không dùng raw health payload để huấn luyện hoặc gọi provider ngoài policy.
8. Trước khi tạo summary, backend phải chuẩn hóa metric type, unit, timezone, source và report window; bản ghi không hợp lệ được loại bằng reason code, không được tự sửa hoặc bỏ qua âm thầm.
9. Backend, không phải LLM, tính expected/completed measurements, adherence, min/max/average/median, period delta, trend, missing windows, alert counts và consultation/follow-up references.
10. Mỗi lần sinh nội dung dùng một `SummaryInputSnapshot` bất biến gồm data cutoff, statistics, missing data, Care Evaluations và source references. Snapshot phải có hash/version để audit và tái tạo kết quả.
11. Structured output tối thiểu tách `overview`, `observations`, `missingData`, `alertsToMention`, `questionsForDoctor` và `disclaimer`; Patient và Doctor dùng hai presentation policy khác nhau trên cùng facts.
12. Output phải qua schema validation và grounding validation. Mọi con số, xu hướng, alert hoặc nhận xét sự kiện phải ánh xạ được về snapshot/source reference; nội dung không có nguồn bị loại.
13. Guard cấm diagnosis, prescription, dose change, stop-medication advice, thay đổi severity và tuyên bố chắc chắn không được chứng minh. Guard fail phải dùng deterministic fallback và ghi validation reason.
14. Summary generation idempotent theo enrollment, report window, data cutoff và summary version. Dữ liệu nguồn thay đổi tạo summary version mới; không ghi đè lịch sử đã được Doctor review.
15. Summary lưu `generated|fallback|failed`, model/prompt version, rule set version, input hash/source refs, validation result, token/latency metadata không chứa raw health data và Doctor review status nếu có.
16. RAG chỉ bổ sung kiến thức giáo dục từ tài liệu active/approved; RAG không tính thống kê, chọn threshold, thay đổi rule result hoặc quyết định hành động khẩn.

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
3. Return URL chỉ hiển thị kết quả. Chỉ IPN có chữ ký hợp lệ mới chuyển payment order sang paid và ghi yêu cầu cấp Subscription vào transactional outbox.
4. IPN lặp phải idempotent: cùng transaction reference không được tạo transaction, outbox event hoặc Subscription grant hai lần.
5. Redis kiểm quota AI realtime theo ngày; AiUsageDaily là dữ liệu bền vững cho thống kê và đối soát.
6. Khi subscription hết hạn, API AI áp dụng quota Free ở request tiếp theo. Worker chỉ hỗ trợ thông báo hết hạn.
7. Hệ thống có ba tier sản phẩm: `free`, `plus`, `care`; giá và giới hạn cụ thể nằm trong Plan/Subscription snapshot, không hard-code theo tên tier.
8. Free luôn có quyền nhập/xem HealthMetrics của chính Patient, biểu đồ cơ bản, một Care Program cơ bản, in-app notification, quota AI cơ bản và safety alert thiết yếu.
9. Plus bao gồm Free và có thể cấp nhiều Care Program, báo cáo 7/30/90 ngày, weekly AI summary, smart reminder/quiet hours, medication reminder, PDF/CSV và quota AI cao hơn theo Plan.
10. Care bao gồm Plus và có thể cấp Doctor-assigned Program, Doctor review theo cadence, Priority Inbox, follow-up, nhắc tái khám và ưu đãi giá consultation theo Plan snapshot.
10a. Khi tính năng Người thân đồng hành P1 được bật, Care bao gồm tối đa một contact active; Plus có thể mua thêm quyền này theo Plan snapshot. Entitlement chỉ cấp khả năng mời/nhắc, không ghi đè consent hoặc mở quyền xem dữ liệu chi tiết.
11. Doctor-reviewed/confirmed report chỉ xác nhận Doctor đã xem báo cáo; không được trình bày thành chẩn đoán, đơn thuốc hoặc bảo đảm kết quả điều trị.
12. Nhắn tin Doctor chỉ tồn tại trong Consultation được authorize. Không tier nào mặc định tạo chat 24/7 hoặc cam kết phản hồi cấp cứu.
13. SLA phản hồi chỉ được hiển thị khi Clinic có giờ phục vụ, nhân sự, escalation và cơ chế đo SLA đã cấu hình; nếu không, giao diện phải nêu rõ Doctor không theo dõi realtime.
14. Cảnh báo `urgent`, safety template và quyền truy cập dữ liệu cơ bản của Patient không được tắt khi hết hạn, downgrade hoặc vượt quota AI.
15. Downgrade/hết hạn không xóa HealthMetrics, Care Alerts hoặc báo cáo lịch sử. Quyền lợi trả phí mới dừng theo `paidThroughAt` và grace policy đã snapshot.
16. Giới hạn lưu lịch sử theo tier chỉ được áp dụng sau privacy/retention review; không được làm mất quyền truy cập/xuất dữ liệu tối thiểu của chính Patient.
17. Consultation usage/reservation ledger dùng idempotency key; retry không được đếm một Consultation nhiều lần.
18. Entitlement được kiểm tra phía backend. Client không được tự khai tier, AI quota, consultation limit, Doctor review hoặc quyền Care Program.
19. Plan trả phí không được thay đổi Care Evaluation severity, thứ tự ưu tiên lâm sàng hoặc quyền được nhận safety escalation.
20. Khi VNPAY chưa nằm trong cut-line, seed/demo subscription có thể dùng để kiểm thử entitlement nhưng phải được đánh dấu rõ, không ghi nhận là doanh thu thật.
21. Trong DA2, VNPAY Sandbox payment/subscription và cancel unpaid order là P0 bắt buộc; seed subscription không thay thế acceptance demo giao dịch Sandbox.
22. Full refund vẫn là P1 và chỉ được bật khi payment, IPN, cancel, entitlement và reconciliation đã đạt release gate.
23. Số consultation tối đa mỗi cycle mặc định là Free `1`, Plus `3`, Care `6`. Field chuẩn là `consultationLimitPerCycle` trong Plan/Subscription snapshot; đây không phải AI quota.
24. Plus/Care dùng `currentPeriodStart/currentPeriodEnd` của Subscription. Free dùng entitlement cycle 30 ngày neo tại thời điểm grant/activation; ledger phải gắn cycle cụ thể, không reset toàn bộ người dùng bằng một cron chung.
25. `consultationsUsed` đếm trực tiếp số Consultation đã sử dụng; số còn lại bằng limit trừ số đã dùng và reservation đang hoạt động.
26. Giới hạn consultation không đồng nghĩa phiên miễn phí và không bảo đảm Doctor còn slot. Chi phí/ưu đãi của từng phiên là chính sách giá độc lập trong Plan.
27. Add-on có thể tăng consultation limit hiệu dụng; add-on phải có source order, expiry, số lượt bổ sung và ledger idempotent.
28. Cả scheduled và on-demand consultation dùng chung một limit. Pending on-demand request chưa tạo reservation; reservation được tạo atomically khi Doctor accept.
29. Scheduled consultation tạo reservation khi booking được xác nhận. Reservation phải chống race để hai request đồng thời không vượt số lượt còn lại.
30. Consultation được count khi chuyển `in_consultation`; Patient `no_show` cũng được count theo no-show policy. Doctor/system cancel hoặc Patient cancel đúng hạn phải hủy reservation.
31. Retry, duplicate event hoặc reconnect không được count/hủy reservation hai lần; ledger entry phải gắn `consultationId` và idempotency key.
32. Khi hết số lượt, Patient có thể chờ cycle mới, nâng gói hoặc mua add-on. Safety alert vẫn hoạt động và tình huống khẩn cấp phải hướng tới cơ sở y tế/cấp cứu.
33. `AiQuestionQuota` là entitlement riêng chỉ đếm câu hỏi AI; không dùng chung counter, ledger hoặc tên field với consultation limit.
34. PaymentOrder dùng state machine `created|pending|processing|paid|failed|expired|cancelled`; mọi transition là conditional, có actor/source/time và audit. Timeout/unknown không được tự chuyển thành failed nếu chưa đối soát provider.
35. Trong một Mongo transaction, IPN hợp lệ upsert PaymentTransaction, chuyển order sang paid và ghi đúng một `SubscriptionGrantRequested` OutboxEvent. Không gọi VNPAY hoặc dịch vụ ngoài trong transaction.
36. Worker cấp Subscription idempotent theo `sourceOrderId`/grant key. Lỗi worker được retry; không tạo payment mới và không chuyển order paid về pending.
37. Reconciliation phải phát hiện order processing quá lâu, paid-without-grant, duplicate/mismatch provider reference và xác minh lại trước thao tác sửa trạng thái.
38. DA2 không dùng Saga framework vì Payment, Subscription và Outbox nằm trong một modular monolith/MongoDB. Chỉ xem xét Saga khi các bước thuộc service/database độc lập và cần compensation liên dịch vụ.

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
