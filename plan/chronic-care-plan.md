# HealthAI Chronic Care — Kế hoạch sản phẩm DA2

## 1. Quyết định sản phẩm

HealthAI DA2 được định vị là nền tảng **theo dõi và hỗ trợ chăm sóc bệnh mạn từ xa**. MVP bắt buộc có hai Care Program cho người trưởng thành: **tăng huyết áp** và **tiểu đường**; cả hai dùng chung Program engine, chỉ khác metric context, rule set và nội dung đã duyệt.

Thiết kế dữ liệu đề xuất nằm tại `docs/db-template-v8.dbml`. Đây là bản nháp để review; chỉ trở thành schema triển khai sau khi các quyết định mở được chốt và migration/version verifier được tạo.

Sản phẩm không khám bệnh, không chẩn đoán, không kê đơn và không thay thế bác sĩ hoặc cơ sở y tế. Hệ thống giúp bệnh nhân duy trì việc theo dõi giữa hai lần khám, giúp bác sĩ nhận biết bệnh nhân cần chú ý và hỗ trợ hai bên kết nối đúng thời điểm.

Định vị ngắn gọn:

> HealthAI Chronic Care biến dữ liệu chỉ số rời rạc thành một quy trình chăm sóc liên tục: theo dõi, nhắc việc, phân tầng ưu tiên, tóm tắt cho bác sĩ và tái tư vấn.

## 2. Bài toán và giá trị

### 2.1 Bài toán thực tế

- Bệnh nhân thường quên đo chỉ số, ghi nhận không đều hoặc bỏ tái khám.
- Một giá trị bất thường đơn lẻ thiếu bối cảnh; bác sĩ cần xem xu hướng nhiều ngày.
- Bác sĩ không thể đọc thủ công toàn bộ dữ liệu của mọi bệnh nhân mỗi ngày.
- Chatbot sức khỏe tổng quát không tạo ra vòng lặp chăm sóc hoặc hành động tiếp theo.
- Phòng khám chưa có công cụ đơn giản để cung cấp dịch vụ theo dõi giữa hai lần khám.

### 2.2 Giá trị theo vai trò

| Vai trò | Giá trị nhận được |
|---|---|
| Patient | Kế hoạch theo dõi rõ ràng, nhắc đúng lịch, biết khi nào nên liên hệ bác sĩ, xem tiến triển dễ hiểu. |
| Doctor | Priority Inbox, xu hướng chỉ số, tóm tắt trước tư vấn và giảm thời gian đọc dữ liệu thô. |
| Admin/Clinic | Quản lý chương trình, gói dịch vụ, chất lượng vận hành và chỉ số sử dụng. |

### 2.3 Giá trị kinh tế

MVP hỗ trợ hai mô hình, nhưng chỉ cần chứng minh một mô hình trong demo:

1. **B2C subscription:** bệnh nhân mua gói theo dõi theo tháng, gồm Care Program, báo cáo định kỳ, quota AI và quyền lợi tư vấn.
2. **B2B2C clinic package:** phòng khám sử dụng dashboard để theo dõi nhóm bệnh nhân và bán gói chăm sóc sau khám/tái khám.

Không đưa claim tiết kiệm chi phí y tế hoặc cải thiện kết quả lâm sàng nếu chưa có nghiên cứu người dùng và dữ liệu xác nhận. Trong DA2, giá trị kinh tế được chứng minh bằng chỉ số vận hành và conversion.

### 2.4 Gói subscription và nguyên tắc phân quyền lợi

Subscription được bán dựa trên mức độ hỗ trợ và tiện ích của quy trình Chronic Care, không bán quyền được an toàn. Cảnh báo an toàn thiết yếu, quyền xem dữ liệu cơ bản và quyền tải/xóa dữ liệu theo chính sách không được khóa sau paywall.

#### Free — theo dõi sức khỏe cơ bản

- Nhập và xem lịch sử HealthMetrics của chính Patient.
- Biểu đồ cơ bản và báo cáo ngắn mặc định.
- Cảnh báo an toàn thiết yếu và safety escalation.
- Tối đa một Care Program cơ bản đang hoạt động, có Doctor assignment bắt buộc nhưng không bao gồm Doctor review định kỳ.
- Notification trong ứng dụng.
- Quota AI RAG cơ bản theo ngày.
- Quyền tải/xóa dữ liệu cá nhân cơ bản theo retention/audit policy.

Free không bao gồm Doctor review định kỳ hoặc cam kết phản hồi. Patient được thực hiện tối đa **1 consultation trong mỗi cycle** và thanh toán riêng cho phiên đó theo chính sách của hệ thống.

#### Plus — tự theo dõi nâng cao

Bao gồm toàn bộ Free và:

- Nhiều Care Program active trong giới hạn cấu hình của Plan.
- Báo cáo 7/30/90 ngày và so sánh xu hướng giữa các giai đoạn.
- AI summary định kỳ theo tuần, có grounding/provenance/fallback.
- Smart Reminder, quiet hours và lịch nhắc được cá nhân hóa.
- Theo dõi thói quen, milestone và streak không mang tính phán xét.
- Medication reminder/adherence khi `BE-CC-010` được bật.
- Patient chủ động xuất báo cáo PDF/CSV.
- Quota AI cao hơn Free.
- Lịch sử mở rộng chỉ áp dụng nếu retention policy được duyệt; dữ liệu tối thiểu và quyền truy cập dữ liệu của chính Patient không được phụ thuộc Plan.
- Được thực hiện tối đa **3 consultations trong mỗi subscription cycle**; chi phí từng phiên vẫn thanh toán riêng nếu Plan không cấu hình ưu đãi.
- Khi tính năng P1 được bật, Patient có thể mua thêm quyền mời một người thân đồng hành để nhận nhắc nhở bỏ lỡ nhiệm vụ; quyền này không bao gồm xem dữ liệu sức khỏe chi tiết.

#### Care — có bác sĩ/phòng khám đồng hành

Bao gồm toàn bộ Plus và:

