# Rà soát khoảng trống implementation ngày 17 11 2026

## Kết luận

Backend DA2 đã có nền tảng cho identity local, RAG vector cơ bản, VNPAY Sandbox
và Chronic Care. Tuy nhiên, các tài liệu sản phẩm và blueprint còn mô tả một tập
hợp khả năng rộng hơn runtime hiện tại. Những phần đó phải được coi là backlog có
thứ tự và exit gate riêng, không phải là tính năng đã hoàn tất.

Tài liệu này là kết quả đối chiếu source, migration, controller, service, test và
contract có trong repository tại ngày 17/11/2026. Nó không thay thế OpenAPI cho
contract runtime, và không kết luận trạng thái của frontend repository riêng hay
môi trường triển khai.

Ký hiệu: **có runtime** = nhìn thấy source phục vụ capability; **còn thiếu** =
chưa có implementation tương ứng với đặc tả/blueprint; **cần quyết định** = không
nên code trước khi product owner chốt policy.

## Phạm vi và nguồn đối chiếu

| Nhóm                             | Nguồn chính đã đối chiếu                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Identity và authorization        | `apps/api/src/modules/authentication/`, `docs/product-spec.md`, OpenAPI                             |
| RAG và AI                        | `apps/api/src/modules/ai-advisory/`, `plan/rag-upgrade-blueprint.md`, `docs/product-spec.md`        |
| Billing và payment               | `apps/api/src/modules/billing/`, migration/test payment, `docs/product-spec.md`                     |
| Consultation, notification và P1 | `apps/api/src/modules/consultations/`, `apps/api/src/modules/notifications/`, product/business spec |
| Handoff/release                  | `docs/fe-integration/`, `docs/runbooks/`, roadmap và generated contracts                            |

## Những năng lực đã có bằng chứng source

| Nhóm                      | Có runtime                                                                                                                                | Bằng chứng trọng tâm                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Auth local                | Register/login JWT, refresh-token rotation theo family, logout-all, OTP reset qua Redis, doctor approval gate                             | `authentication/application/services/auth.service.ts`, `authentication/domain/entities/auth-session.schema.ts`                           |
| Billing subscription      | Plan snapshot phía server, PaymentOrder idempotent, VNPAY signed IPN là authority, outbox grant, grant reconciliation, Patient read       | `billing/application/services/payment-order.service.ts`, `subscription-payment-grant.service.ts`, `test/cc7-payment.integration-spec.ts` |
| RAG cơ bản                | Upload/parse/chunk/embed, Atlas Vector Search, lọc `isActive`, `reviewStatus=approved`, `validUntil`, AI conversation/history và AI quota | `ai-advisory/application/services/retrieval/`, `infrastructure/adapters/retrieval/atlas-vector-store.service.ts`                         |
| Chronic Care/consultation | Care Program, task/rule/alert/report/export; scheduled booking, check-in và scheduled queue                                               | `chronic-care/`, `consultations/`, integration/E2E suites                                                                                |
| Delivery nền              | Transactional outbox, Redis, worker/runbook, OpenAPI và realtime generated artifact                                                       | `infrastructure/outbox/`, `docs/runbooks/`, `apps/api/openapi/`                                                                          |

## Khoảng trống RAG và AI

