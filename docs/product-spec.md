# HealthAI product specification

> Canonical product, role and safety specification. For Chronic Care command behavior, use [chronic-care-spec.md](chronic-care-spec.md); for delivery order, use [roadmap.md](../plan/roadmap.md).

## Business rules

# Healthcare Business Rules

## Má»¥c Ä‘Ã­ch vÃ  pháº¡m vi

TÃ i liá»‡u nÃ y mÃ´ táº£ cÃ¡c quy táº¯c nghiá»‡p vá»¥ cÃ³ thá»ƒ Ä‘iá»u chá»‰nh trong quÃ¡ trÃ¬nh phÃ¡t triá»ƒn. Há»‡ thá»‘ng phá»¥c vá»¥ theo dÃµi vÃ  há»— trá»£ chÄƒm sÃ³c bá»‡nh máº¡n tá»« xa káº¿t há»£p tÆ° váº¥n trá»±c tuyáº¿n; AI chá»‰ há»— trá»£ thÃ´ng tin, tÃ³m táº¯t hoáº·c truy xuáº¥t tÃ i liá»‡u, khÃ´ng Ä‘Æ°a ra cháº©n Ä‘oÃ¡n.

## KhÃ¡i niá»‡m chÃ­nh

- AvailabilitySlot lÃ  khoáº£ng thá»i gian bÃ¡c sÄ© má»Ÿ cho bá»‡nh nhÃ¢n Ä‘áº·t lá»‹ch.
- Consultation lÃ  má»™t yÃªu cáº§u hoáº·c má»™t lá»‹ch tÆ° váº¥n giá»¯a bá»‡nh nhÃ¢n vÃ  bÃ¡c sÄ©.
- On-demand lÃ  bá»‡nh nhÃ¢n gá»­i yÃªu cáº§u tÆ° váº¥n nhanh; bÃ¡c sÄ© quyáº¿t Ä‘á»‹nh cháº¥p nháº­n hoáº·c tá»« chá»‘i.
- Scheduled lÃ  bá»‡nh nhÃ¢n chá»§ Ä‘á»™ng chá»n slot bÃ¡c sÄ© Ä‘Ã£ má»Ÿ.
- Request status thá»ƒ hiá»‡n káº¿t quáº£ xá»­ lÃ½ yÃªu cáº§u hoáº·c quyá»n truy cáº­p tÆ° váº¥n.
- Session status thá»ƒ hiá»‡n tráº¡ng thÃ¡i thá»±c táº¿ cá»§a phiÃªn tÆ° váº¥n.
- Care Program lÃ  chÆ°Æ¡ng trÃ¬nh theo dÃµi cÃ³ thá»i háº¡n, loáº¡i chá»‰ sá»‘, lá»‹ch Ä‘o vÃ  bá»™ rule cÃ³ version.
- Care Enrollment lÃ  quan há»‡ Patient tham gia Care Program vÃ  Doctor Ä‘Æ°á»£c phÃ¢n cÃ´ng theo dÃµi.
- Monitoring Task lÃ  nhiá»‡m vá»¥ Ä‘o chá»‰ sá»‘ theo lá»‹ch; completion/adherence chá»‰ pháº£n Ã¡nh hoáº¡t Ä‘á»™ng theo dÃµi.
- Care Evaluation lÃ  káº¿t quáº£ deterministic cá»§a rule engine; Care Alert lÃ  item cáº§n Patient/Doctor chÃº Ã½ vÃ  xá»­ lÃ½.

## Care Program vÃ  enrollment

1. MVP cam káº¿t cáº£ Care Program tÄƒng huyáº¿t Ã¡p vÃ  tiá»ƒu Ä‘Æ°á»ng; hai chÆ°Æ¡ng trÃ¬nh pháº£i dÃ¹ng chung domain model/rule engine.
2. Chá»‰ Patient active má»›i Ä‘Æ°á»£c enroll. Chá»‰ Admin cÃ³ `program-management permission` Ä‘Æ°á»£c táº¡o/chá»‰nh draft Program Template; chá»‰ Doctor `active + approved` Ä‘Æ°á»£c khá»Ÿi táº¡o enrollment cho Patient.
3. Patient pháº£i xÃ¡c nháº­n consent vÃ  má»¥c Ä‘Ã­ch sá»­ dá»¥ng dá»¯ liá»‡u trÆ°á»›c khi enrollment chuyá»ƒn `active`; consent lÆ°u version vÃ  timestamp.
4. Enrollment cÃ³ tráº¡ng thÃ¡i `pending`, `active`, `paused`, `completed`, `cancelled`. Chá»‰ enrollment `active` sinh Monitoring Task vÃ  Care Evaluation má»›i.
5. Má»—i enrollment pháº£i tham chiáº¿u Ä‘Ãºng má»™t Care Program version vÃ  báº¯t buá»™c cÃ³ má»™t Doctor `active + approved` phá»¥ trÃ¡ch trÆ°á»›c khi chuyá»ƒn active.
6. Cáº­p nháº­t template/rule set khÃ´ng Ä‘Æ°á»£c Ã¢m tháº§m Ä‘á»•i lá»‹ch sá»­. Enrollment Ä‘ang cháº¡y chá»‰ chuyá»ƒn version theo thao tÃ¡c cÃ³ audit vÃ  effective time rÃµ rÃ ng.
7. Patient cÃ³ thá»ƒ yÃªu cáº§u dá»«ng chÆ°Æ¡ng trÃ¬nh; dá»¯ liá»‡u lá»‹ch sá»­ Ä‘Æ°á»£c giá»¯ theo chÃ­nh sÃ¡ch retention/audit, khÃ´ng xÃ³a cá»©ng cÃ¹ng enrollment.
8. Care Program khÃ´ng táº¡o quan há»‡ cáº¥p cá»©u 24/7 vÃ  giao diá»‡n pháº£i nÃªu rÃµ thá»i gian/pháº¡m vi pháº£n há»“i cá»§a Doctor.
9. Program version Ä‘Ã£ publish lÃ  báº¥t biáº¿n; chá»‰nh sá»­a táº¡o draft/version má»›i. Chá»‰ version published/active má»›i Ä‘Æ°á»£c dÃ¹ng cho enrollment má»›i.
10. Baseline, eligibility, consent, task templates, reminder, rule set, review policy, content journey vÃ  completion criteria pháº£i Ä‘Æ°á»£c snapshot hoáº·c tham chiáº¿u version á»•n Ä‘á»‹nh khi enrollment kÃ­ch hoáº¡t. Trong DA2, `taskTemplates` Ä‘Æ°á»£c nhÃºng trong tá»«ng phiÃªn báº£n `CarePrograms`; nhiá»‡m vá»¥ Ä‘Ã£ sinh Ä‘Æ°á»£c lÆ°u riÃªng trong `CareTasks`.
11. Doctor chá»‰ Ä‘Æ°á»£c tÃ¹y chá»‰nh cÃ¡c field Ä‘Æ°á»£c Program Template allowlist. Thay Ä‘á»•i patient-specific threshold hoáº·c review cadence pháº£i cÃ³ quyá»n, lÃ½ do vÃ  audit.
12. Admin quáº£n lÃ½ lifecycle/version/publish/retire cá»§a Program Template vÃ  táº¡o/sá»­a/retire Rule draft qua `rule-management permission`; má»i Doctor `active + approved` cÃ³ thá»ƒ activate Rule mÃ  khÃ´ng cáº§n permission/approval riÃªng. Activate tá»± retire Rule active cÅ© cá»§a cÃ¹ng Program version trong má»™t thao tÃ¡c audit.
13. Rule activation báº¯t buá»™c qua server validation cho declarative schema, operator allowlist, Program version vÃ  audit. Nguá»“n/cÄƒn cá»©, simulation/test evidence lÃ  metadata tÃ¹y chá»n trong DA2, khÃ´ng pháº£i activation gate; AI váº«n khÃ´ng Ä‘Æ°á»£c tá»± phÃ¡t hÃ nh Rule khi khÃ´ng cÃ³ Admin/Doctor actor.
14. Doctor assignment báº¯t buá»™c á»Ÿ má»i tier Ä‘á»ƒ xÃ¡c Ä‘á»‹nh ownership vÃ  authorization; khÃ´ng máº·c Ä‘á»‹nh táº¡o nghÄ©a vá»¥ review Ä‘á»‹nh ká»³, SLA hoáº·c chat 24/7. CÃ¡c quyá»n Ä‘Ã³ chá»‰ cÃ³ khi Plan/Enrollment snapshot ghi rÃµ.
15. `pending -> active` chá»‰ xáº£y ra tá»± Ä‘á»™ng khi Ä‘á»“ng thá»i cÃ³ Doctor `active + approved`, Program `published`, Care Rule `active`, entitlement há»£p lá»‡, Patient Ä‘Ã£ cháº¥p nháº­n Ä‘Ãºng consent version vÃ  hoÃ n thÃ nh toÃ n bá»™ baseline báº¯t buá»™c. Thiáº¿u má»™t Ä‘iá»u kiá»‡n thÃ¬ enrollment váº«n `pending` vÃ  khÃ´ng sinh task/evaluation.
16. Assigned Doctor Ä‘Æ°á»£c chuyá»ƒn `active -> paused` vÃ  `paused -> active` vá»›i lÃ½ do. Patient cÃ³ thá»ƒ gá»­i yÃªu cáº§u pause; Doctor pháº£i xá»­ lÃ½ yÃªu cáº§u trÆ°á»›c khi resume. Resume pháº£i kiá»ƒm tra láº¡i Doctor, Program/Rule, consent vÃ  entitlement.
17. Assigned Doctor hoáº·c worker completion Ä‘Æ°á»£c duyá»‡t cÃ³ thá»ƒ chuyá»ƒn `active|paused -> completed` khi Ä‘áº¡t completion criteria; pháº£i lÆ°u actor/reason. Patient rÃºt consent lÃ m enrollment chÆ°a káº¿t thÃºc chuyá»ƒn `cancelled` ngay; chá»‰ Assigned Doctor Ä‘Æ°á»£c cancel vá»›i lÃ½ do.
18. `completed` vÃ  `cancelled` lÃ  tráº¡ng thÃ¡i cuá»‘i, khÃ´ng reopen. Náº¿u Patient tiáº¿p tá»¥c chÆ°Æ¡ng trÃ¬nh, Doctor táº¡o enrollment má»›i Ä‘á»ƒ giá»¯ nguyÃªn lá»‹ch sá»­ vÃ  snapshot cÅ©.

## Monitoring Task vÃ  má»©c Ä‘á»™ hoÃ n thÃ nh

1. Monitoring Task Ä‘Æ°á»£c sinh tá»« schedule, timezone vÃ  version cá»§a Care Program; worker táº¡o task pháº£i idempotent.
2. Task type P0 gá»“m `metric`, `check_in`, `education`, `appointment`, `doctor_review`; `medication` vÃ  `journal` chá»‰ báº­t khi feature tÆ°Æ¡ng á»©ng hoÃ n táº¥t.
3. Má»—i task template pháº£i cÃ³ type, schedule, time window, completion rule, reminder policy, required/optional vÃ  version. LLM khÃ´ng Ä‘Æ°á»£c tá»± Ä‘Ã¡nh dáº¥u task hoÃ n thÃ nh.
4. Vá»›i task `metric`, HealthMetrics lÃ  source of truth; task chá»‰ tham chiáº¿u metric dÃ¹ng Ä‘á»ƒ hoÃ n thÃ nh, khÃ´ng nhÃ¢n báº£n raw health value.
5. Má»™t HealthMetric chá»‰ hoÃ n thÃ nh task `metric` khi Ä‘Ãºng Patient, metric type vÃ  cá»­a sá»• thá»i gian cho phÃ©p. Task type khÃ¡c dÃ¹ng response/progress/Consultation/DoctorReview canonical tÆ°Æ¡ng á»©ng.
6. Task cÃ³ tráº¡ng thÃ¡i `scheduled`, `due`, `completed`, `missed`, `cancelled`; task cá»§a enrollment paused/cancelled khÃ´ng tiáº¿p tá»¥c nháº¯c.
7. Monitoring adherence báº±ng sá»‘ task Patient-required Ä‘Ã£ completed chia sá»‘ task Patient-required Ä‘áº¿n háº¡n há»£p lá»‡; `doctor_review` khÃ´ng tÃ­nh vÃ o adherence cá»§a Patient.
8. Adherence chá»‰ pháº£n Ã¡nh hoáº¡t Ä‘á»™ng theo dÃµi, khÃ´ng Ä‘Æ°á»£c mÃ´ táº£ lÃ  tuÃ¢n thá»§ Ä‘iá»u trá»‹ hoáº·c uá»‘ng thuá»‘c trá»« khi medication module Ä‘Æ°á»£c Ä‘á»‹nh nghÄ©a riÃªng.
9. Sá»­a/xÃ³a dá»¯ liá»‡u nguá»“n pháº£i táº¡o báº£n ghi HealthMetric thay tháº¿ hoáº·c chuyá»ƒn báº£n ghi cÅ© sang `voided`, ghi `AuditLogs` vá»›i `domain = health`, sau Ä‘Ã³ kÃ­ch hoáº¡t Ä‘Ã¡nh giÃ¡ láº¡i vÃ  táº¡o phiÃªn báº£n task/report/summary liÃªn quan; khÃ´ng ghi Ä‘Ã¨ Ã¢m tháº§m giÃ¡ trá»‹ Ä‘Ã£ Ä‘o.
10. Má»i thá»i gian lÆ°u UTC; viá»‡c xÃ¡c Ä‘á»‹nh ngÃ y vÃ  cá»­a sá»• task dÃ¹ng timezone snapshot cá»§a enrollment.
11. Worker chá»‰ materialize task trong rolling window cáº¥u hÃ¬nh; khÃ´ng táº¡o toÃ n bá»™ task dÃ i háº¡n ngay khi enroll náº¿u gÃ¢y write amplification.
12. Quiet hours, giá»›i háº¡n táº§n suáº¥t vÃ  tráº¡ng thÃ¡i hoÃ n thÃ nh pháº£i Ä‘Æ°á»£c kiá»ƒm tra trÆ°á»›c khi gá»­i reminder Ä‘á»ƒ trÃ¡nh notification fatigue.
13. Worker chuyá»ƒn `scheduled -> due` táº¡i `windowStart`; nguá»“n hoÃ n thÃ nh há»£p lá»‡ chuyá»ƒn `scheduled|due -> completed`; quÃ¡ `windowEnd` chuyá»ƒn `due -> missed`. Enrollment bá»‹ pause/cancel hoáº·c task khÃ´ng cÃ²n Ã¡p dá»¥ng cÃ³ thá»ƒ chuyá»ƒn `scheduled|due -> cancelled` vá»›i reason.
14. `completed`, `missed`, `cancelled` lÃ  tráº¡ng thÃ¡i cuá»‘i trong DA2. Dá»¯ liá»‡u nháº­p sau háº¡n váº«n Ä‘Æ°á»£c lÆ°u, hiá»ƒn thá»‹ trong biá»ƒu Ä‘á»“ vÃ  cÃ³ thá»ƒ táº¡o evaluation má»›i nhÆ°ng khÃ´ng Ä‘á»•i task `missed` thÃ nh completed vÃ  khÃ´ng há»“i tá»‘ adherence cá»§a cá»­a sá»• cÅ©.
15. HealthMetric correction dÃ¹ng append-only replacement/void. Náº¿u cÃ³ metric thay tháº¿ há»£p lá»‡, task Ä‘Ã£ completed cÃ³ thá»ƒ Ä‘á»•i `completionSourceId` trong transaction vÃ  ghi audit; khÃ´ng Ä‘áº£o ngÆ°á»£c tráº¡ng thÃ¡i task. Evaluation/report/summary bá»‹ áº£nh hÆ°á»Ÿng pháº£i Ä‘Æ°á»£c táº¡o version thay tháº¿, khÃ´ng ghi Ä‘Ã¨ lá»‹ch sá»­.

## NgÆ°á»i thÃ¢n Ä‘á»“ng hÃ nh vÃ  nháº¯c nhá»Ÿ há»— trá»£ (P1)