- Care Program do Doctor/Clinic gán và quản lý.
- Doctor review định kỳ theo cadence được snapshot khi enrollment/subscription bắt đầu.
- Care Alert xuất hiện trong Doctor Priority Inbox của người phụ trách.
- Được thực hiện tối đa **6 consultations trong mỗi subscription cycle**; Plan có thể cấu hình mức ưu đãi giá nhưng không dùng mô hình credit trong MVP.
- Follow-up task/note sau consultation.
- Báo cáo có trạng thái Doctor reviewed/confirmed; trạng thái này không có nghĩa chứng nhận chẩn đoán.
- Nhắc tái khám.
- Khi tính năng P1 được bật, bao gồm một người thân đồng hành nhận nhắc nhở bỏ lỡ nhiệm vụ theo consent của Patient.
- Kênh nhắn tin trong phạm vi Consultation đang được authorize; Care không tạo kênh chat 24/7.

Care chỉ được quảng bá SLA phản hồi nếu Clinic thực sự cấu hình nhân sự, giờ phục vụ và cơ chế giám sát SLA. Nếu không có SLA, giao diện phải ghi rõ Doctor không theo dõi realtime và Care Alert không thay thế cấp cứu.

#### Ma trận entitlement đề xuất

Giá và giới hạn số lượng là dữ liệu cấu hình của `Plans`, không hard-code trong frontend/backend.

| Quyền lợi | Free | Plus | Care |
|---|---:|---:|---:|
| Xem/nhập HealthMetrics và biểu đồ cơ bản | Có | Có | Có |
| Safety alert thiết yếu | Có | Có | Có |
| Care Program active | 1 basic | Nhiều theo Plan | Nhiều theo Plan + Doctor assigned |
| Báo cáo | Cơ bản | 7/30/90 ngày | 7/30/90 ngày + Doctor review |
| AI RAG/summary | Quota cơ bản | Quota cao + weekly summary | Quota cao + Doctor-context summary |
| Reminder | In-app cơ bản | Smart + quiet hours | Smart + follow-up/tái khám |
| Medication reminder | Không/P1 | Có khi feature bật | Có khi feature bật |
| Người thân nhận nhắc bỏ lỡ nhiệm vụ | Không | Mua thêm khi P1 bật | Bao gồm 1 người khi P1 bật |
| PDF/CSV export | Dữ liệu cơ bản | Báo cáo nâng cao | Báo cáo nâng cao/reviewed |
| Doctor Priority Inbox | Không | Không | Có |
| Số consultations tối đa mỗi cycle | 1 | 3 | 6 |
| Nhắn tin Doctor | Chỉ trong consultation mua riêng | Chỉ trong consultation | Chỉ trong consultation được authorize |

#### Quy tắc upgrade, downgrade và hết hạn

- Upgrade có hiệu lực sau khi payment/IPN hợp lệ; quyền lợi được đọc từ Subscription grant đã snapshot.
- Downgrade/hết hạn không xóa HealthMetrics, report lịch sử hoặc Care Alert đã phát sinh.
- Khi Care hết hạn, hệ thống dừng tạo quyền lợi Doctor review mới sau paid-through/grace policy, nhưng vẫn giữ safety alert và quyền Patient xem dữ liệu cơ bản.
- Giới hạn mặc định Free/Plus/Care là `1/3/6` consultations mỗi cycle; field chuẩn là `consultationLimitPerCycle` trong Plan/Subscription snapshot, không gọi là AI quota và không hard-code theo tên tier.
- Plus/Care dùng `currentPeriodStart/currentPeriodEnd` của Subscription; Free cũng có bản ghi Subscription với `source = free_grant`, chu kỳ 30 ngày neo tại thời điểm kích hoạt và được chuyển sang chu kỳ kế tiếp trên cùng bản ghi, không reset đồng loạt bằng cron toàn hệ thống.
- `consultationsUsed` đếm số phiên đã sử dụng trong cycle và `consultationsRemaining = consultationLimitPerCycle - consultationsUsed - activeReservations`.
- Giới hạn consultation không đồng nghĩa phiên miễn phí hoặc bảo đảm Doctor còn lịch. Chi phí/ưu đãi của từng phiên là chính sách giá riêng.
- Patient có thể mua add-on để tăng `consultationLimitPerCycle` hiệu dụng; add-on phải có source order, expiry và ledger idempotent.
- Hệ thống tạo reservation nội bộ khi scheduled booking được xác nhận hoặc on-demand request được Doctor accept; count khi phiên vào `in_consultation` hoặc Patient `no_show`; hủy reservation khi Doctor/system hủy hoặc Patient hủy đúng policy.
- `aiTokenLimit` là quota chính cho chat AI; `aiRequestLimit` là giới hạn phụ chống spam. Cả hai độc lập với `consultationLimitPerCycle`, còn summary dùng ngân sách token riêng.
- Plan change không được làm thay đổi quyền lợi của kỳ đã thanh toán nếu chưa có effective time rõ ràng.
- Enforcement nằm ở backend entitlement service; frontend chỉ dùng entitlement response để hiển thị UI.
- Không cho phép Plan trả phí thay đổi severity, thứ tự lâm sàng của Care Alert hoặc ưu tiên cấp cứu.

## 3. Persona và phạm vi bệnh

### Persona chính

- Bệnh nhân trưởng thành đã được nhân viên y tế hướng dẫn theo dõi huyết áp tại nhà.
- Bác sĩ đã được hệ thống xác minh và có bệnh nhân tham gia Care Program.
- Doctor và Admin có quyền tạo/chỉnh draft Program Template theo permission. Admin quản lý lifecycle publish/retire, version rule/ngưỡng, gói dịch vụ và nội dung RAG đã duyệt.

### Phạm vi bệnh trong MVP

- P0: chương trình theo dõi tăng huyết áp và chương trình theo dõi tiểu đường, dùng chung domain model/rule engine.
- P0: mọi enrollment phải có một Doctor `active + approved` được phân công trước khi Patient consent/kích hoạt.
- Ngoài MVP: tự phát hiện bệnh, tự kê/đổi thuốc, tích hợp thiết bị y tế thật, phân tích ECG/CT/MRI và dự đoán biến cố lâm sàng.

### Một Care Program gồm những gì

Care Program không chỉ là một nhãn gắn vào Patient. Đây là một workflow có version, thời hạn, nhiệm vụ, rule và đầu ra đo được. Mỗi Program Template gồm các khối sau:

