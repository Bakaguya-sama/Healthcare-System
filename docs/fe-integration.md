# Frontend Integration Contract — Healthcare DA2

## 1. Mục đích và phạm vi

Tài liệu mô tả dữ liệu, REST API, realtime event, cache và trạng thái UI mà từng trang Web Client, Web Admin và Mobile sử dụng.

Nguồn thiết kế:

- `docs/overview.md` — phạm vi sản phẩm.
- `docs/BUSINESS_RULES.md` — quy tắc nghiệp vụ.
- `docs/db-template-v8.dbml` — target schema DA2 đã duyệt; v7 chỉ là baseline migration.
- `plan/refactor-plan.md` — kiến trúc, thứ tự refactor và cut-line.

Đây là **target integration contract**. Endpoint gắn nhãn Current đã tồn tại trong code; endpoint Target phải được đưa vào OpenAPI trước khi frontend triển khai. Tên endpoint trong tài liệu có thể chỉnh trước khi khóa contract, nhưng sau khi frontend pin OpenAPI version thì breaking change phải dùng compatibility adapter hoặc API version mới.

## 2. Trạng thái và nguyên tắc

| Nhãn | Ý nghĩa |
|---|---|
| Current | Route/API đang được frontend hiện tại sử dụng |
| Target P0 | Phải có cho release chính |
| Target P1 | Chỉ phát hành khi feature flag/gate đạt |
| Deferred | Ngoài deadline 31/12 |

Nguyên tắc tích hợp:

1. Frontend không đọc MongoDB, Mongoose Document hoặc collection trực tiếp.
2. REST client và DTO được sinh từ OpenAPI trong `packages/api-client`.
3. Socket payload hiện tại được xuất tại `apps/api/contracts/realtime-events.json`; frontend repo có thể copy/generate type từ artifact thay vì import backend source.
4. Server state dùng TanStack Query; Zustand chỉ giữ auth state và UI state ngắn hạn.
5. ID gửi qua JSON là `string`; thời gian là ISO-8601 UTC; timezone hiển thị là IANA name.
6. Tiền VND là integer JSON `number`, không có phần thập phân và phải nằm trong `Number.MAX_SAFE_INTEGER`.
7. Page không được tự suy diễn quyền từ UI; backend luôn authorize.
8. Mutation có thể retry phải gửi `Idempotency-Key` hoặc client-generated ID ổn định.
9. Không lưu refresh token trong localStorage ở contract đích cho web; ưu tiên HTTP-only Secure cookie. Mobile dùng secure storage.
10. Không đưa `passwordHash`, `refreshTokenHash`, gateway secret, raw lock/outbox hoặc sanitized gateway payload vào public DTO.

### 2.1 Các lớp dữ liệu một page có thể sử dụng

| Lớp dữ liệu | Ví dụ | Nơi lưu | Quy tắc |
|---|---|---|---|
| Route params | `doctorId`, `consultationId`, `orderId`, `refundId` | Router | Validate format; ID không chứng minh ownership |
| URL query | filter, page, date range, tab | Router URL | Dùng cho state có thể bookmark/share; parse bằng schema |
| Auth context | user, role, accountStatus, access-token expiry | Auth provider/store | Không dùng làm server data cache; clear khi logout/ban |
| Server query state | doctor, slot, consultation, metric, order | TanStack Query | Key ổn định; cache/invalidate theo mục 7 |
| Mutation/form state | notes, reason, selected slot, upload draft | React Hook Form/local component | Validate client để UX tốt; server vẫn validate lại |
| Realtime state | connection, typing, call media, transient queue event | Socket/call provider | Sau reconnect phải refetch REST source of truth |
| Optimistic entity | pending message với `clientMessageId` | Query cache tạm thời | Chỉ dùng cho action có rollback rõ |
| Upload state | progress, local preview, abort handle | Component/upload hook | Không lưu File/blob trong global persistent store |
| Feature/config | refund/WebRTC enabled, limits, supported MIME | Config/bootstrap query | Backend vẫn kiểm tra flag và policy |

Một page không nên tự giữ bản sao dài hạn của cùng server entity trong cả Zustand và TanStack Query. Local derived state phải được tính từ DTO/cache hoặc URL thay vì đồng bộ thủ công nhiều nguồn.

## 3. Chuẩn HTTP dùng chung

### 3.1 Base URL và header

```text
Base URL: {API_BASE_URL}/api/v1
Authorization: Bearer <access-token>
Content-Type: application/json
Idempotency-Key: <uuid>             # booking, message, order, cancel, refund
X-Correlation-Id: <uuid>            # client có thể gửi; server luôn trả
Accept-Language: vi-VN | en-US      # optional
```

Socket.IO dùng `{API_ORIGIN}` với transport path mặc định `/socket.io` và namespace đích `/consultations`, `/notifications`, `/presence`. Client gửi JWT qua `handshake.auth.token`, chỉ kết nối từ origin có trong `CORS_ORIGINS`, và lưu `x-correlation-id` từ HTTP error khi báo lỗi hỗ trợ.

Multipart chỉ dùng cho upload avatar, verification document, attachment và AI image.

### 3.2 Response envelope

```ts
type Id = string;
type IsoDateTime = string;
type LocalDate = string; // YYYY-MM-DD
type MoneyVnd = number;  // integer, no decimal

interface ApiSuccess<T> {
  data: T;
  correlationId?: string;
}

interface PageResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | Array<{ field: string; message: string }>;
  correlationId: string;
}
```

Không duy trì song song response `_id`, `id`, `data.data` và array thuần. API target luôn trả `id` và envelope thống nhất.

### 3.3 Error code frontend phải xử lý

| HTTP | Code tiêu biểu | UI behavior |
|---:|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_STATE_TRANSITION` | Hiển thị field error hoặc message nghiệp vụ |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `REFRESH_REPLAYED` | Refresh một lần; thất bại thì clear auth và về login |
| 403 | `FORBIDDEN`, `ACCOUNT_BANNED`, `DOCTOR_NOT_APPROVED` | Trang 403/modal ban; không retry |
| 404 | `RESOURCE_NOT_FOUND` | Empty/not-found state |
| 409 | `SLOT_ALREADY_BOOKED`, `DUPLICATE_REQUEST`, `VERSION_CONFLICT`, `REFUND_ALREADY_EXISTS` | Invalidate/refetch và giải thích conflict |
| 410 | `REQUEST_EXPIRED`, `PAYMENT_ORDER_EXPIRED` | Disable action và refetch |
| 422 | `CHECK_IN_NOT_ALLOWED`, `REFUND_NOT_ELIGIBLE`, `QUOTA_EXCEEDED` | Hiển thị policy state/CTA phù hợp |
| 429 | `RATE_LIMITED` | Disable submit theo `Retry-After` |
| 502/503 | `PROVIDER_UNAVAILABLE`, `DEPENDENCY_UNAVAILABLE` | Retry có backoff; không optimistic success |

## 4. DTO catalog

Các interface dưới đây là shape frontend cần; generated OpenAPI types là nguồn compile-time chính thức. DTO có thể là projection đã flatten/enrich từ nhiều collection (ví dụ `patient`, `doctor`, `allowedActions`, `displayTitle`) nhưng tên trạng thái, version, kỳ quota và lifecycle phải giữ đúng mô hình v8; frontend không dùng trực tiếp document MongoDB.

### 4.1 Identity và practitioner

```ts
type UserRole = "patient" | "doctor" | "admin";
type AccountStatus = "active" | "banned";
type VerificationStatus = "pending" | "approved" | "rejected";

interface AddressDto {
  street?: string;
  ward?: string;
  district?: string;
  city?: string;
  country?: string;
}

interface DoctorProfileDto {
  specialty?: string;
  workplace?: string;
  experienceYears?: number;
  verificationDocuments?: FileDto[];
  verificationStatus: VerificationStatus;
  verifiedAt?: IsoDateTime;
  rejectReason?: string;
  averageRating: number;
  reviewCount: number;
  bookingSettings: {
    bookingPolicy: "instant" | "approval_required";
    defaultDurationMinutes: number;
    bufferMinutes: number;
    minNoticeMinutes: number;
    maxAdvanceDays: number;
    cancellationDeadlineMinutes: number;
    checkInEarlyMinutes: number;
    noShowAfterMinutes: number;
  };
}

