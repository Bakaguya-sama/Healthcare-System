# ADR E3 — Medical Facility Directory

- Ngày: 2026-11-26
- Trạng thái: Đã chốt; release gate còn mở
- Owner dữ liệu pilot: `super_admin`

## Bối cảnh

Sản phẩm cần Patient tìm cơ sở y tế theo specialty, Care Program/disease và khu
vực/vị trí. Danh mục nội bộ cần được kiểm duyệt; dữ liệu bản đồ bên ngoài không
được coi là đã xác minh hoặc là lời khuyên lâm sàng. Backend hiện là modular
monolith và Chronic Care sở hữu Program/disease.

## Quyết định

1. Tạo bounded context `care-directory`. Domain giữ lifecycle và policy thuần;
   application use case điều phối; infrastructure giữ Mongoose, audit transaction,
   Chronic Care public adapter và Google Places; presentation giữ controller/DTO.
2. `MedicalSpecialty.code` là khóa taxonomy canonical của Directory. Không đổi
   `doctorProfile.specialty` legacy trong E3.
3. Disease/Program mapping có version và trạng thái draft/published/retired.
   Program-specific mapping được ưu tiên; nếu vắng thì dùng disease mapping; nếu
   cả hai thiếu thì trả `manual_specialty_required`, không suy luận bằng AI.
4. Chỉ `super_admin` được quản trị Facility, specialty và mapping. Patient active
   được dùng Directory trong pilot, không phụ thuộc FREE/PLUS/CARE.
5. Pilot giới hạn TP. Hồ Chí Minh. Patient chỉ thấy Facility nội bộ verified.
   Thay đổi nội dung đã verified đi qua revision; bản hiện hành giữ nguyên cho tới
   khi revision mới được duyệt. Freshness suy từ `lastCheckedAt`, ngưỡng mặc định
   180 ngày, không tạo status `stale`.
6. Location Patient nằm trong POST body có consent khi dùng tọa độ chính xác; không
   lưu trong DB, audit, outbox hay log. Kết quả được phân trang và sắp xếp ổn định.
7. Google Places chỉ được gọi khi Patient chủ động chọn tìm rộng hơn hoặc
   `super_admin` tìm candidate. Kết quả là transient/unverified. Admin có thể tìm
   theo `query` (tên, chi nhánh, địa chỉ) hoặc theo specialty nội bộ active cùng
   area/location; hai selector loại trừ nhau. Place type chỉ lọc kết quả Google,
   không tự gán Facility type hay specialty nội bộ. Provider có timeout, giới hạn
   Redis theo actor/toàn cục và kill switch riêng.
8. Khi super_admin chọn Place ID, `POST /from-map-candidate` gọi Place Details
   sau khi kiểm tra quyền và idempotency receipt. Response đầu tiên trả preview có
   attribution để FE đối chiếu; retry trả draft đã commit, không gọi Google và có
   thể không có preview. Place ID được lưu bền vững. Tên/địa chỉ và nội dung Places
   khác chỉ được hiển thị tạm trong response, không được lưu vào draft/receipt/
   audit/cache. Tọa độ chỉ xuất hiện trong preview tạm và không được lưu.
9. Draft từ Google không tự gán facilityType, specialty, dịch vụ, liên hệ, nguồn
   chính thức hoặc booking link. Reviewer nhập các giá trị đó từ nguồn phù hợp.
   Trước khi verify Facility có Place ID, super_admin phải xác nhận đã kiểm tra
   thông tin được công bố bằng nguồn chính thức độc lập; bước này không biến nội
   dung Google bị cấm lưu thành dữ liệu nội bộ.
10. E3 không có AI-assisted search, booking availability hay xác nhận đặt lịch.
   Urgent safety guidance hiện hữu vẫn đứng trước directory.

## Google Places data policy

