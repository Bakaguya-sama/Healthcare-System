# Nội dung thay thế cho đề cương DA2

Tài liệu này là nội dung để thay thế các ô trong biểu mẫu `23520657_23520682_Healthcare_Application_DA2.docx`. Giữ nguyên phần thông tin trường, cán bộ hướng dẫn, thời gian và sinh viên thực hiện của biểu mẫu.

## Tên đề tài

**Tên tiếng Việt:** Xây dựng nền tảng theo dõi và hỗ trợ chăm sóc bệnh mạn từ xa tích hợp AI.

**Tên tiếng Anh:** Developing an AI Integrated Remote Chronic Care Platform.

## Nội dung đề tài

### Lý do chọn đề tài

Các bệnh mạn như tăng huyết áp và tiểu đường cần được theo dõi liên tục giữa các lần tái khám. Tuy nhiên, bệnh nhân thường nhập chỉ số không đều, quên lịch theo dõi hoặc chỉ liên hệ cơ sở y tế khi tình trạng đã đáng lo ngại. Dữ liệu sinh hiệu vì thế rời rạc và bác sĩ khó xem nhanh tình trạng của nhiều bệnh nhân để nhận biết người cần được ưu tiên hỗ trợ.

Đồ án 1 đã xây dựng nền tảng theo dõi chỉ số sức khỏe, tư vấn qua tin nhắn thời gian thực và trợ lý AI RAG. Tuy vậy, hệ thống chưa hình thành vòng lặp chăm sóc liên tục gồm chương trình theo dõi, nhiệm vụ định kỳ, cảnh báo có thể giải thích, bác sĩ xử lý cảnh báo và báo cáo tiến triển. Trợ lý AI tổng quát cũng chưa tạo được giá trị vận hành rõ ràng cho bệnh nhân và phòng khám.

Đề tài DA2 định hướng HealthAI Chronic Care, tập trung biến các chức năng sẵn có thành nền tảng theo dõi và hỗ trợ chăm sóc bệnh mạn từ xa. Hệ thống không thay thế khám bệnh, chẩn đoán, kê đơn hoặc dịch vụ cấp cứu. AI chỉ hỗ trợ tóm tắt dữ liệu, truy xuất kiến thức RAG có nguồn và gợi ý nội dung cần bác sĩ xem xét.

### Mục tiêu

- Xây dựng Program Engine dùng chung cho hai Care Program trong MVP: theo dõi tăng huyết áp và theo dõi tiểu đường.
- Cho phép bác sĩ đã được xác minh phân công bệnh nhân vào chương trình theo dõi sau khi bệnh nhân xác nhận consent.
- Cung cấp lịch nhiệm vụ đo chỉ số, check-in, nội dung giáo dục, nhắc việc, báo cáo 7/30 ngày và chỉ số adherence.
- Xây dựng rule engine có phiên bản để phân tầng `normal`, `attention`, `urgent` cùng reason code; kết quả là cảnh báo tham khảo, không phải chẩn đoán.
- Cung cấp Care Alert, Doctor Priority Inbox và luồng follow-up/consultation để bác sĩ xử lý đúng bệnh nhân cần chú ý.
- Tích hợp AI RAG để tóm tắt dữ liệu đã được backend tổng hợp, giải thích kiến thức y khoa có citation và hỗ trợ bác sĩ chuẩn bị tư vấn. AI không được tự thay đổi severity, rule hoặc quyết định y khoa.
- Duy trì tư vấn độc lập theo scheduled booking/on-demand; consultation có thể liên kết với Care Program nhưng không bắt buộc bệnh nhân phải tham gia chương trình mới được tư vấn.
- Thương mại hóa hợp lý qua tier Free, Plus và Care; tích hợp VNPAY Sandbox, entitlement phía backend, giới hạn câu hỏi AI riêng và giới hạn số consultation theo từng gói.
- Chuẩn hóa hạ tầng Redis, BullMQ, Socket.IO, database migration, kiểm thử tự động, kiểm thử concurrency và CI/CD phù hợp deadline.

### Phạm vi