1. NgÆ°á»i thÃ¢n Ä‘á»“ng hÃ nh pháº£i Ä‘Äƒng kÃ½ tÃ i khoáº£n cÃ³ role `Patient` bÃ¬nh thÆ°á»ng vÃ  dÃ¹ng cÆ¡ cháº¿ Ä‘Äƒng nháº­p sáºµn cÃ³; há»‡ thá»‘ng khÃ´ng táº¡o role `family`. Viá»‡c lÃ  ngÆ°á»i thÃ¢n khÃ´ng cáº¥p quyá»n y táº¿ hoáº·c quyá»n xem dá»¯ liá»‡u cá»§a Patient khÃ¡c.
2. Má»™t Patient cÃ³ thá»ƒ má»i nhiá»u ngÆ°á»i thÃ¢n nhÆ°ng sá»‘ liÃªn káº¿t `active` khÃ´ng Ä‘Æ°á»£c vÆ°á»£t `familyLinkLimit` trong Plan/Subscription snapshot. Patient chá»‰ Ä‘Æ°á»£c má»i tÃ i khoáº£n active khÃ¡c chÃ­nh mÃ¬nh; ngÆ°á»i thÃ¢n pháº£i Ä‘Äƒng nháº­p vÃ  xÃ¡c nháº­n liÃªn káº¿t trÆ°á»›c khi nháº­n notification.
3. Consent pháº£i tÃ¡ch báº¡ch tá»‘i thiá»ƒu hai quyá»n: `missed_task_reminder` vÃ  `weekly_progress`. CÃ¡c quyá»n xem HealthMetrics chi tiáº¿t, Care Alert, AI conversation, consultation, há»“ sÆ¡ hoáº·c dá»¯ liá»‡u y táº¿ nháº¡y cáº£m Ä‘á»u máº·c Ä‘á»‹nh `false` vÃ  ngoÃ i P1.
4. Patient luÃ´n nháº­n reminder trÆ°á»›c. Contact chá»‰ nháº­n reminder khi task Patient-required Ä‘Ã£ `missed`, enrollment cÃ²n `active`, contact Ä‘Ã£ consent vÃ  qua má»™t grace period cáº¥u hÃ¬nh. Notification chá»‰ nÃ³i Patient cÃ³ má»™t hoáº¡t Ä‘á»™ng theo dÃµi chÆ°a hoÃ n thÃ nh; khÃ´ng chá»©a metric, severity, diagnosis, Doctor name, AI content hay lÃ½ do alert.
5. `urgent` khÃ´ng tá»± gá»­i cho contact vÃ  khÃ´ng biáº¿n contact thÃ nh emergency contact. Patient chá»‰ cÃ³ thá»ƒ báº­t má»™t consent riÃªng cho notification `urgent` sau khi Ä‘á»c cáº£nh bÃ¡o; ná»™i dung gá»­i váº«n khÃ´ng nÃªu chi tiáº¿t y khoa vÃ  pháº£i theo safety policy Ä‘Ã£ duyá»‡t.
6. `pending -> active` chá»‰ khi Ä‘Ãºng ngÆ°á»i Ä‘Æ°á»£c má»i accept trÆ°á»›c `invitationExpiresAt`; ngÆ°á»i Ä‘Æ°á»£c má»i cÃ³ thá»ƒ chuyá»ƒn `pending -> declined`, worker chuyá»ƒn invitation quÃ¡ háº¡n sang `expired`, Patient cÃ³ thá»ƒ há»§y invitation thÃ nh `revoked`.
7. Patient Ä‘Æ°á»£c chuyá»ƒn `active -> paused` vÃ  `paused -> active`. Patient hoáº·c ngÆ°á»i thÃ¢n cÃ³ thá»ƒ chuyá»ƒn `active|paused -> revoked`; revoke cÃ³ hiá»‡u lá»±c ngay cho notification/query má»›i nhÆ°ng khÃ´ng Ä‘Äƒng xuáº¥t hay vÃ´ hiá»‡u hÃ³a tÃ i khoáº£n Patient Ä‘á»™c láº­p cá»§a ngÆ°á»i thÃ¢n.
8. Khi má»i láº¡i cÃ¹ng cáº·p Patientâ€“ngÆ°á»i thÃ¢n á»Ÿ tráº¡ng thÃ¡i `revoked|declined|expired`, há»‡ thá»‘ng tÃ¡i sá»­ dá»¥ng `FamilyLinks`, tÄƒng `invitationVersion`, reset dá»¯ liá»‡u vÃ²ng má»i hiá»‡n táº¡i vÃ  chuyá»ƒn vá» `pending`. Má»i FamilyPermission cÅ© váº«n revoked; khi accept pháº£i táº¡o permission/consent version má»›i. Lá»‹ch sá»­ cÃ¡c láº§n má»i náº±m trong `AuditLogs`.
9. Invitation, acceptance/decline/expiry, consent version, pause/resume, thay Ä‘á»•i scope, reminder event, delivery result, revoke vÃ  actor pháº£i Ä‘Æ°á»£c ghi trong `AuditLogs` vá»›i `domain = care` vÃ  cÃ¡c báº£n ghi `FamilyReminders` liÃªn quan. NgÆ°á»i thÃ¢n khÃ´ng Ä‘Æ°á»£c xem danh sÃ¡ch Doctor hoáº·c lá»‹ch sá»­ alert chá»‰ vÃ¬ Ä‘Æ°á»£c liÃªn káº¿t.
10. Reminder cho contact tuÃ¢n thá»§ quiet hours, frequency cap vÃ  deduplication Ä‘á»™c láº­p vá»›i notification cá»§a Patient. KhÃ´ng gá»­i reminder náº¿u task Ä‘Ã£ hoÃ n thÃ nh, bá»‹ há»§y hoáº·c enrollment khÃ´ng cÃ²n active.
11. `FamilyLinks` Ä‘Ã£ biá»ƒu diá»…n quan há»‡ nhiá»u-nhiá»u giá»¯a cÃ¡c tÃ i khoáº£n nÃªn DA2 khÃ´ng táº¡o `FamilyGroups`. Chá»‰ thÃªm group khi cÃ³ nghiá»‡p vá»¥ tháº­t sá»± nhÆ° há»™ gia Ä‘Ã¬nh dÃ¹ng chung, vai trÃ² trÆ°á»Ÿng nhÃ³m hoáº·c há»™i thoáº¡i nhÃ³m.

## Care rule, evaluation vÃ  alert

1. Rule set cÃ³ lifecycle `draft`, `active`, `retired`; chá»‰ version active Ã¡p dá»¥ng cho dá»¯ liá»‡u má»›i. Má»i Doctor `active + approved` cÃ³ thá»ƒ activate sau server validation; khÃ´ng cÃ³ bÆ°á»›c human approval riÃªng. Activate tá»± retire version active cÅ© cá»§a cÃ¹ng Program version.
2. Rule engine pháº£i deterministic vÃ  tráº£ vá» `normal`, `attention` hoáº·c `urgent` cÃ¹ng `reasonCodes`, `ruleSetVersion` vÃ  input references.
3. Rule cÃ³ thá»ƒ dÃ¹ng giÃ¡ trá»‹ hiá»‡n táº¡i, sá»‘ láº§n láº·p, xu hÆ°á»›ng ngáº¯n háº¡n hoáº·c dá»¯ liá»‡u bá»‹ thiáº¿u; khÃ´ng Ä‘Æ°á»£c tráº£ vá» cháº©n Ä‘oÃ¡n/tÃªn bá»‡nh má»›i.
4. NgÆ°á»¡ng vÃ  ná»™i dung hÃ nh Ä‘á»™ng khÃ´ng hard-code ráº£i rÃ¡c trong service. Má»i thay Ä‘á»•i pháº£i cÃ³ actor, lÃ½ do, version vÃ  audit log.
5. AI/LLM khÃ´ng Ä‘Æ°á»£c táº¡o, nÃ¢ng/háº¡ severity hoáº·c ghi Ä‘Ã¨ káº¿t quáº£ Care Evaluation.
6. Evaluation `urgent` dÃ¹ng safety template Ä‘Ã£ duyá»‡t Ä‘á»ƒ hÆ°á»›ng Patient liÃªn há»‡ cÆ¡ sá»Ÿ y táº¿/cáº¥p cá»©u phÃ¹ há»£p; khÃ´ng chá» AI vÃ  khÃ´ng cam káº¿t Doctor pháº£n há»“i tá»©c thá»i.
7. Care Alert pháº£i cÃ³ deduplication key theo enrollment, rule vÃ  evaluation window Ä‘á»ƒ retry khÃ´ng táº¡o cáº£nh bÃ¡o trÃ¹ng.
8. Alert cÃ³ tráº¡ng thÃ¡i `open`, `acknowledged`, `resolved`, `dismissed`; acknowledge khÃ´ng Ä‘á»“ng nghÄ©a Ä‘Ã£ giáº£i quyáº¿t hoáº·c Ä‘Ã£ liÃªn há»‡ Patient.
9. Chá»‰ Doctor Ä‘Æ°á»£c phÃ¢n cÃ´ng, Patient sá»Ÿ há»¯u dá»¯ liá»‡u vÃ  Admin cÃ³ quyá»n audit má»›i xem alert theo pháº¡m vi tÆ°Æ¡ng á»©ng.
10. Resolve/dismiss pháº£i lÆ°u actor, timestamp vÃ  lÃ½ do; alert quan trá»ng khÃ´ng Ä‘Æ°á»£c hard-delete.
11. Assigned Doctor cÃ³ thá»ƒ chuyá»ƒn `open -> acknowledged -> resolved` hoáº·c `open -> resolved`. Khi resolve trá»±c tiáº¿p tá»« `open`, backend pháº£i ghi acknowledge vÃ  resolve cÃ¹ng actor/time trong má»™t transaction Ä‘á»ƒ khÃ´ng máº¥t dáº¥u Ä‘Ã£ tiáº¿p nháº­n.
12. Assigned Doctor Ä‘Æ°á»£c chuyá»ƒn `open|acknowledged -> dismissed` chá»‰ vá»›i reason code Ä‘Æ°á»£c phÃ©p nhÆ° `duplicate`, `invalid_metric`, `rule_false_positive`. Admin cÃ³ quyá»n audit nhÆ°ng khÃ´ng thay Doctor Ä‘Æ°a ra clinical disposition.
13. `resolved` vÃ  `dismissed` lÃ  tráº¡ng thÃ¡i cuá»‘i, khÃ´ng reopen. Evaluation trong cÃ¹ng deduplication window pháº£i dÃ¹ng láº¡i alert `open|acknowledged`; evaluation á»Ÿ window má»›i hoáº·c sau khi alert cÅ© káº¿t thÃºc táº¡o alert má»›i.

## TÃ¬m cÆ¡ sá»Ÿ y táº¿ theo nhu cáº§u theo dÃµi (P1)

1. `MedicalFacilities` lÃ  danh má»¥c cÆ¡ sá»Ÿ y táº¿ do Admin quáº£n lÃ½. Má»—i báº£n ghi cÃ³ `status = verified` pháº£i cÃ³ tá»‘i thiá»ƒu tÃªn, loáº¡i cÆ¡ sá»Ÿ, Ä‘á»‹a chá»‰, tá»a Ä‘á»™, tá»‰nh/thÃ nh, kÃªnh liÃªn há»‡, danh sÃ¡ch chuyÃªn khoa/dá»‹ch vá»¥, nguá»“n xÃ¡c minh, `verifiedAt` hoáº·c `updatedAt` vÃ  nháº­t kÃ½ trong `AuditLogs` vá»›i `domain = facility`.
2. `DiseaseSpecialties` Ã¡nh xáº¡ bá»‡nh/Care Program sang má»™t hoáº·c nhiá»u chuyÃªn khoa. Chá»‰ Admin cÃ³ quyá»n táº¡o, duyá»‡t, sá»­a hoáº·c ngá»«ng dÃ¹ng Ã¡nh xáº¡; má»i thay Ä‘á»•i pháº£i cÃ³ phiÃªn báº£n/nháº­t kÃ½ vÃ  khÃ´ng Ä‘Æ°á»£c coi lÃ  cháº©n Ä‘oÃ¡n hoáº·c hÆ°á»›ng dáº«n lÃ¢m sÃ ng.
3. TÃ¬m kiáº¿m cáº§n condition/Program Ä‘Ã£ chá»n rÃµ rÃ ng hoáº·c specialty Ä‘Ã£ duyá»‡t, cÃ¹ng khu vá»±c hoáº·c vá»‹ trÃ­ do Patient chá»§ Ä‘á»™ng cung cáº¥p. Vá»‹ trÃ­ chÃ­nh xÃ¡c lÃ  dá»¯ liá»‡u nháº¡y cáº£m: chá»‰ dÃ¹ng cho truy váº¥n hiá»‡n táº¡i khi Patient cho phÃ©p, khÃ´ng lÆ°u lá»‹ch sá»­ máº·c Ä‘á»‹nh.
4. Káº¿t quáº£ ná»™i bá»™ chá»‰ láº¥y `MedicalFacilities` Ä‘Ã£ xÃ¡c minh, lá»c chuyÃªn khoa/khu vá»±c rá»“i sáº¯p xáº¿p xÃ¡c Ä‘á»‹nh theo má»©c khá»›p chuyÃªn khoa vÃ  khoáº£ng cÃ¡ch. KhÃ´ng dÃ¹ng AI score, Ä‘Ã¡nh giÃ¡ sao, doanh thu hay phÃ­ quáº£ng cÃ¡o Ä‘á»ƒ thay Ä‘á»•i thá»© tá»± phÃ¹ há»£p y khoa.
5. Má»—i káº¿t quáº£ pháº£i hiá»ƒn thá»‹ source, ngÃ y cáº­p nháº­t, specialty khá»›p vÃ  reason code dá»… hiá»ƒu. Há»‡ thá»‘ng khÃ´ng tuyÃªn bá»‘ â€œtá»‘t nháº¥tâ€, â€œphÃ¹ há»£p Ä‘iá»u trá»‹ nháº¥tâ€ hoáº·c báº£o Ä‘áº£m kháº£ nÄƒng tiáº¿p nháº­n/Ä‘áº·t lá»‹ch náº¿u khÃ´ng cÃ³ xÃ¡c nháº­n chÃ­nh thá»©c cá»§a cÆ¡ sá»Ÿ.
6. Dá»‹ch vá»¥ báº£n Ä‘á»“ bÃªn ngoÃ i chá»‰ Ä‘Æ°á»£c gá»i khi danh má»¥c ná»™i bá»™ thiáº¿u káº¿t quáº£ hoáº·c Patient chá»§ Ä‘á»™ng má»Ÿ rá»™ng tÃ¬m kiáº¿m. Káº¿t quáº£ pháº£i gáº¯n nhÃ£n nguá»“n bÃªn ngoÃ i vÃ  tuÃ¢n thá»§ Ä‘iá»u khoáº£n ghi nguá»“n/lÆ°u dá»¯ liá»‡u cá»§a nhÃ  cung cáº¥p. Khi cáº§n bá»• sung danh má»¥c, Admin chá»n má»™t káº¿t quáº£ báº£n Ä‘á»“ Ä‘á»ƒ táº¡o `MedicalFacilities.status = draft`, kiá»ƒm tra nguá»“n chÃ­nh thá»©c rá»“i má»›i chuyá»ƒn sang `verified`; káº¿t quáº£ API khÃ´ng bao giá» tá»± Ä‘Æ°á»£c xÃ¡c minh.
7. AI chá»‰ Ä‘Æ°á»£c chuáº©n hÃ³a vÄƒn báº£n tá»± nhiÃªn thÃ nh bá»™ lá»c condition/specialty/location trong allowlist vÃ  giáº£i thÃ­ch káº¿t quáº£ dá»±a trÃªn dá»¯ liá»‡u Ä‘Ã£ tráº£ vá». AI khÃ´ng suy luáº­n bá»‡nh, xáº¿p háº¡ng cháº¥t lÆ°á»£ng cÆ¡ sá»Ÿ, cháº©n Ä‘oÃ¡n hoáº·c xá»­ lÃ½ tÃ¬nh huá»‘ng `urgent`.
8. Trong luá»“ng `urgent`, safety template luÃ´n hiá»ƒn thá»‹ trÆ°á»›c. TÃ¬m cÆ¡ sá»Ÿ y táº¿/chá»‰ Ä‘Æ°á»ng lÃ  tÃ¡c vá»¥ bá»• trá»£ vÃ  khÃ´ng Ä‘Æ°á»£c trÃ¬ hoÃ£n hÆ°á»›ng dáº«n liÃªn há»‡ cáº¥p cá»©u/cÆ¡ sá»Ÿ y táº¿ phÃ¹ há»£p.
9. LiÃªn káº¿t Ä‘áº·t lá»‹ch chá»‰ xuáº¥t hiá»‡n khi cÆ¡ sá»Ÿ cÃ³ tÃ­ch há»£p chÃ­nh thá»©c hoáº·c Ä‘Æ°á»ng dáº«n Ä‘Ã£ Ä‘Æ°á»£c Admin xÃ¡c thá»±c. KhÃ´ng mÃ´ phá»ng cÃ²n chá»—, giÃ¡ hoáº·c xÃ¡c nháº­n lá»‹ch tá»« dá»¯ liá»‡u báº£n Ä‘á»“.

## Doctor Priority Inbox vÃ  follow-up

1. Priority Inbox lÃ  projection/query tá»« Care Alerts vÃ  enrollments, khÃ´ng pháº£i nguá»“n dá»¯ liá»‡u lÃ¢m sÃ ng má»›i.
2. Thá»© tá»± máº·c Ä‘á»‹nh: severity, detectedAt vÃ  `_id` tie-breaker; AI score khÃ´ng tham gia quyáº¿t Ä‘á»‹nh thá»© tá»± P0.
3. Má»i list pháº£i pagination, projection vÃ  hard limit; Doctor khÃ´ng Ä‘Æ°á»£c truy váº¥n Patient ngoÃ i assignment há»£p lá»‡.
4. Doctor cÃ³ thá»ƒ acknowledge, ghi chÃº liÃªn há»‡, táº¡o/liÃªn káº¿t Consultation vÃ  resolve alert.
5. Consultation liÃªn káº¿t alert váº«n pháº£i tuÃ¢n thá»§ Ä‘áº§y Ä‘á»§ booking, participant authorization vÃ  session state hiá»‡n cÃ³.
6. Sau consultation, Doctor cÃ³ thá»ƒ ghi follow-up note hoáº·c thay Ä‘á»•i chÆ°Æ¡ng trÃ¬nh trong pháº¡m vi Ä‘Æ°á»£c cáº¥p quyá»n; há»‡ thá»‘ng pháº£i lÆ°u audit.

## BÃ¡o cÃ¡o vÃ  AI summary Chronic Care