| ID     | Trạng thái       | Khoảng trống đã xác minh                                                                                                                                                                                                                             | Hướng đóng và exit gate                                                                                                                          |
| ------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| RAG-01 | Còn thiếu        | `AiDocument`/`AiDocumentChunk` chưa có version, `contentHash`, nguồn, chuyên khoa, ngôn ngữ, trang/section, parent-child metadata hay provenance đủ để tạo citation đáng tin.                                                                        | Migration forward-only; lifecycle document-version; test filter/expiry/duplicate và DTO citation không lộ storage metadata.                      |
| RAG-02 | Còn thiếu        | Upload hiện ingest đồng bộ rồi auto-approve chính document do người upload tạo. Manual re-ingest hiện ném lỗi “not implemented”. Archive/delete chưa có worker/job idempotent để deactivate/rebuild index an toàn.                                   | Tách upload, review và ingestion job; approve theo document; re-ingest idempotent; archive/version replacement phải loại chunks khỏi retrieval.  |
| RAG-03 | Còn thiếu        | Retrieval chỉ vector với threshold cố định `0.85`, dedupe theo content. Chưa có Atlas full-text/hybrid, RRF, reranker, MMR, parent context hoặc threshold đã hiệu chỉnh.                                                                             | Evaluation set tiếng Việt được review; benchmark recall/citation trước-sau; chỉ rollout khi score/latency/cost đạt ngưỡng công bố.               |
| RAG-04 | Còn thiếu        | Safety service hiện chỉ kiểm tra độ dài message. Chưa có intent/emergency router, Evidence Gate, citation validator hoặc bắt buộc answer chỉ dùng evidence. Một nhánh orchestration còn có fallback sang kiến thức chung khi internal context trống. | Rule/router deterministic trước LLM; no-evidence path phải refuse/clarify/escalate; test red-team cho emergency, prescription và thiếu evidence. |
| RAG-05 | Còn thiếu        | Chưa có PubMed/MEDLINE adapter, PII/PHI scrubber, external-evidence cache, KnowledgeCandidate lifecycle hay promotion có kiểm duyệt.                                                                                                                 | Bổ sung sau RAG-01..04; test không gửi PII/ảnh ra ngoài, rate-limit/cache và PMID/content-hash dedupe.                                           |
| RAG-06 | Còn thiếu        | Chưa có evaluation dataset, trace/quality/cost observability hoặc dashboard feedback-to-quality.                                                                                                                                                     | Dataset versioned, offline eval trong CI/release gate, trace redaction và SLO cho ingest/retrieval.                                              |
| RAG-07 | Để sau benchmark | Multi-query, agentic workflow và GraphRAG/Neo4j chỉ là hướng blueprint, không có use case/benchmark chứng minh cần thiết.                                                                                                                            | Không nhận vào implementation trước khi RAG-01..06 có evidence và owner xác nhận use case.                                                       |

## Khoảng trống payment và billing

| ID     | Trạng thái     | Khoảng trống đã xác minh                                                                                                                                                          | Hướng đóng và exit gate                                                                                                                                         |
| ------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAY-01 | Còn thiếu P1   | Chưa có full-refund workflow: policy snapshot, admin approval, provider refund request/status, idempotency/retry/reconcile, đảo grant và audit.                                   | Chốt legal/product refund policy trước; provider sandbox evidence cho success/reject/timeout/replay; cấm partial refund/chargeback/auto-refund trong slice này. |
| PAY-02 | Cần quyết định | Payment hiện chỉ mua/gia hạn Subscription. Consultation charging chưa tồn tại và `care_program_included` bắt buộc không được tạo charge riêng.                                    | Viết contract giá, tax/invoice, cancel/no-show/refund và invariant policy trước schema/code. Không ghép vào PAY-01.                                             |
| PAY-03 | Còn thiếu P1   | Patient history/read đã có nhưng Admin billing dashboard, history export, provider-reference masking contract và aggregate usage ngoài consultation chưa có projection canonical. | Bounded projection/index/explain; redaction/privacy test; frontend owner xác nhận page contract.                                                                |
| PAY-04 | Cần quyết định | Billing read hiện không expose public refund-policy summary; unlimited consultation và aggregate AI/Care Program/family usage chưa có contract.                                   | Chốt DTO business-safe và meter semantics trước khi thêm API/index.                                                                                             |

## Khoảng trống auth, privacy và account lifecycle