**Bệnh nhân:** đăng ký/đăng nhập, quản lý hồ sơ và Health Metrics; tham gia Care Program do bác sĩ phụ trách; xem nhiệm vụ hôm nay, nhập chỉ số, hoàn thành check-in, nhận nhắc việc và Care Alert; xem báo cáo 7/30 ngày; tìm bác sĩ, đặt lịch hoặc gửi yêu cầu tư vấn; chat trong consultation được cấp quyền; hỏi AI RAG có citation; mua/gia hạn gói qua VNPAY; xem quota AI và số consultation còn lại; gửi review/báo cáo vi phạm. Khi phần P0 đã ổn định, bệnh nhân có thể mời một người thân đồng hành nhận nhắc nhở chung nếu bỏ lỡ nhiệm vụ theo dõi; bệnh nhân tự cấp và thu hồi quyền, người thân không mặc định xem chỉ số sức khỏe hay nội dung tư vấn. Ở mức P1, bệnh nhân cũng có thể tìm cơ sở y tế theo chương trình theo dõi/chuyên khoa và vị trí; danh mục được kiểm duyệt là nguồn chính, bản đồ chỉ bổ sung khi thiếu kết quả.

**Bác sĩ:** đăng ký và gửi hồ sơ chuyên môn chờ duyệt; tạo/chỉnh draft Program Template theo quyền; enroll bệnh nhân, xem baseline, trend, adherence, Care Alert và AI summary; xử lý Doctor Priority Inbox, ghi review/follow-up, tạo hoặc liên kết consultation; mở slot, tiếp nhận on-demand request, quản lý check-in/hàng đợi và tư vấn qua chat. Doctor assignment là bắt buộc cho mọi Care Enrollment, nhưng Doctor review định kỳ chỉ là quyền lợi của tier Care.

**Quản trị viên:** quản lý người dùng và duyệt bác sĩ; quản lý lifecycle, nguồn, version và publish/retire Care Program Template/Care Rule Set; quản lý tài liệu RAG, từ cấm AI, gói Free/Plus/Care, entitlement và giao dịch VNPAY; quản lý báo cáo vi phạm và audit. Dashboard KPI chương trình thuộc `CC-OPS-001` hậu DA2.

**Kênh triển khai:** Web Client cho bệnh nhân/bác sĩ và Web Admin là phạm vi MVP nhưng nằm ở repository riêng, ghép backend API sau bằng OpenAPI/realtime canonical; Payment Return UI cũng nằm trong frontend repository. Mobile critical flow, FCM đầy đủ và WebRTC/CallKeep production-grade là P1 sau khi Chronic Care P0 ổn định. Hệ thống không triển khai AI chẩn đoán, tự đổi thuốc, tự kê đơn, theo dõi cấp cứu 24/7, tích hợp thiết bị y tế thật hoặc liên thông hồ sơ bệnh án quốc gia trong DA2.

### Mô hình gói dịch vụ

| Gói  | Quyền lợi chính                                                                                                          | Số consultation tối đa mỗi cycle |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------: |
| Free | Nhập/xem chỉ số, biểu đồ cơ bản, cảnh báo an toàn, một chương trình cơ bản, thông báo trong ứng dụng và quota AI cơ bản  |                                1 |
| Plus | Toàn bộ Free, nhiều chương trình theo Plan, báo cáo 7/30/90 ngày, AI summary, smart reminder, export và quota AI cao hơn |                                3 |
| Care | Toàn bộ Plus, chương trình có Doctor review, Priority Inbox, follow-up và nhắc tái khám                                  |                                6 |

`AiQuestionQuota` chỉ đếm câu hỏi AI. `consultationLimitPerCycle` đếm trực tiếp số consultation đã sử dụng/còn lại; hai entitlement độc lập. Scheduled và on-demand consultation dùng chung limit. Chi phí/ưu đãi của từng consultation là chính sách giá riêng; khi hết limit bệnh nhân có thể chờ cycle mới, nâng gói hoặc mua add-on. Cảnh báo an toàn và quyền xem dữ liệu cơ bản không bị khóa khi hết quota hoặc hết gói.

### Phương pháp thực hiện