1. BÃ¡o cÃ¡o 7/30 ngÃ y Ä‘Æ°á»£c tÃ­nh xÃ¡c Ä‘á»‹nh tá»« HealthMetrics, Monitoring Tasks, Care Alerts vÃ  Consultations trong pháº¡m vi Ä‘Æ°á»£c authorize.
2. Backend tÃ­nh thá»‘ng kÃª, trend vÃ  adherence; LLM chá»‰ diá»…n Ä‘áº¡t tá»« payload chuáº©n hÃ³a, khÃ´ng tá»± tÃ­nh láº¡i hoáº·c bá»• sung dá»¯ kiá»‡n.
3. Summary pháº£i lÆ°u window, data cutoff, model/prompt version, nguá»“n dá»¯ liá»‡u/provenance vÃ  tráº¡ng thÃ¡i generation.
4. Náº¿u AI timeout, lá»—i hoáº·c evidence khÃ´ng Ä‘á»§, há»‡ thá»‘ng váº«n tráº£ bÃ¡o cÃ¡o sá»‘ liá»‡u vÃ  reason codes; narrative chuyá»ƒn `unavailable`.
5. Patient summary dÃ¹ng ngÃ´n ngá»¯ tham kháº£o, khÃ´ng cháº©n Ä‘oÃ¡n. Doctor summary pháº£i phÃ¢n biá»‡t dá»¯ kiá»‡n, dá»¯ liá»‡u thiáº¿u vÃ  ná»™i dung AI sinh.
6. RAG chá»‰ sá»­ dá»¥ng document/chunk active, approved, chÆ°a háº¿t háº¡n; citation tráº£ vá» pháº£i Ä‘Æ°á»£c backend kiá»ƒm tra tá»“n táº¡i.
7. Dá»¯ liá»‡u Patient chá»‰ Ä‘Æ°á»£c Ä‘Æ°a vÃ o summary trong Ä‘Ãºng authorization scope; khÃ´ng dÃ¹ng raw health payload Ä‘á»ƒ huáº¥n luyá»‡n hoáº·c gá»i provider ngoÃ i policy.
8. TrÆ°á»›c khi táº¡o summary, backend pháº£i chuáº©n hÃ³a metric type, unit, timezone, source vÃ  report window; báº£n ghi khÃ´ng há»£p lá»‡ Ä‘Æ°á»£c loáº¡i báº±ng reason code, khÃ´ng Ä‘Æ°á»£c tá»± sá»­a hoáº·c bá» qua Ã¢m tháº§m.
9. Backend, khÃ´ng pháº£i LLM, tÃ­nh expected/completed measurements, adherence, min/max/average/median, period delta, trend, missing windows, alert counts vÃ  consultation/follow-up references.
10. Má»—i láº§n sinh ná»™i dung dÃ¹ng má»™t `SummaryInputSnapshot` báº¥t biáº¿n gá»“m data cutoff, statistics, missing data, Care Evaluations vÃ  source references. Snapshot pháº£i cÃ³ hash/version Ä‘á»ƒ audit vÃ  tÃ¡i táº¡o káº¿t quáº£.
11. Structured output tá»‘i thiá»ƒu tÃ¡ch `overview`, `observations`, `missingData`, `alertsToMention`, `questionsForDoctor` vÃ  `disclaimer`; Patient vÃ  Doctor dÃ¹ng hai presentation policy khÃ¡c nhau trÃªn cÃ¹ng facts.
12. Output pháº£i qua schema validation vÃ  grounding validation. Má»i con sá»‘, xu hÆ°á»›ng, alert hoáº·c nháº­n xÃ©t sá»± kiá»‡n pháº£i Ã¡nh xáº¡ Ä‘Æ°á»£c vá» snapshot/source reference; ná»™i dung khÃ´ng cÃ³ nguá»“n bá»‹ loáº¡i.
13. Guard cáº¥m diagnosis, prescription, dose change, stop-medication advice, thay Ä‘á»•i severity vÃ  tuyÃªn bá»‘ cháº¯c cháº¯n khÃ´ng Ä‘Æ°á»£c chá»©ng minh. Guard fail pháº£i dÃ¹ng deterministic fallback vÃ  ghi validation reason.
14. Summary generation idempotent theo enrollment, report window, data cutoff vÃ  summary version. Dá»¯ liá»‡u nguá»“n thay Ä‘á»•i táº¡o summary version má»›i; khÃ´ng ghi Ä‘Ã¨ lá»‹ch sá»­ Ä‘Ã£ Ä‘Æ°á»£c Doctor review.
15. Summary lÆ°u `generated|fallback|failed`, model/prompt version, rule set version, input hash/source refs, validation result, token/latency metadata khÃ´ng chá»©a raw health data vÃ  Doctor review status náº¿u cÃ³.
16. RAG chá»‰ bá»• sung kiáº¿n thá»©c giÃ¡o dá»¥c tá»« tÃ i liá»‡u active/approved; RAG khÃ´ng tÃ­nh thá»‘ng kÃª, chá»n threshold, thay Ä‘á»•i rule result hoáº·c quyáº¿t Ä‘á»‹nh hÃ nh Ä‘á»™ng kháº©n.
17. Admin/Doctor Ä‘Æ°á»£c cáº¥p quyá»n duyá»‡t á»Ÿ cáº¥p `AiDocuments`, khÃ´ng duyá»‡t thá»§ cÃ´ng tá»«ng chunk. `AiDocuments.reviewStatus` lÃ  nguá»“n chuáº©n; khi document Ä‘Æ°á»£c duyá»‡t/archived, worker dÃ¹ng bulk update Ä‘á»“ng bá»™ `AiDocumentChunks.reviewStatus/isActive`.
17a. Má»—i `AiDocumentChunks` pháº£i káº¿ thá»«a metadata quáº£n trá»‹ tá»« document vÃ  metadata vá»‹ trÃ­ tá»« parser: nguá»“n/tá»• chá»©c, tráº¡ng thÃ¡i duyá»‡t, phiÃªn báº£n, ngÃ y hiá»‡u lá»±c, chuyÃªn khoa, ngÃ´n ngá»¯, Ä‘á»‘i tÆ°á»£ng Ä‘á»c, trang vÃ  Ä‘Æ°á»ng dáº«n section.
18. Retrieval chá»‰ dÃ¹ng chunk `isActive = true`, `reviewStatus = approved`, chÆ°a háº¿t hiá»‡u lá»±c vÃ  khá»›p pháº¡m vi. `citation` pháº£i trá» Ä‘Ãºng document, version, page/section vÃ  source URL; backend kiá»ƒm tra chunk/citation trÆ°á»›c khi tráº£ lá»i.
19. `contentHash` chá»‘ng chunk trÃ¹ng trong cÃ¹ng document; `ingestionVersion` xÃ¡c Ä‘á»‹nh parser/chunker/embedding version Ä‘á»ƒ re-ingestion. `parentChunkId` chá»‰ dÃ¹ng láº¥y section cha Ä‘á»§ ngá»¯ cáº£nh, khÃ´ng bá» qua metadata filter cá»§a child hoáº·c parent.
20. Chunk lá»—i hoáº·c khÃ´ng phÃ¹ há»£p Ä‘Æ°á»£c loáº¡i riÃªng báº±ng `isActive = false`, `excludedBy`, `excludedAt`, `exclusionReason`; thao tÃ¡c nÃ y khÃ´ng thay Ä‘á»•i tráº¡ng thÃ¡i duyá»‡t cá»§a toÃ n document. Document version má»›i pháº£i Ä‘Æ°á»£c duyá»‡t trÆ°á»›c khi thay tháº¿ version cÅ© Ä‘ang active.

## Quy táº¯c tÃ i khoáº£n vÃ  bÃ¡c sÄ©

1. Chá»‰ tÃ i khoáº£n active Ä‘Æ°á»£c tÆ° váº¥n, Ä‘áº·t lá»‹ch hoáº·c thanh toÃ¡n.
2. Chá»‰ user cÃ³ role doctor vÃ  há»“ sÆ¡ Ä‘Æ°á»£c approved má»›i Ä‘Æ°á»£c má»Ÿ slot, nháº­n yÃªu cáº§u hoáº·c tÆ° váº¥n.
3. Presence online dÃ¹ng Redis vÃ  Socket.IO. `Users.lastOnlineAt` trong MongoDB chá»‰ lÃ  thá»i Ä‘iá»ƒm online gáº§n nháº¥t Ä‘Ã£ ghi bá»n vá»¯ng, Ä‘Æ°á»£c cáº­p nháº­t cÃ³ giá»›i háº¡n táº§n suáº¥t khi disconnect/heartbeat; khÃ´ng dÃ¹ng field nÃ y Ä‘á»ƒ káº¿t luáº­n user Ä‘ang online tá»©c thá»i.
4. Má»™t OAuth account chá»‰ liÃªn káº¿t vá»›i má»™t user. Má»™t user chá»‰ cÃ³ má»™t account cho má»—i OAuth provider.
5. Refresh token chá»‰ lÆ°u dáº¡ng hash trong `AuthSessions`, cÃ³ expiry vÃ  rotation. Token gá»­i cho client chá»©a `sessionId` vÃ  secret ngáº«u nhiÃªn; backend tÃ¬m session theo ID rá»“i so sÃ¡nh hash, khÃ´ng query báº±ng plaintext token. Má»—i láº§n rotation revoke báº£n ghi cÅ©, táº¡o báº£n ghi má»›i cÃ¹ng `familyId` vÃ  ná»‘i `rotatedFromSessionId/replacedBySessionId`; dÃ¹ng láº¡i token cÅ© sáº½ revoke cáº£ family. MongoDB lÃ  nguá»“n bá»n vá»¯ng cho logout-all vÃ  replay detection; Redis chá»‰ lÃ  cache/revocation fast-path. OTP chá»‰ tá»“n táº¡i trong Redis vá»›i TTL, giá»›i háº¡n sá»‘ láº§n thá»­ vÃ  rate limit gá»­i láº¡i.

## Lá»‹ch trá»‘ng vÃ  Ä‘áº·t lá»‹ch chá»§ Ä‘á»™ng

`doctorProfile.bookingSettings` lÃ  chÃ­nh sÃ¡ch máº·c Ä‘á»‹nh cá»§a tá»«ng Doctor. Khi booking thÃ nh cÃ´ng, backend snapshot cÃ¡c giÃ¡ trá»‹ Ã¡p dá»¥ng vÃ o Consultation Ä‘á»ƒ viá»‡c Doctor Ä‘á»•i cáº¥u hÃ¬nh sau Ä‘Ã³ khÃ´ng lÃ m thay Ä‘á»•i lá»‹ch Ä‘Ã£ Ä‘áº·t:

- `bookingPolicy`: `instant` xÃ¡c nháº­n ngay; `approval_required` táº¡o yÃªu cáº§u chá» Doctor duyá»‡t.
- `minNoticeMinutes`: thá»i gian tá»‘i thiá»ƒu tá»« lÃºc Ä‘áº·t tá»›i giá» báº¯t Ä‘áº§u; cháº·n Ä‘áº·t quÃ¡ sÃ¡t giá».
- `maxAdvanceDays`: sá»‘ ngÃ y xa nháº¥t Patient Ä‘Æ°á»£c phÃ©p Ä‘áº·t trÆ°á»›c.
- `cancellationDeadlineMinutes`: má»‘c cuá»‘i Patient Ä‘Æ°á»£c há»§y Ä‘Ãºng háº¡n Ä‘á»ƒ hoÃ n lÆ°á»£t/má»Ÿ láº¡i slot theo policy.
- `checkInEarlyMinutes`: sá»‘ phÃºt Patient Ä‘Æ°á»£c check-in trÆ°á»›c giá» háº¹n.
- `noShowAfterMinutes`: sá»‘ phÃºt chá» sau giá» háº¹n trÆ°á»›c khi cÃ³ thá»ƒ Ä‘Ã¡nh dáº¥u `no_show`.
- `defaultDurationMinutes`: thá»i lÆ°á»£ng dá»± kiáº¿n khi táº¡o slot/on-demand; khÃ´ng tá»± káº¿t thÃºc phiÃªn.
- `bufferMinutes`: khoáº£ng Ä‘á»‡m tá»‘i thiá»ƒu giá»¯a cÃ¡c lá»‹ch booked Ä‘á»ƒ giáº£m chá»“ng chÃ©o.

CÃ¡c giÃ¡ trá»‹ pháº£i cÃ³ giá»›i háº¡n há»‡ thá»‘ng do Admin cáº¥u hÃ¬nh; Doctor khÃ´ng Ä‘Æ°á»£c Ä‘áº·t sá»‘ Ã¢m hoáº·c vÆ°á»£t giá»›i háº¡n váº­n hÃ nh.

1. BÃ¡c sÄ© táº¡o AvailabilitySlots vá»›i start time, end time vÃ  timezone. Má»™t bÃ¡c sÄ© khÃ´ng Ä‘Æ°á»£c cÃ³ hai slot cÃ¹ng start time.
2. Slot cÃ³ cÃ¡c tráº¡ng thÃ¡i available, booked, blocked hoáº·c expired.
3. Máº·c Ä‘á»‹nh booking policy lÃ  instant: bá»‡nh nhÃ¢n Ä‘áº·t thÃ nh cÃ´ng thÃ¬ lá»‹ch Ä‘Æ°á»£c xÃ¡c nháº­n ngay, khÃ´ng cáº§n bÃ¡c sÄ© duyá»‡t láº¡i.
4. PhiÃªn báº£n sau cÃ³ thá»ƒ há»— trá»£ approval required. Khi Ä‘Ã³ booking táº¡o consultation cÃ³ request status pending.
5. Bá»‡nh nhÃ¢n chá»‰ tháº¥y slot available, chÆ°a qua giá» báº¯t Ä‘áº§u vÃ  thá»a min notice minutes cá»§a bÃ¡c sÄ©.
6. Bá»‡nh nhÃ¢n chá»‰ Ä‘Æ°á»£c Ä‘áº·t trong max advance days tÃ­nh tá»« hiá»‡n táº¡i.
7. Booking lÃ  thao tÃ¡c atomic: backend chá»‰ táº¡o Consultation khi Ä‘á»•i thÃ nh cÃ´ng slot tá»« available sang booked. Náº¿u táº¡o consultation lá»—i, slot pháº£i Ä‘Æ°á»£c tráº£ vá» available.
8. Khi bá»‡nh nhÃ¢n há»§y Ä‘Ãºng háº¡n cancellation deadline, slot quay láº¡i available. Slot bá»‹ bÃ¡c sÄ© block hoáº·c Ä‘Ã£ háº¿t giá» khÃ´ng Ä‘Æ°á»£c má»Ÿ láº¡i.
9. Slot qua giá» mÃ  khÃ´ng cÃ³ consultation há»£p lá»‡ chuyá»ƒn expired.
10. Slot cá»§a cÃ¹ng Doctor khÃ´ng Ä‘Æ°á»£c overlap vÃ  pháº£i tÃ´n trá»ng `bufferMinutes`; viá»‡c kiá»ƒm tra dÃ¹ng transaction/conditional query, khÃ´ng chá»‰ dá»±a vÃ o unique start time.

## TÆ° váº¥n nhanh theo yÃªu cáº§u

1. Bá»‡nh nhÃ¢n táº¡o consultation on-demand vá»›i request status pending, session status not started vÃ  khÃ´ng cÃ³ availability slot.
2. BÃ¡c sÄ© cÃ³ thá»ƒ accept hoáº·c decline yÃªu cáº§u; trÆ°á»ng declined reason lÃ  tÃ¹y chá»n.
3. YÃªu cáº§u chÆ°a xá»­ lÃ½ chuyá»ƒn expired táº¡i request expires at. GiÃ¡ trá»‹ MVP Ä‘á» xuáº¥t lÃ  24 giá».
4. Má»™t bá»‡nh nhÃ¢n chá»‰ cÃ³ tá»‘i Ä‘a má»™t yÃªu cáº§u pending tá»›i cÃ¹ng bÃ¡c sÄ© Ä‘á»ƒ háº¡n cháº¿ spam.
5. Chá»‰ khi request Ä‘Æ°á»£c accepted, hai bÃªn má»›i truy cáº­p ConsultationMessages hoáº·c phÃ²ng tÆ° váº¥n.
6. BÃ¡c sÄ© cÃ³ thá»ƒ accept nhiá»u yÃªu cáº§u nhÆ°ng chá»‰ Ä‘Æ°á»£c cÃ³ má»™t consultation in consultation táº¡i má»™t thá»i Ä‘iá»ƒm.
7. Doctor khÃ´ng Ä‘Æ°á»£c accept on-demand nhÆ° má»™t cam káº¿t báº¯t Ä‘áº§u ngay náº¿u cÃ³ scheduled consultation sáº¯p tá»›i trong `expectedDurationMinutes + bufferMinutes`. Há»‡ thá»‘ng cÃ³ thá»ƒ cho request tiáº¿p tá»¥c pending hoáº·c accepted/waiting kÃ¨m ETA.

## Tráº¡ng thÃ¡i Consultation

### Request status

| Tráº¡ng thÃ¡i | Ã nghÄ©a |
|---|---|
| pending | Chá» bÃ¡c sÄ© duyá»‡t. |
| accepted | CÃ³ thá»ƒ báº¯t Ä‘áº§u hoáº·c chá» tá»›i giá» tÆ° váº¥n. |
| declined | BÃ¡c sÄ© tá»« chá»‘i. |
| cancelled | Bá»‡nh nhÃ¢n hoáº·c bÃ¡c sÄ© há»§y. |
| expired | KhÃ´ng Ä‘Æ°á»£c xá»­ lÃ½ trÆ°á»›c háº¡n. |

### Session status

| Tráº¡ng thÃ¡i | Ã nghÄ©a |
|---|---|
| not started | ChÆ°a check-in hoáº·c chÆ°a báº¯t Ä‘áº§u. |
| waiting | Bá»‡nh nhÃ¢n Ä‘Ã£ check-in vÃ  Ä‘ang chá». |
| in consultation | BÃ¡c sÄ© Ä‘ang tÆ° váº¥n. |
| interrupted | PhiÃªn bá»‹ giÃ¡n Ä‘oáº¡n do máº¥t heartbeat/káº¿t ná»‘i; cÃ³ thá»ƒ resume hoáº·c Ä‘Æ°á»£c Doctor hoÃ n táº¥t. |
| completed | PhiÃªn tÆ° váº¥n Ä‘Ã£ káº¿t thÃºc. |
| no show | Bá»‡nh nhÃ¢n khÃ´ng xuáº¥t hiá»‡n Ä‘Ãºng quy Ä‘á»‹nh. |