interface UserDto {
  id: Id;
  fullName: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  emailVerifiedAt?: IsoDateTime;
  gender?: string;
  dateOfBirth?: LocalDate;
  phoneNumber?: string;
  avatarUrl?: string;
  address?: AddressDto;
  lastOnlineAt?: IsoDateTime;
  doctorProfile?: DoctorProfileDto;
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager" };
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface DoctorCardDto {
  id: Id;
  fullName: string;
  avatarUrl?: string;
  specialty?: string;
  workplace?: string;
  experienceYears?: number;
  averageRating: number;
  reviewCount: number;
  presence: "online" | "offline" | "unknown";
  nextAvailableAt?: IsoDateTime;
}

interface FileDto {
  publicId: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}
```

### 4.2 Slot, consultation, queue và message

```ts
type SlotStatus = "available" | "booked" | "blocked" | "expired";
type ConsultationMode = "on_demand" | "scheduled";
type RequestStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";
type SessionStatus = "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";

interface AvailabilitySlotDto {
  id: Id;
  doctorId: Id;
  startAt: IsoDateTime;
  endAt: IsoDateTime;
  timezone: string;
  status: SlotStatus;
  blockedAt?: IsoDateTime;
  blockReason?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface ConsultationDto {
  id: Id;
  patient: Pick<UserDto, "id" | "fullName" | "avatarUrl">;
  doctor: DoctorCardDto;
  patientCareProgramId?: Id;
  careAlertId?: Id;
  availabilitySlotId?: Id;
  mode: ConsultationMode;
  requestStatus: RequestStatus;
  sessionStatus: SessionStatus;
  requestedAt: IsoDateTime;
  respondedAt?: IsoDateTime;
  requestExpiresAt?: IsoDateTime;
  declinedReason?: string;
  scheduledStartAt?: IsoDateTime;
  scheduledEndAt?: IsoDateTime;
  timezone?: string;
  expectedDurationMinutes: number;
  bookingSettingsSnapshot?: {
    bookingPolicy: "instant" | "approval_required";
    defaultDurationMinutes: number;
    bufferMinutes: number;
    minNoticeMinutes: number;
    cancellationDeadlineMinutes: number;
    checkInEarlyMinutes: number;
    noShowAfterMinutes: number;
  };
  patientNotes?: string;
  doctorNotes?: string;
  followUpAt?: IsoDateTime;
  followUp?: { note?: string; nextAction?: string; taskId?: Id; createdAt: IsoDateTime };
  queueJoinedAt?: IsoDateTime;
  queuePriorityAt?: IsoDateTime;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  calledAt?: IsoDateTime;
  sessionStartedAt?: IsoDateTime;
  lastHeartbeatAt?: IsoDateTime;
  overtimeStartedAt?: IsoDateTime;
  interruptedAt?: IsoDateTime;
  interruptionReason?: string;
  resumedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  completedBy?: Id;
  noShowAt?: IsoDateTime;
  noShowReason?: string;
  cancelledAt?: IsoDateTime;
  cancelledBy?: Id;
  cancellationReason?: string;
  roomId?: string;
  callStartedAt?: IsoDateTime;
  callEndedAt?: IsoDateTime;
  callEndReason?: string;
  consultationConsent?: { acceptedAt: IsoDateTime; policyVersion: string };
  aiConsultationBrief?: {
    summary: string;
    patientQuestions: string[];
    recentContext: string[];
    status: "draft" | "doctor_reviewed";
    generatedAt: IsoDateTime;
  };
  canCheckIn: boolean;
  allowedActions: string[];
  lastMessage?: MessagePreviewDto;
  review?: ReviewDto;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface QueueEntryDto {
  consultationId: Id;
  patient: Pick<UserDto, "id" | "fullName" | "avatarUrl">;
  mode: ConsultationMode;
  scheduledStartAt?: IsoDateTime;
  queueJoinedAt: IsoDateTime;
  queuePosition: number;
  estimatedWaitMinutes?: number;
  isCurrent: boolean;
}

interface MessagePreviewDto {
  content?: string;
  senderType: "patient" | "doctor" | "system";
  createdAt: IsoDateTime;
}

interface ConsultationMessageDto {
  id: Id;
  consultationId: Id;
  senderId: Id;
  senderType: "patient" | "doctor" | "system";
  clientMessageId?: string;
  content?: string;
  attachments: FileDto[];
  deletedAt?: IsoDateTime;
  createdAt: IsoDateTime;
}

interface ReviewDto {
  id: Id;
  consultationId: Id;
  patientId: Id;
  doctorId: Id;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  status: "published" | "hidden" | "removed";
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
```

`allowedActions` do backend tính theo role/status/policy để frontend render button; frontend vẫn không được xem nó là authorization boundary.

### 4.3 Health và AI

```ts
interface HealthMetricDto {
  id: Id;
  patientId: Id;
  metricType: string;
  unit: string;
  values: Record<string, number>;
  source: "manual" | "device" | "clinician" | "import";
  sourceRef?: { deviceId?: string; importBatchId?: string; enteredBy?: Id };
  validationStatus: "valid" | "rejected" | "superseded" | "voided";
  validationReasonCodes: string[];
  recordedTimezone?: string;
  replacesMetricId?: Id;
  recordedAt: IsoDateTime;
  ingestedAt?: IsoDateTime;
  voidedAt?: IsoDateTime;
  voidReason?: string;
  createdAt: IsoDateTime;
}

interface AiConversationDto {
  id: Id;
  patientId: Id;
  status: "active" | "completed" | "archived";
  displayTitle?: string; // projection từ nội dung đầu tiên, không phải field persistence
  startedAt?: IsoDateTime;
  endedAt?: IsoDateTime;
  lastMessage?: AiMessageDto;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface AiMessageDto {
  id: Id;
  conversationId: Id;
  senderType: "patient" | "ai";
  content?: string;
  attachments: FileDto[];
  citations: Array<{
    documentId: Id;
    chunkId?: Id;
    title: string;
    organization: string;
    version?: string;
    pageNumber?: number;
    sectionPath: string[];
    sourceUrl?: string;
    score?: number;
  }>;
  model?: string;
  status: "pending" | "completed" | "failed";
  sentAt: IsoDateTime;
}

interface AiQuotaDto {
  planName: string;
  period: "day" | "subscription_cycle";
  periodStart: IsoDateTime;
  periodEnd: IsoDateTime;
  tokenLimit: number;
  tokensUsed: number;
  tokensReserved: number;
  tokensRemaining: number;
  requestLimit: number;
  requestsUsed: number;
  resetsAt: IsoDateTime;
}
```

`HealthMetricDto` không có trường mức độ `normal|warning|critical`: mức độ đó thuộc kết quả đánh giá quy tắc (`HealthEvaluation`) hoặc `CareAlert`. Khi sửa chỉ số, backend tạo bản ghi mới có `replacesMetricId` và chuyển bản cũ thành `superseded`; khi xóa về mặt người dùng, backend chuyển trạng thái thành `voided`, không ghi đè hoặc xóa cứng phép đo.

### 4.4 Chronic Care

```ts
interface CareProgramDto {
  id: Id;
  programCode: string;
  version: number;
  name: string;
  diseaseKey: "hypertension" | "diabetes" | string;
  description?: string;
  status: "draft" | "published" | "retired";
  taskTypes: Array<"metric" | "check_in" | "education" | "appointment" | "doctor_review" | "medication" | "journal">;
  expectedDurationDays?: number;
  allowedActions: string[];
}

interface PatientCareProgramDto {
  id: Id;
  patient: Pick<UserDto, "id" | "fullName">;
  doctor: Pick<UserDto, "id" | "fullName">;
  program: Pick<CareProgramDto, "id" | "programCode" | "version" | "name">;
  careRuleId: Id;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  timezone: string;
  consentAcceptedAt?: IsoDateTime;
  baselineCompletedAt?: IsoDateTime;
  startedAt?: IsoDateTime;
  expectedEndAt?: IsoDateTime;
  pausedAt?: IsoDateTime;
  pauseReason?: string;
  completedAt?: IsoDateTime;
  completionReason?: string;
  cancelledAt?: IsoDateTime;
  cancellationReason?: string;
  adherence?: number;
  allowedActions: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface CareTaskDto {
  id: Id;
  patientCareProgramId: Id;
  templateKey: string;
  taskType: "metric" | "check_in" | "education" | "appointment" | "doctor_review" | "medication" | "journal";
  status: "scheduled" | "due" | "completed" | "missed" | "cancelled";
  title: string;
  required: boolean;
  scheduledFor: IsoDateTime;
  windowStart: IsoDateTime;
  windowEnd: IsoDateTime;
  response?: Record<string, unknown>;
  completionSourceType?: "healthMetric" | "response" | "contentProgress" | "consultation" | "doctorReview";
  completionSourceId?: Id;
  completedAt?: IsoDateTime;
  missedAt?: IsoDateTime;
  cancelledAt?: IsoDateTime;
  cancellationReason?: string;
  allowedActions: string[];
}

interface CareAlertDto {
  id: Id;
  patientCareProgramId: Id;
  evaluationId: Id;
  patient: Pick<UserDto, "id" | "fullName">;
  assignedDoctor: Pick<UserDto, "id" | "fullName">;
  severity: "attention" | "urgent";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  reasonCodes: string[];
  detectedAt: IsoDateTime;
  acknowledgedAt?: IsoDateTime;
  resolvedAt?: IsoDateTime;
  resolutionReason?: string;
  dismissedAt?: IsoDateTime;
  dismissalReason?: string;
  followUp?: { note?: string; nextAction?: string; dueAt?: IsoDateTime; createdAt: IsoDateTime };
  consultationId?: Id;
  allowedActions: string[];
}

interface CareReportDto {
  id: Id;
  patientCareProgramId: Id;
  careRuleId: Id;
  reportType: "weekly" | "thirty_day" | "ninety_day" | "final" | "custom";
  dataFormatVersion: string;
  windowStart: IsoDateTime;
  windowEnd: IsoDateTime;
  timezone: string;
  dataUntil: IsoDateTime;
  status: "ready" | "superseded" | "invalidated";
  statistics: Record<string, unknown>;
  trends: Record<string, unknown>;
  missingData: Record<string, unknown>;
  healthEvaluationSummary: Record<string, unknown>;
  consultationSummary?: Record<string, unknown>;
  reportVersion: number;
  generatedAt: IsoDateTime;
}

interface CareSummaryDto {
  id: Id;
  reportId: Id;
  audience: "patient" | "doctor";
  status: "generated" | "fallback" | "failed";
  summaryVersion: number;
  content?: {
    overview: string;
    observations: string[];
    missingData: string[];
    alertsToMention: string[];
    questionsForDoctor: string[];
    disclaimer: string;
  };
  citations: AiMessageDto["citations"];
  reviewStatus?: "not_required" | "pending" | "reviewed" | "rejected";
  createdAt: IsoDateTime;
  reviewedAt?: IsoDateTime;
}

interface FamilyLinkDto {
  id: Id;
  patient: Pick<UserDto, "id" | "fullName">;
  familyUser: Pick<UserDto, "id" | "fullName" | "email">;
  relationship?: string;
  status: "pending" | "active" | "paused" | "revoked" | "declined" | "expired";
  invitationVersion: number;
  invitationExpiresAt: IsoDateTime;
  permissions: string[];
  invitedAt: IsoDateTime;
  acceptedAt?: IsoDateTime;
  pausedAt?: IsoDateTime;
  resumedAt?: IsoDateTime;
  declinedAt?: IsoDateTime;
  declineReason?: string;
  expiredAt?: IsoDateTime;
  revokedAt?: IsoDateTime;
  revokeReason?: string;
  allowedActions: string[];
}

interface MedicalFacilityDto {
  id: Id;
  name: string;
  facilityType: string;
  address: {
    street?: string;
    ward?: string;
    district?: string;
    province: string;
    country: string;
    postalCode?: string;
    displayText: string;
  };
  location: { latitude: number; longitude: number };
  specialties: string[];
  services: string[];
  phone?: string;
  email?: string;
  websiteUrl?: string;
  distanceKm?: number;
  source: "internal" | "map_provider";
  verificationStatus: "verified" | "external_unverified";
  directionUrl?: string;
  matchReasons: string[];
  lastCheckedAt?: IsoDateTime;
}
```

`allowedActions` là nguồn hiển thị hành động theo role/status. State machine đã chốt: Enrollment chỉ active sau Doctor/Program/Rule/entitlement/consent/baseline hợp lệ; CareTask missed là terminal; CareAlert cho phép resolve trực tiếp kèm implicit acknowledge; FamilyLink tái sử dụng record và tăng `invitationVersion` khi mời lại.

### 4.5 Billing

```ts
interface PlanBenefitsDto {
  weeklyAiSummary: boolean;
  reports: Array<"weekly" | "thirty_day" | "ninety_day">;
  smartReminder: boolean;
  medicationReminder: boolean;
  exports: Array<"pdf" | "csv">;
  doctorReview: boolean;
  priorityInbox: boolean;
  followUp: boolean;
  familyLinkLimit: number;
  facilitySearch: boolean;
}

interface PlanDto {
  id: Id;
  code: "FREE" | "PLUS" | "CARE" | string;
  version: number;
  name: string;
  tier: "free" | "plus" | "care";
  description?: string;
  price: MoneyVnd;
  currency: "VND";
  durationDays: number;
  aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: "day" | "subscription_cycle";
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  benefits: PlanBenefitsDto;
  refundPolicy: {
    version: string;
    refundType: "full_only";
    refundWindowHours: number;
    maxAiTokensUsed: number;
    maxConsultationsCounted: number;
    maxDoctorReviewsCompleted: number;
    maxPaidReportsGenerated: number;
    maxPaidCareTasksCompleted: number;
    requireAdminApproval: true;
  };
  status: "draft" | "published" | "retired";
  effectiveFrom?: IsoDateTime;
  effectiveUntil?: IsoDateTime;
}

type PaymentOrderStatus =
  | "created" | "pending" | "processing" | "paid" | "expired"
  | "cancelled" | "failed" | "refund_pending" | "refunded";

interface PaymentOrderDto {
  id: Id;
  orderCode: string;
  plan: Pick<PlanDto, "id" | "name">;
  orderSnapshot: Record<string, unknown>;
  amount: MoneyVnd;
  currency: "VND";
  status: PaymentOrderStatus;
  paymentUrl?: string;
  expiresAt?: IsoDateTime;
  paidAt?: IsoDateTime;
  cancelledAt?: IsoDateTime;
  cancellationReason?: string;
  refundedAt?: IsoDateTime;
  allowedActions: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface SubscriptionDto {
  id: Id;
  sourceOrderId?: Id;
  source: "payment" | "free_grant" | "admin_demo";
  plan: Pick<PlanDto, "id" | "code" | "version" | "name" | "tier">;
  planSnapshot: {
    aiRequestLimit: number;
    aiTokenLimit: number;
    aiQuotaPeriod: "day" | "subscription_cycle";
    consultationLimitPerCycle: number;
    activeCareProgramLimit: number;
    benefits: PlanBenefitsDto;
  };
  status: "active" | "expired" | "cancelled";
  cycleNumber: number;
  currentPeriodStart: IsoDateTime;
  currentPeriodEnd: IsoDateTime;
  startedAt: IsoDateTime;
  expiresAt: IsoDateTime;
  nextPlan?: {
    id: Id;
    code: string;
    name: string;
    startsAt: IsoDateTime;
  };
  cancelledAt?: IsoDateTime;
  cancellationReason?: "user_cancelled" | "payment_refunded" | "admin_revoked";
  allowedActions: string[];
}

type RefundStatus =
  | "requested" | "approved" | "rejected" | "processing"
  | "succeeded" | "failed" | "manual_review";

interface PaymentRefundDto {
  id: Id;
  orderId: Id;
  paymentTransactionId: Id;
  subscriptionId: Id;
  amount: MoneyVnd;
  currency: "VND";
  reasonCode?: string;
  reason: string;
  eligibilityStatus: "eligible" | "review_required" | "ineligible";
  eligibilityReasonCodes: string[];
  usageSnapshot: {
    aiTokensUsed: number;
    consultationsReserved: number;
    consultationsCounted: number;
    doctorReviewsCompleted: number;
    paidReportsGenerated: number;
    paidCareTasksCompleted: number;
    capturedAt: IsoDateTime;
  };
  finalUsageSnapshot?: PaymentRefundDto["usageSnapshot"];
  paidBenefitsPausedAt?: IsoDateTime;
  paidBenefitsResumedAt?: IsoDateTime;
  status: RefundStatus;
  policyVersion: string;
  evaluatedAt: IsoDateTime;
  reEvaluatedAt?: IsoDateTime;
  requestedAt: IsoDateTime;
  reviewedAt?: IsoDateTime;
  rejectionReason?: string;
  providerResponseCode?: string;
  completedAt?: IsoDateTime;
  allowedActions: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
```

Frontend không nhận `gatewayPayload`, `gatewayRequest`, `gatewayResponse`, `lastError` nội bộ hoặc provider secret.

### 4.6 Notification và moderation

```ts
interface NotificationDto {
  id: Id;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "critical";
  resourceType?: "consultation" | "patientCareProgram" | "careTask" | "careAlert" | "careReport" | "familyLink" | "medicalFacility" | "paymentOrder" | "paymentRefund" | "subscription" | "violation";
  resourceId?: Id;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: IsoDateTime;
  createdAt: IsoDateTime;
}

interface ViolationReportDto {
  id: Id;
  reporter?: Pick<UserDto, "id" | "fullName" | "role">;
  reportedUser?: Pick<UserDto, "id" | "fullName" | "role">;
  reportType: string;
  reason: string;
  status: "pending" | "processing" | "resolved" | "dismissed";
  severity: "low" | "medium" | "high";
  source?: Record<string, unknown>;
  evidences: FileDto[];
  aiClassification?: { category: string; severity: string; confidence: number; rationale?: string };
  resolution?: { note?: string; action: "warning" | "suspend" | "ban" | "none"; handledAt?: IsoDateTime };
  assignedTo?: Pick<UserDto, "id" | "fullName">;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface AiDocumentAdminDto {
  id: Id;
  title: string;
  fileType: string;
  guidelineVersion?: string;
  sourceOrganization: string;
  sourceUrl?: string;
  publishedAt?: IsoDateTime;
  effectiveUntil?: IsoDateTime;
  language: string;
  specialties: string[];
  audiences: Array<"patient" | "doctor" | "admin">;
  processingStatus: "uploaded" | "processing" | "ready" | "error";
  reviewStatus: "pending_review" | "approved" | "rejected" | "archived";
  processingError?: string;
  chunkCount: number;
  uploadedBy: Pick<UserDto, "id" | "fullName">;
  reviewedBy?: Pick<UserDto, "id" | "fullName">;
  reviewedAt?: IsoDateTime;
  rejectionReason?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  allowedActions: string[];
}

interface AuditLogDto {
  id: Id;
  domain: "auth" | "user" | "consultation" | "health" | "care" | "ai" | "billing" | "notification" | "moderation" | "facility" | string;
  action: string;
  actor?: Pick<UserDto, "id" | "fullName" | "role">;
  entityType: string;
  entityId?: Id;
  reason?: string;
  fromStatus?: string;
  toStatus?: string;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTime;
}

interface AdminDashboardDto {
  range: { from: IsoDateTime; to: IsoDateTime };
  users: { total: number; active: number; banned: number };
  doctors: { pending: number; approved: number; rejected: number };
  consultations: { total: number; completed: number; noShow: number };
  care: { activeEnrollments: number; openAlerts: number; urgentAlerts: number };
  billing: { paidOrders: number; revenueVnd: MoneyVnd; pendingRefunds: number };
  generatedAt: IsoDateTime;
}
```

## 5. REST API catalog

### 5.1 Auth và profile

| ID | Method + path | Role | Request | Response | Status |
|---|---|---|---|---|---|
| AUTH-01 | `POST /auth/register` | Public | patient JSON hoặc doctor multipart | `UserDto` + verification state | Current/normalize |
| AUTH-02 | `POST /auth/send-otp` | Public | `{ email, purpose }` | `{ expiresAt, resendAfter }` | Current/normalize |
| AUTH-03 | `POST /auth/confirm-otp` | Public | `{ email, purpose, code }` | `{ verified, resetToken? }` | Current/normalize |
| AUTH-04 | `POST /auth/login` | Public | `{ email, password, device }` | `{ user, accessToken, expiresIn }` + refresh cookie | Current/refactor |
| AUTH-05 | `POST /auth/refresh` | Cookie/mobile token | refresh credential | `{ accessToken, expiresIn }` | Current/refactor |
| AUTH-06 | `POST /auth/logout` | Authenticated | current session | `204` | Current |
| AUTH-07 | `POST /auth/logout-all` | Authenticated | none | `{ revokedCount }` | Target P0 |
| AUTH-08 | `POST /auth/forgot-password` | Public | `{ email }` | generic accepted response | Current/normalize |
| AUTH-09 | `POST /auth/reset-password` | Public | `{ resetToken, newPassword }` | `204` | Target P0 |
| AUTH-10 | `POST /auth/change-password` | Authenticated local account | `{ currentPassword, newPassword }` | `204` | Current/normalize |
| AUTH-11 | `GET /auth/me` | Authenticated | none | `UserDto` | Current |
| AUTH-12 | `GET /auth/oauth/:provider/start` | Public | redirect params + PKCE | authorization redirect | Target P1; không chặn deadline P0 |
| AUTH-13 | `GET /auth/oauth/:provider/callback` | Public | provider code/state | short-lived frontend callback result | Target P1; không chặn deadline P0 |
| AUTH-14 | `GET /auth/sessions` | Authenticated | page/device | danh sách phiên an toàn, không có hash/token/IP đầy đủ | Target P0 |
| AUTH-15 | `POST /auth/sessions/:id/revoke` | Session owner | none + idempotency | revoked session | Target P0 |
| USER-01 | `GET /users/me` | Authenticated | none | `UserDto` | Current |
| USER-02 | `PATCH /users/me` | Authenticated | profile JSON/multipart | `UserDto` | Current/normalize |
| USER-03 | `POST /files` | Authenticated | multipart + purpose | `FileDto` | Target P0 |
| USER-04 | `DELETE /files/:publicId` | Owner/Admin | purpose | `204` | Target P0 |
| USER-05 | `POST /devices` | Authenticated | push token/platform/appVersion | device DTO | Target P1 |
| USER-06 | `DELETE /devices/:id` | Owner | none | `204` | Target P1 |
| USER-07 | `POST /users/me/data-exports` | Authenticated | format, included domains + idempotency | export job/status | Target P0; dữ liệu của chính user |
| USER-08 | `POST /users/me/deletion-requests` | Authenticated | password/re-auth, reason? + idempotency | deletion request/status | Target P0; retention/audit policy |
| USER-09 | `GET /users/me/data-exports/:id` | Owner | none | export status + short-lived download URL when ready | Target P0 |
| USER-10 | `GET /users/me/data-exports` | Owner | status/page | export job page | Target P0 |
| USER-11 | `GET /users/me/deletion-requests/latest` | Owner | none | latest deletion request/status hoặc empty | Target P0 |
| PAT-01 | `POST /patients/me` | Patient | none | patient profile | Current canonical |
| PAT-02 | `GET /patients/me` | Patient | none | patient profile + public user fields | Current canonical |
| PAT-03 | `DELETE /patients/me` | Patient | none | success response | Legacy/deprecate; dùng USER-08 để áp dụng retention/audit |
| PAT-04 | `GET /patients` | Admin | page, limit, sortBy, sortOrder | paginated patient profiles | Current canonical |

`/users/profile`, `/patients/profile` và patient profile `PATCH` không còn được hỗ trợ. Patient profile hiện chỉ có quan hệ `userId`; dữ liệu tài khoản thay đổi qua `PATCH /users/me`.

### 5.2 Doctor discovery và verification

| ID | Method + path | Role | Request/query | Response | Status |
|---|---|---|---|---|---|
| DOC-01 | `GET /doctors` | Patient/Public policy | search, specialty, rating, page | `PageResult<DoctorCardDto>` | Target P0; legacy `/users/doctors` |
| DOC-02 | `GET /doctors/:doctorId` | Patient/Auth | none | `DoctorCardDto` + public profile/settings | Target P0 |
| DOC-03 | `GET /doctors/:doctorId/availability-slots` | Patient | from, to, timezone | `AvailabilitySlotDto[]` available only | Target P0 |
| DOC-04 | `GET /admin/doctors/applications` | Admin | status, search, page | page + verification summary | Current/normalize |
| DOC-05 | `POST /admin/doctors/:id/verify` | Admin | `{ reason? }` | updated doctor profile | Current |
| DOC-06 | `POST /admin/doctors/:id/reject` | Admin | `{ reason }` | updated doctor profile | Current |
| DOC-07 | `PATCH /doctors/me/booking-settings` | Doctor approved | booking settings | updated settings | Target P0 |
| DOC-08 | `GET /doctors/me/reviews` | Doctor | page, rating | `PageResult<ReviewDto>` | Target P0 |

### 5.3 Availability, consultation, queue và chat

| ID | Method + path | Role | Request/query | Response | Status |
|---|---|---|---|---|---|
| CON-01 | `POST /availability-slots` | Doctor approved | startAt, endAt, timezone + idempotency | `AvailabilitySlotDto` | Target P0 |
| CON-02 | `GET /availability-slots` | Doctor | from, to, status | `AvailabilitySlotDto[]` | Target P0 |
| CON-03 | `PATCH /availability-slots/:id/block` | Doctor owner | reason | slot | Target P0 |
| CON-04 | `DELETE /availability-slots/:id` | Doctor owner | none | `204` | Target P0 |
| CON-05 | `POST /consultations/scheduled` | Patient | `{ availabilitySlotId, patientNotes }` + idempotency | `ConsultationDto` | Target P0 |
| CON-06 | `POST /consultations/on-demand` | Patient | `{ doctorId, patientNotes }` + idempotency | `ConsultationDto` | Target P0 |
| CON-07 | `GET /consultations` | Patient/Doctor | mode, requestStatus, sessionStatus, from/to, page | `PageResult<ConsultationDto>` | Current canonical |
| CON-08 | `GET /consultations/:id` | Participant/Admin policy | none | `ConsultationDto` | Target P0 |
| CON-09 | `POST /consultations/:id/accept` | Doctor owner | none + idempotency | consultation | Current canonical |
| CON-10 | `POST /consultations/:id/decline` | Doctor owner | `{ reason? }` | consultation | Current canonical |
| CON-11 | `POST /consultations/:id/cancel` | Participant | `{ reason }` + idempotency | consultation | Target P0 |
| CON-12 | `POST /consultations/:id/check-in` | Patient | consultation consent policyVersion khi có chat/call + idempotency | consultation + queue snapshot | Target P0 |
| CON-13 | `GET /consultations/:id/queue` | Patient participant | none | own position/wait estimate | Target P0 |
| CON-14 | `GET /doctors/me/queue` | Doctor | page/limit | `QueueEntryDto[]` | Target P0 |
| CON-15 | `POST /doctors/me/queue/call-next` | Doctor | idempotency | claimed consultation | Target P0 |
| CON-16 | `POST /consultations/:id/start` | Doctor owner | consultation consent/version đã được Patient chấp nhận | consultation | Target P0 |
| CON-17 | `POST /consultations/:id/complete` | Doctor | `{ doctorNotes? }` | consultation | Current canonical |
| CON-17A | `POST /consultations/:id/resume` | Doctor owner | idempotency | consultation | Target P0; only from interrupted and when Doctor has no active session |
| CON-18 | `GET /chat/consultation/:consultationId` | Participant | cursor, limit | message page | Current canonical |
| CON-19 | `POST /chat/consultation/messages` | Participant | consultationId, content/files/clientMessageId | message | Current canonical |
| CON-20 | `POST /consultations/:id/review` | Patient participant | rating/comment | `ReviewDto` | Target P0; legacy `/reviews` |
| CON-21 | `PATCH /consultations/:id/review` | Patient owner | rating/comment | review | Target P0 |
| CON-22 | `POST /consultations/:id/report` | Participant | violation payload/files | violation | Target P0 |
| CON-23 | `POST /consultations/:id/no-show` | Doctor owner | allowlisted reason + idempotency | consultation `no_show` | Target P0; chỉ từ waiting và đúng time policy |
| CON-24 | `PUT /consultations/:id/follow-up` | Doctor owner | note, nextAction, followUpAt/taskId + idempotency | consultation with follow-up | Target P0 |

### 5.4 Health và AI

| ID | Method + path | Role | Request/query | Response | Status |
|---|---|---|---|---|---|
| HLTH-01 | `GET /health-metrics` | Patient owner | metricType, from/to, page | `PageResult<HealthMetricDto>` | Current/normalize |
| HLTH-02 | `POST /health-metrics` | Patient owner | metric payload | metric + alert summary | Current |
| HLTH-03 | `POST /health-metrics/:id/corrections` | Patient owner | giá trị/thời gian đúng, lý do + idempotency | bản ghi mới có `replacesMetricId`; bản cũ `superseded` | Target P0; thay PATCH ghi đè |
| HLTH-04 | `POST /health-metrics/:id/void` | Patient owner | lý do + idempotency | metric `voided` | Target P0; thay DELETE cứng |
| HLTH-05 | `GET /consultations/:id/health-context` | Doctor participant | metric types/range | metrics + summary | Target P0 |
| AI-01 | `GET /ai/quota` | Patient | none | `AiQuotaDto` | Target P0 |
| AI-02 | `POST /ai/conversations` | Patient | initialQuestion/tags | conversation + messages | Target P0; legacy `/ai-assistant/.../start` |
| AI-03 | `GET /ai/conversations` | Patient | status/search/page | conversation page | Target P0 |
| AI-04 | `GET /ai/conversations/:id` | Owner | cursor/limit | conversation + message page | Target P0 |
| AI-05 | `POST /ai/conversations/:id/messages` | Owner | multipart message/images + idempotency | user message + AI message + quota | Target P0 |
| AI-06 | `PATCH /ai/conversations/:id` | Owner | topic/status | conversation | Target P0 |
| AI-07 | `POST /ai/conversations/:id/archive` | Owner | none + idempotency | conversation `archived` | Target P0; không xóa lịch sử bằng client |
| AI-08 | `POST /consultations/:id/ai-brief` | Doctor participant | none | draft consultation brief | Target P1 |

### 5.5 Chronic Care, người thân và cơ sở y tế

| ID | Method + path | Role | Request/query | Response | Status |
|---|---|---|---|---|---|
| CARE-01 | `GET /care-programs` | Patient/Doctor/Admin | diseaseKey, status, page | `PageResult<CareProgramDto>`; Patient chỉ thấy published | Target P0 |
| CARE-02 | `POST /care-programs` | Admin/Doctor có permission | draft payload hoặc sourceProgramId để clone + idempotency | `CareProgramDto` | Target P1 Builder Lite; seed P0 |
| CARE-03 | `PATCH /care-programs/:id` | Admin/Doctor có permission | draft changes + version | `CareProgramDto` | Target P1; draft only |
| CARE-04 | `POST /care-programs/:id/publish` | Admin | review reason + idempotency | published program | Target P0 cho seed/admin workflow |
| CARE-05 | `POST /care-programs/:id/enrollments` | Doctor approved | patientId, timezone, allowed custom settings | `PatientCareProgramDto` pending | Target P0 |
| CARE-06 | `GET /care-enrollments` | Patient/Doctor | status, programCode, page | authorized enrollment page | Target P0 |
| CARE-07 | `GET /care-enrollments/:id` | Participant/Admin audit policy | none | enrollment + program/task/report summary | Target P0 |
| CARE-08 | `POST /care-enrollments/:id/consent` | Patient owner | policyVersion, purposes, baseline answers + idempotency | updated enrollment | Target P0 |
| CARE-09 | `GET /care-enrollments/:id/tasks` | Participant | status, type, from/to, page | `PageResult<CareTaskDto>` | Target P0 |
| CARE-10 | `POST /care-tasks/:id/responses` | Authorized task actor | structured response + idempotency | updated task | Target P0; metric task hoàn thành từ HLTH-02 |
| CARE-11 | `GET /care-enrollments/:id/reports` | Participant | reportType, page | reports + summaries | Target P0 |
| CARE-12 | `GET /doctors/me/care-alerts` | Assigned Doctor | severity, status, from/to, page | `PageResult<CareAlertDto>` | Target P0 |
| CARE-13 | `POST /care-alerts/:id/acknowledge` | Assigned Doctor | note? + idempotency | updated alert | Target P0 |
| CARE-14 | `POST /care-alerts/:id/resolve` | Assigned Doctor | reason/note + idempotency | updated alert | Target P0 |
| CARE-15 | `POST /care-alerts/:id/dismiss` | Assigned Doctor | allowlisted reason + idempotency | updated alert | Target P0; Admin chỉ audit |
| CARE-16 | `POST /care-alerts/:id/consultations` | Patient/Assigned Doctor policy | scheduled/on-demand input + idempotency | linked `ConsultationDto` | Target P0 |
| CARE-17 | `POST /care-enrollments/:id/actions/:action` | Participant theo policy | `request_pause|pause|resume|complete|cancel`, reason + idempotency | updated enrollment hoặc pause request | Target P0; Doctor pause/resume/complete, Patient request pause/withdraw consent |
| CARE-18 | `GET /care-programs/:id/rules` | Admin/Doctor có permission | version/status/page | rule versions + test summary | Target P0 read; edit P1 Builder Lite |
| CARE-19 | `POST /care-programs/:id/rules` | Admin/Doctor có permission | declarative rule draft + sources | draft rule | Target P1 Builder Lite |
| CARE-20 | `POST /care-programs/:id/simulations` | Admin/Doctor có permission | draft version + test cases | deterministic simulation result | Target P1 Builder Lite |
| CARE-21 | `POST /care-programs/:id/rules/:ruleId/activate` | Admin | review note, evidence + idempotency | active rule/version | Target P0 cho seed publish flow |
| CARE-22 | `GET /admin/care-operations` | Admin | range, programCode, doctorId | bounded operational aggregate | Target P0 |
| CARE-23 | `POST /care-programs/:id/retire` | Admin | reason + idempotency | retired Program version | Target P0 |
| CARE-24 | `POST /care-programs/:id/rules/:ruleId/retire` | Admin | reason + idempotency | retired Rule version | Target P0 |
| CARE-25 | `GET /care-alerts/:id` | Patient owner/Assigned Doctor/Admin audit | none | `CareAlertDto` + bounded evaluation/timeline context | Target P0 |
| CARE-26 | `GET /care-tasks/:id` | Authorized task actor | none | `CareTaskDto` + type-specific approved content/form/action | Target P0 |
| CARE-27 | `GET /care-programs/:id` | Patient/Doctor/Admin theo scope | none | `CareProgramDto` + form/template/source projection phù hợp role | Target P0 |
| CARE-28 | `GET /care-reports/:id` | Enrollment participant | none | `CareReportDto` + authorized `CareSummaryDto[]` | Target P0 |
| CARE-29 | `POST /care-summaries/:id/review` | Assigned Doctor | `review|reject`, note + idempotency | updated Doctor-audience summary | Target P0 khi Doctor review được bật |
| CARE-30 | `PATCH /care-programs/:id/rules/:ruleId` | Admin/Doctor có permission | declarative draft changes + version | updated draft rule | Target P1 Builder Lite; draft only |
| CARE-31 | `POST /care-reports/:id/exports` | Enrollment participant có entitlement | `pdf|csv` + idempotency | export job hoặc short-lived download URL | Target P0 cho quyền lợi export |
| CARE-32 | `GET /care-report-exports/:id` | Export owner | none | export status + short-lived download URL | Target P0 |
| CARE-33 | `GET /care-tasks` | Patient/Doctor theo scope | enrollmentId?, type/status/from/to/page | cross-enrollment `PageResult<CareTaskDto>` | Target P1 cho trang medication; P0 có thể chỉ dùng CARE-09 |
| FAM-01 | `GET /family-links` | Patient/linked family user | direction, status, page | `PageResult<FamilyLinkDto>` | Target P1 sau P0 |
| FAM-02 | `POST /family-links` | Patient | family email/userId, relationship + idempotency | pending link | Target P1; enforce `familyLinkLimit`; revoked/declined/expired pair increments invitationVersion |
| FAM-03 | `POST /family-links/:id/accept` | Invited family user | consent version + idempotency | active link | Target P1 |
| FAM-04 | `POST /family-links/:id/actions/:action` | Patient/linked family user theo policy | `pause|resume|revoke|decline`, reason + idempotency | updated link | Target P1; Patient pause/resume; either party revoke; invitee decline |
| FAM-05 | `PUT /family-links/:id/permissions` | Patient owner | permission allowlist + policyVersion | updated permissions | Target P1 |
| FAM-06 | `GET /admin/family-links` | Admin audit permission | patient/family/status/date/page | scoped links + audit summary | Target P1; không trả dữ liệu sức khỏe |
| FAM-07 | `GET /family-links/:id` | Link participant/Admin audit | none | `FamilyLinkDto` + active permission summary | Target P1 |
| FAC-01 | `GET /medical-facilities/search` | Patient | programId/specialty, area hoặc lat/lng, radius, page | verified internal results; optional labelled map fallback | Target P1 sau Family |
| FAC-02 | `GET /medical-facilities/:id` | Patient/Admin | none | `MedicalFacilityDto` | Target P1 |
| FAC-03 | `POST /admin/medical-facilities/map-candidates` | Admin | provider candidate snapshot | draft facility | Target P1 |
| FAC-04 | `POST /admin/medical-facilities/:id/verify` | Admin | official sources, review note + idempotency | verified facility | Target P1 |
| FAC-05 | `POST /admin/disease-specialties/:id/publish` | Admin | approved mapping version + idempotency | active mapping | Target P1 |
| FAC-06 | `GET /admin/medical-facilities` | Admin | status/source/search/area/page | facility page | Target P1 sau Family |
| FAC-07 | `GET /admin/disease-specialties` | Admin | status/programCode/page | mapping versions | Target P1 sau Family |
| FAC-08 | `PATCH /admin/medical-facilities/:id` | Admin | draft metadata/sources + version | updated draft facility | Target P1; draft only |
| FAC-09 | `POST /admin/medical-facilities/:id/actions/:action` | Admin | `mark_stale|retire`, reason + idempotency | updated facility | Target P1 |
| FAC-10 | `POST /admin/disease-specialties` | Admin | draft mapping + sources + idempotency | draft mapping | Target P1 |
| FAC-11 | `PATCH /admin/disease-specialties/:id` | Admin | draft mapping changes + version | updated draft mapping | Target P1; draft only |

Các command trạng thái luôn kiểm tra `allowedActions` lại ở backend; frontend không được suy ra authorization chỉ từ trạng thái. Clinic/Clinic Admin không có endpoint hoặc actor trong DA2.

### 5.6 Billing, cancel và refund

| ID | Method + path | Role | Request/query | Response | Status |
|---|---|---|---|---|---|
| BILL-01 | `GET /plans` | Authenticated | active only | `PlanDto[]` | Target P0 |
| BILL-02 | `GET /subscriptions/me` | Patient | status/page | subscriptions + effective entitlement | Target P0 |
| BILL-03 | `POST /billing/orders` | Patient | `{ planId, returnUrl }` + idempotency | `PaymentOrderDto` | Target P0 |
| BILL-04 | `GET /billing/orders` | Patient | status/page | order page | Target P0 |
| BILL-05 | `GET /billing/orders/:id` | Owner/Admin | none | order + transaction summary | Target P0 |
| BILL-06 | `POST /billing/orders/:id/cancel` | Owner/Admin | reason + idempotency | order | Target P0 |
| BILL-07 | `GET /billing/vnpay/return` | Public/provider redirect | VNPAY params | redirect/page-safe status only | Target P0 |
| BILL-08 | `GET /billing/vnpay/ipn` | VNPAY | signed params | provider-required acknowledgement | Target P0 |
| BILL-09 | `POST /billing/orders/:id/refunds` | Patient owner | reason/reasonCode + idempotency | `PaymentRefundDto` | Target P1 |
| BILL-10 | `GET /billing/refunds/:id` | Owner/Admin | none | refund | Target P1 |
| BILL-11 | `GET /admin/billing/orders` | Admin | status/date/user/orderCode/page | order page + totals | Target P0 |
| BILL-12 | `GET /admin/billing/orders/:id` | Admin | none | order, transaction, subscription, refund | Target P0 |
| BILL-13 | `GET /admin/billing/refunds` | Admin | status/date/user/page | refund page + status totals | Target P1 |
| BILL-14 | `POST /admin/billing/refunds/:id/approve` | Admin | review note + optional override reason + idempotency | refund approved after server re-evaluation | Target P1 |
| BILL-15 | `POST /admin/billing/refunds/:id/reject` | Admin | rejectionReason | refund rejected | Target P1 |
| BILL-16 | `POST /admin/billing/refunds/:id/reconcile` | Admin | none + idempotency | refreshed refund status | Target P1 |
| BILL-17 | `GET /billing/refunds` | Patient owner | status/page | `PageResult<PaymentRefundDto>` | Target P1 |
| BILL-18 | `GET /subscriptions/me/usage` | Patient | none | effective cycle + AI/consultation/Program/family usage and remaining limits | Target P0 |
| BILL-19 | `POST /admin/billing/orders/:id/reconcile` | Authorized Admin | none + idempotency | refreshed order/transaction/grant status | Target P0; không mark-paid thủ công |

IPN và refund provider callbacks không được gọi bằng browser client. `paymentUrl` chỉ được mở sau khi BILL-03 trả về. Return page luôn gọi BILL-05 để lấy trạng thái nguồn chuẩn.

### 5.7 Notification, moderation và admin dashboard

| ID | Method + path | Role | Request/query | Response | Status |
|---|---|---|---|---|---|
| NOTI-01 | `GET /notifications` | Authenticated | unread/page | notification page | Current/normalize |
| NOTI-02 | `PATCH /notifications/:id/read` | Owner | none | notification | Target P0; normalize current PATCH |
| NOTI-03 | `PATCH /notifications/read-all` | Owner | none | `{ updatedCount }` | Target P0 |
| NOTI-04 | `DELETE /notifications/:id` | Owner | none | `204` | Current |
| MOD-01 | `POST /violations` | Authenticated | type/reason/source/evidence | report | Current/normalize |
| MOD-02 | `GET /admin/violations` | Admin | status/severity/assignee/page | violation page + totals | Target P0; legacy `/violations` |
| MOD-03 | `GET /admin/violations/:id` | Admin | none | violation detail | Target P0 |
| MOD-04 | `PATCH /admin/violations/:id` | Admin | status/severity/assignment/resolution | violation | Target P0 |
| ADM-01 | `GET /admin/dashboard` | Admin | date range | aggregated cards/charts | Target P0 |
| ADM-02 | `GET /admin/users` | Admin | role/status/search/page | user page + totals | Target P0; replaces browser merge |
| ADM-03 | `POST /admin/users/:id/lock` | Admin | reason | user | Current |
| ADM-04 | `POST /admin/users/:id/unlock` | Admin | none | user | Current |
| ADM-05 | `POST /admin/users/admins` | Super admin | user/admin role payload | user | Target P0; replaces `/admins` |
| ADM-06 | `PATCH /admin/users/admins/:id` | Super admin | adminRole | user | Target P0 |
| ADM-07 | `GET /admin/plans` | Authorized Admin | status/page | plan page | Target P0 |
| ADM-08 | `POST /admin/plans` | Super admin | plan draft hoặc sourcePlanId để clone + idempotency | draft plan | Target P0 |
| ADM-09 | `PATCH /admin/plans/:id` | Super admin | mutable draft fields + version | plan | Target P0; draft only |
| ADM-10 | `GET /admin/ai/documents` | AI admin | status/page/search | document page | Target P0; legacy `/ai-documents` |
| ADM-11 | `POST /admin/ai/documents` | AI admin | multipart | document processing | Target P0 |
| ADM-12 | `PATCH /admin/ai/documents/:id` | AI admin | metadata bản `pending_review`; bản approved không sửa trực tiếp | document | Target P0 |
| ADM-13 | `POST /admin/ai/documents/:id/archive` | AI admin | reason + idempotency | document `archived` | Target P0; không hard-delete |
| ADM-14 | `GET /admin/ai/blacklist-keywords` | AI admin | search/page | keyword page | Target P0 |
| ADM-15 | `POST /admin/ai/blacklist-keywords` | AI admin | keyword | keyword | Target P0 |
| ADM-16 | `PATCH /admin/ai/blacklist-keywords/:id` | AI admin | keyword | keyword | Target P0 |
| ADM-17 | `DELETE /admin/ai/blacklist-keywords/:id` | AI admin | none | `204` | Target P0 |
| ADM-18 | `GET /admin/ai/documents/:id` | AI admin | none | `AiDocumentAdminDto` + bounded chunk/error summary | Target P0 |
| ADM-19 | `POST /admin/ai/documents/:id/review` | AI admin | `approve|reject`, reason, effective dates + idempotency | reviewed document | Target P0; duyệt cấp document, không duyệt từng chunk |
| ADM-20 | `POST /admin/ai/documents/:id/reingest` | AI admin | parser/chunker/embedding version + idempotency | processing job | Target P1 |
| ADM-21 | `GET /admin/users/:id` | User admin | none | user detail + bounded status/audit summary | Target P0 |
| ADM-22 | `POST /admin/plans/:id/publish` | Super admin | review note + idempotency | published Plan version | Target P0 |
| ADM-23 | `POST /admin/plans/:id/retire` | Super admin | reason + idempotency | retired Plan version | Target P0 |
| ADM-24 | `GET /admin/audit-logs` | Authorized Admin | domain, actor, entityType/id, date, page | `PageResult<AuditLogDto>` | Target P0 |
| ADM-25 | `GET /admin/audit-logs/:id` | Authorized Admin | none | `AuditLogDto` | Target P0 |
| ADM-26 | `GET /admin/plans/:id` | Authorized Admin | none | `PlanDto` + version/audit summary | Target P0 |
| ADM-27 | `POST /admin/ai/documents/:id/chunks/:chunkId/exclude` | AI admin | allowlisted reason + idempotency | updated bounded chunk summary | Target P0 secondary action; không đổi approval document |

### 5.8 Dashboard projections

| ID | Method + path | Role | Request/query | Response | Status |
|---|---|---|---|---|---|
| DASH-01 | `GET /patients/me/dashboard` | Patient | timezone | today tasks, latest metrics, open alerts, active programs, upcoming consultations, usage summary | Target P0; bounded projection |
| DASH-02 | `GET /doctors/me/dashboard` | Approved Doctor | timezone | current consultation, urgent alerts, pending requests, queue summary, today schedule, reviews due | Target P0; bounded projection |

### 5.9 Mô tả chức năng chi tiết cho từng REST API

Mục này giải thích **mục đích nghiệp vụ và hành vi chính** của từng API ID. Method, path, role, request, response và mức ưu tiên vẫn tra ở các bảng 5.1–5.8. Với API mutation, backend luôn kiểm tra authorization, state transition và idempotency trước khi ghi dữ liệu; các side effect như notification, audit hoặc worker job chỉ được phát sau khi transaction chính thành công.

#### Authentication, User và Patient

| ID | Chức năng và hành vi chính |
|---|---|
| AUTH-01 | Tạo tài khoản Patient hoặc Doctor. Chuẩn hóa email, kiểm tra trùng, hash mật khẩu; Doctor được tạo ở trạng thái chờ duyệt và chưa có quyền clinical. |
| AUTH-02 | Tạo OTP theo đúng purpose, lưu hash/attempt/TTL trong Redis và áp dụng cooldown/rate limit; phản hồi không để lộ thông tin nhạy cảm. |
| AUTH-03 | Xác minh OTP còn hạn và đúng purpose; tăng attempt khi sai, vô hiệu OTP khi thành công và trả kết quả phù hợp cho verify/reset flow. |
| AUTH-04 | Xác thực credential và trạng thái account; tạo session/rotation family, trả access token ngắn hạn và đặt refresh cookie an toàn trên Web. |
| AUTH-05 | Xác minh refresh credential với hash trong AuthSessions, rotate một lần và thu hồi token cũ; replay phải revoke cả session family. |
| AUTH-06 | Thu hồi session hiện tại, xóa refresh cookie và ngắt quyền refresh; không ảnh hưởng các thiết bị khác. |
| AUTH-07 | Thu hồi toàn bộ session của user, dùng khi user chủ động logout-all hoặc cần phản ứng bảo mật; access token cũ hết hiệu lực theo policy. |
| AUTH-08 | Khởi tạo luồng quên mật khẩu và gửi hướng dẫn/OTP nếu account phù hợp; luôn trả thông báo chung để chống dò email. |
| AUTH-09 | Kiểm tra reset token/OTP và chính sách mật khẩu, cập nhật password hash rồi thu hồi các session cũ để ngăn tiếp tục sử dụng token bị lộ. |
| AUTH-10 | Đổi mật khẩu cho local account sau khi xác minh mật khẩu hiện tại; OAuth-only account phải dùng luồng thiết lập mật khẩu riêng nếu được hỗ trợ. |
| AUTH-11 | Trả identity hiện hành cho bootstrap ứng dụng: public profile, role, account/verification state và capability cần thiết; không trả secret/hash. |
| AUTH-12 | Khởi tạo OAuth authorization với state, PKCE và callback allowlist; chỉ redirect tới provider được cấu hình và đang bật. |
| AUTH-13 | Xử lý callback OAuth, kiểm tra state/code, link hoặc tạo account theo policy rồi hoàn tất session mà không đưa provider secret ra frontend. |
| AUTH-14 | Liệt kê các phiên đăng nhập của chính user theo thiết bị/thời gian hoạt động; chỉ trả metadata an toàn để nhận diện phiên. |
| AUTH-15 | Thu hồi một phiên cụ thể thuộc user, thường dùng khi phát hiện thiết bị lạ; không cho user revoke session của người khác. |
| USER-01 | Lấy hồ sơ tài khoản hiện tại dùng cho Profile và app shell; đây là projection public-safe, không phải raw Users document. |
| USER-02 | Cập nhật các trường hồ sơ được phép như tên, liên hệ, địa chỉ hoặc avatar; role, verification và adminRole không được client tự sửa. |
| USER-03 | Upload file theo purpose, MIME, magic bytes, size và ownership policy; trả FileDto để gắn vào entity bằng API nghiệp vụ tiếp theo. |
| USER-04 | Gỡ file do user sở hữu khi chưa bị entity/audit policy giữ lại; backend đồng thời dọn metadata/storage theo quy trình an toàn. |
| USER-05 | Đăng ký hoặc cập nhật push token của thiết bị, gắn platform/appVersion với user và bảo đảm một token không thuộc nhiều account đang hoạt động. |
| USER-06 | Vô hiệu đăng ký push của thiết bị khi logout, đổi token hoặc user tắt thông báo; không xóa notification trong app. |
| USER-07 | Tạo job xuất dữ liệu cá nhân theo domain/format được phép; job chạy nền, có audit và tạo liên kết tải xuống hết hạn. |
| USER-08 | Gửi yêu cầu xóa tài khoản sau re-auth; áp dụng retention, anonymization và audit policy thay vì xóa cứng ngay lập tức. |
| USER-09 | Xem trạng thái một export job của chính user và nhận URL tải ngắn hạn khi job hoàn tất. |
| USER-10 | Liệt kê lịch sử export job của user để theo dõi pending/completed/expired/failed mà không lộ đường dẫn storage nội bộ. |
| USER-11 | Trả yêu cầu xóa dữ liệu gần nhất để UI giải thích trạng thái xử lý, thời gian dự kiến và phần dữ liệu phải tiếp tục lưu. |
| PAT-01 | Tạo Patient profile tối thiểu gắn với Users khi account chưa có profile; thao tác phải idempotent để không tạo bản ghi trùng. |
| PAT-02 | Trả Patient profile của chính account cùng các public user fields cần cho Care/health UI. |
| PAT-03 | API xóa profile kiểu cũ; chỉ giữ tạm cho migration và phải chuyển sang USER-08 để tuân thủ retention/audit. |
| PAT-04 | Cho Admin xem danh sách Patient có phân trang và projection giới hạn; không trả mặc định HealthMetrics, AI conversation hoặc chat content. |

#### Doctor discovery và verification

| ID | Chức năng và hành vi chính |
|---|---|
| DOC-01 | Tìm Doctor active + approved theo từ khóa/chuyên khoa/rating; trả card phân trang, presence tạm thời và lịch gần nhất nếu được phép. |
| DOC-02 | Trả hồ sơ công khai của một Doctor đã duyệt, rating aggregate và booking policy đã diễn giải; không trả tài liệu xác minh nội bộ. |
| DOC-03 | Trả slot available của Doctor trong khoảng thời gian và timezone yêu cầu; loại slot booked/blocked/expired trước khi gửi cho Patient. |
| DOC-04 | Liệt kê hồ sơ Doctor cần Admin xét duyệt theo status/search; kèm summary và URL tài liệu có authorization/thời hạn. |
| DOC-05 | Approve hồ sơ Doctor sau kiểm tra; cập nhật verification atomically, ghi audit và phát notification sau commit. |
| DOC-06 | Reject hồ sơ Doctor với lý do bắt buộc; giữ tài liệu/lịch sử để Doctor sửa và nộp lại, đồng thời ghi audit. |
| DOC-07 | Cập nhật bookingSettings của Doctor trong hard limits hệ thống; giá trị mới chỉ áp dụng booking sau đó, consultation cũ dùng snapshot. |
| DOC-08 | Trả rating aggregate và review published của Doctor có phân trang; Doctor chỉ đọc, không sửa hoặc xóa phản hồi của Patient. |

#### Availability, Consultation, Queue và Chat

| ID | Chức năng và hành vi chính |
|---|---|
| CON-01 | Tạo slot làm việc cho Doctor approved; kiểm tra timezone, thời lượng, overlap và buffer trước khi ghi. |
| CON-02 | Liệt kê slot của chính Doctor theo khoảng thời gian/status để vận hành calendar; kết quả luôn bounded. |
| CON-03 | Chuyển slot available sang blocked với lý do; không cho block slot đã booked hoặc gây thay đổi consultation hiện hữu. |
| CON-04 | Xóa slot chưa được sử dụng theo policy; slot booked phải được xử lý qua lifecycle consultation, không xóa trực tiếp. |
| CON-05 | Đặt scheduled consultation bằng cách claim một AvailabilitySlot atomically, reserve consultation quota và chụp booking settings; conflict trả 409. |
| CON-06 | Tạo on-demand request tới Doctor, reserve quota và ngăn trùng một pending request cho cùng cặp Patient–Doctor. |
| CON-07 | Liệt kê consultation trong scope Patient/Doctor theo mode và hai state machine; hỗ trợ filter, pagination và preview tin nhắn. |
| CON-08 | Trả chi tiết consultation cho participant/Admin có quyền, gồm timeline, liên kết Care, queue/call/follow-up và `allowedActions`. |
| CON-09 | Doctor accept on-demand request còn hạn; kiểm tra Doctor approved, xung đột policy và chuyển requestStatus theo conditional update. |
| CON-10 | Doctor decline pending request với lý do tùy policy; release quota reservation và thông báo Patient sau commit. |
| CON-11 | Một participant hủy consultation khi còn trong cửa sổ cho phép; cập nhật slot/quota liên quan và ghi actor/reason. |
| CON-12 | Patient check-in trong cửa sổ hợp lệ, ghi consent cần thiết và đưa consultation vào queue với khóa thứ tự ổn định. |
| CON-13 | Trả riêng vị trí/ETA của Patient trong queue; tuyệt đối không trả danh tính hoặc dữ liệu của Patient khác. |
| CON-14 | Trả queue của Doctor đã được server sắp theo scheduled/on-demand policy, kèm current session và late/wait indicators. |
| CON-15 | Claim nguyên tử consultation kế tiếp cho Doctor; bảo đảm Doctor chỉ có một phiên `in_consultation` và chống hai lần call-next. |
| CON-16 | Doctor bắt đầu consultation đã accepted/waiting và có consent hợp lệ; tạo/authorize room nhưng không phụ thuộc Care Program. |
| CON-17 | Doctor hoàn tất phiên bằng thao tác chủ động, lưu note/thời điểm và count consultation usage; không tự kết thúc theo expected duration. |
| CON-17A | Khôi phục consultation từ interrupted khi Doctor chưa có phiên active khác; giữ timeline gián đoạn và ghi audit. |
| CON-18 | Lấy lịch sử message của consultation theo cursor/page sau khi kiểm tra participant và trạng thái truy cập room. |
| CON-19 | Gửi message/tệp trong consultation; dedupe bằng clientMessageId, kiểm tra file/room authorization và phát event sau persistence. |
| CON-20 | Patient tạo một review cho consultation completed; kiểm tra ownership, unique consultation và rating 1–5 rồi cập nhật aggregate Doctor. |
| CON-21 | Patient sửa review của chính mình trong policy cho phép; cập nhật rating aggregate atomically và lưu moderation history cần thiết. |
| CON-22 | Tạo ViolationReport từ consultation/message được phép, chụp source IDs và evidence mà không cho client tự kết luận vi phạm. |
| CON-23 | Doctor đánh dấu no-show khi consultation đang waiting và đã quá ngưỡng; transition là terminal và xử lý quota theo policy. |
| CON-24 | Doctor tạo/cập nhật kế hoạch follow-up cho consultation, có thể liên kết task; dữ liệu được audit và hiển thị cho Patient theo quyền. |

#### Health Metrics và AI

| ID | Chức năng và hành vi chính |
|---|---|
| HLTH-01 | Trả lịch sử chỉ số hợp lệ của Patient theo loại/khoảng thời gian, kèm trạng thái correction/void để chart không dùng dữ liệu sai. |
| HLTH-02 | Ghi một phép đo append-only, validate unit/range/timezone, kích hoạt rule evaluation và trả safety/alert summary nếu có. |
| HLTH-03 | Tạo bản ghi correction trỏ tới phép đo cũ, chuyển bản cũ thành superseded và chạy lại evaluation; không ghi đè giá trị lịch sử. |
| HLTH-04 | Đánh dấu phép đo là voided với actor/reason, giữ audit và cập nhật các report/evaluation phụ thuộc theo policy. |
| HLTH-05 | Trả health context có giới hạn cho Doctor đang tham gia consultation; scope theo metric/range cần thiết, không mở toàn bộ hồ sơ. |
| AI-01 | Trả quota AI hiệu lực theo ngày hoặc chu kỳ gói, gồm limit/used/reserved/remaining và thời điểm reset; không trộn consultation quota. |
| AI-02 | Tạo hội thoại AI thuộc Patient, kiểm tra entitlement/safety và có thể xử lý câu hỏi đầu tiên qua quota reservation. |
| AI-03 | Liệt kê hội thoại của Patient theo status/search/page, chỉ trả preview cần thiết cho sidebar. |
| AI-04 | Trả một hội thoại và message page có citations đã chuẩn hóa; chỉ owner được truy cập. |
| AI-05 | Nhận câu hỏi/tệp, reserve token, chạy blacklist + RAG trên tài liệu approved, validate output/citation rồi commit hoặc release quota. |
| AI-06 | Cập nhật metadata/lifecycle được phép của hội thoại như display title hoặc completed state; không cho sửa message history. |
| AI-07 | Archive hội thoại để ẩn khỏi danh sách mặc định nhưng vẫn giữ theo retention/audit; thao tác có thể retry an toàn. |
| AI-08 | Sinh bản nháp brief trước consultation từ dữ liệu đã authorize và snapshot có giới hạn; Doctor phải review, AI không tự ghi clinical note. |

#### Chronic Care

| ID | Chức năng và hành vi chính |
|---|---|
| CARE-01 | Liệt kê Care Program theo disease/status; Patient chỉ thấy bản published, Doctor/Admin thấy thêm bản trong permission scope. |
| CARE-02 | Tạo Program draft mới hoặc clone version cũ; lưu schema/template/source có version nhưng chưa tạo task cho Patient. |
| CARE-03 | Sửa Program còn draft với optimistic version check và doctorEditable allowlist; published/retired version là bất biến. |
| CARE-04 | Admin publish Program sau khi validation và review evidence đạt; chỉ một version phù hợp được dùng cho enrollment mới theo policy. |
| CARE-05 | Doctor enroll Patient vào Program published và CareRule active; kiểm tra Doctor assignment, entitlement/limit rồi tạo enrollment pending. |
| CARE-06 | Liệt kê enrollment trong scope Patient hoặc assigned Doctor theo status/program; trả progress, next task và alert/report summary bounded. |
| CARE-07 | Trả workspace của một enrollment gồm snapshot Program/Rule, consent, baseline, progress và các liên kết được authorize. |
| CARE-08 | Patient chấp nhận consent version/purpose/channel và gửi baseline; chỉ activate khi toàn bộ guard 1A cùng hợp lệ. |
| CARE-09 | Liệt kê task của một enrollment theo status/type/time range, bảo toàn timezone và terminal states. |
| CARE-10 | Ghi response hoặc tiến độ cho task phù hợp type/completionRule; chống submit lặp và không cho hoàn thành task missed/terminal. |
| CARE-11 | Liệt kê các report và summary của enrollment theo reportType; lọc audience để Patient không thấy nội dung chỉ dành Doctor. |
| CARE-12 | Trả Priority Inbox của assigned Doctor, sort ổn định theo severity–detectedAt–id và hỗ trợ filter/pagination. |
| CARE-13 | Doctor acknowledge alert open, ghi actor/time/note; gọi lặp không tạo thêm transition hoặc notification trùng. |
| CARE-14 | Doctor resolve alert open/acknowledged với reason/follow-up; resolve trực tiếp tự ghi implicit acknowledge theo quyết định 3A. |
| CARE-15 | Doctor dismiss alert chỉ với reason trong allowlist; trạng thái terminal, Admin chỉ audit chứ không xử lý thay. |
| CARE-16 | Tạo consultation gắn alert theo scheduled/on-demand policy; consultation vẫn là domain độc lập và dùng quota bình thường. |
| CARE-17 | Thực hiện lifecycle enrollment: Patient request pause/withdraw consent; Doctor pause/resume/complete; cancel/complete cần reason và audit. |
| CARE-18 | Liệt kê các CareRule version của Program cùng status, nguồn và test summary; chỉ role có permission được xem draft chi tiết. |
| CARE-19 | Tạo CareRule draft bằng operator declarative allowlist và nguồn tham chiếu; không thực thi rule mới cho Patient. |
| CARE-20 | Chạy deterministic simulation cho Program/Rule draft trên test cases, trả kết quả boundary/missing/repeated để reviewer đánh giá. |
| CARE-21 | Admin activate một Rule đã review và test đạt; ghi version/evidence, retire rule cũ theo policy và không hồi tố enrollment đang chạy. |
| CARE-22 | Trả aggregate vận hành Chronic Care theo range/Program/Doctor: enrollment, adherence và alert/follow-up metrics; không trả raw HealthMetrics. |
| CARE-23 | Retire Program version để ngăn enrollment mới; enrollment hiện hữu tiếp tục theo snapshot trừ khi policy yêu cầu chuyển đổi riêng. |
| CARE-24 | Retire CareRule version để ngăn gán mới; giữ version cho khả năng tái hiện evaluation/report lịch sử. |
| CARE-25 | Trả chi tiết alert và bounded evaluation/timeline context cho Patient, assigned Doctor hoặc Admin audit theo projection khác nhau. |
| CARE-26 | Trả chi tiết task cùng form/content/action theo taskType; chỉ cung cấp nội dung approved và `allowedActions` ở thời điểm đọc. |
| CARE-27 | Trả chi tiết Program và projection schema/template/source theo role; Patient không nhận rule nội bộ hoặc draft content. |
| CARE-28 | Trả một deterministic report và summary đúng audience; report facts vẫn có dù AI summary failed/fallback. |
| CARE-29 | Assigned Doctor review/reject Doctor-audience AI summary, ghi reviewer/note/version; không thay đổi statistics hoặc alert severity. |
| CARE-30 | Sửa CareRule còn draft với version check và operator allowlist; rule active/retired không được chỉnh tại chỗ. |
| CARE-31 | Tạo PDF/CSV export từ report đã authorize sau khi kiểm tra entitlement; file/job có TTL và không chứa field ngoài audience scope. |
| CARE-32 | Trả trạng thái report export và URL tải ngắn hạn cho đúng owner; không trả storage key nội bộ. |
| CARE-33 | Liệt kê task xuyên nhiều enrollment trong scope, dùng cho medication/today view; vẫn bounded và giữ enrollmentId để mở đúng context. |

#### Người thân đồng hành

| ID | Chức năng và hành vi chính |
|---|---|
| FAM-01 | Liệt kê lời mời/liên kết đã gửi hoặc nhận theo direction/status; chỉ trả thông tin quan hệ và permission summary an toàn. |
| FAM-02 | Patient mời một account Patient khác làm người thân; kiểm tra familyLinkLimit, chống self-invite và tái dùng pair bằng invitationVersion. |
| FAM-03 | Người được mời chấp nhận invitation còn hạn cùng consent version; kích hoạt permission riêng, không mặc định cấp quyền xem health data. |
| FAM-04 | Thực hiện pause/resume/revoke/decline theo actor và state machine; revoke/decline/expired có thể được mời lại bằng version mới. |
| FAM-05 | Patient owner thay permission trong allowlist, tạo version/audit và dừng reminder không còn quyền; family user không tự mở rộng quyền. |
| FAM-06 | Cho Admin audit link, invitation version, actor và delivery summary để hỗ trợ tranh chấp; không trả metric/AI/chat/alert reason. |
| FAM-07 | Trả chi tiết một FamilyLink và permission đang hiệu lực cho participant/Admin audit; projection phụ thuộc role. |

#### Danh mục cơ sở y tế

| ID | Chức năng và hành vi chính |
|---|---|
| FAC-01 | Tìm cơ sở theo Program/disease mapping, specialty, khu vực hoặc khoảng cách; ưu tiên verified internal và gắn nhãn map fallback. |
| FAC-02 | Trả chi tiết cơ sở, nguồn, trạng thái xác minh, liên hệ và lý do khớp; không khẳng định chất lượng hoặc lịch trống chưa tích hợp. |
| FAC-03 | Admin chọn một kết quả map provider để tạo draft, chụp provider/placeId/source; candidate không tự trở thành verified. |
| FAC-04 | Admin verify draft sau khi bổ sung nguồn chính thức và checklist; ghi reviewer/time/audit trước khi cho Patient tìm thấy như verified. |
| FAC-05 | Publish một DiseaseSpecialty mapping version đã duyệt để search dùng deterministic specialty allowlist. |
| FAC-06 | Liệt kê facility draft/verified/stale/retired theo nguồn, khu vực và search để Admin vận hành danh mục. |
| FAC-07 | Liệt kê các version ánh xạ disease/program–specialty cùng lifecycle và nguồn phê duyệt. |
| FAC-08 | Sửa metadata/source của facility còn draft với version check; verified record phải qua lifecycle thay vì sửa ngầm dữ liệu đã công bố. |
| FAC-09 | Đánh dấu facility stale hoặc retired với reason; kết quả không còn được xem như verified active và cache search phải invalidate. |
| FAC-10 | Tạo draft DiseaseSpecialty mapping mới từ danh sách chuyên khoa và nguồn do Admin kiểm soát. |
| FAC-11 | Sửa mapping còn draft với optimistic version check; active/retired mapping là bất biến. |

#### Subscription, Payment và Refund

| ID | Chức năng và hành vi chính |
|---|---|
| BILL-01 | Trả các Plan published đang bán với version, giá, quota, benefits và refund policy; không trả draft/retired cho Patient. |
| BILL-02 | Trả subscription history và effective entitlement của Patient, gồm plan snapshot/chu kỳ/thay đổi kế tiếp; một user chỉ có một active subscription. |
| BILL-03 | Tạo PaymentOrder từ Plan server-side, chụp immutable snapshot, kiểm tra duplicate/idempotency và trả URL VNPAY; không tin amount từ client. |
| BILL-04 | Liệt kê order của Patient theo status/page để hiển thị lịch sử; transaction payload nhạy cảm không nằm trong response. |
| BILL-05 | Trả order detail và safe transaction summary; đây là source of truth sau VNPAY return thay vì query success trên URL. |
| BILL-06 | Hủy order chưa thanh toán khi còn trạng thái cho phép; transition conditional để không thắng race với IPN paid. |
| BILL-07 | Nhận browser redirect từ VNPAY, xác minh dữ liệu cần thiết rồi chỉ redirect/hiển thị trạng thái an toàn; không grant subscription tại browser. |
| BILL-08 | Nhận IPN có chữ ký từ VNPAY, xử lý idempotent payment state và outbox grant; trả acknowledgement đúng đặc tả provider. |
| BILL-09 | Tạo một full-refund request cho paid order, snapshot policy/usage, đánh giá sơ bộ và pause paid-only benefits khi request được nhận. |
| BILL-10 | Trả refund detail cho owner/Admin với status, reason codes và usage snapshot phù hợp; ẩn gateway/internal error khỏi Patient. |
| BILL-11 | Liệt kê PaymentOrder cho Admin theo status/date/user/orderCode, kèm totals và reconciliation flags; luôn phân trang. |
| BILL-12 | Trả Admin detail gồm order snapshot, safe transaction, subscription grant/outbox và refund relation để điều tra đối soát. |
| BILL-13 | Liệt kê refund queue theo status/date/user với eligibility và snapshot summary để Admin xử lý. |
| BILL-14 | Admin approve refund sau khi server re-evaluate usage; override cần reason và không được vượt invariant amount/provider/idempotency. |
| BILL-15 | Admin reject refund với lý do, ghi audit và resume paid benefits khi policy cho phép; không gọi provider refund. |
| BILL-16 | Đối soát lại refund processing/unknown với provider bằng request id ổn định; cập nhật trạng thái mà không tạo refund lần hai. |
| BILL-17 | Liệt kê refund của Patient theo status/page để theo dõi yêu cầu và mở detail. |
| BILL-18 | Trả usage trong chu kỳ hiệu lực: AI token/request, consultation reserved/counted, Program và family links used/remaining. |
| BILL-19 | Admin đối soát order/transaction/grant bị lệch hoặc IPN đến muộn; command idempotent và không cho mark-paid thủ công. |

#### Notification và Moderation

| ID | Chức năng và hành vi chính |
|---|---|
| NOTI-01 | Trả inbox notification của user theo unread/page, gồm resource deep-link an toàn; notification in-app đã được persist trước external delivery. |
| NOTI-02 | Đánh dấu một notification thuộc user là đã đọc theo idempotent update và trả thời điểm đọc. |
| NOTI-03 | Đánh dấu toàn bộ notification hiện có của user là đã đọc, trả số bản ghi thay đổi và không ảnh hưởng user khác. |
| NOTI-04 | Xóa/ẩn notification khỏi inbox của owner theo retention policy; không xóa entity nghiệp vụ được liên kết. |
| MOD-01 | Tạo ViolationReport từ source/evidence được authorize, validate upload và đưa vào hàng đợi kiểm duyệt; AI chưa phải kết luận. |
| MOD-02 | Liệt kê report cho Admin theo status/severity/assignee với totals và phân trang để triage. |
| MOD-03 | Trả report detail, evidence và source context được phép cho Admin; không mở rộng sang dữ liệu ngoài phạm vi báo cáo. |
| MOD-04 | Cập nhật assignment/severity/workflow/resolution theo transition hợp lệ; action cảnh cáo/khóa tài khoản dùng command tương ứng và ghi audit. |

#### Web Admin

| ID | Chức năng và hành vi chính |
|---|---|
| ADM-01 | Trả dashboard aggregate theo date range cho Users, Doctors, Consultations, Care và Billing; không gửi collections thô để browser tự đếm. |
| ADM-02 | Tìm/lọc user theo role/status với totals và pagination; projection đủ cho bảng quản trị, không kèm health/chat/AI content. |
| ADM-03 | Khóa account với reason, revoke session/capability liên quan, ghi audit và phát account-banned notification sau commit. |
| ADM-04 | Mở khóa account theo permission, ghi audit; không tự khôi phục verification hoặc subscription đã hết hạn. |
| ADM-05 | Super Admin tạo/gán Admin capability cho user hợp lệ, kiểm tra role conflict và ghi audit. |
| ADM-06 | Super Admin đổi adminRole trong enum canonical; ngăn tự hạ quyền gây mất quản trị cuối cùng theo policy. |
| ADM-07 | Liệt kê mọi Plan version cho Admin theo status/page, gồm effective dates để quản lý lifecycle. |
| ADM-08 | Tạo Plan draft mới hoặc clone version cũ; validate hard ceilings nhưng chưa làm thay đổi entitlement hiện hành. |
| ADM-09 | Sửa Plan còn draft với version check; published/retired Plan không chỉnh trực tiếp. |
| ADM-10 | Liệt kê tài liệu AI theo processing/review/search/page để vận hành ingestion và review. |
| ADM-11 | Upload tài liệu RAG cùng metadata nguồn; chống duplicate bằng checksum và enqueue pipeline parse/chunk/embed. |
| ADM-12 | Sửa metadata của document còn pending_review; approved document phải tạo version/re-ingest flow thay vì sửa ngầm citation source. |
| ADM-13 | Archive document với reason, loại nó khỏi retrieval mới nhưng giữ metadata/chunk/audit phục vụ lịch sử. |
| ADM-14 | Liệt kê blacklist keyword theo search/page cho AI Admin mà không hiển thị raw Patient prompts. |
| ADM-15 | Tạo keyword sau normalize/dedupe và ghi audit; keyword được dùng trong safety filter theo policy. |
| ADM-16 | Sửa keyword hiện có, normalize và kiểm tra conflict trước khi cập nhật. |
| ADM-17 | Xóa keyword theo policy/audit; không ảnh hưởng message lịch sử đã tạo. |
| ADM-18 | Trả document detail, metadata nguồn, preview và bounded processing/chunk/error summary; không trả embedding vector. |
| ADM-19 | AI Admin approve/reject document ở cấp tài liệu với reason/effective dates; trạng thái được denormalize xuống chunk, không duyệt từng chunk. |
| ADM-20 | Khởi chạy re-ingestion bằng pipeline version mới, giữ document/version history và tránh hai job trùng qua idempotency. |
| ADM-21 | Trả user detail cùng profile/verification/subscription và scoped audit summary; raw secret và health content không được trả mặc định. |
| ADM-22 | Super Admin publish Plan draft sau validation/diff review; bảo đảm một published version/code và áp dụng cho giao dịch mới. |
| ADM-23 | Super Admin retire Plan để ngừng bán/gán mới; order/subscription cũ tiếp tục dùng immutable snapshot. |
| ADM-24 | Tìm AuditLogs theo domain/actor/entity/action/date với pagination và redacted metadata; log là read-only. |
| ADM-25 | Trả một audit event chi tiết nếu Admin có quyền với domain/entity tương ứng; không trả secret hoặc raw health payload. |
| ADM-26 | Trả Plan version detail, refund policy, benefits và bounded audit/version summary cho editor/compare view. |
| ADM-27 | Exclude một chunk lỗi/duplicate/unsafe khỏi retrieval với reason; không thay đổi approval của toàn document và không xóa chunk. |

#### Dashboard projection

| ID | Chức năng và hành vi chính |
|---|---|
| DASH-01 | Tổng hợp dữ liệu “hôm nay” cho Patient theo timezone: tasks, latest metrics, alerts, Programs, consultations và usage; mỗi nhóm có giới hạn rõ. |
| DASH-02 | Tổng hợp hàng đợi công việc Doctor: current session, urgent alerts, pending requests, queue, lịch hôm nay và review cần làm; không tải toàn bộ lịch sử. |

## 6. Realtime contract

### 6.1 Kết nối

```text
Namespaces target: /consultations, /notifications, /presence
Handshake auth: access token
Reconnect: exponential backoff + rejoin authorized consultation rooms
Server ack: { ok, data?, error?: ApiError }
```

Frontend không tự join room theo ID bất kỳ. Server xác minh participant/role trước khi join.

### 6.2 Event catalog

| Event | Direction | Payload | Page tác động |
|---|---|---|---|
| `presence.v1.set` | Doctor client → server | `{ state: "online" | "offline" }` | Doctor app shell/dashboard; server vẫn áp dụng heartbeat/TTL |
| `presence.v1.changed` | server → client | `{ userId, state, lastOnlineAt }` | Doctor list, consultation header |
| `consultation.v1.join` | client → server | `{ consultationId }` | Consultation room |
| `consultation.v1.updated` | server → client | `ConsultationDto` hoặc patch + version | Lists, detail, queue |
| `message.v1.send` | client → server | `{ consultationId, clientMessageId, content, attachments }` | Chat room |
| `message.v1.created` | server → client | `ConsultationMessageDto` | Chat, list preview |
| `message.v1.failed` | server → client | `{ clientMessageId, code, message }` | Chat retry state |
| `queue.v1.changed` | server → client | `{ consultationId, position, estimatedWaitMinutes, version }` | Patient queue, doctor queue |
| `queue.v1.called` | server → client | `{ consultationId, calledAt }` | Patient queue/call CTA |
| `call.v1.offer` | bidirectional | consultationId + SDP | Call UI |
| `call.v1.answer` | bidirectional | consultationId + SDP | Call UI |
| `call.v1.ice` | bidirectional | consultationId + ICE candidate | Call UI |
| `call.v1.ended` | server → client | `{ consultationId, reason, endedAt }` | Call/consultation detail |
| `notification.v1.created` | server → client | `NotificationDto` | Global notification store |
| `care-enrollment.v1.updated` | server → client | enrollment ID/status/version | Patient/Doctor Care Program detail |
| `care-task.v1.updated` | server → client | task ID/status/version | Patient task list/dashboard |
| `care-alert.v1.created` | server → client | safe alert summary | Doctor Priority Inbox, Patient alert banner |
| `care-alert.v1.updated` | server → client | alert ID/status/version | Priority Inbox/detail |
| `care-report.v1.ready` | server → client | report ID, enrollment ID, reportType | Patient/Doctor Care workspace |
| `family-link.v1.updated` | server → client | link ID/status/version | Patient/family invitation page P1 |
| `account.v1.banned` | server → client | `{ reason }` | Global logout/ban modal |
| `payment.v1.updated` | server → client | safe PaymentOrder status payload | Payment result/history |
| `refund.v1.updated` | server → client | safe PaymentRefund status payload | Refund detail/admin queue |

REST vẫn là source of truth sau reconnect. Event chỉ cập nhật cache hoặc kích hoạt refetch, không thay thế persistence.

## 7. Query key và invalidation

```ts
const queryKeys = {
  me: ["me"],
  authSessions: (filter: unknown) => ["auth-sessions", filter],
  dataExports: (filter: unknown) => ["data-exports", filter],
  patientDashboard: (timezone: string) => ["patient-dashboard", timezone],
  doctorDashboard: (timezone: string) => ["doctor-dashboard", timezone],
  doctors: (filter: unknown) => ["doctors", filter],
  doctor: (id: Id) => ["doctor", id],
  slots: (doctorId: Id, range: unknown) => ["slots", doctorId, range],
  consultations: (filter: unknown) => ["consultations", filter],
  consultation: (id: Id) => ["consultation", id],
  messages: (id: Id) => ["consultation-messages", id],
  queue: (doctorIdOrConsultationId: Id) => ["queue", doctorIdOrConsultationId],
  healthMetrics: (filter: unknown) => ["health-metrics", filter],
  carePrograms: (filter: unknown) => ["care-programs", filter],
  careEnrollments: (filter: unknown) => ["care-enrollments", filter],
  careEnrollment: (id: Id) => ["care-enrollment", id],
  careTasks: (enrollmentId: Id, filter: unknown) => ["care-tasks", enrollmentId, filter],
  careTask: (id: Id) => ["care-task", id],
  careAlerts: (filter: unknown) => ["care-alerts", filter],
  careAlert: (id: Id) => ["care-alert", id],
  careReports: (enrollmentId: Id) => ["care-reports", enrollmentId],
  careReport: (id: Id) => ["care-report", id],
  familyLinks: (filter: unknown) => ["family-links", filter],
  medicalFacilities: (filter: unknown) => ["medical-facilities", filter],
  medicalFacility: (id: Id) => ["medical-facility", id],
  aiConversations: (filter: unknown) => ["ai-conversations", filter],
  aiConversation: (id: Id) => ["ai-conversation", id],
  aiQuota: ["ai-quota"],
  plans: ["plans"],
  subscriptions: ["subscriptions", "me"],
  subscriptionUsage: ["subscriptions", "me", "usage"],
  paymentOrders: (filter: unknown) => ["payment-orders", filter],
  paymentOrder: (id: Id) => ["payment-order", id],
  refunds: (filter: unknown) => ["refunds", filter],
  refund: (id: Id) => ["refund", id],
  notifications: (filter: unknown) => ["notifications", filter],
  adminDashboard: (range: unknown) => ["admin-dashboard", range],
  adminUsers: (filter: unknown) => ["admin-users", filter],
  adminUser: (id: Id) => ["admin-user", id],
  adminPlans: (filter: unknown) => ["admin-plans", filter],
  aiDocuments: (filter: unknown) => ["ai-documents", filter],
  aiDocument: (id: Id) => ["ai-document", id],
  auditLogs: (filter: unknown) => ["audit-logs", filter],
  violations: (filter: unknown) => ["violations", filter],
};
```

| Mutation/event | Cache cần invalidate/update |
|---|---|
| Book/cancel slot | slots, consultations, consultation detail |
| Accept/decline/check-in/call-next/complete | consultations, detail, queue, dashboard |
| Message created | append messages by `clientMessageId`; update consultation preview |
| Review created/updated | consultation detail, doctor detail/list, doctor reviews |
| Health metric mutation | health metrics, patient dashboard; AI quota không liên quan |
| Enrollment consent/lifecycle | care enrollment list/detail, tasks, dashboard, Doctor assigned list |
| Care task completed/missed | task list, enrollment detail, adherence, dashboard; report refetch khi ready event đến |
| Care alert created/updated | Doctor Priority Inbox, enrollment detail, Patient alert banner/dashboard |
| Family link/permission updated | family link lists của cả hai phía, entitlement usage và notification preferences |
| Facility verified/retired | Admin facility lists; Patient search cache theo TTL/invalidation event nếu feature bật |
| AI message completed | conversation, conversation list, AI quota |
| Payment IPN/status update | order detail/list, subscriptions, AI quota/entitlement |
| Cancel order | order detail/list |
| Refund update | refund detail/list, order detail/list, subscriptions, AI quota/entitlement |
| Account ban | clear all cache và auth state |

## 8. Page contracts — Public và dùng chung

| Page/route target | Hiện tại | Role | Read | Mutation | Realtime/cache/UI state |
|---|---|---|---|---|---|
| Login `/login` | Current | Public | none | AUTH-04; AUTH-12/13 khi P1 OAuth bật | loading, invalid credentials, rate limit, banned, OAuth callback error; redirect theo role |
| Sign up `/signup` | Current client | Public | optional doctor prefill legacy | AUTH-01, AUTH-02, AUTH-03 | multipart doctor docs; pending-verification success |
| Forgot password `/forgot-password` | Current `/forget-password` | Public | none | AUTH-08, AUTH-02 | generic response chống account enumeration; resend countdown |
| Confirm OTP `/confirm-otp` | Current | Public | navigation state email/purpose | AUTH-03 | expired, attempts exceeded, resend; không lưu OTP |
| Reset password `/reset-password` | Current flow chưa chuẩn | Public | reset token | AUTH-09 | password policy, expired token, success redirect |
| Change password `/settings/security` | Current `/change-password` | Authenticated local | USER/AUTH me | AUTH-10, AUTH-07 | OAuth-only account state; revoke sessions confirmation |
| Privacy & data `/settings/privacy` | New | Authenticated | retention/export/deletion policy | USER-07..11 | re-auth trước yêu cầu nhạy cảm; hiển thị job/request status |
| Profile `/profile` | Current | All | AUTH-11/USER-01 | USER-02, USER-03/04 | invalidate me; doctor verification state; upload progress/error |
| Notifications drawer `/notifications` hoặc global panel | Current partial | All | NOTI-01 | NOTI-02/03/04 | subscribe `notification.v1.created`; unread badge; deep-link allowlist |
| About/Services/Contact | Current static | Public | static content/config | optional contact API | không phụ thuộc business collections |

## 9. Page contracts — Patient

| Page/route target | Mapping hiện tại | Dữ liệu/DTO | API | Realtime và hành động chính |
|---|---|---|---|---|
| Dashboard `/patient/dashboard` | `/patient-overview` | bounded dashboard projection | DASH-01 | notification/consultation/care updates; cards có loading độc lập; detail refetch bằng domain API |
| Doctor discovery `/patient/doctors` | `/my-doctors` | `PageResult<DoctorCardDto>` | DOC-01 | filter/search/page; `presence.v1.changed`; không tạo request trực tiếp từ stale card |
| Doctor detail `/patient/doctors/:id` | modal/card hiện tại | DoctorCardDto, reviews summary, booking settings | DOC-02, DOC-03 | chọn on-demand hoặc sang slot picker; not-approved/not-found state |
| Slot booking `/patient/doctors/:id/book` | New | slots + selected doctor | DOC-03, CON-05 | refetch khi 409; timezone display; idempotency key giữ qua retry |
| Create on-demand request | request modal hiện tại | doctor + patientNotes | CON-06 | handle duplicate pending 409; invalidate consultation lists |
| Consultation list `/patient/consultations` | `/doctor-chat` + `/consultations` | paged ConsultationDto | CON-07 | `consultation.v1.updated`, message preview; tabs upcoming/pending/active/history |
| Consultation detail `/patient/consultations/:id` | doctor-chat selected session | ConsultationDto, messages, review | CON-08, CON-18, CON-11, CON-12, CON-20/21/22 | join room; send message; check-in/cancel/review/report from `allowedActions` |
| Waiting room `/patient/consultations/:id/queue` | New | consultation + own queue snapshot | CON-08, CON-13 | `queue.v1.changed/called`; reconnect refetch; leave/cancel policy |
| Chat/call surface | embedded current chat | Message DTO, FileDto, call state | CON-18/19, USER-03 | message and call events; optimistic message keyed clientMessageId; upload retry |
| Health dashboard `/patient/health` | `/health-metric` | HealthMetricDto page/chart | HLTH-01 | filter metric/date; timezone; loading/empty/error per chart/table |
| Health metric editor | modal current | metric draft | HLTH-02/03/04 | invalidate health/dashboard; critical alert may arrive notification socket |
| Care Programs `/patient/care-programs` | New | authorized PatientCareProgramDto page | CARE-06 | enrollment status, adherence, next task và alert; `care-enrollment.v1.updated` |
| Care Program detail `/patient/care-programs/:id` | New | enrollment, CareTaskDto, alerts, reports | CARE-07/09/11 | consent/baseline qua CARE-08; task response CARE-10; lifecycle actions chỉ từ `allowedActions` |
| Care Task detail `/patient/care-tasks/:id` | New | CareTaskDto + type-specific form/content | CARE-26, CARE-10, HLTH-02 | metric mở editor; check-in form schema; education viewer/progress; appointment mở consultation flow |
| Care Alert detail `/patient/care-alerts/:id` | New | CareAlertDto + safe evaluation/timeline context | CARE-25, CARE-16 | reason codes dễ hiểu, safety template, linked consultation; không hiển thị rule nội bộ nhạy cảm |
| Care report `/patient/care-programs/:id/reports/:reportId` | New | CareReportDto + patient CareSummaryDto | CARE-28/31/32 | deterministic metrics luôn hiển thị; AI fallback/citation state; export theo entitlement |
| Medication tasks `/patient/medications` | New P1, feature-gated | CareTaskDto lọc `medication` | CARE-10/33 | chỉ xác nhận theo kế hoạch có sẵn; không đổi liều/kê đơn; missed là terminal |
| Người thân `/patient/family` | New P1 | FamilyLinkDto page + effective `familyLinkLimit` | FAM-01..05, FAM-07 | invite/accept/pause/resume/revoke; không hiển thị dữ liệu sức khỏe chi tiết |
| Tìm cơ sở y tế `/patient/medical-facilities` | New P1 sau Family | MedicalFacilityDto page | FAC-01/02 | source/verification label, distance và direction URL; không quảng bá xếp hạng chất lượng |
| Chi tiết cơ sở `/patient/medical-facilities/:id` | New P1 sau Family | MedicalFacilityDto | FAC-02 | thông tin liên hệ, chuyên khoa khớp, nguồn/ngày kiểm tra và mở chỉ đường; không mô phỏng lịch trống |
| AI chat `/patient/ai` | `/ai-chat` | conversations/messages/quota | AI-01..07 | optimistic user message; pending AI response; quota rollback on provider failure |
| Plans `/patient/plans` | New | PlanDto[], effective entitlement | BILL-01/02 | plan comparison; hide inactive; no price from client in create order |
| Checkout/payment result `/patient/billing/orders/:id` | New | PaymentOrderDto | BILL-03/05/07 | open payment URL; poll/refetch after return; `payment.v1.updated`; never trust query success alone |
| Billing history `/patient/billing` | New | orders, subscriptions, effective usage, refunds | BILL-02/04/05/10/17/18 | cancel allowed order via BILL-06; CTA based on `allowedActions` |
| Refund request `/patient/billing/orders/:id/refund` | New P1 | paid order + per-benefit eligibility | BILL-05/09 | reason required; show usage/reason codes; paid benefits pause after accepted request; Free/safety remain; feature flag fallback |
| Refund detail `/patient/refunds/:id` | New P1 | PaymentRefundDto + order summary | BILL-10 | `refund.v1.updated`; manual-review explanatory state; no client provider retry |

Patient page guards:

- `role=patient`, `accountStatus=active`.
- Consultation/health/billing ownership vẫn do backend kiểm tra.
- Queue/chat/call route phải xử lý 403 sau khi consultation bị cancel/completed hoặc session bị revoke.

## 10. Page contracts — Doctor

| Page/route target | Mapping hiện tại | Dữ liệu/DTO | API | Realtime và hành động chính |
|---|---|---|---|---|
| Dashboard `/doctor/dashboard` | `/doctor-overview` | bounded Doctor dashboard projection | DASH-02 | consultation/queue/alert notifications; detail refetch bằng domain API |
| Profile/verification `/doctor/profile` | `/profile` | UserDto + DoctorProfileDto | USER-01/02/03/04 | pending/rejected/approved states; reject reason; upload validation |
| Availability `/doctor/availability` | New | AvailabilitySlotDto[] + booking settings | CON-01..04, DOC-07 | calendar timezone; overlap conflict; booked slot không delete/block tùy policy |
| Requests `/doctor/requests` | trong `/consultations` | pending on-demand consultations | CON-07/08/09/10 | `consultation.v1.updated`; accept/decline idempotent; expiry countdown |
| Queue `/doctor/queue` | New | QueueEntryDto[] + current consultation | CON-14/15 | `queue.v1.changed`; call-next atomic; 409 refetch; no manual client reordering |
| Consultation list `/doctor/consultations` | `/consultations` | paged ConsultationDto | CON-07 | tabs request/upcoming/in-progress/history; message preview events |
| Consultation detail `/doctor/consultations/:id` | selected card/chat | consultation/messages/patient health context | CON-08/16/17/18/19/23/24, HLTH-05, AI-08 P1 | join room; start/complete/no-show/follow-up; authorized health range only; AI brief is draft |
| Care enrollment `/doctor/care-programs` | New | published CareProgramDto + assigned enrollment page | CARE-01/05/06/07 | enroll Patient; assignment authorization; pending consent state |
| Priority Inbox `/doctor/care-alerts` | New | CareAlertDto page | CARE-12..16 | stable severity/time sort; acknowledge/resolve/dismiss/link consultation; alert realtime events |
| Alert detail `/doctor/care-alerts/:id` | New | CareAlertDto + metric/evaluation/report context | CARE-25, CARE-13..16 | acknowledge/resolve/dismiss/link consultation; direct resolve ghi implicit acknowledge |
| Patient Care detail `/doctor/care-programs/:id` | New | enrollment, tasks, reports, Doctor summary | CARE-07/09/11/17/28/29 | chỉ assigned Doctor; pause/resume/complete theo `allowedActions`; audit reason bắt buộc |
| Program drafts `/doctor/program-templates` | New P1 Builder Lite | CareProgramDto/rule drafts/simulation | CARE-01..04, CARE-18..20 | Doctor tạo/chỉnh draft theo permission; không publish/activate rule |
| Reviews `/doctor/reviews` | dashboard/list partial | ReviewDto page/summary | DOC-08 | filter/rating; no edit/delete by doctor |
| Notifications/global | Current partial | NotificationDto | NOTI-01..04 | request/check-in/called/message/verification events |

Doctor route guard phải phân biệt:

- Doctor account active nhưng verification pending/rejected: chỉ profile/verification và logout được dùng.
- Doctor approved: mới được availability, requests, queue và consultation actions.

## 11. Page contracts — Admin

| Page/route target | Mapping hiện tại | Dữ liệu/DTO | API | Realtime và hành động chính |
|---|---|---|---|---|
| Dashboard `/admin/dashboard` | `/` | aggregate cards/charts | ADM-01 | date filter; server aggregation; không gọi 5 API rồi tự đếm như hiện tại |
| User management `/admin/users` | `/user-management` | user page + totals | ADM-02..06 | lock/unlock/create admin; confirm modal; invalidate me nếu self-change |
| User detail `/admin/users/:id` | New | UserDto + bounded account/audit summary | ADM-21, ADM-03/04, ADM-24 | khóa/mở khóa cần reason và confirm; không hiển thị raw token/health payload |
| Doctor verification `/admin/doctors/verification` | `/doc-verification` | applications/files/summary | DOC-04..06 | approve/reject reason; file preview; audit result notification |
| Care Program management `/admin/care-programs` | New | CareProgramDto versions/rules | CARE-01..04, CARE-23/24/27 | draft/preview/publish/retire; published version immutable; Admin là publisher |
| Care Program editor `/admin/care-programs/:id` | New | Program draft, rule versions, sources, simulation | CARE-03/04, CARE-18..21, CARE-23/24/27/30 | tabs cấu hình/baseline/tasks/rules/source/preview; publish/activate có review evidence |
| Care operations `/admin/care-operations` | New | bounded aggregate/alert audit | CARE-22, ADM-24/25 | audit/operational metrics; không đóng vai assigned Doctor |
| Family audit `/admin/family-links` | New P1 | scoped FamilyLinkDto/audit | FAM-06, ADM-24 | read/audit để hỗ trợ tranh chấp; không tự mở quyền hoặc xem dữ liệu sức khỏe |
| Medical facilities `/admin/medical-facilities` | New P1 sau Family | drafts, verified facilities, disease mappings | FAC-02..11 | chọn map candidate, sửa draft, xác minh nguồn chính thức, stale/retire, publish mapping |
| AI knowledge `/admin/ai/knowledge` | `/ai-knowledge-base` | documents + processing status | ADM-10..13 | upload progress; processing polling/event; deactivate instead of unsafe hard delete |
| AI document detail `/admin/ai/knowledge/:id` | New | AiDocumentAdminDto + processing/chunk summary | ADM-18..20, ADM-27 | approve/reject ở document level; preview citation metadata; exclude chunk lỗi; re-ingest P1 |
| AI blacklist `/admin/ai/blacklist` | tab hiện tại | keyword page | ADM-14..17 | normalized keyword conflicts; mutation invalidation |
| Plans `/admin/plans` | New | all plans | ADM-07..09 | edit creates future-facing plan version/snapshot behavior; existing orders unchanged |
| Plan editor `/admin/plans/:id` | New | PlanDto version + refund policy/benefits | ADM-07..09, ADM-22/23/26 | chỉ sửa draft; compare version; publish/retire có confirm và audit |
| Payments `/admin/billing/orders` | New | orders/transactions/totals | BILL-11/12 | filters, detail, reconciliation status; no manual mark-paid button |
| Payment detail `/admin/billing/orders/:id` | New | order, safe transaction, subscription grant, refund | BILL-12/19 | timeline trạng thái/IPN/grant; reconcile theo server capability; không sửa paid thủ công |
| Refund queue `/admin/billing/refunds` | New P1 | PaymentRefundDto page/totals | BILL-13..16 | show captured/final usage and reason codes; approve re-evaluates server-side; override requires reason; `refund.v1.updated`; processing action disabled |
| Violation list `/admin/violations` | `/violation-reports` | report page/totals | MOD-02 | filter status/severity/assignee |
| Violation detail `/admin/violations/:id` | modal/page hiện tại | full report/evidence/AI draft | MOD-03/04 | transition validation; admin decision required; ban action through user API |
| Notification campaigns `/admin/notifications/campaigns` | P2/Deferred | campaign page/status | contract chỉ bổ sung nếu feature vào cut-line sau DA2 | worker fan-out status; không gửi hàng loạt trong HTTP request |
| Audit logs `/admin/audit-logs` | New | AuditLogDto page/detail | ADM-24/25 | filter domain/actor/entity/time; read-only; deep-link tới entity nếu được phép |
| Admin profile `/admin/profile` | `/profile` | UserDto | USER-01/02/03/04, AUTH-10 | admin role readonly trừ super-admin workflow |

Admin authorization dùng `adminProfile.adminRole`; ẩn menu chỉ là UX, backend guard vẫn bắt buộc.

## 12. Đặc tả màn hình frontend

Phần này là đầu vào trực tiếp cho sitemap, wireframe, Use Case và kiểm thử chấp nhận. Ký hiệu: **P0** phải có trong bản phát hành; **P1** chỉ thiết kế/triển khai khi qua cut-line; **Deferred** không đưa vào navigation DA2.

Các bảng ở mục 8–11 là **hợp đồng route/API** để lập trình và test; một route chi tiết không đồng nghĩa phải có một thiết kế màn hình độc lập. Mục 12 gom các route liên quan thành **trang/workspace theo mục tiêu người dùng**, rồi liệt kê component ngay trong trang sở hữu. Drawer/dialog vẫn có deep-link khi cần chia sẻ URL hoặc refresh trình duyệt.

| Nhóm giao diện | P0 cần thiết kế/triển khai | P1 sau cut-line | Deferred |
|---|---:|---:|---:|
| Public/dùng chung | 6 trang/luồng | OAuth nằm trong trang Login | 0 |
| Patient | 7 workspace | 2 workspace: Người thân, Cơ sở y tế; call/refund/medication là phần mở rộng | 0 |
| Doctor | 7 workspace | 1 workspace: Program drafts; call là phần mở rộng | 0 |
| Web Admin | 10 workspace nền | 2 workspace: Family audit, Facility; refund là tab mở rộng | 1: Notification Campaign |

Con số trên đếm theo **workspace người dùng nhìn thấy**, không đếm drawer, dialog hoặc route deep-link là trang mới.

### 12.1 App shell và điều hướng

| Kênh | Điều hướng chính | Thành phần dùng chung |
|---|---|---|
| Patient Web/Mobile | Tổng quan, Chương trình, Chỉ số, Tư vấn, Bác sĩ, AI, Gói dịch vụ; Người thân và Cơ sở y tế khi P1 bật | App bar, unread badge, urgent safety banner, subscription/quota summary, profile menu, reconnect/offline indicator |
| Doctor Web/Mobile | Tổng quan, Priority Inbox, Bệnh nhân theo dõi, Yêu cầu, Hàng đợi, Lịch làm việc, Phiên tư vấn, Đánh giá | Verification banner, current-consultation bar, queue badge, notification drawer, profile menu |
| Web Admin | Dashboard, Người dùng, Duyệt bác sĩ, Care Program, Vận hành Care, Tri thức AI, Gói dịch vụ, Thanh toán, Vi phạm, Audit; Family/Facility/Campaign khi P1 bật | Sidebar theo permission, environment badge, global search có giới hạn, audit shortcut, profile menu |

Quy tắc shell:

- Menu lấy từ role, admin permission, feature flags và effective entitlement; ẩn menu không thay backend authorization.
- Urgent safety banner luôn ưu tiên hơn upsell, AI hoặc gợi ý cơ sở y tế và không được đóng vĩnh viễn khi alert còn hiệu lực.
- Badge/counter chỉ dùng aggregate endpoint hoặc realtime event; không tải toàn bộ collection để tự đếm.
- Mobile không có Admin shell. Responsive Web Admin ưu tiên desktop/tablet; màn hình hẹp có thể chỉ đọc đối với bảng rộng.

### 12.2 Public, tài khoản và màn hình dùng chung

#### C-01. Trang Đăng nhập — `/login` — P0, OAuth P1

- **Trang làm gì:** xác thực tài khoản và chuyển đúng workspace theo role.
- **Component:** `LoginForm`, `PasswordField`, `ForgotPasswordLink`, `OAuthButtons` (feature-gated P1), `AuthErrorBanner`, `RateLimitNotice`.
- **Trạng thái bắt buộc:** disable khi submit; lỗi credential chung; xử lý banned, email chưa xác thực, rate limit và OAuth callback; không lưu refresh token web trong JavaScript.

#### C-02. Trang Đăng ký và xác thực — `/signup`, `/confirm-otp` — P0

- **Trang làm gì:** tạo account Patient hoặc Doctor và xác thực email theo luồng từng bước.
- **Component:** `RoleSelector`, `AccountForm`, `PatientProfileFields`, `DoctorProfessionalFields`, `VerificationDocumentUploader`, `RegistrationStepper`, `OtpInput`, `MaskedEmail`, `OtpCountdown`, `ResendOtpAction`, `RegistrationResult`.
- **Trạng thái bắt buộc:** validate từng bước; email trùng; upload progress/retry; OTP không lưu; giới hạn thử/gửi lại; Doctor hoàn tất ở trạng thái chờ duyệt.

#### C-03. Trang Khôi phục mật khẩu — `/forgot-password`, `/reset-password` — P0

- **Trang làm gì:** gửi yêu cầu khôi phục và đặt mật khẩu mới.
- **Component:** `ForgotPasswordForm`, `GenericAcceptedState`, `ResetPasswordForm`, `PasswordStrength`, `TokenExpiredState`.
- **Trạng thái bắt buộc:** phản hồi không làm lộ email tồn tại; token hết hạn; password policy; thành công thu hồi session theo policy.

#### C-04. Trung tâm thông báo — `/notifications` — P0

- **Trang làm gì:** xem thông báo cá nhân được persist từ mọi domain và đi đến đúng tài nguyên.
- **Component:** `NotificationTabs`, `UnreadCounter`, `NotificationList`, `NotificationItem`, `ResourceIcon`, `MarkAllReadAction`, `NotificationEmptyState`.
- **Trạng thái bắt buộc:** phân trang; realtime append + dedupe theo id/uniqueKey; mark one/all; deep-link phải authorize lại; tài nguyên đã mất trả trạng thái an toàn.

#### C-05. Trang trạng thái hệ thống — `403`, `404`, `feature-disabled`, `offline` — P0

- **Trang làm gì:** giải thích vì sao không thể tiếp tục và đưa ra một CTA hợp lệ.
- **Component:** `StatusIllustration`, `StatusExplanation`, `PrimaryRecoveryAction`, `ReconnectAction`, `CorrelationIdCopy` khi có lỗi server.
- **Trạng thái bắt buộc:** 403 không tiết lộ resource tồn tại; flag tắt quay về chức năng P0; offline không tự replay payment/booking với idempotency key mới.

#### C-06. Trang Tài khoản và dữ liệu cá nhân — `/profile`, `/settings/security`, `/settings/privacy` — P0

- **Trang làm gì:** cho mọi role sửa thông tin cơ bản, quản lý mật khẩu/phiên và thực hiện quyền export/xóa dữ liệu; phần chuyên môn Doctor vẫn nằm trong D-02.
- **Component:** `AccountSettingsTabs`, `ProfileForm`, `AvatarUploader`, `PasswordForm`, `SessionList`, `RevokeSessionAction`, `LogoutAllDialog`, `DataExportForm`, `ExportJobList`, `DeletionRequestDialog`, `RetentionNotice`, `UnsavedChangeGuard`.
- **Hành động chính:** cập nhật profile; đổi mật khẩu; revoke một/tất cả phiên; tạo/tải export; gửi deletion request sau re-auth.
- **Trạng thái bắt buộc:** OAuth-only state; link tải hết hạn; role/adminRole chỉ đọc; giải thích dữ liệu phải retention/audit; Admin không có phiên bản Mobile riêng.

### 12.3 Màn hình Patient

Mỗi dòng dưới đây là **một trang hoặc một không gian làm việc hoàn chỉnh**. Dialog, drawer và panel được đặt trong trang sở hữu thay vì được tính thành màn hình độc lập.

#### P-01. Trang Tổng quan — `/patient/dashboard` — P0

- **Trang làm gì:** cho Patient biết ngay hôm nay cần làm gì, có rủi ro nào cần chú ý, lịch tư vấn nào sắp tới và quyền lợi gói còn bao nhiêu.
- **Component:** `SafetyBanner`, `TodayTaskList`, `LatestMetricCards`, `ActiveProgramCard`, `UpcomingConsultationCard`, `OpenAlertCard`, `PlanUsageCard`, `QuickActionBar`.
- **Hành động chính:** nhập chỉ số, mở nhiệm vụ, check-in, xem alert/báo cáo, mở lịch tư vấn.
- **Trạng thái bắt buộc:** từng card tải/lỗi độc lập; urgent luôn đứng đầu; số liệu xác định không bị thay bởi nội dung AI; card không có dữ liệu phải giải thích cách bắt đầu.

#### P-02. Trang Bác sĩ và đặt tư vấn — `/patient/doctors` — P0

- **Trang làm gì:** tìm bác sĩ, xem hồ sơ và slot, sau đó đặt lịch hoặc gửi yêu cầu tư vấn nhanh mà không phải chuyển qua nhiều màn hình rời.
- **Component:** `DoctorSearchBar`, `SpecialtyFilter`, `DoctorCardGrid`, `DoctorDetailDrawer`, `DoctorPublicProfile`, `ReviewSummary`, `AvailabilityCalendar`, `SlotPicker`, `BookingPolicySummary`, `ConsultationQuotaBadge`, `BookingConfirmDialog`, `OnDemandRequestDialog`.
- **Hành động chính:** lọc/tìm; mở drawer chi tiết; chọn slot; xác nhận booking qua CON-05; gửi on-demand qua CON-06.
- **Trạng thái bắt buộc:** phân trang và empty state; refetch hồ sơ/slot trước khi gửi; conflict 409 yêu cầu chọn lại; giữ cùng idempotency key khi retry; Doctor offline không đồng nghĩa không thể đặt lịch; thiếu quota phải giải thích riêng với quota AI.

Route `/patient/doctors/:id` và `/patient/doctors/:id/book` có thể là deep-link vào `DoctorDetailDrawer` và bước chọn lịch của cùng trang, không bắt buộc thiết kế như hai sản phẩm độc lập.

#### P-03. Trang Tư vấn — `/patient/consultations` — P0, cuộc gọi P1

- **Trang làm gì:** quản lý toàn bộ vòng đời scheduled/on-demand từ chờ phản hồi, check-in, hàng đợi, chat/call đến đánh giá sau tư vấn.
- **Component:** `ConsultationTabs`, `ConsultationFilter`, `ConsultationList`, `ConsultationStatusBadge`, `ConsultationDetailPanel`, `StatusTimeline`, `DoctorMiniProfile`, `LinkedCareContext`, `WaitingRoomPanel`, `QueuePositionCard`, `MessageTimeline`, `MessageComposer`, `AttachmentUploader`, `CallPanel`, `FollowUpCard`, `ReviewDialog`, `ViolationReportDialog`.
- **Hành động chính:** hủy/check-in; theo dõi vị trí; chat; tham gia call khi bật; xem follow-up; đánh giá hoặc báo cáo vi phạm.
- **Trạng thái bắt buộc:** dùng đồng thời `requestStatus` và `sessionStatus`; realtime chỉ patch rồi refetch khi reconnect; không lộ người khác trong queue; tin nhắn optimistic theo `clientMessageId`; kết thúc cuộc gọi không tự hoàn thành consultation; mọi nút theo `allowedActions`.

Route `/patient/consultations/:id` và `/patient/consultations/:id/queue` là deep-link tới panel chi tiết/phòng chờ trong trang này.

#### P-04. Trang Chỉ số sức khỏe — `/patient/health` — P0

- **Trang làm gì:** nhập, xem biểu đồ/lịch sử, sửa sai và vô hiệu hóa chỉ số theo nguyên tắc append-only.
- **Component:** `MetricTypeTabs`, `MetricRangeFilter`, `MetricSummaryCards`, `MetricChart`, `MetricHistoryTable`, `MetricSourceBadge`, `ValidationStatusBadge`, `MetricEditorDialog`, `MetricCorrectionDialog`, `MetricVoidDialog`, `MetricSafetyResult`, `DataExportButton`.
- **Hành động chính:** tạo phép đo bằng HLTH-02; sửa sai bằng HLTH-03 tạo record thay thế; void bằng HLTH-04; xuất dữ liệu cơ bản.
- **Trạng thái bắt buộc:** chuẩn hóa unit/timezone; cảnh báo thời điểm cũ/tương lai; bản `superseded/voided` vẫn xem được trong lịch sử nhưng không dùng như giá trị hiện hành; không nối biểu đồ qua vùng thiếu dữ liệu; kết quả urgent hiển thị safety CTA trước AI.

#### P-05. Trang Chương trình chăm sóc — `/patient/care-programs` — P0

- **Trang làm gì:** là workspace chính của Chronic Care: xem các chương trình, hoàn tất onboarding, làm nhiệm vụ, theo dõi tiến độ, alert và báo cáo.
- **Component cấp danh sách:** `ProgramStatusTabs`, `ProgramCard`, `ProgramProgress`, `NextTaskPreview`, `ProgramDoctorCard`, `ProgramAlertBadge`.
- **Component cấp chi tiết:** `ProgramHeader`, `EnrollmentStatusTimeline`, `OnboardingStepper`, `ConsentViewer`, `BaselineFormRenderer`, `TodayTaskList`, `CareTaskDrawer`, `TaskTypeRenderer`, `AdherenceExplanation`, `MetricTrendPanel`, `AlertList`, `AlertDetailDrawer`, `ReportList`, `CareReportViewer`, `AiSummaryPanel`, `CitationDrawer`, `ProgramActionMenu`.
- **Hành động chính:** Patient consent và điền baseline; hoàn thành check-in/education; task metric mở `MetricEditorDialog`; xem alert/report; yêu cầu pause hoặc rút consent/cancel theo policy; mở consultation gắn Program/Alert.
- **Trạng thái bắt buộc:** chỉ active khi đạt guard 1A; `missed/completed/cancelled` là terminal; completed/cancelled program chỉ đọc; thống kê báo cáo vẫn hiện khi AI failed/fallback; compare/export theo entitlement; AI summary không được gọi là chẩn đoán.

Các route `/patient/care-programs/:id/onboarding`, `/patient/care-programs/:id`, `/patient/care-tasks/:id`, `/patient/care-alerts/:id` và `/patient/care-programs/:id/reports/:reportId` là các deep-link tới step/panel tương ứng của workspace. Không cần năm thiết kế navigation rời nhau.

#### P-06. Trang AI sức khỏe — `/patient/ai` — P0

- **Trang làm gì:** hỏi đáp có RAG, xem nguồn trích dẫn và mức token còn lại; không thay thế tư vấn khẩn cấp hoặc bác sĩ.
- **Component:** `ConversationSidebar`, `ConversationHeader`, `AiMessageList`, `AiComposer`, `AttachmentUploader`, `CitationDrawer`, `TokenQuotaMeter`, `SafetyDisclaimer`, `EmergencyAction`, `ArchiveConversationDialog`.
- **Hành động chính:** tạo/mở/archive hội thoại; gửi câu hỏi; mở citation; xem quota kỳ hiện tại.
- **Trạng thái bắt buộc:** reserve/commit/release token rõ ràng; retry không trừ lặp; blocked/safety/provider-failed có thông báo riêng; citation phải có tổ chức, phiên bản, trang/section khi có; fallback không giả là câu trả lời từ nguồn.

#### P-07. Trang Gói dịch vụ và thanh toán — `/patient/billing` — P0, refund P1

- **Trang làm gì:** so sánh Free/Plus/Care, xem gói hiệu lực và usage, tạo/thanh toán đơn, theo dõi lịch sử và yêu cầu hoàn tiền nếu được bật.
- **Component:** `CurrentSubscriptionCard`, `PlanComparison`, `PlanBenefitTable`, `AiUsageMeter`, `ConsultationUsageMeter`, `CareProgramLimit`, `FamilyLinkLimit`, `OrderList`, `OrderDetailDrawer`, `PaymentStatusTimeline`, `VnpayAction`, `ScheduledPlanChangeCard`, `RefundRequestDialog`, `RefundDetailPanel`, `UsageEligibilitySummary`.
- **Hành động chính:** chọn/nâng/hạ gói theo `allowedActions`; tạo order; mở `paymentUrl`; hủy order chưa trả; theo dõi trạng thái; gửi refund P1.
- **Trạng thái bắt buộc:** hiển thị snapshot của order/subscription, không gửi giá từ client; trang return luôn refetch BILL-05; pending/processing polling có backoff; phân biệt token AI và số consultation; không khóa dữ liệu/safety khi hết gói; refund không lộ lỗi provider.

`/patient/plans` và `/patient/billing/orders/:id` có thể là deep-link tới tab hoặc drawer của trang Billing; chỉ tách route để chia sẻ URL và xử lý VNPAY return.

#### P-08. Trang Người thân — `/patient/family` — P1 ưu tiên 1

- **Trang làm gì:** Patient quản lý người được nhắc hỗ trợ, đồng thời tài khoản Patient khác xem và phản hồi lời mời nhận được.
- **Component:** `FamilyLimitUsage`, `SentInvitationList`, `ReceivedInvitationList`, `FamilyMemberCard`, `InviteFamilyDialog`, `RelationshipField`, `PermissionEditor`, `InvitationStatusTimeline`, `ReinviteDialog`, `RevokeDialog`.
- **Hành động chính:** mời, accept/decline, pause/resume, revoke, đổi permission, mời lại.
- **Trạng thái bắt buộc:** giới hạn theo `familyLinkLimit`; mời lại tái dùng record và tăng `invitationVersion`; chỉ chia sẻ loại nhắc `missed_task_reminder/weekly_progress` đã cấp; không hiển thị metric, alert reason, AI hoặc nội dung consultation.

#### P-09. Trang Cơ sở y tế — `/patient/medical-facilities` — P1 sau Family

- **Trang làm gì:** tìm cơ sở phù hợp theo bệnh/chương trình, chuyên khoa và khu vực; hỗ trợ mở chỉ đường chứ chưa thay thế hệ thống đặt lịch của bệnh viện.
- **Component:** `FacilitySearchForm`, `ProgramOrSpecialtySelector`, `LocationConsent`, `RadiusFilter`, `FacilityList`, `FacilityMap`, `FacilityCard`, `VerificationBadge`, `MatchReasonList`, `FacilityDetailDrawer`, `DirectionsAction`, `EmergencySafetyBanner`.
- **Hành động chính:** tìm dữ liệu nội bộ; chủ động mở rộng kết quả map provider; xem chi tiết; gọi/mở website/chỉ đường.
- **Trạng thái bắt buộc:** không lưu lịch sử vị trí mặc định; phân biệt verified và external-unverified; không xếp hạng “tốt nhất”; không hiển thị lịch trống/đặt lịch nếu chưa có tích hợp chính thức; urgent CTA đứng trước kết quả.

Route `/patient/medical-facilities/:id` là deep-link mở `FacilityDetailDrawer`.

### 12.4 Màn hình Doctor

#### D-01. Trang Tổng quan — `/doctor/dashboard` — P0

- **Trang làm gì:** cho Doctor thấy việc cần xử lý theo thứ tự ưu tiên: phiên đang diễn ra, alert khẩn, Patient trong hàng đợi, yêu cầu mới và lịch hôm nay.
- **Component:** `VerificationBanner`, `PresenceToggle`, `CurrentConsultationBar`, `UrgentAlertList`, `PendingRequestSummary`, `QueueSummary`, `TodaySchedule`, `PatientsNeedingReview`, `OperationalNotice`.
- **Hành động chính:** bật/tắt presence; quay lại phiên đang chạy; mở alert, request, queue hoặc hồ sơ Patient Care.
- **Trạng thái bắt buộc:** Doctor chưa approved chỉ thấy hướng dẫn xác minh; current consultation và urgent alert ưu tiên cao nhất; số đếm lấy từ aggregate/realtime, không tải danh sách đầy đủ.

#### D-02. Trang Hồ sơ chuyên môn — `/doctor/profile` — P0

- **Trang làm gì:** cập nhật thông tin công khai, tải tài liệu xác minh và hiểu trạng thái xét duyệt.
- **Component:** `DoctorProfileForm`, `VerificationDocumentUploader`, `VerificationStatusCard`, `RejectReasonPanel`, `PublicProfilePreview`, `UnsavedChangeGuard`.
- **Hành động chính:** lưu profile; thêm/thay tài liệu; xem lý do bị từ chối và gửi lại.
- **Trạng thái bắt buộc:** upload progress/retry; tài liệu chỉ mở bằng URL được cấp quyền; Doctor pending/rejected không được mở hành động clinical.

#### D-03. Trang Lịch làm việc — `/doctor/availability` — P0

- **Trang làm gì:** quản lý slot và chính sách booking tại cùng một nơi.
- **Component:** `AvailabilityCalendar`, `SlotStatusLegend`, `SlotEditor`, `BulkSlotCreator`, `BlockSlotDialog`, `BookingSettingsForm`, `TimezoneSelector`, `ConflictPreview`, `PolicyExplanation`.
- **Hành động chính:** tạo/xóa slot available; block slot; đổi `defaultDurationMinutes`, `bufferMinutes`, notice, advance, cancellation, check-in và no-show settings.
- **Trạng thái bắt buộc:** báo overlap/buffer conflict; slot booked không bị sửa phá lịch; thay settings chỉ áp dụng booking sau đó vì consultation đã giữ snapshot; validate theo hard limit server.

#### D-04. Trang Điều phối tư vấn — `/doctor/consultations` — P0, cuộc gọi P1

- **Trang làm gì:** hợp nhất yêu cầu on-demand, lịch sắp tới, hàng đợi, phiên hiện tại và lịch sử để tránh Doctor phải chuyển qua nhiều trang vận hành chồng chéo.
- **Component:** `ConsultationWorkspaceTabs`, `PendingRequestList`, `UpcomingConsultationList`, `QueueBoard`, `QueueEntry`, `CurrentSessionPanel`, `ConsultationHistory`, `ConsultationDetailDrawer`, `PatientContextPanel`, `LinkedCareContext`, `StatusTimeline`, `MessageTimeline`, `MessageComposer`, `CallPanel`, `DoctorNoteEditor`, `FollowUpEditor`, `CompleteConsultationDialog`, `NoShowDialog`.
- **Hành động chính:** accept/decline request; call-next atomically; start/resume; chat/call; ghi note/follow-up; đánh dấu no-show; hoàn tất phiên.
- **Trạng thái bắt buộc:** scheduled và on-demand dùng chung queue do server sắp; không drag reorder; chỉ một `in_consultation`; 409/expired phải refetch; thời lượng chỉ tạo cảnh báo overtime, không tự kết thúc; end call không đồng nghĩa complete; dữ liệu Patient chỉ hiện trong authorization scope.

`/doctor/requests`, `/doctor/queue` và `/doctor/consultations/:id` là deep-link vào tab/drawer của workspace này, không cần ba bộ UI rời nhau.

#### D-05. Trang Theo dõi bệnh mạn — `/doctor/care-programs` — P0

- **Trang làm gì:** enroll Patient, theo dõi tiến độ và xử lý toàn bộ hồ sơ Patient Care được phân công.
- **Component cấp danh sách:** `CarePatientFilters`, `CarePatientTable`, `EnrollmentStatusBadge`, `AdherenceIndicator`, `LatestAlertPreview`, `LatestReportPreview`, `EnrollPatientDialog`, `ProgramSelector`, `CustomSettingsForm`.
- **Component cấp chi tiết:** `PatientCareHeader`, `BaselineViewer`, `TaskTimeline`, `AdherenceBreakdown`, `NormalizedTrendCharts`, `AlertTimeline`, `ReportViewer`, `DoctorAiSummary`, `CitationDrawer`, `FollowUpPlan`, `EnrollmentActionMenu`.
- **Hành động chính:** tạo enrollment pending; xem consent/baseline; pause/resume/complete có reason; yêu cầu consultation; xem/review báo cáo và tạo follow-up.
- **Trạng thái bắt buộc:** Doctor assignment bắt buộc; pending consent không mở dữ liệu vượt scope; không sửa published rule; hành động trạng thái theo `allowedActions` và ghi audit; AI summary chỉ là draft hỗ trợ.

Route `/doctor/care-programs/:id` là deep-link mở hồ sơ chi tiết trong cùng workspace.

#### D-06. Trang Priority Inbox — `/doctor/care-alerts` — P0

- **Trang làm gì:** tập trung alert của Patient được phân công và giúp Doctor xử lý theo severity/thời gian ổn định.
- **Component:** `AlertFilterBar`, `AlertPriorityList`, `SeverityBadge`, `AlertReasonSummary`, `AlertDetailPanel`, `TriggeringDataPanel`, `TrendContext`, `AlertStatusTimeline`, `AlertActionBar`, `LinkConsultationDialog`, `ResolutionDialog`, `DismissDialog`.
- **Hành động chính:** acknowledge; resolve trực tiếp với implicit acknowledge; dismiss bằng reason allowlist; tạo/liên kết consultation; ghi follow-up.
- **Trạng thái bắt buộc:** sort `severity → detectedAt → id`; resolved/dismissed terminal; Admin không xử lý thay Doctor; urgent có safety action; reason code được diễn giải nhưng không bị AI thay đổi severity.

Route `/doctor/care-alerts/:id` là deep-link mở `AlertDetailPanel`.

#### D-07. Trang Bản nháp chương trình — `/doctor/program-templates` — P1

- **Trang làm gì:** cho Doctor được cấp quyền tạo/chỉnh phần allowlist của draft và kiểm tra rule trước khi gửi Admin duyệt.
- **Component:** `DraftProgramList`, `ProgramDraftEditor`, `BaselineSchemaBuilder`, `TaskTemplateBuilder`, `ReminderPolicyEditor`, `RuleReadOnlyPreview`, `SourceReferenceEditor`, `RuleSimulationPanel`, `DraftDiffViewer`, `SubmitForReviewDialog`.
- **Hành động chính:** tạo/clone/chỉnh draft; chạy simulation; gửi review.
- **Trạng thái bắt buộc:** Doctor không publish Program, activate/retire rule; AI chỉ hỗ trợ tạo nháp; conflict version phải compare/refetch.

#### D-08. Trang Đánh giá — `/doctor/reviews` — P0

- **Trang làm gì:** xem điểm tổng hợp và phản hồi Patient đã công bố.
- **Component:** `RatingSummary`, `RatingDistribution`, `ReviewFilter`, `ReviewList`, `ReportAbuseDialog`.
- **Hành động chính:** lọc/xem; báo cáo nội dung nếu policy cho phép.
- **Trạng thái bắt buộc:** read-only; Doctor không sửa/xóa review của Patient; review hidden/removed không xuất hiện như published.

### 12.5 Màn hình Web Admin

Admin chỉ có Web; không thiết kế ứng dụng Admin Mobile.

#### A-01. Trang Dashboard — `/admin/dashboard` — P0

- **Trang làm gì:** quan sát tình trạng vận hành toàn hệ thống theo khoảng thời gian.
- **Component:** `DateRangeFilter`, `UserKpiCards`, `DoctorVerificationCard`, `ConsultationKpiCards`, `CareOperationCards`, `BillingKpiCards`, `BoundedTrendCharts`, `OperationalWarningList`, `DemoDataBadge`.
- **Hành động chính:** đổi khoảng thời gian; mở danh sách đã lọc từ một card/warning.
- **Trạng thái bắt buộc:** aggregate từ server; từng khối tải/lỗi riêng; không tự tải collection để đếm; KPI vận hành không được trình bày như hiệu quả lâm sàng.

#### A-02. Trang Người dùng — `/admin/users` — P0

- **Trang làm gì:** tìm và quản lý account Patient/Doctor/Admin, đồng thời xem thông tin chi tiết cần thiết mà không mặc định mở dữ liệu sức khỏe.
- **Component:** `UserFilterBar`, `UserTotals`, `UserTable`, `AccountStatusBadge`, `LastOnlineCell`, `UserDetailDrawer`, `ProfileSummary`, `DoctorVerificationSummary`, `SubscriptionSummary`, `ScopedAuditTimeline`, `LockUserDialog`, `AdminRoleDialog`.
- **Hành động chính:** tìm/lọc/phân trang; lock/unlock có reason; Super Admin tạo hoặc đổi adminRole.
- **Trạng thái bắt buộc:** không có bulk destructive action; không hiển thị token, OTP, session secret hoặc health content; permission quyết định action; mọi thay đổi ghi audit.

Route `/admin/users/:id` là deep-link mở `UserDetailDrawer`.

#### A-03. Trang Duyệt bác sĩ — `/admin/doctors/verification` — P0

- **Trang làm gì:** xử lý hồ sơ Doctor pending/approved/rejected theo một quy trình kiểm tra nhất quán.
- **Component:** `VerificationQueue`, `DoctorApplicationCard`, `DoctorProfilePanel`, `CredentialPreview`, `SubmissionTimeline`, `VerificationChecklist`, `ApproveDialog`, `RejectDialog`.
- **Hành động chính:** mở hồ sơ; approve/reject kèm reason; xem lần nộp trước.
- **Trạng thái bắt buộc:** file access có authorization; disable double submit; notification chỉ phát sau commit; rejected vẫn giữ lịch sử/audit.

#### A-04. Trang Quản lý Care Program — `/admin/care-programs` — P0 seed/lifecycle, Builder P1

- **Trang làm gì:** quản lý version Program và CareRule từ draft, mô phỏng, duyệt đến publish/activate/retire trong một workspace.
- **Component cấp danh sách:** `ProgramFilterBar`, `ProgramVersionTable`, `ProgramStatusBadge`, `VersionCompareDrawer`, `CreateOrCloneDraftDialog`.
- **Component editor:** `ProgramOverviewForm`, `EligibilityFormBuilder`, `BaselineFormBuilder`, `TaskTemplateBuilder`, `ReminderPolicyEditor`, `ReviewPolicyEditor`, `ContentJourneyEditor`, `SourceReferenceEditor`, `CareRuleEditor`, `RuleSimulationPanel`, `ValidationIssueList`, `DraftDiffViewer`, `ProgramAuditTimeline`, `PublishProgramDialog`, `ActivateRuleDialog`, `RetireDialog`.
- **Hành động chính:** tạo/clone draft; chỉnh metadata/schema/template/rule; simulation; publish Program; activate Rule riêng; retire.
- **Trạng thái bắt buộc:** published immutable; Program và Rule có lifecycle riêng; chỉ operator allowlist; phải có source/test trước activate; AI chỉ soạn draft, Admin chịu quyết định; conflict version phải refetch/compare.

Route `/admin/care-programs/:id` là deep-link vào editor của cùng workspace.

#### A-05. Trang Vận hành Chronic Care — `/admin/care-operations` — P0

- **Trang làm gì:** theo dõi số enrollment, adherence và tốc độ xử lý alert/follow-up theo Program/Doctor để phát hiện vấn đề vận hành.
- **Component:** `CareOperationFilters`, `EnrollmentKpiCards`, `AdherenceDistribution`, `AlertResponseMetrics`, `FollowUpMetrics`, `ProgramBreakdownTable`, `DoctorWorkloadTable`, `ExportAggregateAction`, `ScopedAuditDrawer`.
- **Hành động chính:** lọc, drill-down và export tập aggregate có giới hạn.
- **Trạng thái bắt buộc:** Admin chỉ giám sát/audit, không acknowledge/resolve alert thay Doctor; không hiển thị payload HealthMetric thô trong bảng tổng hợp.

#### A-06. Trang Tri thức AI — `/admin/ai/knowledge` — P0, re-ingest P1

- **Trang làm gì:** quản lý tài liệu RAG và từ khóa cấm trong cùng khu vực quản trị AI.
- **Component:** `KnowledgeTabs`, `DocumentFilterBar`, `DocumentTable`, `DocumentUploader`, `ProcessingStatusBadge`, `ReviewStatusBadge`, `DocumentDetailDrawer`, `DocumentMetadataForm`, `DocumentPreview`, `IngestionSummary`, `ChunkErrorSummary`, `CitationSample`, `DocumentAuditTimeline`, `DocumentReviewDialog`, `ArchiveDocumentDialog`, `ReingestDialog`, `BlacklistTable`, `BlacklistEditorDialog`.
- **Hành động chính:** upload; sửa metadata khi pending; approve/reject cấp document; archive; exclude chunk lỗi như thao tác phụ; re-ingest P1; quản lý blacklist.
- **Trạng thái bắt buộc:** không duyệt từng chunk; chunk kế thừa `reviewStatus` document; chỉ chunk approved, active và còn hiệu lực được retrieve; archive không xóa lịch sử; không hiển thị raw Patient prompt.

Route `/admin/ai/knowledge/:id` là deep-link mở `DocumentDetailDrawer`; `/admin/ai/blacklist` có thể là tab của cùng trang.

#### A-07. Trang Gói dịch vụ — `/admin/plans` — P0

- **Trang làm gì:** cấu hình version Free/Plus/Care, quota, benefit và refund policy từ giao diện Admin thay vì env.
- **Component:** `PlanVersionTable`, `PlanStatusBadge`, `PlanCompareDrawer`, `PlanEditor`, `PricingSection`, `AiQuotaSection`, `ConsultationLimitSection`, `CareAndFamilyLimits`, `BenefitEditor`, `RefundPolicyEditor`, `HardLimitValidation`, `PlanDiffViewer`, `PublishPlanDialog`, `RetirePlanDialog`.
- **Hành động chính:** tạo/clone draft; sửa draft; publish/retire; lên lịch plan kế tiếp theo policy.
- **Trạng thái bắt buộc:** chỉ Super Admin publish/retire; một published version/code; published immutable; subscription/order cũ giữ snapshot; hard ceiling vẫn nằm trong server configuration và không cho Admin vượt.

Route `/admin/plans/:id` là deep-link vào `PlanEditor`.

#### A-08. Trang Thanh toán và hoàn tiền — `/admin/billing/orders` — P0, refund P1

- **Trang làm gì:** tra cứu order/transaction/subscription, xử lý đối soát; nếu P1 bật thì duyệt full refund.
- **Component:** `BillingFilterBar`, `BillingTotals`, `OrderTable`, `ReconciliationBadge`, `OrderDetailDrawer`, `OrderSnapshot`, `SafeTransactionSummary`, `IpnTimeline`, `SubscriptionGrantPanel`, `OutboxStatusPanel`, `ReconcileAction`, `RefundQueue`, `RefundDetailPanel`, `UsageSnapshotCompare`, `EligibilityReasonList`, `ApproveRefundDialog`, `RejectRefundDialog`.
- **Hành động chính:** mở chi tiết; chạy reconcile idempotent; P1 approve/reject/override refund sau server re-evaluation.
- **Trạng thái bắt buộc:** không có “mark paid” thủ công; redact gateway payload/secret; late/duplicate IPN thể hiện rõ; processing refund disable action; override không vượt invariant amount/provider/idempotency.

Route `/admin/billing/orders/:id` và `/admin/billing/refunds` là deep-link/tab của workspace.

#### A-09. Trang Kiểm duyệt — `/admin/violations` — P0

- **Trang làm gì:** tiếp nhận, phân công, kiểm tra bằng chứng và kết luận báo cáo vi phạm.
- **Component:** `ViolationTotals`, `ViolationFilterBar`, `ViolationTable`, `ViolationDetailDrawer`, `ReporterAndTargetSummary`, `EvidenceViewer`, `SourceContextPanel`, `ViolationTimeline`, `AiClassificationDraft`, `AssignmentControl`, `ResolutionDialog`, `UserActionDialog`.
- **Hành động chính:** assign/triage; chuyển processing; resolve/dismiss; warning/suspend/ban qua command người dùng.
- **Trạng thái bắt buộc:** AI classification chỉ là gợi ý; Admin chịu trách nhiệm quyết định; evidence có kiểm tra quyền; không mở context ngoài source đã báo cáo.

Route `/admin/violations/:id` là deep-link mở `ViolationDetailDrawer`.

#### A-10. Trang Audit — `/admin/audit-logs` — P0

- **Trang làm gì:** tra cứu log bất biến dùng chung theo domain, actor, entity, action và thời gian.
- **Component:** `AuditFilterBar`, `AuditTable`, `AuditDetailDrawer`, `StatusChangeView`, `SafeMetadataViewer`, `AuthorizedEntityLink`.
- **Hành động chính:** lọc/phân trang; mở detail; deep-link tới entity nếu có quyền.
- **Trạng thái bắt buộc:** read-only; không render secret, token, raw health/message/prompt; log hết retention hiển thị như không còn dữ liệu chứ không suy ra entity không tồn tại.

#### A-11. Trang Audit Người thân — `/admin/family-links` — P1

- **Trang làm gì:** hỗ trợ kiểm tra lifecycle lời mời, permission và delivery reminder mà không xem nội dung sức khỏe.
- **Component:** `FamilyLinkFilter`, `FamilyLinkTable`, `InvitationTimeline`, `PermissionSummary`, `ReminderDeliverySummary`, `SupportRevokeDialog`.
- **Hành động chính:** lọc/xem; hỗ trợ revoke khi policy cho phép.
- **Trạng thái bắt buộc:** không hiển thị metric, alert reason, AI/chat/consultation content; luôn hiện invitationVersion và actor/timestamp.

#### A-12. Trang Danh mục cơ sở y tế — `/admin/medical-facilities` — P1 sau Family

- **Trang làm gì:** đưa candidate từ map API vào danh mục nội bộ, đối chiếu nguồn chính thức và quản lý ánh xạ bệnh/chuyên khoa.
- **Component:** `FacilityStatusTabs`, `FacilityTable`, `MapCandidateSearch`, `MapCandidatePreview`, `FacilityEditor`, `OfficialSourceEditor`, `FacilityMapPreview`, `VerificationChecklist`, `VerifyFacilityDialog`, `StaleOrRetireDialog`, `DiseaseSpecialtyMappingEditor`, `MappingVersionTable`, `PublishMappingDialog`.
- **Hành động chính:** chọn candidate thành draft; chỉnh; verify/stale/retire; tạo và publish mapping.
- **Trạng thái bắt buộc:** map result không tự verified; lưu provider/placeId/source; mapping có version/lifecycle; không bổ sung Clinic actor vào scope.

#### A-13. Trang Notification Campaign — `/admin/notifications/campaigns` — P2/Deferred

- **Trang làm gì:** soạn và theo dõi thông báo individual/segment/all nếu feature qua cut-line.
- **Component:** `CampaignList`, `CampaignEditor`, `AudienceBuilder`, `AudienceEstimate`, `ChannelSelector`, `CampaignPreview`, `ScheduleControl`, `DeliveryAggregate`.
- **Hành động chính:** draft, preview, schedule/cancel và xem kết quả.
- **Trạng thái bắt buộc:** worker fan-out sau khi snapshot audience; không gửi hàng loạt ngay trong HTTP request; không xuất hiện trong navigation DA2 khi flag tắt.

### 12.6 Modal, drawer và component nghiệp vụ bắt buộc

Các component dùng chung dưới đây được tái sử dụng trong các trang P/D/A ở trên; không đưa chúng thành mục menu hoặc trang độc lập nếu không có nhu cầu deep-link:

- Confirm dialog có reason cho cancel consultation, pause/complete/cancel enrollment, dismiss alert, lock user, publish/retire Plan/Program và refund decision.
- Consent viewer có policy version cho Care Program, audio/video consultation và Family permission.
- File uploader có allowlist MIME/size, progress, retry, remove và virus/processing state nếu backend trả về.
- Citation drawer hiển thị document title/version/page/section/source URL; citation không hợp lệ không được render như nguồn đáng tin.
- Entitlement/quota dialog giải thích limit, used, reserved, remaining và reset time; consultation quota không gọi là AI credit.
- Safety alert component dùng nội dung template đã duyệt, CTA liên hệ cơ sở y tế/cấp cứu và không chờ AI.
- Status timeline dùng cho Consultation, Enrollment, Payment, Refund, Document ingestion và Violation; timestamp/actor hiển thị theo quyền.
- Unsaved-change guard cho profile, Program/Rule/Plan draft; server version conflict phải refetch/compare, không ghi đè im lặng.

### 12.7 Ma trận bao phủ chức năng → màn hình

| Nhóm chức năng | Màn hình chính | Màn hình hỗ trợ |
|---|---|---|
| Chronic Care | P-05 Chương trình, D-05 Theo dõi bệnh mạn, D-06 Priority Inbox | P-01/D-01 Dashboard, P-04 Chỉ số, P-03/D-04 Tư vấn, A-04/A-05 quản trị |
| Scheduled/on-demand consultation | P-02 Bác sĩ và đặt tư vấn, P-03/D-04 workspace Tư vấn | Dashboard, linked Care context, review/report dialog |
| AI/RAG | P-06 AI sức khỏe, A-06 Tri thức AI | Citation drawer, token quota, Care summary trong P-05/D-05 |
| Subscription/payment | P-07 Gói và thanh toán, A-07 Gói dịch vụ, A-08 Thanh toán | Usage meter, order/refund drawer |
| Người thân P1 | P-08 Người thân | A-11 Family audit, C-04 Notification center |
| Cơ sở y tế P1 | P-09 Cơ sở y tế | A-12 Danh mục/xác minh/mapping |
| Identity/privacy | C-01..C-03 Auth, C-06 Tài khoản, D-02 hồ sơ chuyên môn | A-02 Users, A-03 Doctor verification |
| Moderation/audit | A-09 Kiểm duyệt, A-10 Audit | Violation dialog trong P-03, user detail drawer |

## 13. Mobile integration

Mobile dùng cùng endpoint IDs và DTO với Web Client, nhưng có adapter riêng:

| Concern | Web | Mobile |
|---|---|---|
| Access token | memory/store; refresh bằng HTTP-only cookie | secure storage + refresh credential policy |
| Push token | browser optional | USER-05/NOTI-05 khi login/token refresh |
| File | browser File/multipart | Expo URI → multipart adapter |
| Network | online chủ yếu | retry/backoff, offline banner, không replay mutation nguy hiểm bằng ID mới |
| Deep link | router URL | consultation/payment/refund notification deep link allowlist |
| Call | WebRTC browser | React Native WebRTC foreground P1 |
| Biometrics | Không | chỉ mở secure credential, không thay backend authentication |

Mobile chỉ dành cho Patient và Doctor, không có Admin navigation hoặc Admin route.

| Mobile role | Màn hình ưu tiên khi P1 Mobile được bật |
|---|---|
| Patient | Login/OTP, dashboard, nhiệm vụ Care hôm nay, nhập chỉ số, alert/safety, Care Program detail/report, doctor discovery, booking/on-demand, consultation list/detail/chat, waiting room, notifications và profile |
| Doctor | Login, dashboard, Priority Inbox, alert detail/actions, Patient Care summary, requests, queue, consultation detail/chat/call foreground, availability read/quick block, notifications và profile |

Plans/payment có thể mở Web flow an toàn trong giai đoạn đầu nếu deep-link return được allowlist. Family và facility chỉ đưa lên Mobile sau khi Web P1 tương ứng hoàn chỉnh. Admin mobile và production-grade background CallKeep là Deferred.

## 14. Legacy-to-target migration map

| Current route/API | Target | Migration rule |
|---|---|---|
| `/patient-overview` | `/patient/dashboard` | compatibility redirect |
| `/my-doctors` | `/patient/doctors` | split discovery/detail/booking |
| `/doctor-chat` | `/patient/consultations` | selection chuyển thành route có consultationId |
| `/doctor-overview` | `/doctor/dashboard` | server dashboard summary |
| `/consultations` doctor page | `/doctor/consultations` | giữ page, đổi data contract |
| `GET/POST /sessions` | `/consultations/*` | Đã xóa ở RF-10B; FE mới chỉ gọi canonical API |
| `/sessions/:id/confirm` | `/consultations/:id/accept` | Đã xóa; dùng requestStatus/sessionStatus canonical |
| `/sessions/:id/reject` | `/consultations/:id/decline` | Đã xóa; cancel là transition riêng |
| `/chat/session/:id`, `/chat/send` | `/chat/consultation/:consultationId`, `/chat/consultation/messages` | Đã xóa; request/event dùng `consultationId` |
| legacy socket `join_session`, `new_message`, `session_changed` | canonical consultation/message events | Đã xóa ở RF-10B; không có compatibility alias |
| `/reviews/session/:id` | `/reviews/consultation/:id` | Đã xóa; một review/consultation |
| `/users/doctors` | `/doctors` | paginated DoctorCardDto |
| Admin tự merge `/users`, `/users/doctors`, `/admins` | `/admin/users` | server-side pagination/aggregation |
| Admin dashboard tải collections | `/admin/dashboard` | endpoint aggregate chuyên dụng |
| `/ai-assistant/*` và AI CRUD trùng | `/ai/*` + `/admin/ai/*` | migrate từng capability |
| `/notifications/mark-all-as-read` | `/notifications/read-all` | compatibility alias tạm thời |

Session endpoint/event legacy đã bị xóa vì frontend được xây mới ở repository khác. Web Client và Web Admin phải sinh client/contract test từ OpenAPI và realtime artifact canonical.

### 14.1 Kết quả rà soát source frontend hiện tại

Kết luận: source trong `apps/client`, `apps/admin` và `packages/ui` vẫn chủ yếu là FE DA1. Nó có thể dùng làm tham khảo UI, nhưng **không được xem là đã khớp contract DA2**. Các sai lệch cần xử lý theo thứ tự sau:

| Mức | Khu vực source hiện tại | Sai lệch so với contract DA2 | Cách chuyển đổi bắt buộc |
|---|---|---|---|
| Blocker bảo mật | `packages/ui/src/store/useAuthStore.ts`, hai file `apps/*/src/lib/api.ts` | Persist cả access/refresh token trong localStorage; refresh request gửi `userId + refreshToken`; một notification hook còn log access token | Web dùng refresh cookie `HttpOnly + Secure + SameSite`; store chỉ giữ user và access token ngắn hạn trong memory; AUTH-05 không nhận userId từ client; xóa toàn bộ token log |
| Blocker dữ liệu | `patient/health-metric/services/health-metrics.service.ts` | DTO dùng `type` và value lồng `{value, recordedAt}`; PATCH/DELETE trực tiếp; có `getAllHealthMetrics()` tải mọi trang | Dùng `HealthMetricDto.metricType/values/source/validationStatus`; sửa bằng HLTH-03 correction, xóa bằng HLTH-04 void; chart/list luôn bounded |
| Blocker Consultation | Patient/Doctor `consultations.service.ts`, `doctor-chat.service.ts`, `my-doctor.service.ts` | Dùng `/sessions`, `/sessions/:id/confirm|reject|complete`, `/chat/session`, `/chat/send`; chỉ có một status `pending|active|completed|rejected`; Patient gửi `scheduledAt` tùy ý | Chuyển sang CON-01..24; DTO có `mode + requestStatus + sessionStatus`; scheduled chỉ nhận `availabilitySlotId`; chat dùng `consultationId`; queue/check-in/no-show/follow-up theo state machine |
| Blocker AI safety/cost | `patient/ai-chat/services/ai-chat.service.ts` | Dùng `/ai-assistant/*`; citation là `Record<string, unknown>`; có API gửi raw `patientProfile + recentMetrics` từ browser để tạo summary; chưa có token quota DTO | Chuyển AI-01..07; typed citation; quota reserve/commit/release ở server; xóa luồng FE tự gửi dữ liệu thô, Care summary chỉ sinh từ server `SummaryInputSnapshot` |
| Blocker vận hành | `admin/overview/services/overview.service.ts`, `doctor/overview/services/overview.service.ts` | Tải nhiều danh sách với limit 100/1000 rồi tự lọc/đếm/vẽ thống kê | Dùng ADM-01, DASH-01 và DASH-02; server trả aggregate bounded; detail mới gọi domain list API |
| Cao | `admin/user-management/services/user-management.service.ts` | Tự merge `/users`, `/users/doctors`, `/admins`; role FE là `user_admin|ai_admin`, khác DB `user_manager|ai_manager` | Dùng ADM-02/21 và enum canonical; không suy ra Doctor/Admin bằng merge client |
| Cao | `admin/ai_management/services/ai-management.service.ts` | Gộp ingestion/review/availability thành một `status=processing|error|active|inactive`; PATCH status và DELETE document | Dùng `processingStatus` + `reviewStatus`; ADM-10..13/18..20/27; approve/reject cấp document, archive thay hard-delete, chunk chỉ exclude khi lỗi |
| Cao | `services/notifications.service.ts` và socket hooks | Endpoint mark-read cũ; DTO thiếu `resourceType/resourceId/data`; socket event `notifications` dạng action envelope cũ | Dùng NOTI-01..04 và `notification.v1.created`; typed deep-link allowlist; reconnect refetch và dedupe |
| Cao | `packages/ui/src/types/auth.ts` và DTO nằm rải trong từng service | `name/avatar`, adminRole và response envelope không thống nhất; nhiều DTO Patient/Doctor Consultation bị sao chép | Sinh API types từ OpenAPI; `UserDto.fullName/avatarUrl`; chỉ tạo view model tại feature boundary; xóa DTO transport viết tay trùng nhau |
| Trung bình | `my-doctor.service.ts` | Chuyên khoa hard-code bằng tiếng Anh, doctor list không phân trang, rating đổi thành string, presence dùng boolean | Danh mục/label tách khỏi transport DTO; DOC-01 paginated; giữ rating là number; presence dùng `online|offline|unknown` |
| Trung bình | review/profile/report services ở cả Client và Admin | Endpoint và mapper cũ được lặp lại giữa nhiều feature | Một generated client; shared query keys/error mapper; feature hook chỉ compose dữ liệu cho page, không khai báo lại API contract |

### 14.2 Cấu trúc DTO/API frontend đích

```text
packages/
  api-client/                 # sinh từ OpenAPI, không sửa tay
    generated/
    client.ts
  realtime-contracts/        # schema/event version dùng chung
apps/client/src/features/
  consultations/api.ts       # gọi generated client, map sang view model nếu cần
  chronic-care/api.ts
  health/api.ts
  ai/api.ts
  billing/api.ts
apps/admin/src/features/
  users/api.ts
  care-programs/api.ts
  ai-knowledge/api.ts
  billing/api.ts
```

Quy tắc chuyển đổi:

1. Transport DTO chỉ sinh từ OpenAPI; không tạo lại `ApiXxx` khác nhau trong từng service.
2. View model được phép đổi tên/format cho UI nhưng mapper phải nằm ở boundary và không làm mất state/version/`allowedActions`.
3. Component không đọc `_id`, `__v`, raw Mongo document hoặc tự đoán quan hệ từ field populate.
4. Pagination dùng một chuẩn `PageResult<T> { items, page, limit, total, hasNext }`; bỏ các biến thể `data/pages`, mảng trần và vòng lặp tải toàn bộ.
5. Mutation retry-sensitive nhận `Idempotency-Key` ổn định do lớp API của feature tạo và giữ tới khi có kết quả cuối.
6. Endpoint legacy chỉ tồn tại sau một adapter có deadline xóa rõ; không cho page mới gọi trực tiếp.
7. CI phải typecheck generated client và chạy contract test; OpenAPI breaking diff làm fail build trước khi merge backend/frontend.

## 15. UI state bắt buộc cho mỗi page

Mỗi page đọc dữ liệu từ server phải có:

- Initial loading/skeleton.
- Empty state có CTA hợp lệ.
- Recoverable error với retry.
- 401 session-expired flow duy nhất, không hiện nhiều modal.
- 403/ban/doctor-not-approved state.
- 404/not-found.
- Mutation pending: disable action gây duplicate.
- Conflict state 409: refetch trước khi cho thao tác tiếp.
- Stale/reconnecting indicator cho socket-dependent page.
- Feature-disabled state cho refund/WebRTC/FCM P1.
- Accessibility: keyboard focus, label, error association và trạng thái không chỉ thể hiện bằng màu.

Không dùng optimistic update cho:

- Slot booking/cancel nếu chưa có server acknowledgement.
- Doctor call-next.
- Payment paid/refunded.
- Subscription activation/revocation.
- Admin ban/verification/refund approval.

Có thể optimistic cho message bằng `clientMessageId`, notification read và một số profile field, nhưng phải rollback khi server từ chối.

## 16. Page-level security và privacy

- Patient health data chỉ xuất hiện ở patient owner hoặc doctor đang có consultation được phép.
- Chat/file URL cần authorization hoặc signed URL policy; không coi URL Cloudinary là quyền truy cập.
- Admin dashboard không trả raw health content, AI prompt hoặc chat content.
- Payment page không hiển thị gateway payload/signature.
- Refund page không hiển thị provider internal error cho patient; map sang trạng thái an toàn.
- AI page luôn hiển thị disclaimer; emergency response có CTA phù hợp.
- Không đưa access/refresh token, OTP, health content hoặc payment params vào analytics/log frontend.
- Web không persist refresh token trong Zustand/localStorage/sessionStorage; refresh token đi bằng cookie `HttpOnly + Secure + SameSite`. Access token ngắn hạn ưu tiên giữ trong memory và tuyệt đối không `console.log`.
- Mobile lưu refresh credential trong secure storage của hệ điều hành; không dùng AsyncStorage thuần cho token.
- Deep-link từ Notification phải đi qua allowlist `resourceType → route builder`, không dùng URL tùy ý từ payload.

## 17. Definition of Done cho tích hợp một page

Một page chỉ hoàn thành khi:

1. Route và role guard đúng.
2. Endpoint đã có trong OpenAPI version được pin.
3. Không khai báo lại DTO thủ công nếu generated type đã có.
4. Query key và invalidation được định nghĩa.
5. Loading, empty, error, forbidden, conflict và feature-disabled states đã xử lý.
6. Mutation nguy hiểm có idempotency/disable duplicate submit.
7. Socket listener được đăng ký/hủy đúng lifecycle và reconnect có REST refetch.
8. Không leak raw database/internal field.
9. Unit/component test cho mapper và states quan trọng.
10. E2E cho happy path cùng ít nhất một failure/race path.
11. Responsive web hoặc mobile device target đã kiểm tra.
12. API/page mapping trong tài liệu này được cập nhật nếu contract thay đổi.