- Phân tích nghiệp vụ và thiết kế Program Engine, Care Enrollment, Monitoring Task, Care Rule Set, Care Alert, Care Summary, entitlement và consultation usage/reservation ledger.
- Áp dụng kiến trúc Modular Monolith với NestJS, TypeScript, MongoDB Atlas và Mongoose. Mỗi bounded context sở hữu dữ liệu của mình; Health Metrics là source of truth cho chỉ số sức khỏe.
- Xây dựng rule engine deterministic, version hóa, có reason code, test boundary case và audit. Rule/ngưỡng do Admin quản lý nhưng phải có nguồn/căn cứ được duyệt trước khi publish.
- Dùng Redis và BullMQ cho reminder, delayed/retry job, quota, rate limit và background processing; dùng transactional outbox để không mất notification/side effect sau transaction.
- Tích hợp Google GenAI SDK và MongoDB Atlas Vector Search cho RAG, AI summary có grounding/provenance/fallback. AI không có quyền quyết định severity, eligibility, entitlement hoặc publish rule.
- Tích hợp VNPAY Sandbox theo cơ chế xác thực IPN, idempotency và Subscription snapshot. Return URL chỉ hiển thị kết quả; IPN hợp lệ mới cấp quyền lợi.
- Áp dụng Agile/Scrum theo sprint; kiểm thử unit, integration, E2E, contract, concurrency và load test. Dùng Jest, Supertest, Postman, k6 và GitHub Actions.

### Nền tảng công nghệ

| Nhóm                   | Công nghệ                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Frontend               | React, TypeScript, Vite, TanStack Query, Zustand, Tailwind CSS, Shadcn UI, Chart.js |
| Backend                | Node.js, NestJS, TypeScript, Passport/JWT, Swagger/OpenAPI                          |
| Dữ liệu                | MongoDB Atlas, Mongoose, MongoDB Atlas Vector Search                                |
| Realtime và background | Socket.IO, Redis, BullMQ, transactional outbox                                      |
| AI                     | Google GenAI SDK, RAG, structured output validation                                 |
| Tích hợp ngoài         | VNPAY Sandbox, Cloudinary, Nodemailer, FCM P1                                       |
| Chất lượng và vận hành | Jest, Supertest, k6, GitHub Actions, Docker Compose, Postman                        |

### Kết quả mong đợi

- Hoàn thành demo end-to-end cho hai Care Program tăng huyết áp và tiểu đường: enroll, nhiệm vụ theo dõi, nhập Health Metric, rule evaluation, Care Alert, Priority Inbox, báo cáo AI có fallback và follow-up consultation.
- Nếu P0 ổn định, hoàn thành chức năng tìm cơ sở y tế cơ bản: quản trị danh mục cơ sở đã kiểm duyệt, ánh xạ chương trình theo dõi sang chuyên khoa, tìm theo khoảng cách và liên kết chỉ đường; không khẳng định chất lượng điều trị hoặc khả năng còn lịch.
- Patient có thể thực hiện consultation độc lập hoặc từ Care Alert; các luồng scheduled/on-demand, check-in, queue và chat được authorize đúng participant.
- VNPAY Sandbox kích hoạt Plus/Care qua IPN hợp lệ; entitlement backend kiểm soát riêng quota AI và số consultation còn lại theo cycle.
- Rule engine, alert, booking, consultation limit và payment có test cho race condition/idempotency; hệ thống có audit, notification retry, pagination và security baseline.
- DA2 cung cấp release evidence cho critical journey, security/privacy và migration rehearsal. Dashboard KPI vận hành như monitoring adherence aggregate, alert acknowledgment time, follow-up conversion và conversion/usage theo tier thuộc `CC-OPS-001` hậu DA2; không được diễn giải dữ liệu demo như kết quả điều trị lâm sàng.
- Sản phẩm hoàn thiện ở mức demo/pilot, sẵn sàng cho kiểm thử người dùng có kiểm soát và đánh giá khả năng triển khai tại phòng khám.

## Kế hoạch thực hiện

### Giai đoạn 1: Khảo sát, phân tích và thiết kế — 01/09 đến 14/09/2026

- **Công việc thực hiện:** Rà soát các chức năng sẵn có của hệ thống từ đồ án trước; xác định các chức năng được giữ lại và các chức năng cần bổ sung cho hướng theo dõi bệnh mạn. Phân tích quy trình của bệnh nhân, bác sĩ và quản trị viên; thiết kế luồng màn hình, cơ sở dữ liệu, giao diện lập trình ứng dụng và phân quyền. Chuẩn hóa các phần nền tảng đang có để dễ mở rộng.
- **Kết quả cần đạt:** Tài liệu yêu cầu nghiệp vụ; sơ đồ quy trình sử dụng; thiết kế cơ sở dữ liệu và giao diện lập trình ứng dụng; danh sách chức năng ưu tiên; bản thiết kế giao diện chính và kế hoạch triển khai được duyệt.

### Giai đoạn 2: Xây dựng chương trình theo dõi tăng huyết áp — 15/09 đến 28/09/2026