## Check-in vÃ  hÃ ng Ä‘á»£i

1. HÃ ng Ä‘á»£i chá»‰ chá»©a consultation accepted cÃ³ session status waiting.
2. Bá»‡nh nhÃ¢n cÃ³ lá»‹ch Ä‘Æ°á»£c check-in sá»›m tá»‘i Ä‘a check in early minutes; giÃ¡ trá»‹ MVP Ä‘á» xuáº¥t lÃ  15 phÃºt.
3. HÃ ng Ä‘á»£i sáº¯p theo scheduled start time, sau Ä‘Ã³ theo queue joined time. Vá»‹ trÃ­ hiá»ƒn thá»‹ chá»‰ lÃ  snapshot, khÃ´ng pháº£i nguá»“n dá»¯ liá»‡u chuáº©n.
4. Khi bÃ¡c sÄ© gá»i ngÆ°á»i tiáº¿p theo, backend atomically Ä‘á»•i má»™t consultation tá»« waiting sang in consultation.
5. Náº¿u bá»‡nh nhÃ¢n khÃ´ng xuáº¥t hiá»‡n sau no show after minutes tÃ­nh tá»« giá» háº¹n, session chuyá»ƒn no show. GiÃ¡ trá»‹ MVP Ä‘á» xuáº¥t lÃ  10 phÃºt.
6. Má»™t consultation on-demand Ä‘Ã£ accepted cÅ©ng cÃ³ thá»ƒ vÃ o waiting khi bÃ¡c sÄ© Ä‘ang tÆ° váº¥n cho ngÆ°á»i khÃ¡c.
7. Scheduled vÃ  on-demand dÃ¹ng chung hÃ ng Ä‘á»£i theo Doctor. Thá»© tá»± máº·c Ä‘á»‹nh: scheduled Ä‘Ã£ quÃ¡ giá», scheduled Ä‘Ã£ Ä‘áº¿n cá»­a sá»• phá»¥c vá»¥, sau Ä‘Ã³ on-demand accepted theo `queueJoinedAt`. KhÃ´ng Ä‘Æ°á»£c ngáº¯t phiÃªn `in_consultation` Ä‘á»ƒ phá»¥c vá»¥ phiÃªn khÃ¡c.
8. `call-next` pháº£i kiá»ƒm tra atomically Doctor chÆ°a cÃ³ phiÃªn `in_consultation`; partial unique index lÃ  lá»›p báº£o vá»‡ cuá»‘i cÃ¹ng chá»‘ng hai request Ä‘á»“ng thá»i.
9. On-demand chá»‰ Ä‘Æ°á»£c gá»i trong khoáº£ng trá»‘ng khi `now + expectedDurationMinutes + bufferMinutes` khÃ´ng vÆ°á»£t giá» scheduled tiáº¿p theo. Náº¿u phiÃªn hiá»‡n táº¡i kÃ©o dÃ i, scheduled Patient nháº­n cáº­p nháº­t trá»…/ETA.

## Káº¿t thÃºc vÃ  giÃ¡n Ä‘oáº¡n Consultation

1. `scheduledEndAt` hoáº·c thá»i lÆ°á»£ng dá»± kiáº¿n chá»‰ dÃ¹ng cho lá»‹ch, cáº£nh bÃ¡o vÃ  ETA; há»‡ thá»‘ng khÃ´ng tá»± chuyá»ƒn Consultation sang `completed` khi háº¿t giá».
2. Doctor chá»§ Ä‘á»™ng káº¿t thÃºc cuá»™c gá»i (`callEndedAt`) vÃ  xÃ¡c nháº­n hoÃ n táº¥t Consultation (`completedAt`, `completedBy`). Hai má»‘c cÃ³ thá»ƒ khÃ¡c nhau Ä‘á»ƒ Doctor hoÃ n thiá»‡n note.
3. TrÆ°á»›c giá» dá»± kiáº¿n káº¿t thÃºc, há»‡ thá»‘ng cÃ³ thá»ƒ cáº£nh bÃ¡o. Khi quÃ¡ giá», ghi `overtimeStartedAt`; khÃ´ng tá»± Ä‘Ã³ng chat/call hoáº·c Ä‘Ã¡nh dáº¥u Ä‘Ã£ hoÃ n thÃ nh.
4. Náº¿u phiÃªn `in_consultation` máº¥t heartbeat quÃ¡ giá»›i háº¡n ká»¹ thuáº­t, worker chuyá»ƒn sang `interrupted` báº±ng conditional update, ghi lÃ½ do vÃ  giáº£i phÃ³ng khÃ³a má»™t phiÃªn Ä‘ang cháº¡y. Worker khÃ´ng Ä‘Æ°á»£c ghi `completed` thay Doctor.
5. Doctor cÃ³ thá»ƒ resume phiÃªn interrupted náº¿u khÃ´ng cÃ³ phiÃªn khÃ¡c Ä‘ang cháº¡y, hoáº·c hoÃ n táº¥t vá»›i ghi chÃº/lÃ½ do. Má»i interrupt/resume/complete ghi `AuditLogs` vá»›i `domain = consultation`.

## Chat, video vÃ  quyá»n truy cáº­p

1. ConsultationMessages thuá»™c Ä‘Ãºng má»™t consultation vÃ  chá»‰ patient hoáº·c doctor cá»§a consultation Ä‘Ã³ má»›i xem hoáº·c gá»­i message.
2. Room ID chá»‰ táº¡o sau khi consultation Ä‘Æ°á»£c accepted vÃ  pháº£i unique.
3. WebRTC signaling Ä‘i qua Socket.IO. KhÃ´ng lÆ°u signaling message vÃ o MongoDB.
4. File Ä‘Ã­nh kÃ¨m lÆ°u trÃªn Cloudinary; database chá»‰ giá»¯ metadata, URL vÃ  public ID.
5. Bá»‡nh nhÃ¢n pháº£i xÃ¡c nháº­n consent vá»›i phiÃªn báº£n chÃ­nh sÃ¡ch hiá»‡n hÃ nh trÆ°á»›c audio hoáº·c video consultation.

## Review vÃ  vi pháº¡m

1. Má»™t consultation cÃ³ tá»‘i Ä‘a má»™t review, Ä‘Æ°á»£c báº£o vá»‡ báº±ng unique index cá»§a consultation ID.
2. Chá»‰ patient thuá»™c consultation accepted vÃ  completed má»›i Ä‘Æ°á»£c review.
3. Khi táº¡o, sá»­a, áº©n hoáº·c xÃ³a review, cáº­p nháº­t rating sum, review count vÃ  average rating cá»§a doctor profile trong cÃ¹ng transaction.
4. Admin khÃ´ng xÃ³a cá»©ng review vi pháº¡m; chuyá»ƒn status sang hidden hoáº·c removed Ä‘á»ƒ giá»¯ audit.
5. Violation report cÃ³ bá»‘n tráº¡ng thÃ¡i pending, processing, resolved, dismissed; severity gá»“m low, medium, high.
6. Evidence pháº£i tham chiáº¿u message, consultation hoáº·c file Cloudinary. AI classification chá»‰ há»— trá»£ phÃ¢n loáº¡i, khÃ´ng tá»± Ä‘á»™ng khÃ³a tÃ i khoáº£n.

## GÃ³i dá»‹ch vá»¥, quota AI vÃ  VNPAY

1. GiÃ¡, quyá»n lá»£i vÃ  quota táº¡i lÃºc mua pháº£i Ä‘Æ°á»£c snapshot trong PaymentOrders vÃ  Subscriptions.
2. Tiá»n VND lÆ°u dÆ°á»›i dáº¡ng integer, khÃ´ng dÃ¹ng sá»‘ thá»±c.
3. Return URL chá»‰ hiá»ƒn thá»‹ káº¿t quáº£. Chá»‰ IPN cÃ³ chá»¯ kÃ½ há»£p lá»‡ má»›i chuyá»ƒn payment order sang paid vÃ  ghi yÃªu cáº§u cáº¥p Subscription vÃ o transactional outbox.
4. IPN láº·p pháº£i idempotent: cÃ¹ng transaction reference khÃ´ng Ä‘Æ°á»£c táº¡o transaction, outbox event hoáº·c Subscription grant hai láº§n.
5. Redis kiá»ƒm quota AI realtime theo ngÃ y; AiUsageDaily lÃ  dá»¯ liá»‡u bá»n vá»¯ng cho thá»‘ng kÃª vÃ  Ä‘á»‘i soÃ¡t.
6. Khi subscription háº¿t háº¡n, API AI Ã¡p dá»¥ng quota Free á»Ÿ request tiáº¿p theo. Worker chá»‰ há»— trá»£ thÃ´ng bÃ¡o háº¿t háº¡n.
7. Há»‡ thá»‘ng cÃ³ ba tier sáº£n pháº©m: `free`, `plus`, `care`; giÃ¡ vÃ  giá»›i háº¡n cá»¥ thá»ƒ náº±m trong Plan/Subscription snapshot, khÃ´ng hard-code theo tÃªn tier.
8. Free luÃ´n cÃ³ quyá»n nháº­p/xem HealthMetrics cá»§a chÃ­nh Patient, biá»ƒu Ä‘á»“ cÆ¡ báº£n, má»™t Care Program cÆ¡ báº£n, in-app notification, quota AI cÆ¡ báº£n vÃ  safety alert thiáº¿t yáº¿u.
9. Plus bao gá»“m Free vÃ  cÃ³ thá»ƒ cáº¥p nhiá»u Care Program, bÃ¡o cÃ¡o 7/30/90 ngÃ y, weekly AI summary, smart reminder/quiet hours, medication reminder, PDF/CSV vÃ  quota AI cao hÆ¡n theo Plan.
10. Care bao gá»“m Plus vÃ  cÃ³ thá»ƒ cáº¥p Doctor-assigned Program, Doctor review theo cadence, Priority Inbox, follow-up, nháº¯c tÃ¡i khÃ¡m vÃ  Æ°u Ä‘Ã£i giÃ¡ consultation theo Plan snapshot.
10a. Khi tÃ­nh nÄƒng NgÆ°á»i thÃ¢n Ä‘á»“ng hÃ nh P1 Ä‘Æ°á»£c báº­t, sá»‘ ngÆ°á»i thÃ¢n active láº¥y tá»« `familyLinkLimit` trong Plan snapshot; Care cÃ³ thá»ƒ máº·c Ä‘á»‹nh má»™t hoáº·c nhiá»u ngÆ°á»i, Plus cÃ³ thá»ƒ mua add-on. Entitlement chá»‰ cáº¥p sá»‘ lÆ°á»£ng liÃªn káº¿t, khÃ´ng ghi Ä‘Ã¨ consent hoáº·c má»Ÿ quyá»n xem dá»¯ liá»‡u chi tiáº¿t.
11. Doctor-reviewed/confirmed report chá»‰ xÃ¡c nháº­n Doctor Ä‘Ã£ xem bÃ¡o cÃ¡o; khÃ´ng Ä‘Æ°á»£c trÃ¬nh bÃ y thÃ nh cháº©n Ä‘oÃ¡n, Ä‘Æ¡n thuá»‘c hoáº·c báº£o Ä‘áº£m káº¿t quáº£ Ä‘iá»u trá»‹.
12. Nháº¯n tin Doctor chá»‰ tá»“n táº¡i trong Consultation Ä‘Æ°á»£c authorize. KhÃ´ng tier nÃ o máº·c Ä‘á»‹nh táº¡o chat 24/7 hoáº·c cam káº¿t pháº£n há»“i cáº¥p cá»©u.
13. DA2 chÆ°a cÃ³ Clinic/Clinic Admin vÃ  khÃ´ng quáº£ng bÃ¡ SLA pháº£n há»“i. Giao diá»‡n pháº£i nÃªu rÃµ Doctor khÃ´ng theo dÃµi realtime; SLA theo tá»• chá»©c chá»‰ Ä‘Æ°á»£c xem xÃ©t sau DA2 khi cÃ³ mÃ´ hÃ¬nh Clinic, giá» phá»¥c vá»¥, nhÃ¢n sá»±, escalation vÃ  cÆ¡ cháº¿ Ä‘o lÆ°á»ng.
14. Cáº£nh bÃ¡o `urgent`, safety template vÃ  quyá»n truy cáº­p dá»¯ liá»‡u cÆ¡ báº£n cá»§a Patient khÃ´ng Ä‘Æ°á»£c táº¯t khi háº¿t háº¡n, downgrade hoáº·c vÆ°á»£t quota AI.
15. Downgrade/háº¿t háº¡n khÃ´ng xÃ³a HealthMetrics, Care Alerts hoáº·c bÃ¡o cÃ¡o lá»‹ch sá»­. Quyá»n lá»£i tráº£ phÃ­ má»›i dá»«ng theo `paidThroughAt` vÃ  grace policy Ä‘Ã£ snapshot.
16. Giá»›i háº¡n lÆ°u lá»‹ch sá»­ theo tier chá»‰ Ä‘Æ°á»£c Ã¡p dá»¥ng sau privacy/retention review; khÃ´ng Ä‘Æ°á»£c lÃ m máº¥t quyá»n truy cáº­p/xuáº¥t dá»¯ liá»‡u tá»‘i thiá»ƒu cá»§a chÃ­nh Patient.
17. `ConsultationUsages` dÃ¹ng má»™t báº£n ghi cho má»—i Consultation trong má»™t chu ká»³ vÃ  cáº­p nháº­t nguyÃªn tá»­ theo vÃ²ng Ä‘á»i `reserved â†’ counted|released|expired`; khÃ³a chá»‘ng xá»­ lÃ½ trÃ¹ng báº£o Ä‘áº£m retry khÃ´ng Ä‘áº¿m má»™t Consultation nhiá»u láº§n. Má»—i láº§n Ä‘á»•i tráº¡ng thÃ¡i pháº£i ghi báº£n ghi báº¥t biáº¿n trong `AuditLogs` vá»›i `domain = billing`; DA2 khÃ´ng xÃ¢y event sourcing riÃªng.
18. Entitlement Ä‘Æ°á»£c kiá»ƒm tra phÃ­a backend. Client khÃ´ng Ä‘Æ°á»£c tá»± khai tier, AI quota, consultation limit, Doctor review hoáº·c quyá»n Care Program.
19. Plan tráº£ phÃ­ khÃ´ng Ä‘Æ°á»£c thay Ä‘á»•i Care Evaluation severity, thá»© tá»± Æ°u tiÃªn lÃ¢m sÃ ng hoáº·c quyá»n Ä‘Æ°á»£c nháº­n safety escalation.
20. Khi VNPAY chÆ°a náº±m trong cut-line, seed/demo subscription cÃ³ thá»ƒ dÃ¹ng Ä‘á»ƒ kiá»ƒm thá»­ entitlement nhÆ°ng pháº£i Ä‘Æ°á»£c Ä‘Ã¡nh dáº¥u rÃµ, khÃ´ng ghi nháº­n lÃ  doanh thu tháº­t.
21. Trong DA2, VNPAY Sandbox payment/subscription vÃ  cancel unpaid order lÃ  P0 báº¯t buá»™c; seed subscription khÃ´ng thay tháº¿ acceptance demo giao dá»‹ch Sandbox.
22. Full refund váº«n lÃ  P1 vÃ  chá»‰ Ä‘Æ°á»£c báº­t khi payment, IPN, cancel, entitlement vÃ  reconciliation Ä‘Ã£ Ä‘áº¡t release gate.
23. Sá»‘ consultation tá»‘i Ä‘a má»—i cycle máº·c Ä‘á»‹nh lÃ  Free `1`, Plus `3`, Care `6`. Field chuáº©n lÃ  `consultationLimitPerCycle` trong Plan/Subscription snapshot; Ä‘Ã¢y khÃ´ng pháº£i AI quota.
24. Plus/Care dÃ¹ng `currentPeriodStart/currentPeriodEnd` cá»§a Subscription. Free cÅ©ng táº¡o báº£n ghi `Subscriptions` vá»›i `source = free_grant` vÃ  chu ká»³ 30 ngÃ y neo táº¡i thá»i Ä‘iá»ƒm kÃ­ch hoáº¡t; khÃ´ng táº¡o PaymentOrder cho Free vÃ  khÃ´ng táº¡o Subscription má»›i má»—i chu ká»³. `ConsultationUsages` pháº£i gáº¯n chu ká»³ cá»¥ thá»ƒ, khÃ´ng reset toÃ n bá»™ ngÆ°á»i dÃ¹ng báº±ng má»™t cron chung.
25. `consultationsUsed` Ä‘áº¿m trá»±c tiáº¿p sá»‘ Consultation Ä‘Ã£ sá»­ dá»¥ng; sá»‘ cÃ²n láº¡i báº±ng limit trá»« sá»‘ Ä‘Ã£ dÃ¹ng vÃ  reservation Ä‘ang hoáº¡t Ä‘á»™ng.
26. Giá»›i háº¡n consultation khÃ´ng Ä‘á»“ng nghÄ©a phiÃªn miá»…n phÃ­ vÃ  khÃ´ng báº£o Ä‘áº£m Doctor cÃ²n slot. Chi phÃ­/Æ°u Ä‘Ã£i cá»§a tá»«ng phiÃªn lÃ  chÃ­nh sÃ¡ch giÃ¡ Ä‘á»™c láº­p trong Plan.
27. Add-on cÃ³ thá»ƒ tÄƒng consultation limit hiá»‡u dá»¥ng; add-on pháº£i cÃ³ source order, expiry, sá»‘ lÆ°á»£t bá»• sung vÃ  ledger idempotent.
28. Cáº£ scheduled vÃ  on-demand consultation dÃ¹ng chung má»™t limit. Pending on-demand request chÆ°a táº¡o reservation; reservation Ä‘Æ°á»£c táº¡o atomically khi Doctor accept.
29. Scheduled consultation táº¡o reservation khi booking Ä‘Æ°á»£c xÃ¡c nháº­n. Reservation pháº£i chá»‘ng race Ä‘á»ƒ hai request Ä‘á»“ng thá»i khÃ´ng vÆ°á»£t sá»‘ lÆ°á»£t cÃ²n láº¡i.
30. Consultation Ä‘Æ°á»£c count khi chuyá»ƒn `in_consultation`; Patient `no_show` cÅ©ng Ä‘Æ°á»£c count theo no-show policy. Doctor/system cancel hoáº·c Patient cancel Ä‘Ãºng háº¡n pháº£i há»§y reservation.
31. Retry, duplicate event hoáº·c reconnect khÃ´ng Ä‘Æ°á»£c count/há»§y reservation hai láº§n; ledger entry pháº£i gáº¯n `consultationId` vÃ  idempotency key.
32. Khi háº¿t sá»‘ lÆ°á»£t, Patient cÃ³ thá»ƒ chá» cycle má»›i, nÃ¢ng gÃ³i hoáº·c mua add-on. Safety alert váº«n hoáº¡t Ä‘á»™ng vÃ  tÃ¬nh huá»‘ng kháº©n cáº¥p pháº£i hÆ°á»›ng tá»›i cÆ¡ sá»Ÿ y táº¿/cáº¥p cá»©u.
33. AI chat dÃ¹ng `aiTokenLimit` lÃ m quota chÃ­nh, tÃ­nh trÃªn tá»•ng input + output token Ä‘Ã£ commit trong ká»³. `aiRequestLimit` lÃ  giá»›i háº¡n phá»¥ chá»‘ng spam vÃ  trÆ°á»ng há»£p request ráº¥t nhá»; summary job cÃ³ ngÃ¢n sÃ¡ch token riÃªng. CÃ¡c giá»›i háº¡n nÃ y khÃ´ng dÃ¹ng chung vá»›i consultation limit.
33a. TrÆ°á»›c khi gá»i model, Redis reserve `estimatedInputTokens + maxOutputTokens`; khi provider tráº£ káº¿t quáº£ thÃ¬ commit token thá»±c táº¿ vÃ o `AiUsageDaily` vÃ  release pháº§n dÆ°. Request lá»—i/timeout pháº£i release reservation; retry dÃ¹ng idempotency key Ä‘á»ƒ khÃ´ng trá»« token hai láº§n.
34. PaymentOrder dÃ¹ng state machine `created|pending|processing|paid|failed|expired|cancelled|refund_pending|refunded`; má»i transition lÃ  conditional, cÃ³ actor/source/time vÃ  audit. Timeout/unknown khÃ´ng Ä‘Æ°á»£c tá»± chuyá»ƒn thÃ nh failed náº¿u chÆ°a Ä‘á»‘i soÃ¡t provider.
35. Trong má»™t Mongo transaction, IPN há»£p lá»‡ upsert PaymentTransaction, chuyá»ƒn order sang paid vÃ  ghi Ä‘Ãºng má»™t `SubscriptionGrantRequested` OutboxEvent. KhÃ´ng gá»i VNPAY hoáº·c dá»‹ch vá»¥ ngoÃ i trong transaction.
36. Worker cáº¥p Subscription idempotent theo `sourceOrderId`/grant key. Lá»—i worker Ä‘Æ°á»£c retry; khÃ´ng táº¡o payment má»›i vÃ  khÃ´ng chuyá»ƒn order paid vá» pending.
37. Reconciliation pháº£i phÃ¡t hiá»‡n order processing quÃ¡ lÃ¢u, paid-without-grant, duplicate/mismatch provider reference vÃ  xÃ¡c minh láº¡i trÆ°á»›c thao tÃ¡c sá»­a tráº¡ng thÃ¡i.
38. DA2 khÃ´ng dÃ¹ng Saga framework vÃ¬ Payment, Subscription vÃ  Outbox náº±m trong má»™t modular monolith/MongoDB. Chá»‰ xem xÃ©t Saga khi cÃ¡c bÆ°á»›c thuá»™c service/database Ä‘á»™c láº­p vÃ  cáº§n compensation liÃªn dá»‹ch vá»¥.
39. Má»—i user chá»‰ cÃ³ má»™t Subscription `active`, Ä‘Æ°á»£c báº£o vá»‡ báº±ng partial unique index. KhÃ´ng Ä‘Æ°á»£c táº¡o hai gÃ³i active song song rá»“i cá»™ng quyá»n lá»£i.
40. Náº¿u Ä‘Ã£ cÃ³ PaymentOrder `created|pending|processing` cho cÃ¹ng user vÃ  cÃ¹ng thao tÃ¡c Ä‘á»•i gÃ³i, request láº·p pháº£i tráº£ láº¡i order hiá»‡n cÃ³; khÃ´ng táº¡o order má»›i.
41. Náº¿u user Ä‘ang dÃ¹ng Free, gÃ³i tráº£ phÃ­ Ä‘Ã£ thanh toÃ¡n Ä‘Æ°á»£c kÃ­ch hoáº¡t ngay trong transaction cáº¥p quyá»n vÃ  thay tháº¿ Free. Náº¿u Ä‘ang dÃ¹ng Plus/Care, mua cÃ¹ng gÃ³i hoáº·c Ä‘á»•i gÃ³i Ä‘Æ°á»£c lÃªn lá»‹ch cho chu ká»³ káº¿ tiáº¿p báº±ng `nextPlanId`, `nextPlanSnapshot`, `nextPlanOrderId`, `nextPlanStartsAt`; táº¡i má»™t thá»i Ä‘iá»ƒm chá»‰ cÃ³ má»™t thay Ä‘á»•i káº¿ tiáº¿p.
42. Khi Ä‘Ã£ cÃ³ thay Ä‘á»•i gÃ³i káº¿ tiáº¿p, láº§n mua má»›i bá»‹ tá»« chá»‘i cho tá»›i khi thay Ä‘á»•i cÅ© Ä‘Æ°á»£c há»§y theo policy hoáº·c Ä‘Ã£ cÃ³ hiá»‡u lá»±c. DA2 khÃ´ng prorate, khÃ´ng cá»™ng dá»“n hai Plan vÃ  khÃ´ng nÃ¢ng cáº¥p giá»¯a chu ká»³; chÃ­nh sÃ¡ch nÃ y pháº£i hiá»ƒn thá»‹ trÆ°á»›c thanh toÃ¡n.
43. Worker chuyá»ƒn chu ká»³ báº±ng conditional update: kiá»ƒm tra active subscription vÃ  `nextPlanStartsAt`, tÄƒng `cycleNumber`, Ã¡p dá»¥ng snapshot má»›i, xÃ³a cÃ¡c field `nextPlan*` vÃ  ghi `AuditLogs`. Retry khÃ´ng Ä‘Æ°á»£c chuyá»ƒn chu ká»³ hai láº§n.
44. `Plans` Ä‘Æ°á»£c version hÃ³a. Admin chá»‰ sá»­a version `draft`; publish táº¡o version bÃ¡n Ä‘Æ°á»£c vá»›i `effectiveFrom/effectiveUntil`. PaymentOrder vÃ  Subscription luÃ´n snapshot Plan Ä‘Ã£ publish, nÃªn sá»­a Plan má»›i khÃ´ng Ã¢m tháº§m Ä‘á»•i quyá»n lá»£i Ä‘Ã£ mua.

