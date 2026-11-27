# Runbook — Medical Facility Directory (E3)

## Feature flags

- `FACILITY_DIRECTORY_ENABLED=false` khi chưa rollout: tắt API Directory.
- `GOOGLE_MAPS_PLACES_ENABLED=false` khi chưa được cấp credential và xác nhận
  quota/điều khoản: tắt riêng Google Places; không ảnh hưởng internal search.
- `GOOGLE_MAPS_API_KEY` lấy từ secret manager/environment của deployment, không
  lưu trong repo, ticket, log hoặc evidence.
- Giới hạn mặc định: 5 request/phút/actor và 60 request/phút toàn hệ thống; Redis
  dùng chung, atomic limiter. Có thể điều chỉnh bằng
  `GOOGLE_MAPS_REQUESTS_PER_MINUTE_PER_ACTOR` và
  `GOOGLE_MAPS_REQUESTS_PER_MINUTE_GLOBAL`. Redis lỗi thì provider request
  fail-closed; Directory nội bộ vẫn hoạt động.
- Timeout Google Places: 8 giây. Lỗi ngoài chỉ trả mã an toàn
  `MAP_PROVIDER_UNAVAILABLE`/`MAP_PROVIDER_DISABLED`.

## Migration và khởi động

1. Xác nhận target database là môi trường được owner cho phép; không suy ra target
   từ tên DB hoặc `.env` một cách tùy tiện.
2. Backup và kiểm tra collection `medicalfacilities`, `diseasespecialties`,
   `medicalspecialties`, `medicalfacilityrevisions`, `facilitycommandreceipts`,
   `facilityduplicateguards`. Duplicate review decisions are embedded in
   `medicalfacilities.duplicateReviews` (maximum 50 per Facility).
3. Chạy `pnpm --filter api database:migrate`, rồi
   `pnpm --filter api database:verify`. Migration `202611251100` tạo Directory;
   `202611271000` thêm duplicate lookup fields/indexes, embedded
   `duplicateReviews` và guard HCMC bằng migration forward-only, tạo strict
   validators và các index unique/2dsphere/TTL. Nếu collection đã có
   dữ liệu không khớp validator, dừng để review; không xóa hoặc tự promote.
4. Disable `autoIndex` trong môi trường production-like; quản lý index bằng
   migration có kiểm soát.

## Tìm candidate và nạp Facility

1. `super_admin` tìm Google candidate theo đúng một chế độ:
   - `query`: tên cơ sở, tên kèm chi nhánh hoặc địa chỉ; có thể bổ sung area hoặc
     location để ưu tiên kết quả. Nếu có location, `radiusKm` chỉ là
     `locationBias`, không phải ranh giới bắt buộc.
   - `specialtyCode`: specialty nội bộ đang active và đúng một trong area/location.
     Candidate được tìm theo tên specialty hiển thị; Admin vẫn phải tự gán specialty
     nội bộ khi sửa draft.
   `placeType` nếu có chỉ là allowlist filter của Google Text Search; không ánh xạ
   thành Facility type hoặc specialty của HealthcareApp. Query và specialty cùng lúc
   là input mơ hồ và bị từ chối.
2. Candidate response có Place ID, các field preview nếu provider trả về, URL bản
   đồ an toàn và attribution. FE giữ Place ID của dòng Admin đã chọn.
3. `POST /from-map-candidate` kiểm tra role, receipt idempotency rồi mới gọi Place
   Details cho command mới. Response đầu tiên gồm draft rỗng về business details
   cùng `providerPreview` tạm; Place ID được lưu bền vững. Retry cùng actor/key/
   Place ID trả receipt đã commit ngay cả khi Google lỗi; preview không được giữ
   trong receipt. FE có thể gọi `GET /{id}/map-candidate` để lấy preview mới.
4. Storage theo Places policy: Place ID được lưu bền vững; tên/địa chỉ và các
   Places content khác chỉ tồn tại trong response có attribution. Tọa độ provider chỉ tồn tại trong preview tạm và không được lưu vào database. Không sao chép tên/địa chỉ từ preview vào draft payload.
5. Người duyệt lấy tên, địa chỉ, tọa độ, facility type, specialty, dịch vụ, liên
   hệ, booking link và nguồn xác minh từ nguồn chính thức đủ điều kiện sử dụng,
   nhập vào draft rồi kiểm tra lại. Google không xác minh specialty, facility type,
   nguồn chính thức hay booking link.
6. Verify yêu cầu nguồn HTTPS chính thức, vị trí GeoJSON `[longitude, latitude]`,
   ít nhất một kênh liên hệ và specialty active. Dùng revision mới khi sửa bản
   verified; bản cũ giữ nguyên tới khi revision mới được duyệt. Với Facility có
   Place ID, request verify còn phải xác nhận reviewer đã đối chiếu nguồn chính
   thức độc lập.
7. Không đưa synthetic fixture hoặc kết quả chưa duyệt vào danh sách Patient.

## Rà soát khả năng trùng và gắn Place ID

1. Khi tạo draft, nếu API trả `409 FACILITY_POSSIBLE_DUPLICATE`, mở từng
   candidate theo Facility ID và so tên, địa chỉ, trạng thái, revision, Place ID,
   reason code và khoảng cách. Đây là gợi ý, không phải kết luận record trùng.