| Khối | Nội dung cấu hình | Ví dụ tăng huyết áp 30 ngày |
|---|---|---|
| Thông tin chương trình | Tên, mô tả, đối tượng, thời lượng, owner, version | Theo dõi huyết áp tại nhà — 30 ngày |
| Eligibility | Điều kiện sử dụng và trường hợp không phù hợp | Patient trưởng thành đã được hướng dẫn theo dõi tại nhà |
| Consent & disclaimer | Phiên bản consent, phạm vi dữ liệu, giới hạn dịch vụ | Không thay thế cấp cứu; Doctor không theo dõi 24/7 |
| Baseline | Bộ câu hỏi/chỉ số ban đầu | Lịch sinh hoạt, timezone, thói quen đo, số đo gần đây |
| Goals | Mục tiêu hành vi/theo dõi, không phải cam kết điều trị | Hoàn thành tối thiểu số lần đo đã giao mỗi tuần |
| Monitoring protocol | Metric type, số lần đo, cửa sổ thời gian | Huyết áp sáng/tối theo lịch được giao |
| Task templates | Metric, check-in, education, consultation/review | Đo huyết áp, check-in tuần, đọc hướng dẫn đo đúng |
| Reminder policy | Thời điểm, retry, quiet hours, channel | In-app trước hạn; nhắc lại nếu chưa hoàn thành |
| Rule set | Rule version hóa và reason code | Missing data, repeated attention, urgent safety rule |
| Review policy | Ai review, cadence, dữ liệu được xem | Doctor review tuần đối với tier Care |
| Content journey | Tài liệu approved theo tuần/mốc | Cách đo đúng, chuẩn bị câu hỏi tái khám |
| Completion criteria | Điều kiện hoàn thành/đóng chương trình | Hết 30 ngày và tạo final report |
| Entitlement | Tier nào được dùng module nào | Free/Plus tự thực hiện nhưng vẫn Doctor-assigned; Care có Doctor review |

Template ở trạng thái `draft` có thể chỉnh sửa. Khi publish, hệ thống tạo version bất biến; thay đổi cấu hình tạo version mới thay vì sửa lịch sử của enrollment đang chạy.

### Các loại nhiệm vụ trong chương trình

Program engine nên hỗ trợ một số `taskType` dùng lại được thay vì tạo collection/service riêng cho từng bệnh:

| Task type | Patient thực hiện | Cách hoàn thành | Cut-line |
|---|---|---|---|
| `metric` | Nhập chỉ số sức khỏe | HealthMetric hợp lệ trong time window | P0 |
| `check_in` | Trả lời bộ câu hỏi ngắn có cấu trúc | Check-in response hợp lệ | P0 |
| `education` | Đọc nội dung đã duyệt và xác nhận | Content progress/acknowledgment | P0 tối giản |
| `appointment` | Đặt hoặc tham gia tái khám | Consultation đạt state cấu hình | P0/P1 theo NF-2/NF-3 |
| `doctor_review` | Không hiển thị như nhiệm vụ Patient | Doctor hoàn tất review | P0 cho Care demo |
| `medication` | Xác nhận đã uống/bỏ qua/hoãn theo đơn hiện có | Medication log | P1 |
| `journal` | Ghi triệu chứng/câu hỏi muốn trao đổi | Journal entry | P1 |

Mỗi task template tối thiểu có `taskType`, schedule, time window, completion rule, reminder policy, required/optional và version. Worker materialize task theo từng ngày/tuần bằng idempotency key; không tạo vô hạn task cho toàn bộ chương trình ngay lúc enroll.

### Trải nghiệm Patient trong một chương trình

#### Khi tham gia

- Xem mục tiêu, thời lượng, Doctor phụ trách nếu có, quyền lợi subscription và giới hạn dịch vụ.
- Xác nhận consent phiên bản hiện hành.
- Hoàn thành baseline assessment.
- Chọn timezone, quiet hours và kênh thông báo.
- Xem trước lịch nhiệm vụ và có quyền từ chối/rời chương trình theo policy.

#### Trong quá trình theo dõi

- Màn hình **Hôm nay** hiển thị task đến hạn, quá hạn và đã hoàn thành.
- Nhập chỉ số với validation đơn vị, thời điểm và giá trị bất thường về mặt dữ liệu.
- Hoàn thành check-in ngắn; không buộc nhập văn bản dài mỗi ngày.
- Xem tiến độ tuần, adherence, streak nhẹ nhàng và milestone.
- Nhận smart reminder, nhưng có quiet hours và giới hạn tần suất để tránh notification fatigue.
- Xem trend, report và reason code bằng ngôn ngữ dễ hiểu.
- Từ alert/report có thể đặt lịch, gửi on-demand request hoặc chuẩn bị câu hỏi cho Doctor.
- Xem nội dung giáo dục đúng giai đoạn, có nguồn/citation và không thay thế hướng dẫn riêng của Doctor.

#### Khi kết thúc

- Nhận final report gồm baseline, mức độ hoàn thành, trend, alerts và consultations.
- Đánh giá mức hữu ích của chương trình và AI summary.
- Chọn kết thúc, gia hạn hoặc chuyển chương trình nếu có quyền và được Doctor duyệt khi cần.
- Dữ liệu không bị xóa chỉ vì Program hoặc Subscription kết thúc.

### Trải nghiệm Doctor và Admin

Doctor có thể:

- Tạo/chỉnh draft Program Template trong phạm vi permission; chọn template đã publish, kiểm tra eligibility và enroll Patient.
- Chỉ tùy chỉnh các trường được template cho phép như lịch đo, timezone, review cadence hoặc patient-specific threshold đã được policy cho phép.
- Xem baseline, adherence, trend, missing data, Care Alerts và AI summary trong một màn hình.
- Acknowledge/resolve alert, ghi review note, tạo consultation và giao follow-up task.
- Pause, complete hoặc chuyển version enrollment với lý do/audit.

Admin/Clinic có thể:

- Tạo/chỉnh draft bằng **Program Builder Lite** theo các khối cấu hình có sẵn; DA2 không cần drag-and-drop workflow builder tổng quát.
- Preview lịch/task/rule trên dữ liệu giả lập trước khi publish.
- Là owner quản trị rule/ngưỡng: kiểm tra nguồn/căn cứ đã duyệt, publish/retire version và lưu audit. Admin không tự đặt claim lâm sàng thiếu nguồn.
- Quản lý nội dung RAG, entitlement và người có quyền tạo/chỉnh/sử dụng template.
- Xem cohort KPI không lộ dữ liệu ngoài scope: enrollment, adherence, alert acknowledgment và follow-up conversion.
- Audit thay đổi template, rule, consent, assignment và entitlement.