## Quáº£n lÃ½ cáº¥u hÃ¬nh há»‡ thá»‘ng vÃ  cáº¥u hÃ¬nh kinh doanh

1. ENV chá»‰ chá»©a secret/háº¡ táº§ng vÃ  hard ceiling ká»¹ thuáº­t, vÃ­ dá»¥ database URL, provider key, request timeout, batch size tá»‘i Ä‘a, token tá»‘i Ä‘a/request, sá»‘ consultation/family link tá»‘i Ä‘a há»‡ thá»‘ng. KhÃ´ng lÆ°u giÃ¡ hoáº·c quota tá»«ng gÃ³i trong ENV.
2. Admin UI quáº£n lÃ½ chÃ­nh sÃ¡ch kinh doanh cÃ³ version trong database: Plan price/duration, AI token/request limit, consultation limit, Care Program limit, family link limit vÃ  feature benefits.
3. Doctor chá»‰ sá»­a `bookingSettings` cá»§a mÃ¬nh trong min/max do há»‡ thá»‘ng quy Ä‘á»‹nh. Admin cÃ³ thá»ƒ thay default/range váº­n hÃ nh nhÆ°ng khÃ´ng sá»­a lá»‹ch Ä‘Ã£ booked vÃ¬ Consultation giá»¯ snapshot.
4. Clinical thresholds, Care Rules vÃ  safety templates náº±m trong database cÃ³ version vÃ  audit; khÃ´ng lÃ  ENV vÃ  khÃ´ng cho báº¥t ká»³ actor nÃ o sá»­a trá»±c tiáº¿p báº£n active/published.
5. State transition, authorization, cÃ´ng thá»©c quota vÃ  quy táº¯c má»™t active Subscription/má»™t `in_consultation` lÃ  invariant trong code/database constraint, khÃ´ng pháº£i cáº¥u hÃ¬nh Admin.
6. Má»i thay Ä‘á»•i cáº¥u hÃ¬nh qua Admin pháº£i validate hard ceiling, cÃ³ `effectiveFrom`, actor/reason vÃ  `AuditLogs`; thay Ä‘á»•i chá»‰ Ã¡p dá»¥ng cho dá»¯ liá»‡u/chu ká»³ má»›i trá»« khi cÃ³ migration Ä‘Æ°á»£c duyá»‡t rÃµ rÃ ng.

## ChÃ­nh sÃ¡ch hoÃ n tiá»n toÃ n pháº§n (P1)

1. DA2 chá»‰ há»— trá»£ hoÃ n toÃ n bá»™ tiá»n Ä‘Ãºng má»™t láº§n cho má»™t `PaymentOrder` Ä‘Ã£ thu tiá»n. KhÃ´ng há»— trá»£ hoÃ n má»™t pháº§n, nhiá»u láº§n, chargeback hoáº·c tá»± Ä‘á»™ng hoÃ n khi há»§y consultation.
2. Äiá»u kiá»‡n hoÃ n tiá»n khÃ´ng dÃ¹ng má»™t tá»· lá»‡ sá»­ dá»¥ng chung. Há»‡ thá»‘ng Ä‘Ã¡nh giÃ¡ riÃªng tá»«ng quyá»n lá»£i tráº£ phÃ­ theo `refundPolicy` cá»§a phiÃªn báº£n Plan Ä‘Ã£ Ä‘Æ°á»£c snapshot trong `PaymentOrders.orderSnapshot`.
3. YÃªu cáº§u thÃ´ng thÆ°á»ng chá»‰ há»£p lá»‡ khi ngÆ°á»i yÃªu cáº§u lÃ  chá»§ order, order Ä‘ang `paid`, cÃ²n trong `refundWindowHours` vÃ  chÆ°a cÃ³ refund lifecycle trÆ°á»›c Ä‘Ã³. Lá»—i thanh toÃ¡n/há»‡ thá»‘ng nhÆ° thu trÃ¹ng, Ä‘Ã£ thu nhÆ°ng khÃ´ng cáº¥p quyá»n hoáº·c cáº¥p sai quyá»n Ä‘Æ°á»£c Ä‘Æ°a vÃ o `review_required` thay vÃ¬ tá»± Ä‘á»™ng tá»« chá»‘i.
4. Khi nháº­n yÃªu cáº§u, há»‡ thá»‘ng chá»¥p `usageSnapshot` gá»“m AI token Ä‘Ã£ dÃ¹ng, consultation Ä‘ang giá»¯ chá»—/Ä‘Ã£ tÃ­nh lÆ°á»£t, Doctor review Ä‘Ã£ hoÃ n thÃ nh, bÃ¡o cÃ¡o tráº£ phÃ­ Ä‘Ã£ táº¡o vÃ  nhiá»‡m vá»¥ Care tráº£ phÃ­ Ä‘Ã£ hoÃ n thÃ nh. Quyá»n lá»£i Free vÃ  cáº£nh bÃ¡o an toÃ n khÃ´ng Ä‘Æ°á»£c tÃ­nh Ä‘á»ƒ cháº·n hoÃ n tiá»n.
5. Consultation má»›i chá»‰ `reserved` pháº£i Ä‘Æ°á»£c há»§y/giáº£i phÃ³ng reservation theo chÃ­nh sÃ¡ch consultation trÆ°á»›c khi xÃ©t hoÃ n tiá»n. Consultation Ä‘Ã£ `counted` hoáº·c `no_show`, Doctor review Ä‘Ã£ hoÃ n thÃ nh vÃ  Ä‘áº§u ra tráº£ phÃ­ Ä‘Ã£ phÃ¡t sinh Ä‘Æ°á»£c so vá»›i tá»«ng ngÆ°á»¡ng trong policy; khÃ´ng quy Ä‘á»•i táº¥t cáº£ thÃ nh má»™t pháº§n trÄƒm mÆ¡ há»“.
6. Transaction táº¡o request pháº£i chuyá»ƒn order `paid -> refund_pending`, táº¡o `PaymentRefunds`, lÆ°u policy/usage snapshot vÃ  táº¡m dá»«ng viá»‡c táº¡o hÃ nh Ä‘á»™ng tráº£ phÃ­ má»›i. Patient váº«n truy cáº­p dá»¯ liá»‡u cá»§a mÃ¬nh, quyá»n Free vÃ  safety alert.
7. Ngay trÆ°á»›c khi Admin duyá»‡t, backend pháº£i chá»¥p `finalUsageSnapshot` vÃ  Ä‘Ã¡nh giÃ¡ láº¡i Ä‘á»ƒ ngÄƒn race giá»¯a sá»­ dá»¥ng dá»‹ch vá»¥ vÃ  duyá»‡t refund. Náº¿u khÃ´ng cÃ²n Ä‘á»§ Ä‘iá»u kiá»‡n thÃ¬ khÃ´ng gá»i provider; request bá»‹ reject hoáº·c chuyá»ƒn `review_required` theo reason code.
8. Má»i refund cáº§n Admin duyá»‡t. Admin chá»‰ Ä‘Æ°á»£c override ngÆ°á»¡ng sá»­ dá»¥ng cho trÆ°á»ng há»£p ngoáº¡i lá»‡ cÃ³ lÃ½ do; khÃ´ng Ä‘Æ°á»£c bá» qua invariant sá»‘ tiá»n khÃ´ng vÆ°á»£t khoáº£n Ä‘Ã£ thu, Ä‘Ãºng giao dá»‹ch provider, má»™t refund lifecycle/order vÃ  idempotency. Quyáº¿t Ä‘á»‹nh/override pháº£i vÃ o `AuditLogs` vá»›i `domain = billing`.
9. Worker gá»i VNPAY ngoÃ i MongoDB transaction vÃ  giá»¯ nguyÃªn `providerRequestId` khi retry. Timeout/káº¿t quáº£ khÃ´ng xÃ¡c Ä‘á»‹nh chuyá»ƒn `manual_review`; pháº£i query/reconcile provider trÆ°á»›c láº§n gá»i tiáº¿p theo.
10. Chá»‰ khi provider xÃ¡c nháº­n thÃ nh cÃ´ng má»›i chuyá»ƒn refund sang `succeeded`, order sang `refunded` vÃ  há»§y Ä‘Ãºng Subscription grant. Khi reject hoáº·c provider failure Ä‘Ã£ cÃ³ káº¿t luáº­n, order trá»Ÿ vá» `paid` vÃ  quyá»n lá»£i tráº£ phÃ­ Ä‘Æ°á»£c má»Ÿ láº¡i.
11. `refundPolicy` lÃ  cáº¥u hÃ¬nh nghiá»‡p vá»¥ cÃ³ version do Admin quáº£n lÃ½ trong Plan draft rá»“i publish; sá»­a Plan khÃ´ng há»“i tá»‘ order cÅ©. ENV chá»‰ giá»¯ feature flag/kill switch, provider timeout, sá»‘ láº§n retry vÃ  hard ceiling ká»¹ thuáº­t.
12. GiÃ¡ trá»‹ seed khuyáº¿n nghá»‹ Ä‘á»ƒ review sáº£n pháº©m lÃ  `refundType = full_only`, `refundWindowHours = 168`, má»i ngÆ°á»¡ng sá»­ dá»¥ng tráº£ phÃ­ báº±ng `0`, `requireAdminApproval = true`. ÄÃ¢y lÃ  máº·c Ä‘á»‹nh ká»¹ thuáº­t, pháº£i Ä‘Æ°á»£c chá»§ sáº£n pháº©m rÃ  soÃ¡t trÆ°á»›c khi phÃ¡t hÃ nh vÃ  khÃ´ng thay tháº¿ Ä‘iá»u khoáº£n phÃ¡p lÃ½.

## Notification, Outbox vÃ  worker