| ID      | Trạng thái                          | Khoảng trống đã xác minh                                                                                                                                                                               | Hướng đóng và exit gate                                                                                                                                |
| ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AUTH-01 | Còn thiếu P1                        | OAuth identity/linking chưa có provider, entity hay controller dù product spec có `(provider, providerAccountId)` và gọi OAuth là P1 feature-gated.                                                    | Chọn provider, account-link/unlink/recovery policy, CSRF/state/PKCE và tests cho collision/merge. Không tự gộp theo email.                             |
| AUTH-02 | Cần làm rõ rồi mới làm              | Local registration trả token ngay; source hiện không có lifecycle email verification. Sequence diagram từng mô tả trạng thái pending verification, trong khi product rules chỉ yêu cầu account active. | Owner chốt activation policy cho Patient và Doctor. Nếu bắt buộc verify, thêm token lifecycle, resend/rate limit, login gate và migration/UX contract. |
| AUTH-03 | Còn thiếu                           | Refresh request vẫn nhận `userId` từ body dù service kiểm tra claim; logout hiện revoke mọi session của user, chưa có current-session identifier, list/revoke device/session hay session-facing API.   | Chuẩn hóa refresh từ refresh-token subject, định nghĩa logout current/all và device/session UX; authorization/replay/regression tests.                 |
| AUTH-04 | Cần khắc phục trong hardening slice | Auth registration có log toàn bộ DTO và gửi email OTP trực tiếp từ request; điều này không khớp mục tiêu safe logging/outbox delivery của product spec.                                                | Redact log, đưa delivery qua outbox hoặc ghi rõ exception có retry/observability; test đảm bảo password/OTP/document URL không vào log/event.          |
| AUTH-05 | Chưa có scope chốt                  | MFA/passkey, self-service account deletion/export/retention và consent lifecycle tổng thể không có contract/source rõ.                                                                                 | Product/privacy owner định nghĩa legal retention và recovery trước khi đưa vào roadmap committed.                                                      |

## Khoảng trống nghiệp vụ và delivery khác