- **Công việc thực hiện:** Xây dựng cơ chế tạo và quản lý chương trình chăm sóc; cho phép quản trị viên và bác sĩ tạo mẫu chương trình, phiên bản hóa nội dung và giao chương trình cho bệnh nhân. Bổ sung quy trình bác sĩ phụ trách, ghi nhận sự đồng ý, đánh giá chỉ số ban đầu, bảng hỏi định kỳ và lịch yêu cầu bệnh nhân nhập chỉ số. Hoàn thiện chương trình mẫu theo dõi tăng huyết áp.
- **Kết quả cần đạt:** Bệnh nhân có thể đăng ký, được gán bác sĩ và tham gia chương trình tăng huyết áp; bác sĩ có thể theo dõi danh sách bệnh nhân phụ trách; hệ thống tạo đúng lịch nhập huyết áp và bảng hỏi theo cấu hình.

### Giai đoạn 3: Theo dõi chỉ số, cảnh báo và nhắc việc — 29/09 đến 12/10/2026

- **Công việc thực hiện:** Xây dựng bộ quy tắc đánh giá chỉ số sức khỏe theo ngưỡng do quản trị viên quản lý; phân loại mức bình thường, cần chú ý và khẩn. Tạo cảnh báo chăm sóc, thông báo trong ứng dụng, cơ chế nhắc bệnh nhân nhập chỉ số và lưu vết các thao tác. Kiểm thử các trường hợp biên của ngưỡng cảnh báo.
- **Kết quả cần đạt:** Khi bệnh nhân nhập chỉ số, hệ thống tự đánh giá và tạo cảnh báo đúng mức; bệnh nhân nhận được lời nhắc phù hợp; bác sĩ có thể xem lịch sử cảnh báo và xử lý; có dữ liệu kiểm thử chứng minh các ngưỡng hoạt động đúng.

### Giai đoạn 4: Hỗ trợ bác sĩ và kết nối tư vấn — 13/10 đến 26/10/2026

- **Công việc thực hiện:** Xây dựng hộp thư ưu tiên cho bác sĩ, sắp xếp bệnh nhân theo mức cần theo dõi; tạo báo cáo theo dõi 7 ngày và 30 ngày; bổ sung chức năng ghi nhận theo dõi sau tư vấn. Liên kết chương trình chăm sóc với chức năng đặt lịch hoặc tư vấn theo yêu cầu, nhưng vẫn bảo đảm bệnh nhân có thể tư vấn bác sĩ độc lập với chương trình.
- **Kết quả cần đạt:** Bác sĩ xem được các bệnh nhân cần ưu tiên, báo cáo diễn biến và lịch sử chăm sóc; bệnh nhân có thể đặt tư vấn; kết quả tư vấn có thể được gắn vào quá trình theo dõi khi cần.

### Giai đoạn 5: Mở rộng chương trình tiểu đường và trợ lý AI — 27/10 đến 09/11/2026

- **Công việc thực hiện:** Dùng lại cơ chế chương trình chăm sóc để tạo chương trình theo dõi tiểu đường. Tích hợp trợ lý AI trả lời câu hỏi dựa trên nguồn tài liệu được duyệt; tạo bản tóm tắt diễn biến theo tuần cho bệnh nhân và bác sĩ. Bổ sung trích dẫn nguồn, kiểm tra nội dung bám nguồn và phương án trả lời an toàn khi AI không có đủ căn cứ.
- **Kết quả cần đạt:** Hệ thống có ít nhất hai chương trình mẫu là tăng huyết áp và tiểu đường; AI trả lời có dẫn nguồn, không thay thế chẩn đoán; bác sĩ và bệnh nhân xem được bản tóm tắt theo dõi dễ hiểu.

### Giai đoạn 6: Hoàn thiện gói dịch vụ và thanh toán — 10/11 đến 23/11/2026

- **Công việc thực hiện:** Hoàn thiện ba gói Miễn phí, Plus và Care; áp dụng quyền lợi theo từng gói, gồm số chương trình được tham gia, số lượt hỏi AI và số lượt tư vấn bác sĩ trong mỗi chu kỳ. Tích hợp thanh toán thử nghiệm VNPAY, xử lý tạo đơn, hủy đơn chưa thanh toán và nhận kết quả thanh toán an toàn, không ghi nhận trùng giao dịch.
- **Kết quả cần đạt:** Bệnh nhân xem, đăng ký và sử dụng đúng quyền lợi của gói dịch vụ; số lượt tư vấn được giới hạn theo gói riêng với số lượt hỏi AI; giao dịch thử nghiệm cập nhật trạng thái gói chính xác.