1. Notifications lÃ  inbox hiá»ƒn thá»‹ trong app; OutboxEvents lÃ  hÃ ng Ä‘á»£i sá»± kiá»‡n bá»n vá»¯ng Ä‘á»ƒ worker gá»­i Socket.IO, FCM hoáº·c email.
2. Thay Ä‘á»•i nghiá»‡p vá»¥ quan trá»ng pháº£i táº¡o entity chÃ­nh, notification vÃ  outbox event trong cÃ¹ng MongoDB transaction.
3. Worker claim OutboxEvents theo status pending vÃ  available at, gá»­i theo channel phÃ¹ há»£p, sau Ä‘Ã³ Ä‘Ã¡nh dáº¥u completed, retry failed hoáº·c dead khi háº¿t sá»‘ láº§n thá»­.
4. BullMQ dÃ¹ng Redis cho delayed jobs: nháº¯c lá»‹ch 24 giá» vÃ  15 phÃºt trÆ°á»›c cuá»™c háº¹n, gá»­i campaign theo batch vÃ  retry tÃ¡c vá»¥ ngoÃ i há»‡ thá»‘ng.
5. Broadcast campaign pháº£i Ä‘Æ°á»£c worker fan-out theo batch; khÃ´ng táº¡o toÃ n bá»™ notification trong HTTP request cá»§a admin.
6. Gá»­i cho má»™t user: táº¡o trá»±c tiáº¿p má»™t `Notifications` vÃ  má»™t OutboxEvent trong cÃ¹ng transaction. Gá»­i cho danh sÃ¡ch/nhÃ³m/táº¥t cáº£: táº¡o `NotificationCampaigns` vá»›i `targetType = individual|segment|all`, Ä‘Ã³ng bÄƒng `targetFilter` vÃ  `audienceSnapshotAt`, sau Ä‘Ã³ worker táº¡o má»™t `Notifications` cho tá»«ng ngÆ°á»i nháº­n theo batch.
7. `Notifications` lÃ  tráº¡ng thÃ¡i inbox riÃªng cá»§a tá»«ng user, vÃ¬ váº­y Ä‘á»c/xÃ³a cá»§a ngÆ°á»i nÃ y khÃ´ng áº£nh hÆ°á»Ÿng ngÆ°á»i khÃ¡c. `uniqueKey` chá»‘ng táº¡o trÃ¹ng khi worker retry; `delivery` lÆ°u tráº¡ng thÃ¡i tá»«ng kÃªnh in-app/push/email.
8. `segment` chá»‰ dÃ¹ng bá»™ lá»c allowlist nhÆ° role, Plan, Care Program hoáº·c khu vá»±c. KhÃ´ng nháº­n Mongo filter thÃ´ tá»« client; má»i campaign cáº§n hard cap/batch/cursor vÃ  quyá»n Admin phÃ¹ há»£p.

## Quy táº¯c váº­n hÃ nh vÃ  dá»¯ liá»‡u

1. MongoDB transaction cáº§n Atlas hoáº·c MongoDB replica set. Local development pháº£i cháº¡y replica set Ä‘á»ƒ test transaction.
2. Redis lÃ  cache, presence, quota vÃ  hÃ ng Ä‘á»£i job; MongoDB lÃ  nguá»“n dá»¯ liá»‡u nghiá»‡p vá»¥ chÃ­nh.
3. KhÃ´ng lÆ°u secret, plaintext refresh token, OTP plaintext hoáº·c khÃ³a VNPAY trong database.
4. Táº¥t cáº£ thá»i gian lÆ°u UTC; timezone chá»‰ dÃ¹ng Ä‘á»ƒ hiá»ƒn thá»‹ vÃ  kiá»ƒm tra lá»‹ch cá»§a bÃ¡c sÄ© hoáº·c bá»‡nh nhÃ¢n.
5. CÃ¡c enum, thá»i háº¡n vÃ  limit trong tÃ i liá»‡u nÃ y pháº£i Ä‘Æ°á»£c Ä‘áº·t thÃ nh cáº¥u hÃ¬nh, khÃ´ng hard-code ráº£i rÃ¡c trong service.



## Product and architecture overview

# Healthcare Application â€” Tá»•ng quan sáº£n pháº©m DA2

## 1. Má»¥c Ä‘Ã­ch tÃ i liá»‡u

TÃ i liá»‡u mÃ´ táº£ pháº¡m vi sáº£n pháº©m, nghiá»‡p vá»¥, kiáº¿n trÃºc vÃ  tráº¡ng thÃ¡i chuyá»ƒn Ä‘á»•i cá»§a Healthcare Application tá»« DA1 sang DA2. Nguá»“n chuáº©n Ä‘i kÃ¨m:

- Nghiá»‡p vá»¥/command contract Chronic Care: ADR-0002, sau Ä‘Ã³ lÃ  `docs/BUSINESS_RULES.md`.
- Dá»¯ liá»‡u Ä‘Ã£ triá»ƒn khai trÆ°á»›c migration: `docs/db-template-v7.dbml`; target schema DA2 Ä‘Ã£ duyá»‡t: `docs/db-template-v8.dbml`.
- Káº¿ hoáº¡ch implementation Chronic Care: `plan/chronic-care-plan.md`; `plan/refactor-plan.md` chá»‰ giá»¯ dependency/refactor/cut-line tá»•ng quan.
- Há»£p Ä‘á»“ng tÃ­ch há»£p frontend: `docs/fe-integration.md`.

DA2 Ä‘Æ°á»£c triá»ƒn khai trong giai Ä‘oáº¡n 09/2026â€“12/2026, deadline má»¥c tiÃªu 31/12/2026. Nhá»¯ng chá»©c nÄƒng Ä‘Æ°á»£c mÃ´ táº£ lÃ  **má»¥c tiÃªu cá»§a phiÃªn báº£n DA2**, khÃ´ng máº·c Ä‘á»‹nh Ä‘Ã£ tá»“n táº¡i trong code DA1.

## 2. Äá»‹nh vá»‹ sáº£n pháº©m

Healthcare Application Ä‘Æ°á»£c Ä‘á»‹nh vá»‹ thÃ nh **HealthAI Chronic Care â€” ná»n táº£ng theo dÃµi vÃ  há»— trá»£ chÄƒm sÃ³c bá»‡nh máº¡n tá»« xa**, khÃ´ng pháº£i há»‡ thá»‘ng khÃ¡m bá»‡nh, cháº©n Ä‘oÃ¡n hoáº·c thay tháº¿ cÆ¡ sá»Ÿ y táº¿. MVP báº¯t buá»™c cÃ³ hai Care Program dÃ¹ng chung Program engine: tÄƒng huyáº¿t Ã¡p vÃ  tiá»ƒu Ä‘Æ°á»ng.

Sáº£n pháº©m há»— trá»£:

- Bá»‡nh nhÃ¢n theo dÃµi chá»‰ sá»‘ sá»©c khá»e vÃ  nháº­n cáº£nh bÃ¡o tham kháº£o.
- Bá»‡nh nhÃ¢n tham gia Care Program, nháº­n lá»‹ch Ä‘o vÃ  xem má»©c Ä‘á»™ hoÃ n thÃ nh theo dÃµi.
- á»ž pháº¡m vi P1, bá»‡nh nhÃ¢n cÃ³ thá»ƒ má»i má»™t hoáº·c nhiá»u ngÆ°á»i thÃ¢n Ä‘á»“ng hÃ nh trong giá»›i háº¡n `familyLinkLimit` Ä‘á»ƒ nháº­n lá»i nháº¯c chung khi bá»‡nh nhÃ¢n bá» lá»¡ hoáº¡t Ä‘á»™ng theo dÃµi, trÃªn cÆ¡ sá»Ÿ Ä‘á»“ng Ã½ vÃ  quyá»n chia sáº» do bá»‡nh nhÃ¢n kiá»ƒm soÃ¡t.
- Rule engine version hÃ³a phÃ¢n táº§ng `normal|attention|urgent` vá»›i lÃ½ do giáº£i thÃ­ch Ä‘Æ°á»£c; káº¿t quáº£ khÃ´ng pháº£i cháº©n Ä‘oÃ¡n.
- BÃ¡c sÄ© theo dÃµi Priority Inbox vÃ  bÃ¡o cÃ¡o 7/30 ngÃ y thay vÃ¬ Ä‘á»c toÃ n bá»™ dá»¯ liá»‡u thÃ´.
- Bá»‡nh nhÃ¢n chá»§ Ä‘á»™ng Ä‘áº·t lá»‹ch theo slot bÃ¡c sÄ© Ä‘Ã£ má»Ÿ.
- á»ž má»©c P1, bá»‡nh nhÃ¢n tÃ¬m cÆ¡ sá»Ÿ y táº¿ theo chÆ°Æ¡ng trÃ¬nh theo dÃµi/chuyÃªn khoa vÃ  vá»‹ trÃ­; danh má»¥c ná»™i bá»™ Ä‘Ã£ kiá»ƒm duyá»‡t lÃ  nguá»“n chÃ­nh, dá»‹ch vá»¥ báº£n Ä‘á»“ chá»‰ bá»• sung khi thiáº¿u káº¿t quáº£.
- Bá»‡nh nhÃ¢n gá»­i yÃªu cáº§u tÆ° váº¥n nhanh theo cÆ¡ cháº¿ on-demand.
- BÃ¡c sÄ© tiáº¿p nháº­n yÃªu cáº§u, quáº£n lÃ½ lá»‹ch, hÃ ng Ä‘á»£i vÃ  tÆ° váº¥n qua chat/audio/video.
- AI cung cáº¥p thÃ´ng tin, tÃ³m táº¯t vÃ  truy xuáº¥t tri thá»©c RAG; khÃ´ng tá»± Ä‘Æ°a ra cháº©n Ä‘oÃ¡n.
- GÃ³i há»™i viÃªn vÃ  quota kiá»ƒm soÃ¡t quyá»n lá»£i AI.
- Ba tier `Free`, `Plus`, `Care` láº§n lÆ°á»£t phá»¥c vá»¥ theo dÃµi cÆ¡ báº£n, tá»± theo dÃµi nÃ¢ng cao vÃ  chÆ°Æ¡ng trÃ¬nh cÃ³ Doctor Ä‘á»“ng hÃ nh. Clinic/Clinic Admin chÆ°a thuá»™c pháº¡m vi DA2.
- Má»i enrollment Ä‘á»u báº¯t buá»™c Doctor assignment Ä‘á»ƒ xÃ¡c Ä‘á»‹nh ownership; chá»‰ tier Care máº·c Ä‘á»‹nh cÃ³ quyá»n lá»£i Doctor review theo cadence Ä‘Ã£ snapshot.
- Thanh toÃ¡n, cancel payment order vÃ  full refund cÃ³ quáº£n trá»‹ viÃªn duyá»‡t.
- Quáº£n trá»‹ ngÆ°á»i dÃ¹ng, há»“ sÆ¡ bÃ¡c sÄ©, tri thá»©c AI, billing vÃ  bÃ¡o cÃ¡o vi pháº¡m.

Khi cÃ³ dáº¥u hiá»‡u kháº©n cáº¥p, há»‡ thá»‘ng pháº£i hÆ°á»›ng ngÆ°á»i dÃ¹ng tá»›i cÆ¡ sá»Ÿ y táº¿ hoáº·c dá»‹ch vá»¥ cáº¥p cá»©u phÃ¹ há»£p, khÃ´ng tiáº¿p tá»¥c mÃ´ phá»ng cháº©n Ä‘oÃ¡n.

## 3. Vai trÃ² vÃ  kÃªnh sá»­ dá»¥ng

| Vai trÃ² | Web Client | Mobile | Web Admin |
|---|---|---|---|
| Patient | Theo dÃµi sá»©c khá»e, tÃ¬m bÃ¡c sÄ©, Ä‘áº·t lá»‹ch, on-demand, queue, chat/call, AI, billing | Critical patient flows, FCM vÃ  secure token storage | KhÃ´ng |
| Doctor | Care Program, Priority Inbox, dashboard, slot, request, queue, chat/call, há»“ sÆ¡ vÃ  review | Critical doctor flows, FCM vÃ  call foreground | KhÃ´ng |
| Admin | KhÃ´ng dÃ¹ng client cho nghiá»‡p vá»¥ quáº£n trá»‹ | NgoÃ i MVP | Dashboard, users, doctor verification, AI knowledge, plans, payments/refunds, moderation |

Frontend sáº½ Ä‘Æ°á»£c tÃ¡ch thÃ nh repository riÃªng gá»“m:

```text
healthcare-frontend/
â”œâ”€â”€ apps/web-client
â”œâ”€â”€ apps/web-admin
â”œâ”€â”€ apps/mobile
â””â”€â”€ packages/
    â”œâ”€â”€ ui
    â”œâ”€â”€ api-client
    â””â”€â”€ realtime-contracts
```

Backend trá»Ÿ thÃ nh repository NestJS Ä‘á»™c láº­p. REST types phÃ­a frontend Ä‘Æ°á»£c sinh tá»« OpenAPI; frontend khÃ´ng import trá»±c tiáº¿p Mongoose schemas hoáº·c domain source cá»§a backend.

## 4. Chá»©c nÄƒng theo vai trÃ²

### 4.1 Patient

- ÄÄƒng kÃ½ local hoáº·c OAuth, xÃ¡c thá»±c email, Ä‘Äƒng nháº­p vÃ  quáº£n lÃ½ phiÃªn.
- Quáº£n lÃ½ há»“ sÆ¡, avatar vÃ  thÃ´ng tin liÃªn há»‡.
- Xem danh sÃ¡ch bÃ¡c sÄ© active + approved vÃ  há»“ sÆ¡ chuyÃªn mÃ´n.
- Xem AvailabilitySlots vÃ  Ä‘áº·t lá»‹ch chá»§ Ä‘á»™ng.
- Gá»­i on-demand request cho bÃ¡c sÄ© khi khÃ´ng chá»n slot.
- Há»§y consultation theo policy; check-in vÃ  theo dÃµi vá»‹ trÃ­ hÃ ng Ä‘á»£i.
- Chat, gá»­i tá»‡p/hÃ¬nh áº£nh vÃ  tham gia audio/video call khi consultation cho phÃ©p.
- Nháº­p, sá»­a, xÃ³a vÃ  xem biá»ƒu Ä‘á»“ HealthMetrics.
- Tham gia Care Program, xem nhiá»‡m vá»¥ Ä‘o, má»©c Ä‘á»™ hoÃ n thÃ nh vÃ  bÃ¡o cÃ¡o 7/30 ngÃ y.
- Má»i, xÃ¡c nháº­n, sá»­a hoáº·c thu há»“i quyá»n cá»§a ngÆ°á»i thÃ¢n Ä‘á»“ng hÃ nh trong giá»›i háº¡n `familyLinkLimit`; chá»n nháº­n lá»i nháº¯c bá» lá»¡ nhiá»‡m vá»¥ mÃ  khÃ´ng cáº§n chia sáº» chá»‰ sá»‘ sá»©c khá»e chi tiáº¿t.
- Nháº­n Care Alert cÃ³ lÃ½ do rÃµ rÃ ng vÃ  chuyá»ƒn sang Ä‘áº·t lá»‹ch/on-demand consultation khi cáº§n.
- TÃ¬m cÆ¡ sá»Ÿ y táº¿ theo chuyÃªn khoa, Ä‘á»‹a Ä‘iá»ƒm vÃ  khoáº£ng cÃ¡ch; xem lÃ½ do gá»£i Ã½, nguá»“n dá»¯ liá»‡u vÃ  liÃªn káº¿t chá»‰ Ä‘Æ°á»ng. Káº¿t quáº£ khÃ´ng pháº£i khuyáº¿n nghá»‹ vá» cháº¥t lÆ°á»£ng chuyÃªn mÃ´n.
- Há»i AI, xem citation/lá»‹ch sá»­ vÃ  pháº§n trÄƒm quota token cÃ²n láº¡i.
- Xem Plans, táº¡o PaymentOrder, theo dÃµi káº¿t quáº£ thanh toÃ¡n vÃ  Subscription.
- Cancel order chÆ°a thanh toÃ¡n; gá»­i full-refund request cho order Ä‘Ã£ paid.
- Review bÃ¡c sÄ© sau consultation completed vÃ  gá»­i ViolationReport.
- Nháº­n notification trong app vÃ  FCM trÃªn mobile.

### 4.2 Doctor

- ÄÄƒng kÃ½, cáº­p nháº­t DoctorProfile vÃ  táº£i tÃ i liá»‡u xÃ¡c minh.
- Chá»‰ doctor `active + approved` Ä‘Æ°á»£c má»Ÿ slot, nháº­n request hoáº·c báº¯t Ä‘áº§u tÆ° váº¥n.
- Táº¡o, block vÃ  quáº£n lÃ½ AvailabilitySlots.
- Accept/decline on-demand request.
- Theo dÃµi patient Ä‘Ã£ check-in, gá»i ngÆ°á»i tiáº¿p theo báº±ng thao tÃ¡c atomic vÃ  xá»­ lÃ½ no-show.
- Chat/call trong consultation Ä‘Æ°á»£c authorize.
- Xem health context cá»§a patient trong pháº¡m vi consultation.
- Enroll Patient vÃ o Care Program Ä‘Ã£ duyá»‡t; xem Priority Inbox vÃ  xá»­ lÃ½ Care Alert Ä‘Æ°á»£c phÃ¢n cÃ´ng.
- Xem bÃ¡o cÃ¡o xu hÆ°á»›ng xÃ¡c Ä‘á»‹nh vÃ  AI summary trÆ°á»›c consultation; AI khÃ´ng quyáº¿t Ä‘á»‹nh severity.
- Ghi consultation note, hoÃ n táº¥t phiÃªn vÃ  xem review.
- Nháº­n notification vá» request, queue, lá»‹ch, message vÃ  verification.

### 4.3 Admin