| ID       | Trạng thái         | Khoảng trống đã xác minh                                                                                                                             | Hướng đóng và exit gate                                                                                                                          |
| -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| CARE-01  | ✅ Đã triển khai E1 | E1 đưa `doctorProfile.bookingSettings` thay bridge ENV cho scheduled booking; pilot chỉ hỗ trợ `instant`, `approval_required` vẫn chưa được nhận. Migration/verifier, API Doctor/Admin, snapshot regression, worker/outbox rehearsal và pilot aggregate đã có evidence. | Tiếp tục theo dõi vận hành staging/production; CARE-02 vẫn phụ trách unified on-demand queue/ETA sau khi có thêm dữ liệu. |
| CARE-02  | Còn thiếu hậu DA2  | Unified on-demand queue và ETA có dữ liệu vận hành chưa được làm; scheduled queue đã có.                                                             | Đo scheduled pilot trước; policy fairness/priority/cancel/race và realtime contract cần chốt.                                                    |
| CARE-03  | Cần quyết định     | Scheduled consultation quá 24 giờ chưa xử lý chỉ được cảnh báo/review; disposition/quota tiếp theo chưa chốt.                                        | Product owner chốt disposition; test không double-count/release quota.                                                                           |
| DEL-01   | Còn thiếu P1       | Frontend Patient/Doctor/Admin, Payment Return UI và full Web E2E nằm ở repository khác; backend handoff không chứng minh consumer journey.           | Pin generated contract version, consumer contract tests và E2E do owner frontend chạy.                                                           |
| ADMIN-01 | Còn thiếu          | Booking hiện dùng ENV bridge; refund policy, feature flag và business configuration chưa có một governance/version/audit surface thống nhất.         | Chốt owner, version/snapshot, role/audit và hard-limit trước khi mở Admin command/config API.                                                    |
| FAM-01   | Còn thiếu P1       | Family link, consent, reminder, audit và privacy projection chưa có module/entity/migration/API runtime.                                             | Invite/accept/revoke, `familyLinkLimit`, delayed reminder và test không lộ PHI/clinical content.                                                 |
| NTF-01   | Còn thiếu P1       | In-app outbox có runtime, nhưng FCM delivery và notification campaign snapshot/fan-out/recipient lifecycle chưa có source canonical.                 | Worker batch/idempotency, audience allowlist, opt-in/privacy, delivery retry/dead-letter và operations evidence.                                 |
| RTC-01   | Còn thiếu P1       | Chat realtime có runtime; WebRTC foreground call, TURN/reconnect contract và multi-instance adapter proof chưa có.                                   | Server-authorized room/signaling, load/failure test và operational/security evidence trước production claim.                                     |
| MED-01   | Còn thiếu P1       | Medication adherence chưa có model/command/policy runtime.                                                                                           | Chỉ nhận sau Care Program P0; consent/reminder/adherence có safety boundary, không tự kê/đổi thuốc.                                              |
| MOD-01   | Còn thiếu P1       | Manual violation moderation có runtime; AI-assisted classification/recommendation chưa có.                                                           | AI chỉ gợi ý, Admin là outcome authority; bias/privacy/audit test trước enablement.                                                              |
| MOB-01   | Còn thiếu P1       | Mobile Patient/Doctor không nằm trong repository và chưa có consumer implementation evidence.                                                        | Contract pin, critical journey E2E và security/privacy review tại repository mobile.                                                             |
| DIR-01   | Còn thiếu P1       | Tìm cơ sở y tế chưa có module/entity/migration/API runtime. Product spec chỉ định đây là feature sau Family Companion; bản đồ ngoài chỉ là fallback. | Taxonomy disease-to-specialty, Admin-curated facility lifecycle, Patient search/filter/pagination và privacy review trước provider map fallback. |
| OPS-01   | Giữ nguyên Phase F | KPI aggregate và operations dashboard chưa có; đây là `CC-OPS-001` sau DA2.                                                                          | Theo đúng Phase F của roadmap mới; không dùng seed/demo để suy ra kết quả lâm sàng.                                                              |

## Mâu thuẫn tài liệu cần sửa trước khi nhận slice

1. `docs/sequence/README.md` vẫn ghi Availability/scheduled/check-in/queue và
   Patient billing read là chưa hoàn tất, trái với source, tests và roadmap ngày
   17/11. Bản cập nhật cùng đợt này đã sửa map trạng thái.
2. Product spec mô tả nhiều requirement đích của RAG (metadata/citation/review) và
   auth/OAuth nhưng không đánh dấu rõ phần nào chưa có runtime. Roadmap mới là
   nguồn ưu tiên về thứ tự triển khai; audit này là bảng truy vết.
3. `plan/rag-upgrade-blueprint.md` là kiến trúc đích, không phải bằng chứng hoàn
   thành. Bản cập nhật cùng đợt này thêm liên kết trạng thái để tránh đọc nhầm.

## Thứ tự đề xuất

1. Hoàn tất release smoke ngoài source nếu có deployment; không mở rộng scope DA2.
2. Nhận **AUTH-03 + AUTH-04** như một security hardening slice nhỏ; **AUTH-02**
   chỉ sau quyết định activation.
3. Làm RAG theo thứ tự **RAG-01 → RAG-02 → RAG-04 → RAG-06 → RAG-03**. PubMed chỉ
   sau Evidence Gate và PII boundary hoạt động.
4. Chỉ nhận **PAY-01** sau khi policy refund được owner phê duyệt; giữ consultation
   charging là quyết định độc lập.
5. Làm **CARE-01/02/03**, P1 delivery và Phase F theo capacity, không trộn với
   payment/RAG security slice.

Mỗi slice phải cập nhật OpenAPI/realtime nếu surface thay đổi, migration/verifier
nếu persistence thay đổi, và contract frontend trước khi ghi nhận hoàn thành.