### AI trong Care Program

AI được dùng ở những vị trí tạo giá trị nhưng có fallback rõ ràng:

| AI capability | Input được phép | Output | Người/logic kiểm soát |
|---|---|---|---|
| Baseline structuring | Câu trả lời Patient trong enrollment | Bản tóm tắt baseline có cấu trúc | Patient xác nhận; backend validate schema |
| Weekly/final narrative | Report số liệu do backend tính | Tóm tắt dễ hiểu cho Patient/Doctor | Grounding, provenance và fallback |
| Doctor pre-review | Timeline được authorize | Draft điểm cần Doctor kiểm tra | Doctor quyết định, không auto-resolve |
| Education selection | Program stage + approved content metadata | Gợi ý nội dung phù hợp | Chỉ chọn tài liệu active/approved |
| Reminder wording | Task, locale, lịch sử gửi không nhạy cảm | Câu nhắc thân thiện | Template/policy giới hạn nội dung |
| Program draft assistant | Yêu cầu của Admin/Doctor + schema Program | Draft template/rule description | Admin duyệt nguồn, version và publish |
| Consultation note draft | Consultation context được authorize | Bản nháp tóm tắt | Doctor sửa/xác nhận trước lưu chính thức |

LLM không được quyết định eligibility, thay đổi threshold, tạo severity, enroll/loại Patient, cấp entitlement hoặc publish Program. Các thao tác đó dùng rule/permission/state transition xác định.

#### Chuỗi xử lý AI đọc và tóm tắt HealthMetrics

AI không nhận toàn bộ dữ liệu thô rồi tự tính toán. Luồng chuẩn gồm bảy bước có thể kiểm thử độc lập:

```text
HealthMetrics gốc
 -> chuẩn hóa đơn vị/thời gian/nguồn
 -> tổng hợp xác định bằng backend
 -> Care Rule Evaluation
 -> SummaryInput snapshot có cấu trúc
 -> LLM diễn đạt theo schema
 -> kiểm tra grounding/safety
 -> lưu AI summary hoặc deterministic fallback
```

1. **Chuẩn hóa:** kiểm tra loại chỉ số, đơn vị, timezone, khoảng thời gian, nguồn nhập và cờ dữ liệu không hợp lệ. Không tự sửa giá trị bất thường; bản ghi bị loại phải có reason code.
2. **Tổng hợp xác định:** backend tính số lần dự kiến/đã đo, adherence, min/max/average/median, chênh lệch theo kỳ, trend, missing windows, alert counts và consultation/follow-up liên quan. LLM không tính lại các số này.
3. **Đánh giá rule:** rule engine version hóa tạo `normal|attention|urgent` và `reasonCodes`. Severity luôn là dữ liệu đầu vào bất biến đối với LLM.
4. **Đóng gói đầu vào:** tạo `SummaryInputSnapshot` chỉ chứa khoảng báo cáo, dữ liệu thống kê cần thiết, missing data, rule results và source references đã authorize; không gửi toàn bộ hồ sơ nếu không cần.
5. **Sinh nội dung:** yêu cầu structured output tách `overview`, `observations`, `missingData`, `alertsToMention`, `questionsForDoctor` và `disclaimer`. Patient view dùng ngôn ngữ dễ hiểu; Doctor view giữ số liệu, provenance và điểm cần kiểm tra.
6. **Kiểm tra đầu ra:** schema validation, kiểm tra mọi con số/tuyên bố có trong snapshot, cấm diagnosis/prescription/dose change, kiểm tra citation và giới hạn ngôn ngữ khẳng định. Output không đạt không được hiển thị như summary hợp lệ.
7. **Fallback và lưu vết:** khi provider timeout, schema sai, grounding fail hoặc evidence thiếu, trả báo cáo xác định bằng template. Lưu window, data cutoff, input hash/source refs, rule set version, prompt/model version, validation result và trạng thái `generated|fallback|failed`.

RAG chỉ bổ sung nội dung giáo dục đã duyệt và citation; không dùng RAG để tính thống kê, chọn ngưỡng hoặc thay đổi severity. Summary job và API phải idempotent theo `(enrollmentId, reportWindow, dataCutoff, summaryVersion)`; dữ liệu nguồn thay đổi thì tạo version mới thay vì âm thầm ghi đè.

#### Bộ kiểm thử AI summary

- Bộ dữ liệu cố định cho tăng huyết áp và tiểu đường gồm trường hợp bình thường, thiếu dữ liệu, giá trị lặp vượt ngưỡng, đơn vị sai và `urgent`.
- Đối chiếu số liệu trong output với `SummaryInputSnapshot`; không chấp nhận số không có nguồn.
- Kiểm tra lời khuyên chẩn đoán/kê đơn/đổi liều, hạ severity và tuyên bố chắc chắn.
- Kiểm tra hai dạng Patient/Doctor, fallback khi provider lỗi và giới hạn dữ liệu theo authorization.
- Theo dõi tỷ lệ grounding pass, fallback, validation failure, latency và token cost; không dùng demo summary làm bằng chứng hiệu quả lâm sàng.

### Ví dụ hoàn chỉnh: Program tăng huyết áp 30 ngày

| Giai đoạn | Patient | Hệ thống | Doctor |
|---|---|---|---|
| Ngày 0 | Consent, baseline, chọn giờ nhắc | Tạo enrollment/tasks và snapshot version | Kiểm tra enrollment nếu tier Care |
| Ngày 1–7 | Đo theo lịch, check-in cuối tuần | Reminder, adherence, rule evaluation | Chỉ nhận item cần review |
| Ngày 7 | Xem weekly report | Backend tính report, AI viết narrative | Review report nếu Care |
| Ngày 8–29 | Tiếp tục task; phản hồi alert | Điều chỉnh reminder theo policy, không đổi rule | Follow-up/consultation khi cần |
| Ngày 30 | Xem final report và phản hồi | Đóng kỳ, tạo KPI và lựa chọn gia hạn | Xác nhận report/follow-up nếu Care |