2. Nếu đúng cùng một cơ sở và candidate chưa có Place ID, gọi
   `PATCH /admin/medical-facilities/{id}` trên Facility nội bộ
   đang giữ dữ liệu được duyệt. Gửi Place ID đã chọn, revision hiện tại và
   `Idempotency-Key` mới. API kiểm tra ID qua Places, chỉ lưu Place ID, tăng
   metadata revision và ghi audit/receipt transactionally. Không thay/gỡ ID;
   Facility retired bị từ chối.
3. Nếu là hai cơ sở khác nhau, gửi `duplicateReview` với đúng các candidate IDs
   đã xem, `confirmedDistinct=true` và lý do đủ cụ thể. Sau conflict, dùng
   `Idempotency-Key` mới vì request body đã đổi. Backend kiểm tra lại candidate
   hiện tại trước khi ghi quyết định.
4. Quyết định phương án A lưu theo cặp Facility IDs; cùng cặp không bị hỏi lại
   khi verify dù nội dung đổi. Quyết định không áp dụng cho Facility ID khác.
   Candidate mới ở thời điểm verify vẫn yêu cầu review. Không thể dùng quyết định
   này để vượt Place ID trùng chính xác.
5. `truncated=true` nghĩa là candidate search chưa quét hết tập có thể liên quan;
   không chấp nhận tạo/verify dựa trên danh sách đó. Bổ sung street, số nhà,
   ward/district hoặc dữ liệu nội bộ chính xác rồi chạy lại.
6. Nếu Place ID đã thuộc Facility khác, xử lý 409 bằng cách mở Facility owner.
   Không sửa DB trực tiếp, không xóa unique index, không chuyển ID bằng tay.
   Nếu cùng Facility đã có ID khác, workflow thay/gỡ Place ID chưa được hỗ trợ.
7. Verify HCMC được serialize qua guard document trong transaction. Đây là đảm
   bảo cho các verify cạnh tranh trong cùng database; tạo draft đồng thời không
   bị khóa, nhưng draft không hiển thị với Patient và sẽ được kiểm tra ở verify.
   Theo dõi `FACILITY_DUPLICATE_REVIEW_GUARD_MISSING` sau migration; dừng verify
   và chạy verifier/migration theo quy trình nếu guard chưa có.

## Freshness và retirement

- `lastCheckedAt` là thời điểm kiểm tra gần nhất. Ngưỡng mặc định 180 ngày từ
  `FACILITY_FRESHNESS_DAYS`; quá ngưỡng vẫn có thể tìm thấy nhưng gắn nhãn cần
  kiểm tra lại.
- Admin lọc bằng `needsRecheck=true`; kiểm tra nguồn rồi verify revision/đánh
  dấu recheck theo workflow hiện hành.
- Cơ sở sai, đóng cửa hoặc có nguy cơ an toàn: `super_admin` retire ngay; không
  chờ hết 180 ngày.

## Privacy, attribution và quota

- Không bật request-body logging cho `/medical-facilities/search` hoặc
  `/medical-facilities/external-search`. Tọa độ Patient không được log, audit,
  outbox, notification hay evidence.
- Không gửi health data/diagnosis/care alert/consultation/AI history sang Google.
- Kết quả Google phải hiển thị attribution. Tuân thủ [Places API policies]
  (https://developers.google.com/maps/documentation/places/web-service/policies),
  gồm hạn chế cache/storage và map display. Place ID được persist; tên/địa chỉ
  chỉ là response preview; tọa độ chỉ xuất hiện trong preview tạm. Không ghi provider preview vào receipt, audit, outbox hoặc log.
  Review điều khoản Google áp dụng cho project/region với legal owner trước khi
  triển khai thương mại và trước mỗi thay đổi provider.
- Theo dõi số request, timeout và `429` bằng metadata đã redaction; không lưu
  query/location chi tiết hoặc raw response.

## Kill switch, rollback và smoke

- Provider có lỗi/quota cao: đặt `GOOGLE_MAPS_PLACES_ENABLED=false`; internal
  search tiếp tục phục vụ. Directory lỗi hoặc cần rollback: đặt
  `FACILITY_DIRECTORY_ENABLED=false`.
- Với command tạo draft từ Place ID, retry cùng actor/key/payload đọc receipt
  đã commit trước khi gọi Google. Nếu request trước chưa commit và provider đang
  lỗi, retry vẫn có thể nhận `503`; không đổi key hoặc payload để thử lại. Receipt
  có TTL 7 ngày và việc tắt Directory vẫn chặn command theo kill switch.
- Rollback migration không tự xóa collections/index/data. Dùng restore/roll
  forward theo runbook database chung sau khi xác định target, backup và owner.
- Smoke release phải ghi môi trường, actor, timestamp, endpoint/kết quả đã
  redaction; chỉ dùng synthetic test data. Kiểm thử riêng Patient internal search,
  external explicit action, provider failure và admin verify/retire.
- Chưa có staging deploy/worker/rollback smoke trong evidence hiện tại; không bật
  production chỉ dựa trên local tests.