Rà soát tài liệu Google ngày 2026-11-26:
[Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies),
[Google Maps Platform Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms),
[Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search),
và [Place Types](https://developers.google.com/maps/documentation/places/web-service/place-types).
Place ID được lưu bền vững. Tên, địa chỉ và nội dung Places không được lưu vào
Directory; chỉ trả trong response tạm có attribution. Tọa độ Places chỉ được trả trong response preview, không được lưu.
Không copy preview vào draft, receipt, audit hoặc log. Cần luôn hiển thị
attribution theo kết quả Google.

Admin `placeType` dùng allowlist của các Place Types được hỗ trợ bởi Text Search;
adapter gửi `includedType` cùng `strictTypeFiltering: true`. `locationBias` là
ưu tiên xếp vùng tìm kiếm, không phải bộ lọc cứng. Đây chỉ là cách thu hẹp kết
quả provider, không quyết định taxonomy nội bộ.
Không dùng dữ liệu Google để render lên bản đồ không phải Google. Legal/compliance
owner cần rà soát điều khoản phù hợp tài khoản/region trước rollout thương mại.

## Hệ quả và giới hạn

- Migration `202611251100` tạo validator/indexes forward-only. Nếu collection
  legacy đã có dữ liệu không khớp validator, migration dừng an toàn và yêu cầu
  owner phân loại; không tự sửa hay promote record.
- Feature flags mặc định tắt. Google key thiếu thì fallback không hoạt động,
  nhưng internal search độc lập.
- Source, synthetic integration và HTTP contract có thể được kiểm tra local;
  corpus TP.HCM được duyệt, Google credential/provider smoke, FE consumer validation
  và staging rollout vẫn là các release gate riêng.
- Không thay đổi Phase F hoặc snapshot `plan/roadmap.md`.

## Quyết định bổ sung: duplicate review và liên kết Place ID

Ngày: 2026-11-27.

1. Draft thủ công và draft từ Google đều chạy duplicate check ở backend. Verify
   chạy lại sau khi Facility đủ thông tin; draft thiếu dữ liệu so sánh vẫn được
   tạo và không được hiểu là đã xác nhận không trùng.
2. Exact Google Place ID là invariant riêng: unique trên mọi Facility status,
   luôn trả conflict nếu ID đã được gắn; review “cơ sở khác” không bypass được.
3. Fuzzy match chỉ tạo cảnh báo khi tên gần giống và có thêm địa chỉ gần giống
   hoặc tọa độ trong 100 m. Chỉ giống tên, chỉ gần tọa độ và khác quận/huyện
   không đủ. Chuẩn hóa giữ branch number và không dùng tên cơ sở làm khóa.
4. `409 FACILITY_POSSIBLE_DUPLICATE` trả candidate tối đa 50 và cờ `truncated`.
   Nếu candidate scan bị cắt, không cho tiếp tục bằng danh sách chưa đầy đủ;
   Admin cần bổ sung chi tiết phân biệt.
5. Theo phương án A đã duyệt, super_admin xác nhận từng cặp Facility ID một lần.
   Backend lưu ID cặp, actor, thời điểm và reason; khi verify, quyết định vẫn
   áp dụng dù thông tin hai Facility thay đổi. Ứng viên mới chưa được xác nhận
   vẫn chặn verify. Quyết định không lan sang Facility ID khác.
6. Duplicate decisions, AuditLog, Facility mutation và idempotency receipt được
   ghi trong cùng MongoDB transaction. Candidate IDs gửi trong xác nhận mới phải
   nằm trong candidate set hiện tại; dữ liệu FE cũ trả
   `FACILITY_DUPLICATE_REVIEW_CANDIDATE_NOT_CURRENT`.
7. Một guard document HCMC được ghi trong transaction verify để tuần tự hóa lần
   rà cuối giữa các verify cạnh tranh. Cơ chế này không khóa create draft; hai
   draft tương tự có thể cùng tồn tại nhưng Patient không thấy chúng và verify
   sẽ rà lại. Không tuyên bố đây là fuzzy uniqueness tuyệt đối.
8. Gắn Place ID dùng resource update `PATCH /admin/medical-facilities/:id`, không
   tạo endpoint chuyên biệt. Chỉ gắn lần đầu vào Facility draft/verified; không
   sửa details, thay/gỡ ID hoặc chuyển ID giữa các Facility.
   Command dùng optimistic revision và receipt/audit transaction; chỉ ID được
   persist, không sửa business details, không thay/gỡ ID và không chuyển ID giữa
   các Facility.

Các index/persistence bổ sung: token lookup và duplicate-location nội bộ trên
`MedicalFacilities` và `FacilityDuplicateGuards` singleton cho pilot HCMC.
Quyết định duplicate được nhúng theo candidate Facility ID trong document
`MedicalFacilities`, tối đa 50 quyết định mỗi record. Migration
`202611271000-e3-facility-duplicate-review` là forward-only, backfill chỉ tạo
derived lookup fields từ dữ liệu nội bộ, không lấy Google preview. E3 vẫn còn
release gate corpus được duyệt, provider thật, FE consumer và staging smoke.

### Điều chỉnh implementation — 2026-11-27

- Bỏ collection `facilityduplicatedecisions`; mỗi `MedicalFacility` nhúng tối đa
  50 `duplicateReviews` theo `candidateFacilityId`, actor, thời điểm và reason.
  AuditLog và receipt vẫn ghi cùng transaction. Migration `202611271000` mới chỉ
  được chạy trong DB test tạm và suite đã drop DB đó; chưa áp dụng vào database
  ứng dụng. Vì vậy migration chưa phát hành được cập nhật trực tiếp, không đổi
  checksum migration đã áp dụng ở môi trường ứng dụng.
- Thay endpoint chuyên biệt bằng `PATCH /admin/medical-facilities/:id`, một thao
  tác metadata tài nguyên chỉ nhận `placeId` và `expectedRevision`. API hiện chỉ
  cho gắn Place ID lần đầu, provider xác minh trước khi ghi, giữ nguyên details;
  không replace/unlink. `PUT /:id/draft` tiếp tục quản lý nội dung draft/revision.
- Giữ `facilityduplicateguards` vì cần một điểm ghi chung trong transaction để
  tuần tự hóa verify cạnh tranh tại pilot HCMC; không có lock phù hợp sẵn có
  trong bounded context. Guard có đúng một document singleton và không tạo lock
  lâu dài. Draft create vẫn có thể chạy song song, sau đó verify kiểm tra lại.