### Chiến lược mở rộng chương trình

Mở rộng theo module và mức tái sử dụng, không fork toàn bộ code theo từng bệnh:

| Giai đoạn | Chương trình/module | Phần tái sử dụng | Phần bổ sung | Giá trị kinh tế |
|---|---|---|---|---|
| P0 | Tăng huyết áp 30 ngày | Toàn bộ Program engine | BP metric/rule/content | Chứng minh critical journey và gói Care |
| P0 | Tiểu đường | Enrollment, tasks, alerts, report, AI | Glucose context, rule/content đã duyệt | Chứng minh engine tái sử dụng và tăng giá trị Plus/Care |
| P1 | Medication adherence | Schedule, reminder, report | Medication plan/log và safety copy | Add-on Plus/Care |
| P1 | Kiểm soát cân nặng/chuyển hóa | Goals, metric, check-in, content | Weight/waist/habit templates | Subscription Patient-led, Doctor-assigned dễ tiếp cận |
| P2 | Chăm sóc sau khám 7/14/30 ngày | Tasks, content, consultation, report | Checklist/attachment theo chuyên khoa | Clinic bán gói follow-up |
| P1 | Người thân đồng hành | Nhắc nhở/thông báo | Người thân có tài khoản Patient, xác nhận liên kết, giới hạn một người và quyền theo từng loại dữ liệu | Add-on Plus, gồm trong Care |
| P1 | Tìm cơ sở y tế | Tìm theo bệnh/chuyên khoa và vị trí | Admin chọn kết quả bản đồ, tạo bản nháp, xác minh nguồn chính thức; tìm theo khoảng cách | Tạo bước hành động sau cảnh báo/tái khám; hỗ trợ hợp tác phòng khám sau DA2 |
| Sau DA2 | Thiết bị đo/Health platform | Metric ingestion | Device identity, provenance, reconciliation | Giảm nhập tay, tăng retention |

Điều kiện nhận một Program mới:

1. Ít nhất 80% luồng dùng lại Program engine hiện có; không tạo bounded context riêng chỉ vì khác bệnh.
2. Có owner chịu trách nhiệm rule/content và nguồn duyệt.
3. Có ít nhất một KPI sản phẩm và một hành trình demo/test.
4. Không thêm Program thứ ba trước khi cả tăng huyết áp và tiểu đường pass E2E, authorization, rule boundary và AI fallback.
5. Program mới phải tắt được bằng feature flag/template status mà không ảnh hưởng enrollment khác.

### Mức phức tạp chấp nhận được trước deadline

Có thể tận dụng AI hỗ trợ lập trình để nhận thêm các phần có giá trị kiến trúc:

- Program engine theo schema thay vì hard-code riêng tăng huyết áp/tiểu đường.
- Program Builder Lite với form cấu hình và preview, không làm visual workflow builder.
- Generic task scheduler cho `metric`, `check_in`, `education`, `doctor_review`.
- Versioned JSON rule definition với tập operator allowlist, không cho chạy code/script tùy ý.
- Simulation endpoint/test harness chạy template trên dữ liệu giả để xem task/alert dự kiến.
- Structured-output AI summary và program draft assistant có schema validation.

AI hỗ trợ code làm giảm thời gian tạo boilerplate/test/data mapping, nhưng không thay thế việc duyệt rule y khoa, threat model, race condition, authorization và usability. Vì vậy các phần thiết bị thật, mạng lưới nhiều phòng khám và tác tử AI tự vận hành vẫn để sau DA2. Người thân đồng hành chỉ nhận ở mức P1, số lượng theo `familyLinkLimit`, chủ yếu nhắc bỏ lỡ nhiệm vụ; quyền xem dữ liệu chi tiết để sau DA2. Tìm cơ sở y tế P1 chỉ dùng danh mục kiểm duyệt và bản đồ bổ sung, không tích hợp lịch trống/đặt lịch trực tiếp của bệnh viện.

## 4. Vòng lặp chăm sóc cốt lõi

```mermaid
flowchart LR
    A[Doctor/Admin tạo template] --> B[Patient tham gia Care Program]
    B --> C[Nhận lịch đo và nhiệm vụ]
    C --> D[Nhập Health Metric]
    D --> E[Rule engine đánh giá dữ liệu]
    E --> F[Care Alert + Priority Inbox]
    E --> G[Tiếp tục theo dõi]
    F --> H[Doctor xem trend + AI summary]
    H --> I[Chat / đặt Consultation]
    I --> J[Doctor ghi nhận kế hoạch tiếp theo]
    J --> C
```

Một hành trình demo đạt yêu cầu:

1. Doctor gán chương trình tăng huyết áp 30 ngày cho Patient.
2. Patient thấy lịch đo và nhập chỉ số hằng ngày.
3. Một chuỗi dữ liệu vi phạm rule cấu hình tạo Care Alert có lý do giải thích được.
4. Patient nhận hướng dẫn an toàn; Doctor thấy Patient trong Priority Inbox.
5. AI tạo bản tóm tắt chỉ từ dữ liệu được phép và nguồn RAG đã duyệt.
6. Patient đặt lịch hoặc gửi yêu cầu tư vấn; Doctor xem tóm tắt trước phiên.
7. Sau phiên, Doctor cập nhật ghi chú/kế hoạch theo dõi; hệ thống tiếp tục vòng lặp.

## 5. Phạm vi chức năng

### 5.1 P0 — bắt buộc cho Chronic Care MVP

#### CC-1. Care Program

- Admin/Doctor tạo hoặc chỉnh draft template theo permission; Admin quản lý publish/retire và rule/ngưỡng theo version.
- Doctor `active + approved` enroll Patient vào chương trình có thời gian bắt đầu/kết thúc; enrollment không được active nếu chưa có Doctor assignment.
- Một enrollment có trạng thái `pending`, `active`, `paused`, `completed`, `cancelled`.
- Chương trình cấu hình loại chỉ số, tần suất đo, timezone và rule cảnh báo.
- Patient xem mục tiêu theo dõi và xác nhận tham gia trước khi kích hoạt.

#### CC-2. Monitoring Schedule và adherence