### Giai đoạn 7: Hoàn thiện P0 và release evidence — 24/11 đến 07/12/2026

- **Công việc thực hiện:** Hoàn thiện Availability Slot/scheduled booking, check-in/queue, export và consumer read API; đồng bộ OpenAPI/realtime; kiểm thử E2E, concurrency, security/privacy, migration/restore và feature-flag matrix. Chuẩn bị dữ liệu minh họa và các kịch bản trình diễn.
- **Kết quả cần đạt:** Phiên bản P0 chạy ổn định với các luồng chính, không sửa tay database; contract artifact khớp source; có release evidence cho normal/attention/urgent. KPI/dashboard operations và P1 chưa hoàn tất chuyển hậu DA2 để không ảnh hưởng hạn nộp.

### Giai đoạn 8: Chốt chức năng và hoàn thiện báo cáo — 08/12 đến 13/12/2026

- **Công việc thực hiện:** Ngừng bổ sung chức năng mới; kiểm thử theo kịch bản của bệnh nhân, bác sĩ và quản trị viên; sửa các lỗi nghiêm trọng; hoàn thiện báo cáo, hình ảnh minh họa và video hoặc kịch bản trình diễn.
- **Kết quả cần đạt:** Bản phần mềm ổn định để nghiệm thu; danh sách lỗi nghiêm trọng đã được xử lý; báo cáo đồ án và tư liệu minh họa hoàn chỉnh.

### Giai đoạn 9: Kiểm thử cuối và diễn tập bảo vệ — 14/12 đến 23/12/2026

- **Công việc thực hiện:** Kiểm thử lại sau khi sửa lỗi; kiểm tra tải, bảo mật và sao lưu dữ liệu; diễn tập toàn bộ quy trình trình bày và chuẩn bị phương án thay thế khi mạng hoặc dịch vụ bên ngoài gặp sự cố.
- **Kết quả cần đạt:** Biên bản kiểm thử cuối; bản trình diễn ổn định; tài liệu hướng dẫn sử dụng và bài trình bày sẵn sàng cho buổi bảo vệ.

### Giai đoạn 10: Thời gian dự phòng — 24/12 đến 31/12/2026

- **Công việc thực hiện:** Chỉ xử lý lỗi cản trở sử dụng, lỗi bảo mật hoặc lỗi ảnh hưởng trực tiếp đến buổi trình diễn; không tiếp nhận yêu cầu chức năng mới.
- **Kết quả cần đạt:** Phiên bản nộp cuối cùng ổn định, mã nguồn và tài liệu được đóng gói đầy đủ trước hạn cuối tháng 12.

## Hướng phát triển đề tài

- Xây dựng `CC-OPS-001`: KPI aggregate bounded, operations dashboard và phân tách dữ liệu demo/real sau DA2.
- Mở rộng Medication Adherence: kế hoạch thuốc theo đơn hiện có, reminder, medication log và báo cáo tuân thủ; hệ thống không tự điều chỉnh liều hoặc khuyên ngừng thuốc.
- Mở rộng Care Program sang kiểm soát cân nặng/chuyển hóa, chăm sóc sau khám và các bệnh mạn khác khi Program Engine đã được kiểm chứng.
- Mở rộng tính năng người thân đồng hành từ phiên bản cơ bản: thêm nhiều người thân, báo cáo tiến độ theo tuần và các quyền chia sẻ chi tiết hơn, sau khi mô hình đồng ý và phân quyền cơ bản được kiểm chứng.
- Kết nối chính thức với bệnh viện/phòng khám để lấy lịch trống và hỗ trợ đặt lịch sau khi có đối tác cung cấp giao diện tích hợp đáng tin cậy.
- Đồng bộ thiết bị đo qua Bluetooth/Wi-Fi và Health Platform sau khi có cơ chế xác minh thiết bị, provenance và đối soát dữ liệu.
- Hỗ trợ nhiều phòng khám với tenant isolation, cohort analytics và dashboard vận hành; không khẳng định liên thông hồ sơ bệnh án quốc gia khi chưa có chuẩn và đối tác phù hợp.
- Nghiên cứu AI hình ảnh lâm sàng chỉ sau khi có bộ dữ liệu, quy trình kiểm định chuyên môn, consent và cơ chế đánh giá an toàn phù hợp.