- Xem dashboard tá»•ng há»£p tá»« endpoint chuyÃªn dá»¥ng, khÃ´ng táº£i toÃ n bá»™ collection vá» trÃ¬nh duyá»‡t Ä‘á»ƒ tá»± Ä‘áº¿m.
- TÃ¬m kiáº¿m, lá»c, khÃ³a/má»Ÿ khÃ³a tÃ i khoáº£n vÃ  xem audit liÃªn quan.
- Approve/reject há»“ sÆ¡ bÃ¡c sÄ© kÃ¨m lÃ½ do.
- Quáº£n lÃ½ Plans vÃ  tráº¡ng thÃ¡i hiá»ƒn thá»‹.
- Xem PaymentOrders, PaymentTransactions vÃ  tráº¡ng thÃ¡i Ä‘á»‘i soÃ¡t.
- Review/approve/reject PaymentRefunds; provider call do worker thá»±c hiá»‡n.
- Quáº£n lÃ½ tÃ i liá»‡u RAG vÃ  blacklist keywords.
- Admin táº¡o/chá»‰nh draft Care Program vÃ  Rule theo permission, publish/retire Program vÃ  retire Rule; má»i Doctor `active + approved` cÃ³ thá»ƒ activate Rule version sau server validation, khÃ´ng cÃ³ bÆ°á»›c duyá»‡t riÃªng.
- Xá»­ lÃ½ ViolationReports theo workflow bá»‘n tráº¡ng thÃ¡i.
- Táº¡o vÃ  theo dÃµi NotificationCampaigns náº¿u cÃ²n trong release cut-line.

## 5. Nghiá»‡p vá»¥ cá»‘t lÃµi

### 5.1 Identity vÃ  OAuth

1. Má»™t tÃ i khoáº£n náº±m trong `Users`; doctor/admin profile chá»‰ lÃ  dá»¯ liá»‡u theo vai trÃ².
2. TÃ i khoáº£n OAuth Ä‘Æ°á»£c Ã¡nh xáº¡ qua `OAuthAccounts`; tÃ i khoáº£n OAuth-only cÃ³ thá»ƒ khÃ´ng cÃ³ `passwordHash`.
3. OTP hash, attempts vÃ  TTL náº±m trong Redis, khÃ´ng náº±m trong Users.
4. Refresh token chá»‰ lÆ°u hash trong `AuthSessions`, cÃ³ rotation theo `familyId` vÃ  phÃ¡t hiá»‡n replay.
5. Password change, logout-all hoáº·c account ban pháº£i revoke session liÃªn quan.
6. OAuth dÃ¹ng state, callback allowlist vÃ  PKCE khi phÃ¹ há»£p.

### 5.2 Scheduled consultation

```mermaid
sequenceDiagram
    participant P as Patient
    participant API as NestJS API
    participant DB as MongoDB
    participant W as Worker
    P->>API: Xem slot available
    P->>API: Book slot + Idempotency-Key
    API->>DB: Transaction claim slot + create Consultation + OutboxEvent
    DB-->>API: Consultation accepted/not_started
    API-->>P: Booking confirmed
    W->>P: Reminder 24h/15m
    P->>API: Check-in trong cá»­a sá»• há»£p lá»‡
    API->>DB: sessionStatus=waiting, queuePriorityAt Ä‘Æ°á»£c gÃ¡n
```

- Patient chá»‰ Ä‘Æ°á»£c chá»n slot do doctor táº¡o sáºµn; khÃ´ng gá»­i `scheduledAt` tÃ¹y Ã½.
- Claim slot lÃ  atomic, má»™t slot chá»‰ táº¡o tá»‘i Ä‘a má»™t consultation.
- Cancel Ä‘Ãºng policy má»Ÿ láº¡i slot náº¿u slot váº«n cÃ²n há»£p lá»‡.
- Scheduled instant booking cÃ³ `requestStatus=accepted` ngay sau transaction.

### 5.3 On-demand consultation

```mermaid
stateDiagram-v2
    [*] --> pending: Patient gá»­i request
    pending --> accepted: Doctor accept
    pending --> declined: Doctor decline
    pending --> cancelled: Patient cancel
    pending --> expired: requestExpiresAt
    accepted --> waiting: Check-in/join queue
    accepted --> cancelled: Má»™t bÃªn há»§y há»£p lá»‡
    waiting --> in_consultation: Doctor call-next atomically
    waiting --> no_show: QuÃ¡ háº¡n
    in_consultation --> interrupted: Máº¥t heartbeat/káº¿t ná»‘i
    interrupted --> in_consultation: Doctor resume
    interrupted --> completed: Doctor hoÃ n táº¥t cÃ³ lÃ½ do
    in_consultation --> completed: Doctor hoÃ n táº¥t
```

- Má»™t patient chá»‰ cÃ³ tá»‘i Ä‘a má»™t on-demand request pending tá»›i cÃ¹ng doctor.
- Doctor chá»‰ cÃ³ tá»‘i Ä‘a má»™t consultation `in_consultation`.
- `scheduledEndAt` lÃ  má»‘c dá»± kiáº¿n, khÃ´ng tá»± Ä‘á»™ng hoÃ n táº¥t phiÃªn. Doctor káº¿t thÃºc; worker chá»‰ Ä‘Æ°á»£c chuyá»ƒn phiÃªn máº¥t heartbeat sang `interrupted`.
- `requestStatus` mÃ´ táº£ vÃ²ng Ä‘á»i yÃªu cáº§u; `sessionStatus` mÃ´ táº£ vÃ²ng Ä‘á»i phiÃªn thá»±c táº¿.
- KhÃ´ng dÃ¹ng `active` cho nhiá»u nghÄ©a vÃ  khÃ´ng dÃ¹ng `rejected` Ä‘á»ƒ biá»ƒu diá»…n cancel.

### 5.4 HÃ ng Ä‘á»£i

HÃ ng Ä‘á»£i lÃ  truy váº¥n nghiá»‡p vá»¥ tá»« `Consultations`, khÃ´ng pháº£i BullMQ queue. Má»™t item náº±m trong queue khi:

```text
requestStatus = accepted
sessionStatus = waiting
queueJoinedAt != null
queuePriorityAt != null
```

Scheduled vÃ  on-demand dÃ¹ng chung hÃ ng Ä‘á»£i theo Doctor. Æ¯u tiÃªn láº§n lÆ°á»£t: scheduled quÃ¡ giá», scheduled Ä‘Ã£ Ä‘áº¿n cá»­a sá»• phá»¥c vá»¥, rá»“i on-demand accepted theo thá»i Ä‘iá»ƒm vÃ o hÃ ng Ä‘á»£i. On-demand chá»‰ Ä‘Æ°á»£c gá»i trong khoáº£ng trá»‘ng náº¿u thá»i lÆ°á»£ng dá»± kiáº¿n cá»™ng buffer khÃ´ng Ä‘Ã¨ lÃªn scheduled káº¿ tiáº¿p. `queuePriorityAt` lÃ  khÃ³a sáº¯p xáº¿p á»•n Ä‘á»‹nh; `call-next` dÃ¹ng conditional update/transaction Ä‘á»ƒ hai request Ä‘á»“ng thá»i khÃ´ng claim cÃ¹ng má»™t consultation.

### 5.5 Chat, call vÃ  review

- Message gáº¯n vá»›i `consultationId`; server kiá»ƒm tra participant trÆ°á»›c read/send/join room.
- `clientMessageId` chá»‘ng táº¡o message trÃ¹ng khi client retry.
- Socket.IO phá»¥c vá»¥ chat, notification, queue update vÃ  WebRTC signaling.
- WebRTC media Ä‘i peer-to-peer/TURN; database chá»‰ lÆ°u metadata báº¯t Ä‘áº§u/káº¿t thÃºc vÃ  consent.
- `callEndedAt` ghi cuá»™c gá»i Ä‘Ã£ dá»«ng; `completedAt` chá»‰ Ä‘Æ°á»£c ghi khi Doctor xÃ¡c nháº­n hoÃ n táº¥t consultation/note. QuÃ¡ thá»i lÆ°á»£ng chá»‰ táº¡o cáº£nh bÃ¡o/overtime, khÃ´ng tá»± complete.
- Patient chá»‰ review consultation cá»§a mÃ¬nh sau khi completed; má»™t consultation cÃ³ tá»‘i Ä‘a má»™t review.
- Rating summary cá»§a doctor Ä‘Æ°á»£c cáº­p nháº­t trong transaction vÃ  cÃ³ job Ä‘á»‘i soÃ¡t.

### 5.6 Chronic Care, Health tracking vÃ  AI

- HealthMetrics lÆ°u theo UTC; timezone dÃ¹ng cho hiá»ƒn thá»‹.
- Care Program xÃ¡c Ä‘á»‹nh loáº¡i metric, táº§n suáº¥t Ä‘o, timezone, thá»i háº¡n vÃ  rule set Ã¡p dá»¥ng.
- Monitoring task Ä‘Æ°á»£c hoÃ n thÃ nh bá»Ÿi HealthMetric há»£p lá»‡; adherence chá»‰ pháº£n Ã¡nh má»©c Ä‘á»™ hoÃ n thÃ nh theo dÃµi, khÃ´ng pháº£i tuÃ¢n thá»§ Ä‘iá»u trá»‹.
- Alert threshold/rule chá»‰ lÃ  cáº£nh bÃ¡o tham kháº£o. Rule engine lÃ  deterministic, version hÃ³a vÃ  tráº£ vá» reason codes; AI khÃ´ng Ä‘Æ°á»£c táº¡o hoáº·c thay Ä‘á»•i severity.
- Care Alert `urgent` pháº£i hiá»ƒn thá»‹ hÃ nh Ä‘á»™ng an toÃ n tá»« template Ä‘Ã£ duyá»‡t vÃ  khÃ´ng chá» LLM.
- NgÆ°á»i thÃ¢n Ä‘á»“ng hÃ nh lÃ  tÃ­nh nÄƒng P1, khÃ´ng pháº£i vai trÃ² y táº¿ má»›i: ngÆ°á»i thÃ¢n Ä‘Äƒng kÃ½ tÃ i khoáº£n Patient bÃ¬nh thÆ°á»ng, Ä‘Äƒng nháº­p báº±ng cÆ¡ cháº¿ sáºµn cÃ³ rá»“i xÃ¡c nháº­n liÃªn káº¿t do Patient má»i. NgÆ°á»i thÃ¢n chá»‰ nháº­n nháº¯c nhá»Ÿ chung sau khi Patient bá» lá»¡ nhiá»‡m vá»¥ quÃ¡ khoáº£ng thá»i gian cáº¥u hÃ¬nh; máº·c Ä‘á»‹nh khÃ´ng xem HealthMetrics, ná»™i dung AI, consultation hoáº·c Care Alert.
- Patient luÃ´n Ä‘Æ°á»£c nháº¯c trÆ°á»›c. ThÃ´ng bÃ¡o cho contact khÃ´ng chá»©a chá»‰ sá»‘, cháº©n Ä‘oÃ¡n hay lÃ½ do cáº£nh bÃ¡o; má»i consent, thay Ä‘á»•i quyá»n, gá»­i thÃ´ng bÃ¡o vÃ  thu há»“i quyá»n pháº£i audit. `urgent` khÃ´ng biáº¿n contact thÃ nh kÃªnh cáº¥p cá»©u; chá»‰ thÃ´ng bÃ¡o contact náº¿u Patient báº­t lá»±a chá»n riÃªng.
- TÃ¬m cÆ¡ sá»Ÿ y táº¿ P1 nháº­n Ä‘áº§u vÃ o lÃ  Program/bá»‡nh Ä‘Æ°á»£c chá»n rÃµ rÃ ng hoáº·c chuyÃªn khoa Ä‘Æ°á»£c duyá»‡t cÃ¹ng khu vá»±c/vá»‹ trÃ­ do Patient chá»n. Há»‡ thá»‘ng dÃ¹ng `DiseaseSpecialties` do Admin duyá»‡t, lá»c `MedicalFacilities` Ä‘Ã£ xÃ¡c minh, rá»“i sáº¯p xáº¿p xÃ¡c Ä‘á»‹nh theo má»©c khá»›p chuyÃªn khoa vÃ  khoáº£ng cÃ¡ch. Khi dá»¯ liá»‡u ná»™i bá»™ chÆ°a Ä‘á»§, backend gá»i API báº£n Ä‘á»“; Admin pháº£i chá»n káº¿t quáº£, táº¡o báº£n nhÃ¡p vÃ  kiá»ƒm tra nguá»“n chÃ­nh thá»©c trÆ°á»›c khi Ä‘Ã¡nh dáº¥u Ä‘Ã£ xÃ¡c minh.
- AI chá»‰ chuáº©n hÃ³a truy váº¥n tá»± nhiÃªn thÃ nh specialty/khu vá»±c vÃ  giáº£i thÃ­ch reason code; AI khÃ´ng suy luáº­n diagnosis, khÃ´ng xáº¿p háº¡ng cháº¥t lÆ°á»£ng cÆ¡ sá»Ÿ vÃ  khÃ´ng thay tháº¿ safety flow. External map result pháº£i cÃ³ source label, chá»‰ Ä‘Æ°á»£c dÃ¹ng lÃ m fallback vÃ  khÃ´ng tá»± thÃ nh dá»¯ liá»‡u verified.
- Doctor Priority Inbox chá»‰ chá»©a Patient thuá»™c enrollment Ä‘Æ°á»£c phÃ¢n cÃ´ng vÃ  cÃ³ pagination/stable sort.
- BÃ¡o cÃ¡o 7/30 ngÃ y tÃ­nh sá»‘ liá»‡u báº±ng backend; LLM chá»‰ diá»…n Ä‘áº¡t tá»« payload chuáº©n hÃ³a vÃ  pháº£i cÃ³ fallback.
- Chuá»—i AI summary lÃ  `normalize metrics â†’ deterministic aggregate â†’ rule evaluation â†’ SummaryInput snapshot â†’ structured LLM output â†’ grounding/safety guard â†’ summary hoáº·c fallback`. Má»i con sá»‘ vÃ  nháº­n xÃ©t pháº£i truy vá» snapshot/source reference; Patient vÃ  Doctor dÃ¹ng presentation policy khÃ¡c nhau trÃªn cÃ¹ng facts.
- Redis reserve/commit/release quota token theo ngÃ y; `AiUsageDaily` lÃ  dá»¯ liá»‡u bá»n vá»¯ng, tÃ¡ch token chat khá»i token sinh summary. Request cap váº«n Ä‘Æ°á»£c giá»¯ Ä‘á»ƒ chá»‘ng spam.
- KhÃ´ng dÃ¹ng cron xÃ³a toÃ n bá»™ quota key; key theo ngÃ y cÃ³ TTL.
- RAG dÃ¹ng `AiDocuments`, `AiDocumentChunks` vÃ  Atlas Vector Search.
- Admin/Doctor Ä‘Æ°á»£c cáº¥p quyá»n duyá»‡t á»Ÿ cáº¥p `AiDocuments`; tráº¡ng thÃ¡i trÃªn chunk lÃ  báº£n sao phá»¥c vá»¥ Atlas filter. Chunk lá»—i cÃ³ thá»ƒ bá»‹ loáº¡i riÃªng nhÆ°ng khÃ´ng yÃªu cáº§u duyá»‡t tá»«ng chunk.
- AI response pháº£i cÃ³ safety policy/disclaimer vÃ  khÃ´ng cháº©n Ä‘oÃ¡n.

### 5.7 Billing, cancel vÃ  refund

- Free giá»¯ HealthMetrics, biá»ƒu Ä‘á»“ cÆ¡ báº£n, safety alert, má»™t Care Program cÆ¡ báº£n, in-app notification vÃ  quota AI cÆ¡ báº£n.
- Plus bá»• sung nhiá»u Care Program, bÃ¡o cÃ¡o 7/30/90 ngÃ y, weekly AI summary, smart reminder, medication reminder, export vÃ  quota AI cao hÆ¡n.
- Care bao gá»“m Plus cÃ¹ng Doctor-assigned Program, review Ä‘á»‹nh ká»³, Priority Inbox, follow-up, tÃ¡i khÃ¡m vÃ  Æ°u Ä‘Ã£i giÃ¡ consultation theo Plan snapshot.
- `consultationLimitPerCycle` máº·c Ä‘á»‹nh: Free `1`, Plus `3`, Care `6`; há»‡ thá»‘ng Ä‘áº¿m trá»±c tiáº¿p `consultationsUsed` vÃ  sá»‘ cÃ²n láº¡i.
- Scheduled/on-demand dÃ¹ng chung consultation limit vÃ  reservation ledger idempotent. Quota AI lÃ  entitlement khÃ¡c, dÃ¹ng tá»•ng input/output token vÃ  request cap, khÃ´ng dÃ¹ng chung vá»›i consultation.
- Subscription khÃ´ng Ä‘Æ°á»£c thay Ä‘á»•i severity/Æ°u tiÃªn lÃ¢m sÃ ng; safety alert vÃ  quyá»n truy cáº­p dá»¯ liá»‡u cÆ¡ báº£n khÃ´ng bá»‹ khÃ³a khi háº¿t háº¡n.
- Plan Ä‘Æ°á»£c version hÃ³a `draft â†’ published â†’ retired`. Admin sá»­a chÃ­nh sÃ¡ch kinh doanh trong database vÃ  hard ceiling há»‡ thá»‘ng; Subscription giá»¯ snapshot nÃªn quyá»n lá»£i Ä‘Ã£ mua khÃ´ng Ä‘á»•i Ã¢m tháº§m.