- Hệ thống sinh nhiệm vụ đo chỉ số theo lịch chương trình.
- Patient có thể đánh dấu hoàn thành bằng cách nhập HealthMetric hợp lệ.
- Adherence chỉ là tỷ lệ hoàn thành nhiệm vụ theo dõi, không phải đánh giá tuân thủ điều trị.
- Nhắc việc sử dụng Notification + Outbox + BullMQ và phải idempotent.

#### CC-3. Rule-based Risk Stratification

- Rule engine đánh giá giá trị hiện tại, số lần lặp, xu hướng ngắn hạn và dữ liệu bị thiếu.
- Kết quả gồm `normal`, `attention`, `urgent` cùng `reasonCodes`; không trả về tên bệnh hay chẩn đoán.
- Mỗi kết quả lưu `ruleSetVersion`, dữ liệu đầu vào tham chiếu và thời điểm đánh giá để audit.
- `urgent` hiển thị hướng dẫn liên hệ cơ sở y tế/cấp cứu phù hợp; không chờ AI sinh nội dung hành động.
- Ngưỡng lâm sàng không hard-code rải rác; phải nằm trong rule set được duyệt và version hóa.

#### CC-4. Care Alert và Doctor Priority Inbox

- Alert được tạo từ rule evaluation, không tạo trùng cho cùng cửa sổ/rule.
- Doctor chỉ xem alert của Patient đang thuộc chương trình mình phụ trách hoặc consultation được authorize.
- Priority Inbox sắp theo severity, thời điểm phát hiện và trạng thái xử lý; không dùng AI score làm nguồn quyết định duy nhất.
- Doctor có thể acknowledge, contact patient, link consultation hoặc resolve với ghi chú.

#### CC-5. Chronic Care Summary

- Báo cáo 7/30 ngày gồm số lần đo, adherence, thống kê/trend, alert và consultation liên quan.
- Phần số liệu được backend tính xác định; LLM chỉ diễn đạt/tóm tắt từ payload đã chuẩn hóa.
- Summary ghi model/prompt version, phạm vi thời gian và nguồn dữ liệu; lỗi AI không được chặn dashboard số liệu.
- Patient summary dùng ngôn ngữ dễ hiểu; Doctor summary ưu tiên timeline và dữ kiện cần kiểm tra.

#### CC-6. Liên kết Consultation

- Từ alert hoặc summary, Patient có thể đặt slot hoặc gửi on-demand request.
- Consultation lưu liên kết tùy chọn tới enrollment/alert để Doctor có đúng ngữ cảnh.
- Sau consultation, Doctor có thể ghi follow-up note và cập nhật chương trình trong phạm vi được phép.

### 5.2 P1 — chỉ làm sau khi P0 ổn định

- Medication schedule và medication adherence; không tự chỉnh liều hoặc khuyến nghị ngừng thuốc.
- PDF report chia sẻ do Patient chủ động xuất.
- B2B clinic dashboard và cohort analytics nâng cao.
- Entitlement đầy đủ cho Free/Plus/Care; trong MVP có thể dùng seed subscription trước khi VNPAY sẵn sàng.
- FCM/mobile critical flow nếu web + in-app notification đã hoàn chỉnh.

### 5.3 P0 thương mại — VNPAY Sandbox

- VNPAY payment/subscription và cancel unpaid order là tiêu chí bắt buộc của MVP/demo.
- Chỉ IPN hợp lệ chuyển order sang paid và ghi `SubscriptionGrantRequested` vào transactional outbox; Return URL không cấp entitlement.
- Worker cấp Subscription idempotent theo source order; reconciliation xử lý `processing` quá lâu và `paid` nhưng chưa có grant.
- DA2 dùng payment state machine + Mongo transaction + outbox + worker + reconciliation, không thêm Saga framework. Chỉ cân nhắc Saga sau khi tách Payment/Subscription/Booking thành service và database độc lập.
- Free/Plus/Care entitlement phải chạy end-to-end với Plan/PaymentOrder/Subscription snapshot.
- Seed subscription chỉ dùng cho test nội bộ; acceptance demo doanh thu phải dùng giao dịch VNPAY Sandbox có audit.
- Full refund vẫn là P1 và chỉ nhận khi payment/cancel/idempotency đã ổn định. Điều kiện được snapshot theo phiên bản Plan, đánh giá riêng mức dùng AI/consultation/Doctor review/báo cáo/nhiệm vụ Care, tạm dừng quyền trả phí khi chờ và kiểm tra lại trước khi Admin duyệt.

### 5.4 Ngoài phạm vi DA2

- AI chẩn đoán, kê đơn, đổi liều hoặc dự đoán biến cố lâm sàng.
- Doctor theo dõi realtime 24/7 hoặc cam kết phản hồi cấp cứu.
- Tích hợp thiết bị y tế/Bluetooth, nhà thuốc, bảo hiểm và giao diện đặt lịch chính thức của bệnh viện.
- Người thân đồng hành nhiều contact hoặc chia sẻ dữ liệu chi tiết ngoài consent P1.
- WebRTC production-grade, full refund, GraphRAG và autonomous medical agent nếu làm chậm P0.

## 6. Ranh giới AI và an toàn

AI được phép:

- Tóm tắt dữ liệu 7/30 ngày đã được backend tổng hợp.
- Viết lại thông tin cho Patient bằng ngôn ngữ dễ hiểu.
- Trả lời kiến thức chung bằng RAG từ tài liệu active/approved và citation hợp lệ.
- Gợi ý danh sách câu hỏi để Doctor xem xét trong consultation.

AI không được phép:

- Tạo severity hoặc thay đổi kết quả rule engine.
- Chẩn đoán, kê đơn, đổi liều, bảo đảm an toàn hoặc trì hoãn cấp cứu.
- Suy diễn dữ liệu không có trong payload, truy cập Patient khác hoặc nguồn chưa duyệt.
- Tự động gửi nội dung có ảnh hưởng y khoa mà không qua template/safety validation.

Nếu LLM lỗi, timeout hoặc không đủ evidence, hệ thống vẫn hiển thị số liệu xác định, lý do rule và hành động an toàn; summary chuyển trạng thái `unavailable` thay vì bịa câu trả lời.

## 7. Dữ liệu và ownership đề xuất

| Entity | Module sở hữu | Mục đích |
|---|---|---|
| `CarePrograms` | chronic-care | Chương trình đã duyệt, loại chỉ số, lịch và phiên bản. |
| `PatientCarePrograms` | chronic-care | Chương trình Patient tham gia, Doctor phụ trách, đồng ý chia sẻ, thời hạn và trạng thái. |
| `CareTasks` | chronic-care | Nhiệm vụ theo lịch và trạng thái hoàn thành/bỏ lỡ. |
| `CareRules` | chronic-care | Bộ quy tắc có phiên bản; trạng thái draft/active/retired. |
| `HealthEvaluations` | chronic-care | Kết quả tính bằng quy tắc, mã lý do và dữ liệu đầu vào để kiểm tra. |
| `CareAlerts` | chronic-care | Alert lifecycle và thao tác xử lý của Doctor. |
| `CareReports` | chronic-care | Số liệu, xu hướng và dữ liệu thiếu do backend tính. |
| `CareSummaries` | chronic-care | Nội dung AI diễn đạt từ CareReport, có phiên bản và nguồn. |
| `FamilyLinks`, `FamilyPermissions`, `FamilyReminders` | chronic-care | Liên kết tài khoản người thân, quyền được cấp và lịch sử nhắc. |
| `AuditLogs` | platform-audit | Nhật ký dùng chung; Chronic Care ghi với `domain = care`. |
| `HealthMetrics` | health-tracking | Source of truth cho dữ liệu chỉ số; không nhân bản sang chronic-care. |
| `Consultations` | consultations | Phiên tư vấn; chỉ giữ liên kết tùy chọn tới enrollment/alert. |

Module `chronic-care` dùng public API/query port của `health-tracking`, `consultations`, `notifications` và `ai-advisory`; không inject model thuộc module khác.

## 8. API và realtime dự kiến

API contract chi tiết chỉ chốt sau design review. Bề mặt dự kiến:

- `GET /api/v1/care-programs`
- `POST /api/v1/admin/care-programs`
- `POST /api/v1/admin/care-programs/:id/versions/:version/publish`
- `POST /api/v1/admin/care-programs/:id/simulate`
- `POST /api/v1/care-programs/:programId/enrollments`
- `GET /api/v1/care-enrollments/me`
- `GET /api/v1/care-enrollments/:id/today`
- `GET /api/v1/care-enrollments/:id/tasks`
- `POST /api/v1/monitoring-tasks/:id/check-ins`
- `GET /api/v1/care-enrollments/:id/summary?window=7d|30d`
- `GET /api/v1/doctor/care-inbox`
- `POST /api/v1/doctor/care-enrollments/:id/reviews`
- `PATCH /api/v1/care-alerts/:id/acknowledge`
- `PATCH /api/v1/care-alerts/:id/resolve`
- `POST /api/v1/care-alerts/:id/consultations`

Realtime events dự kiến:

- `care-alert.v1.created`
- `care-alert.v1.updated`
- `monitoring-task.v1.due`
- `care-summary.v1.ready`

Mọi list endpoint có pagination/hard limit/stable sort. Doctor access phải được kiểm tra theo assignment/enrollment; không nhận `patientId` từ client làm bằng chứng phân quyền.

## 9. Backlog và dependency

| ID | Feature | Ưu tiên | Phụ thuộc | Done khi |
|---|---|---:|---|---|
| BE-CC-001 | Care Program + Enrollment + consent | P0 | Identity, Doctor capability | State/authorization E2E pass |
| BE-CC-002 | Monitoring schedule/tasks | P0 | BE-CC-001, Health Tracking | Timezone/idempotent generation pass |
| BE-CC-003 | Versioned rule engine/evaluation | P0 | BE-CC-001, Health Tracking | Boundary/repeat/missing-data tests pass |
| BE-CC-004 | Care Alert lifecycle | P0 | BE-CC-003, Outbox | Dedupe/audit/retry tests pass |
| BE-CC-005 | Doctor Priority Inbox | P0 | BE-CC-004 | Auth/pagination/sort/query plan pass |
| BE-CC-006 | Deterministic 7/30-day report + SummaryInput snapshot | P0 | BE-CC-002, BE-CC-004 | Normalization/aggregation/timezone/provenance tests pass |
| BE-CC-007 | AI narrative summary + output guard | P0 | BE-CC-006, AI/RAG | Schema/numerical grounding/safety/fallback/privacy tests pass |
| BE-CC-008 | Consultation link/follow-up | P0 | BE-CC-004, NF-2/NF-3 | Critical journey E2E pass |
| BE-CC-009 | Product/clinic metrics | P0 | BE-CC-001..008 | KPI queries bounded and verified |
| BE-CC-010 | Medication adherence | P1 | BE-CC-001/002 | Reminder/log/privacy tests pass |
| BE-CC-011 | Diabetes program | P0 | BE-CC-001..007 | E2E pass, no disease-specific fork of core flow |
| BE-CC-012 | Free/Plus/Care entitlement | P0 | Plans/Subscriptions, AI quota | Backend enforcement/downgrade/safety tests pass |
| BE-CC-013 | Consultation usage/reservation ledger | P0 | BE-CC-012, Consultations | Limit/count/reserve/release/idempotency tests pass |
| BE-CC-014 | Baseline/check-in schema engine | P0 | BE-CC-001 | Validation/version/privacy tests pass |
| BE-CC-015 | Program Builder Lite + simulation | P1 | BE-CC-001/003/014 | Draft/publish/preview/audit tests pass |
| BE-CC-016 | Education journey/content progress | P1 | BE-CC-001, AI/RAG | Approved-content/auth/progress tests pass |
| BE-CC-017 | Người thân đồng hành | P1 | BE-CC-001/002, Notification | Invite/consent/revoke/privacy/deduplication tests pass |
| BE-CC-018 | Tìm cơ sở y tế | P1 | Care Program, vị trí, Admin | Verified directory/map/ranking/privacy/fallback tests pass |

## 10. Lịch thực hiện đến 31/12/2026

Giả định hai thành viên, ưu tiên một vertical slice chạy được trên Web. Feature freeze ngày 08/12; từ thời điểm này không nhận feature mới.