```mermaid
stateDiagram-v2
    [*] --> created
    created --> pending: Táº¡o payment URL
    created --> cancelled: Cancel trÆ°á»›c thanh toÃ¡n
    pending --> cancelled: Cancel trÆ°á»›c thanh toÃ¡n
    pending --> paid: IPN há»£p lá»‡
    pending --> expired: Háº¿t háº¡n
    cancelled --> paid: Late valid IPN
    paid --> refund_pending: Táº¡o refund request
    refund_pending --> paid: Reject/fail cÃ³ káº¿t luáº­n
    refund_pending --> refunded: Provider xÃ¡c nháº­n thÃ nh cÃ´ng
```

- Return URL chá»‰ hiá»ƒn thá»‹ tráº¡ng thÃ¡i; IPN há»£p lá»‡ má»›i ghi nháº­n paid vÃ  táº¡o outbox event yÃªu cáº§u cáº¥p quyá»n lá»£i.
- Duplicate IPN khÃ´ng táº¡o hai subscriptions.
- Má»—i paid order táº¡o má»™t Subscription grant cÃ³ `sourceOrderId` unique.
- Worker cáº¥p grant idempotent vÃ  reconciliation phá»¥c há»“i trÆ°á»ng há»£p paid-without-grant. DA2 dÃ¹ng state machine + Mongo transaction + transactional outbox, chÆ°a dÃ¹ng Saga framework.
- Cancel order chá»‰ dÃ nh cho `created|pending`; khÃ´ng gá»i refund provider.
- Late valid IPN cá»§a order cancelled/expired váº«n pháº£i ghi nháº­n, khÃ´ng bá» qua tiá»n Ä‘Ã£ thu.
- Full refund MVP: patient request, admin approve/reject, worker gá»i VNPAY, timeout chuyá»ƒn `manual_review` Ä‘á»ƒ Ä‘á»‘i soÃ¡t.
- Refund khÃ´ng xÃ©t theo má»™t pháº§n trÄƒm sá»­ dá»¥ng chung. Má»—i phiÃªn báº£n Plan cÃ³ `refundPolicy` riÃªng; policy Ä‘Æ°á»£c snapshot vÃ o order vÃ  Ä‘Ã¡nh giÃ¡ theo tá»«ng quyá»n lá»£i tráº£ phÃ­ nhÆ° AI token, consultation Ä‘Ã£ tÃ­nh lÆ°á»£t, Doctor review, bÃ¡o cÃ¡o vÃ  nhiá»‡m vá»¥ Care tráº£ phÃ­.
- Khi táº¡o yÃªu cáº§u, há»‡ thá»‘ng chá»¥p má»©c sá»­ dá»¥ng vÃ  táº¡m dá»«ng hÃ nh Ä‘á»™ng tráº£ phÃ­ má»›i nhÆ°ng váº«n giá»¯ dá»¯ liá»‡u, quyá»n Free vÃ  cáº£nh bÃ¡o an toÃ n. Backend kiá»ƒm tra láº¡i má»©c sá»­ dá»¥ng ngay trÆ°á»›c khi Admin duyá»‡t Ä‘á»ƒ trÃ¡nh race condition.
- Lá»—i thu trÃ¹ng/Ä‘Ã£ thu nhÆ°ng chÆ°a cáº¥p hoáº·c cáº¥p sai quyá»n Ä‘i vÃ o `review_required`. Admin cÃ³ thá»ƒ duyá»‡t ngoáº¡i lá»‡ vá»›i lÃ½ do vÃ  audit, nhÆ°ng khÃ´ng thá»ƒ vÆ°á»£t sá»‘ tiá»n Ä‘Ã£ thu hoáº·c táº¡o nhiá»u refund cho cÃ¹ng order.
- Chá»‰ khi provider xÃ¡c nháº­n refund thÃ nh cÃ´ng má»›i chuyá»ƒn order `refunded` vÃ  cancel Ä‘Ãºng subscription grant.
- Partial refund, chargeback, auto-approve vÃ  auto-refund do há»§y consultation náº±m ngoÃ i DA2.

### 5.8 Notification, Outbox vÃ  worker

```text
MongoDB transaction
  -> business entity
  -> Notification
  -> OutboxEvent
  -> dispatcher
  -> BullMQ
  -> Socket.IO / FCM / Email / external job
```

- Outbox Ä‘áº£m báº£o side effect khÃ´ng máº¥t sau commit.
- BullMQ phá»¥c vá»¥ reminder, expiration, no-show, notification retry, RAG ingestion vÃ  payment/refund reconciliation.
- Consumer pháº£i idempotent vÃ¬ delivery lÃ  at-least-once.

## 6. Kiáº¿n trÃºc há»‡ thá»‘ng Ä‘Ã­ch

```mermaid
flowchart LR
    WC[Web Client] --> API[NestJS Modular Monolith]
    WA[Web Admin] --> API
    M[React Native Expo] --> API
    WC <--> WS[Socket.IO]
    WA <--> WS
    M <--> WS
    WS --> API
    API --> MG[Mongoose]
    MG --> DB[(MongoDB Atlas)]
    API --> R[(Redis)]
    API --> O[OutboxEvents]
    O --> B[BullMQ Workers]
    B --> F[FCM / Email / VNPAY]
    API --> AI[Google GenAI + RAG]
    AI --> VS[Atlas Vector Search]
    API --> C[Cloudinary]
    WC <--> RTC[WebRTC + TURN]
    M <--> RTC
```

Backend sá»­ dá»¥ng Modular Monolith, chia theo capability:

| Module | Dá»¯ liá»‡u sá»Ÿ há»¯u |
|---|---|
| authentication | Users, OAuthAccounts, AuthSessions, UserDevices |
| practitioner-management | DoctorProfile embedded trong Users vÃ  verification policy |
| consultations | AvailabilitySlots, Consultations, ConsultationMessages, Reviews |
| health-tracking | HealthMetrics |
| chronic-care | CarePrograms, CareRules, PatientCarePrograms, CareTasks, HealthEvaluations, CareAlerts, CareReports, CareSummaries, FamilyLinks, FamilyPermissions, FamilyReminders |
| care-directory | MedicalFacilities, DiseaseSpecialties |
| ai-advisory | AiConversations, AiMessages, AiUsageDaily, AiDocuments, AiDocumentChunks, BlacklistKeywords |
| billing | Plans, PaymentOrders, PaymentTransactions, Subscriptions, SubscriptionAddOns, ConsultationUsages, PaymentRefunds |
| notifications | NotificationCampaigns, Notifications, OutboxEvents |
| moderation | ViolationReports |
| platform-audit | AuditLogs dÃ¹ng chung, phÃ¢n biá»‡t báº±ng `domain` |

Mongoose lÃ  ODM chÃ­nh. Má»—i collection cÃ³ má»™t canonical model thuá»™c module sá»Ÿ há»¯u; module khÃ¡c truy cáº­p qua application facade/query port, khÃ´ng inject model trá»±c tiáº¿p.

## 7. Dá»¯ liá»‡u

DB v7 gá»“m 27 collections vÃ  váº«n lÃ  baseline Ä‘Ã£ triá»ƒn khai trÆ°á»›c migration. `docs/db-template-v8.dbml` gá»“m 42 collections, trong Ä‘Ã³ cÃ³ hai collection háº¡ táº§ng migration/lock, vÃ  Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t lÃ m target schema DA2. V8 bá»• sung Chronic Care, bÃ¡o cÃ¡o xÃ¡c Ä‘á»‹nh/AI summary, quyá»n lá»£i gÃ³i dá»‹ch vá»¥/lÆ°á»£t tÆ° váº¥n, ngÆ°á»i thÃ¢n Ä‘á»“ng hÃ nh, tÃ¬m cÆ¡ sá»Ÿ y táº¿ vÃ  má»™t `AuditLogs` dÃ¹ng chung. V8 cÃ³ thá»ƒ dÃ¹ng lÃ m nguá»“n váº½ ERD vÃ  triá»ƒn khai model, nhÆ°ng chÆ°a Ä‘Æ°á»£c xem lÃ  Ä‘Ã£ triá»ƒn khai váº­t lÃ½ cho tá»›i khi cÃ³ migration, verifier vÃ  kiá»ƒm thá»­ tÆ°Æ¡ng á»©ng.

NguyÃªn táº¯c:

- MongoDB lÃ  source of truth cho dá»¯ liá»‡u nghiá»‡p vá»¥; Redis chá»‰ giá»¯ cache, presence, quota, OTP vÃ  queue jobs.
- DÃ¹ng versioned migration files; khÃ´ng dÃ¹ng `autoIndex`, `syncIndexes()` hoáº·c script rá»i lÃ m deployment migration.
- Partial/sparse/TTL index, time-series options, validators vÃ  Atlas Search definition Ä‘Æ°á»£c táº¡o/verify qua migration.
- Timestamp lÆ°u UTC; tiá»n VND lÆ°u integer; secret/token/OTP plaintext khÃ´ng náº±m trong database.
- Frontend chá»‰ nháº­n API DTO, khÃ´ng nháº­n raw Mongoose Document hoáº·c field ná»™i bá»™ nhÆ° hash, lock vÃ  gateway payload.

## 8. API vÃ  realtime contract

- REST prefix: `/api/v1`.
- OpenAPI lÃ  nguá»“n contract chuáº©n giá»¯a backend vÃ  frontend repository.
- Lá»—i chuáº©n: `code`, `message`, `details`, `correlationId`.
- Pagination chuáº©n: `items`, `page`, `limit`, `total`, `hasNext`.
- Command cÃ³ nguy cÆ¡ retry nhÆ° booking, message, create order, cancel vÃ  refund dÃ¹ng `Idempotency-Key` hoáº·c conditional transition.
- Socket event cÃ³ version, vÃ­ dá»¥ `consultation.v1.updated`, `message.v1.created`, `queue.v1.changed`, `notification.v1.created`.
- Frontend integration chi tiáº¿t theo tá»«ng page náº±m trong `docs/fe-integration.md`.

## 9. CÃ´ng nghá»‡

| NhÃ³m | CÃ´ng nghá»‡ | Vai trÃ² |
|---|---|---|
| Backend | Node.js, TypeScript, NestJS | API, authorization, use case vÃ  worker bootstrap |
| Persistence | MongoDB Atlas, Mongoose, MongoDB driver | Business data, migration vÃ  feature MongoDB Ä‘áº·c thÃ¹ |
| Cache/jobs | Redis, BullMQ | OTP, quota, presence, delayed/retry jobs; worker dÃ¹ng trá»±c tiáº¿p BullMQ |
| Realtime | Socket.IO, Redis Adapter, WebRTC, TURN | Chat, notification, queue vÃ  call signaling/media |
| AI | Google GenAI SDK, Atlas Vector Search | AI advisory, summary vÃ  RAG |
| Files/push/email | Cloudinary, FCM, Nodemailer | Attachment, push notification vÃ  email |
| Payment | VNPAY Sandbox | Payment, query/reconciliation vÃ  full-refund P1 |
| Frontend | React, Vite, TanStack Query, Zustand, Tailwind/Shadcn | Web Client vÃ  Web Admin |
| Mobile | React Native, Expo | Patient/doctor critical flows |
| Quality | Jest, Supertest, k6, GitHub Actions | Unit, integration, E2E, load test vÃ  CI/CD |

## 10. Hiá»‡n tráº¡ng vÃ  chuyá»ƒn Ä‘á»•i

| Baseline DA1 trÆ°á»›c RF-0 | ÄÃ­ch DA2 |
|---|---|
| Session API cÅ© Ä‘Ã£ bá»‹ xÃ³a á»Ÿ RF-10B | `/consultations` vá»›i requestStatus vÃ  sessionStatus tÃ¡ch biá»‡t |
| Patient gá»­i thá»i gian tÃ¹y Ã½ | Scheduled booking chá»‰ tá»« AvailabilitySlot |
| ChÆ°a cÃ³ check-in/queue atomic | `queuePriorityAt`, call-next vÃ  no-show policy |
| Chat compatibility theo `sessionId` Ä‘Ã£ bá»‹ xÃ³a | Message/room theo `consultationId`, event canonical |
| User/Doctor/Admin models cÃ²n trÃ¹ng | Má»™t Users model vá»›i embedded role profiles |
| AI models/endpoints trÃ¹ng | Má»™t AI Conversation/Message model vÃ  capability services |
| Presence trong process | Redis TTL/heartbeat vÃ  Socket.IO Redis Adapter |
| Notification side effect trá»±c tiáº¿p | Notification + transactional outbox + worker |
| ChÆ°a cÃ³ billing implementation | Plans, payment/IPN, cancel, Subscription grant vÃ  refund P1 |
| Health Metrics má»›i dá»«ng á»Ÿ ghi nháº­n/cáº£nh bÃ¡o Ä‘Æ¡n láº» | Care Program, monitoring adherence, rule evaluation, Care Alert vÃ  Doctor Priority Inbox |
| Frontend/backend cÃ¹ng monorepo | Backend repo riÃªng; frontend monorepo riÃªng; OpenAPI contract |

CÃ¡c API/page hiá»‡n táº¡i vÃ  API/page Ä‘Ã­ch Ä‘Æ°á»£c phÃ¢n biá»‡t rÃµ trong `docs/fe-integration.md`. Frontend repo má»›i chá»‰ dÃ¹ng contract canonical; backend khÃ´ng cÃ²n Session compatibility endpoint/event.

## 11. Pháº¡m vi theo deadline

### P0 pháº£i hoÃ n thÃ nh

- Build/test/CI xanh.
- Identity/session security vÃ  doctor verification; OAuth lÃ  P1 feature-gated.
- AvailabilitySlot, scheduled/on-demand Consultation, check-in, queue vÃ  chat.
- Notification/outbox/worker.
- AI quota/RAG cá»‘t lÃµi.
- Chronic Care cho tÄƒng huyáº¿t Ã¡p vÃ  tiá»ƒu Ä‘Æ°á»ng: Doctor-assigned enrollment/consent, monitoring tasks, rule engine, Care Alert, Priority Inbox, bÃ¡o cÃ¡o 7/30 ngÃ y vÃ  AI summary cÃ³ fallback.
- LiÃªn káº¿t Care Alert vá»›i scheduled/on-demand consultation vÃ  follow-up.
- VNPAY Sandbox payment/subscription vÃ  cancel unpaid order.
- Web critical journeys vÃ  test race/idempotency.

### P1 cÃ³ feature flag/cut-line

- Full refund cÃ³ admin duyá»‡t.
- Mobile patient/doctor critical flow, FCM.
- WebRTC foreground call.
- AI há»— trá»£ moderation.
- Medication adherence sau khi hai chÆ°Æ¡ng trÃ¬nh P0 Ä‘áº¡t gate.
- NgÆ°á»i thÃ¢n Ä‘á»“ng hÃ nh vá»›i sá»‘ liÃªn káº¿t theo `familyLinkLimit`, lá»i má»i/xÃ¡c nháº­n/thu há»“i consent, nháº¯c bá» lá»¡ nhiá»‡m vá»¥ vÃ  audit; khÃ´ng cáº§n FamilyGroup trong DA2.
- TÃ¬m cÆ¡ sá»Ÿ y táº¿ chá»‰ sau NgÆ°á»i thÃ¢n Ä‘á»“ng hÃ nh vÃ  khi cÃ²n buffer trÆ°á»›c feature freeze; dá»‹ch vá»¥ báº£n Ä‘á»“ bÃªn ngoÃ i chá»‰ lÃ  fallback.

### NgoÃ i pháº¡m vi DA2

- Partial refund, chargeback vÃ  auto-refund.
- Admin mobile Ä‘áº§y Ä‘á»§ vÃ  CallKeep production-grade.
- AI cháº©n Ä‘oÃ¡n hoáº·c tá»± quyáº¿t Ä‘á»‹nh cháº¿ tÃ i.
- AI táº¡o severity, kÃª/Ä‘á»•i thuá»‘c hoáº·c thay tháº¿ pháº£n á»©ng cáº¥p cá»©u.
- IoT/Bluetooth medical device, chia sáº» dá»¯ liá»‡u sá»©c khá»e chi tiáº¿t cho ngÆ°á»i thÃ¢n vÃ  tÃ­ch há»£p nhÃ  thuá»‘c/báº£o hiá»ƒm.
- Microservices, Kafka, Kubernetes vÃ  scale claim chÆ°a Ä‘Æ°á»£c Ä‘o.

Full refund máº·c Ä‘á»‹nh khÃ´ng thuá»™c committed scope. Chá»‰ nháº­n trÆ°á»›c feature freeze khi payment/cancel/IPN/reconciliation P0 Ä‘Ã£ xanh vÃ  cÃ²n capacity Ä‘Ã£ xÃ¡c nháº­n; náº¿u khÃ´ng, giá»¯ `VNPAY_REFUND_ENABLED=false`.

## 12. TiÃªu chÃ­ hoÃ n thÃ nh

- Business rule, API contract vÃ  migration khÃ´ng mÃ¢u thuáº«n DB v8 Ä‘Ã£ duyá»‡t; v7 chá»‰ cÃ²n lÃ  baseline Ä‘Ã£ triá»ƒn khai trÆ°á»›c migration, cÃ²n v8 lÃ  target canonical cho DA2.
- Backend, Web Client vÃ  Web Admin build/typecheck/test xanh.
- Critical E2E cho auth, Care Program, monitoring, alert, Doctor Inbox, AI fallback, booking/queue/chat vÃ  feature P1 Ä‘Æ°á»£c báº­t.
- Race/idempotency tests pass cho slot, call-next, IPN vÃ  refund.
- Database rá»—ng Ä‘Æ°á»£c táº¡o láº¡i tá»« migration files vÃ  `database:verify` pass.
- KhÃ´ng log dá»¯ liá»‡u nháº¡y cáº£m; room/file/API Ä‘á»u authorize phÃ­a server.
- Demo khÃ´ng cáº§n sá»­a tay database.
- README, OpenAPI, realtime events vÃ  `fe-integration.md` khá»›p release thá»±c táº¿.