| Thời gian | Mục tiêu | Đầu ra review/demo |
|---|---|---|
| 01/09–14/09 | Khảo sát và nền tảng | Audit DA1, chốt Chronic Care scope, business rules, wireflow, database/API draft, refactor/hardening nền tảng và seed scenario. |
| 15/09–28/09 | Care Program foundation | Program Template/version, Doctor assignment bắt buộc, consent, baseline/check-in schema, monitoring tasks và chương trình tăng huyết áp. |
| 29/09–12/10 | Risk, alert và reminder | Rule engine version hóa, Care Evaluation, Care Alert lifecycle, notification/outbox, reminder, audit và test boundary. |
| 13/10–26/10 | Doctor workflow và consultation | Priority Inbox, deterministic report 7/30 ngày, authorization, scheduled/on-demand link, follow-up và queue/check-in cần thiết. |
| 27/10–09/11 | Chương trình tiểu đường và AI | Dùng lại Program Engine cho tiểu đường; chuẩn hóa/tổng hợp HealthMetrics, SummaryInput snapshot, structured output, numerical grounding/safety guard, RAG citation, fallback và evaluation dataset. |
| 10/11–23/11 | Subscription và VNPAY | Free/Plus/Care entitlement, AI question limit, consultation limit/reservation, VNPAY Sandbox payment/cancel, outbox grant và reconciliation; không dùng Saga framework. |
| 24/11–07/12 | Tích hợp và bằng chứng | KPI dashboard, hợp đồng giao diện lập trình/thời gian thực, kiểm thử từ đầu đến cuối, truy cập đồng thời, hiệu năng, bảo mật, chuyển đổi/đối soát dữ liệu và dữ liệu trình diễn. Chỉ khi P0 ổn định mới nhận P1 theo thứ tự: tìm cơ sở y tế cơ bản, sau đó Người thân đồng hành. |
| 08/12–13/12 | Feature freeze và UAT | Chỉ hoàn thiện P0, kiểm thử người dùng kịch bản, sửa lỗi ưu tiên cao và chốt báo cáo. |
| 14/12–23/12 | Release candidate | Full regression, load/security test, demo rehearsal, video/kịch bản trình bày và sửa lỗi release blocker. |
| 24/12–31/12 | Buffer | Chỉ xử lý blocker, bảo mật và lỗi demo; không thêm feature mới. |

Điều chỉnh so với `refactor-plan.md`:

- Chronic Care P0 thay cho việc nhận đồng thời toàn bộ Payment, Refund, WebRTC, OAuth và Mobile.
- NF-2/NF-3/NF-4 chỉ triển khai phần cần cho hành trình Chronic Care: đặt lịch/tư vấn, reminder và notification.
- AI quota và VNPAY Sandbox payment/cancel là P0; full refund vẫn là P1 có cut-line riêng, policy quản lý qua Plan/Admin UI còn ENV chỉ giữ feature flag và giới hạn kỹ thuật.
- Medication adherence là P1, không được làm chậm Care Program, risk, inbox và summary.
- Người thân đồng hành là P1: chỉ thực hiện sau khi P0 ổn định; số liên kết theo `familyLinkLimit`, nhắc bỏ lỡ nhiệm vụ và không chia sẻ chỉ số chi tiết.
- Tìm cơ sở y tế là P1: chỉ thực hiện sau khi P0 ổn định; hoàn thành danh mục đã kiểm duyệt, tìm theo chuyên khoa/khoảng cách và liên kết chỉ đường trước. Tích hợp lịch trống/đặt lịch bệnh viện để sau DA2.

## 11. KPI và bằng chứng giá trị

DA2 đo khả năng vận hành, không tuyên bố hiệu quả lâm sàng:

| KPI | Cách đo MVP |
|---|---|
| Monitoring adherence | Số task đo hoàn thành / số task đến hạn. |
| Alert acknowledgment time | Thời gian từ alert tạo đến Doctor acknowledge. |
| Follow-up conversion | Tỷ lệ alert dẫn tới consultation được tạo/hoàn thành. |
| Doctor review effort | Số màn hình/thời gian thao tác trong scripted usability test. |
| AI summary acceptance | Doctor đánh giá useful/not useful; theo dõi fallback và unsupported output. |
| Retention proxy | Tỷ lệ Patient còn nhập dữ liệu ở tuần 2/4 trong dữ liệu pilot/demo. |
| Free → Plus/Care conversion | Tỷ lệ subscription hợp lệ được kích hoạt; seed/demo grant không được tính doanh thu. |
| Paid entitlement usage | Tỷ lệ dùng report, summary, reminder, Doctor review và consultations theo từng tier. |

Mọi dashboard phải phân biệt dữ liệu seed/demo với dữ liệu người dùng thực. Không trình bày KPI demo như kết quả nghiên cứu y khoa.

## 12. Definition of Done cho MVP

- Critical journey ở mục 4 chạy end-to-end mà không sửa tay database.
- Rule engine deterministic, version hóa, giải thích được và có unit test cho boundary cases.
- Alert dedupe, notification/outbox retry và Doctor authorization có integration/E2E test.
- Report 7/30 ngày đúng timezone, không N+1, có pagination/index/query evidence.
- AI summary không có quyền quyết định severity; có grounding, provenance và fallback khi provider lỗi.
- OpenAPI, realtime events, business rules, seed data và frontend integration docs khớp implementation.
- Demo có ít nhất ba kịch bản: bình thường, cần chú ý và khẩn cấp/escalation.
- Không log raw health payload, prompt chứa dữ liệu nhạy cảm hoặc thông tin truy cập ngoài quyền.

## 13. Quyết định đã duyệt ngày 23/09/2026

1. MVP bắt buộc có cả chương trình tăng huyết áp và tiểu đường; hai chương trình dùng chung Program engine.
2. Admin và Doctor đều được tạo/chỉnh draft Program Template theo permission. Admin chịu trách nhiệm quản lý lifecycle, nguồn, version và publish/retire rule/ngưỡng.
3. Doctor assignment là bắt buộc cho mọi enrollment trước khi kích hoạt.
4. VNPAY Sandbox payment/subscription và cancel unpaid order là tiêu chí bắt buộc của MVP/demo; full refund không tự động trở thành P0.
5. Admin quản lý bộ rule/ngưỡng và version. Rule/ngưỡng phải có nguồn/căn cứ được duyệt, audit trail và simulation/test trước khi publish; Admin không được dùng AI để tự sinh rồi tự động phát hành rule lâm sàng.
