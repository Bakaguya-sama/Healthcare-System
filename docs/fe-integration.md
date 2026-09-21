# Frontend Integration Contract — Healthcare DA2

## 1. Mục đích và phạm vi

Tài liệu mô tả dữ liệu, REST API, realtime event, cache và trạng thái UI mà từng trang Web Client, Web Admin và Mobile sử dụng.

Nguồn thiết kế:

- `docs/overview.md` — phạm vi sản phẩm.
- `docs/BUSINESS_RULES.md` — quy tắc nghiệp vụ.
- `docs/db-template-v7.dbml` — mô hình dữ liệu.
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

Socket.IO dùng `{API_ORIGIN}` với transport path mặc định `/socket.io` và namespace riêng (`/chat`, `/session`, `/notifications`, `/`). Client gửi JWT qua `handshake.auth.token`, chỉ kết nối từ origin có trong `CORS_ORIGINS`, và lưu `x-correlation-id` từ HTTP error khi báo lỗi hỗ trợ.

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

Các interface dưới đây là shape frontend cần; generated OpenAPI types là nguồn compile-time chính thức.

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
type SessionStatus = "not_started" | "waiting" | "in_consultation" | "completed" | "no_show";

interface AvailabilitySlotDto {
  id: Id;
  doctorId: Id;
  startAt: IsoDateTime;
  endAt: IsoDateTime;
  timezone: string;
  status: SlotStatus;
  blockReason?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

interface ConsultationDto {
  id: Id;
  patient: Pick<UserDto, "id" | "fullName" | "avatarUrl">;
  doctor: DoctorCardDto;
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
  patientNotes?: string;
  doctorNotes?: string;
  queueJoinedAt?: IsoDateTime;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  calledAt?: IsoDateTime;
  sessionStartedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  noShowAt?: IsoDateTime;
  cancelledAt?: IsoDateTime;
  cancellationReason?: string;
  roomId?: string;
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
  source: "manual" | "device";
  recordedAt: IsoDateTime;
  status?: "normal" | "warning" | "critical";
  createdAt: IsoDateTime;
}

interface AiConversationDto {
  id: Id;
  patientId: Id;
  status: "active" | "completed" | "archived";
  topic?: string;
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
  citations: Array<{ documentId: Id; title: string; chunkId?: Id; score?: number }>;
  model?: string;
  status: "pending" | "completed" | "failed";
  sentAt: IsoDateTime;
}

interface AiQuotaDto {
  usageDate: LocalDate;
  planName: string;
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
  resetsAt: IsoDateTime;
}
```

### 4.4 Billing

```ts
interface PlanDto {
  id: Id;
  name: string;
  description?: string;
  price: MoneyVnd;
  currency: "VND";
  durationDays: number;
  dailyAiLimit: number;
  features: Record<string, boolean | number | string>;
  isActive: boolean;
}

type PaymentOrderStatus =
  | "created" | "pending" | "paid" | "expired"
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
}

interface SubscriptionDto {
  id: Id;
  sourceOrderId: Id;
  plan: Pick<PlanDto, "id" | "name" | "dailyAiLimit" | "features">;
  status: "active" | "expired" | "cancelled";
  startedAt: IsoDateTime;
  expiresAt: IsoDateTime;
  cancelledAt?: IsoDateTime;
  cancellationReason?: "user_cancelled" | "payment_refunded" | "admin_revoked";
}

type RefundStatus =
  | "requested" | "approved" | "rejected" | "processing"
  | "succeeded" | "failed" | "manual_review";

interface PaymentRefundDto {
  id: Id;
  orderId: Id;
  paymentTransactionId: Id;
  amount: MoneyVnd;
  currency: "VND";
  reasonCode?: string;
  reason: string;
  status: RefundStatus;
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

### 4.5 Notification và moderation

```ts
interface NotificationDto {
  id: Id;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "critical";
  resourceType?: "consultation" | "paymentOrder" | "paymentRefund" | "subscription" | "violation";
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
| AUTH-12 | `GET /auth/oauth/:provider/start` | Public | redirect params + PKCE | authorization redirect | Target P0 |
| AUTH-13 | `GET /auth/oauth/:provider/callback` | Public | provider code/state | short-lived frontend callback result | Target P0 |
| USER-01 | `GET /users/me` | Authenticated | none | `UserDto` | Current |
| USER-02 | `PATCH /users/me` | Authenticated | profile JSON/multipart | `UserDto` | Current/normalize |
| USER-03 | `POST /files` | Authenticated | multipart + purpose | `FileDto` | Target P0 |
| USER-04 | `DELETE /files/:publicId` | Owner/Admin | purpose | `204` | Target P0 |
| USER-05 | `POST /devices` | Authenticated | push token/platform/appVersion | device DTO | Target P1 |
| USER-06 | `DELETE /devices/:id` | Owner | none | `204` | Target P1 |

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
| CON-12 | `POST /consultations/:id/check-in` | Patient | none + idempotency | consultation + queue snapshot | Target P0 |
| CON-13 | `GET /consultations/:id/queue` | Patient participant | none | own position/wait estimate | Target P0 |
| CON-14 | `GET /doctors/me/queue` | Doctor | page/limit | `QueueEntryDto[]` | Target P0 |
| CON-15 | `POST /doctors/me/queue/call-next` | Doctor | idempotency | claimed consultation | Target P0 |
| CON-16 | `POST /consultations/:id/start` | Doctor/participant policy | consent/version | consultation | Target P0 |
| CON-17 | `POST /consultations/:id/complete` | Doctor | `{ doctorNotes? }` | consultation | Current canonical |
| CON-18 | `GET /chat/consultation/:consultationId` | Participant | cursor, limit | message page | Current canonical |
| CON-19 | `POST /chat/consultation/messages` | Participant | consultationId, content/files/clientMessageId | message | Current canonical |
| CON-20 | `POST /consultations/:id/review` | Patient participant | rating/comment | `ReviewDto` | Target P0; legacy `/reviews` |
| CON-21 | `PATCH /consultations/:id/review` | Patient owner | rating/comment | review | Target P0 |
| CON-22 | `POST /consultations/:id/report` | Participant | violation payload/files | violation | Target P0 |

### 5.4 Health và AI

| ID | Method + path | Role | Request/query | Response | Status |
|---|---|---|---|---|---|
| HLTH-01 | `GET /health-metrics` | Patient owner | metricType, from/to, page | `PageResult<HealthMetricDto>` | Current/normalize |
| HLTH-02 | `POST /health-metrics` | Patient owner | metric payload | metric + alert summary | Current |
| HLTH-03 | `PATCH /health-metrics/:id` | Patient owner | allowed values/time | metric + alert summary | Current |
| HLTH-04 | `DELETE /health-metrics/:id` | Patient owner | none | `204` | Current |
| HLTH-05 | `GET /consultations/:id/health-context` | Doctor participant | metric types/range | metrics + summary | Target P0 |
| AI-01 | `GET /ai/quota` | Patient | none | `AiQuotaDto` | Target P0 |
| AI-02 | `POST /ai/conversations` | Patient | initialQuestion/tags | conversation + messages | Target P0; legacy `/ai-assistant/.../start` |
| AI-03 | `GET /ai/conversations` | Patient | status/search/page | conversation page | Target P0 |
| AI-04 | `GET /ai/conversations/:id` | Owner | cursor/limit | conversation + message page | Target P0 |
| AI-05 | `POST /ai/conversations/:id/messages` | Owner | multipart message/images + idempotency | user message + AI message + quota | Target P0 |
| AI-06 | `PATCH /ai/conversations/:id` | Owner | topic/status | conversation | Target P0 |
| AI-07 | `DELETE /ai/conversations/:id` | Owner | none | `204`/archive policy | Target P0 |
| AI-08 | `POST /consultations/:id/ai-brief` | Doctor participant | none | draft consultation brief | Target P1 |

### 5.5 Billing, cancel và refund

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
| BILL-14 | `POST /admin/billing/refunds/:id/approve` | Admin | review note + idempotency | refund approved | Target P1 |
| BILL-15 | `POST /admin/billing/refunds/:id/reject` | Admin | rejectionReason | refund rejected | Target P1 |
| BILL-16 | `POST /admin/billing/refunds/:id/reconcile` | Admin | none + idempotency | refreshed refund status | Target P1 |

IPN và refund provider callbacks không được gọi bằng browser client. `paymentUrl` chỉ được mở sau khi BILL-03 trả về. Return page luôn gọi BILL-05 để lấy trạng thái nguồn chuẩn.

### 5.6 Notification, moderation và admin dashboard

| ID | Method + path | Role | Request/query | Response | Status |
|---|---|---|---|---|---|
| NOTI-01 | `GET /notifications` | Authenticated | unread/page | notification page | Current/normalize |
| NOTI-02 | `PATCH /notifications/:id/read` | Owner | none | notification | Target P0; normalize current PATCH |
| NOTI-03 | `PATCH /notifications/read-all` | Owner | none | `{ updatedCount }` | Target P0 |
| NOTI-04 | `DELETE /notifications/:id` | Owner | none | `204` | Current |
| NOTI-05 | `POST /devices` | Authenticated | FCM token/platform | device | Target P1 |
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
| ADM-07 | `GET /admin/plans` | Admin | status/page | plan page | Target P0 |
| ADM-08 | `POST /admin/plans` | Admin | plan payload | plan | Target P0 |
| ADM-09 | `PATCH /admin/plans/:id` | Admin | mutable plan fields | plan | Target P0 |
| ADM-10 | `GET /admin/ai/documents` | AI admin | status/page/search | document page | Target P0; legacy `/ai-documents` |
| ADM-11 | `POST /admin/ai/documents` | AI admin | multipart | document processing | Target P0 |
| ADM-12 | `PATCH /admin/ai/documents/:id` | AI admin | title/isActive | document | Target P0 |
| ADM-13 | `DELETE /admin/ai/documents/:id` | AI admin | none | accepted/deactivation | Target P0 |
| ADM-14 | `GET /admin/ai/blacklist-keywords` | AI admin | search/page | keyword page | Target P0 |
| ADM-15 | `POST /admin/ai/blacklist-keywords` | AI admin | keyword | keyword | Target P0 |
| ADM-16 | `PATCH /admin/ai/blacklist-keywords/:id` | AI admin | keyword | keyword | Target P0 |
| ADM-17 | `DELETE /admin/ai/blacklist-keywords/:id` | AI admin | none | `204` | Target P0 |

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
| `presence.v1.changed` | server → client | `{ userId, state, lastSeenAt }` | Doctor list, consultation header |
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
| `account.v1.banned` | server → client | `{ reason }` | Global logout/ban modal |
| `payment.v1.updated` | server → client | safe PaymentOrder status payload | Payment result/history |
| `refund.v1.updated` | server → client | safe PaymentRefund status payload | Refund detail/admin queue |

REST vẫn là source of truth sau reconnect. Event chỉ cập nhật cache hoặc kích hoạt refetch, không thay thế persistence.

## 7. Query key và invalidation

```ts
const queryKeys = {
  me: ["me"],
  doctors: (filter: unknown) => ["doctors", filter],
  doctor: (id: Id) => ["doctor", id],
  slots: (doctorId: Id, range: unknown) => ["slots", doctorId, range],
  consultations: (filter: unknown) => ["consultations", filter],
  consultation: (id: Id) => ["consultation", id],
  messages: (id: Id) => ["consultation-messages", id],
  queue: (doctorIdOrConsultationId: Id) => ["queue", doctorIdOrConsultationId],
  healthMetrics: (filter: unknown) => ["health-metrics", filter],
  aiConversations: (filter: unknown) => ["ai-conversations", filter],
  aiConversation: (id: Id) => ["ai-conversation", id],
  aiQuota: ["ai-quota"],
  plans: ["plans"],
  subscriptions: ["subscriptions", "me"],
  paymentOrders: (filter: unknown) => ["payment-orders", filter],
  paymentOrder: (id: Id) => ["payment-order", id],
  refunds: (filter: unknown) => ["refunds", filter],
  refund: (id: Id) => ["refund", id],
  notifications: (filter: unknown) => ["notifications", filter],
  adminDashboard: (range: unknown) => ["admin-dashboard", range],
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
| AI message completed | conversation, conversation list, AI quota |
| Payment IPN/status update | order detail/list, subscriptions, AI quota/entitlement |
| Cancel order | order detail/list |
| Refund update | refund detail/list, order detail/list, subscriptions, AI quota/entitlement |
| Account ban | clear all cache và auth state |

## 8. Page contracts — Public và dùng chung

| Page/route target | Hiện tại | Role | Read | Mutation | Realtime/cache/UI state |
|---|---|---|---|---|---|
| Login `/login` | Current | Public | none | AUTH-04, AUTH-12 | loading, invalid credentials, rate limit, banned, OAuth callback error; redirect theo role |
| Sign up `/signup` | Current client | Public | optional doctor prefill legacy | AUTH-01, AUTH-02, AUTH-03 | multipart doctor docs; pending-verification success |
| Forgot password `/forgot-password` | Current `/forget-password` | Public | none | AUTH-08, AUTH-02 | generic response chống account enumeration; resend countdown |
| Confirm OTP `/confirm-otp` | Current | Public | navigation state email/purpose | AUTH-03 | expired, attempts exceeded, resend; không lưu OTP |
| Reset password `/reset-password` | Current flow chưa chuẩn | Public | reset token | AUTH-09 | password policy, expired token, success redirect |
| Change password `/settings/security` | Current `/change-password` | Authenticated local | USER/AUTH me | AUTH-10, AUTH-07 | OAuth-only account state; revoke sessions confirmation |
| Profile `/profile` | Current | All | AUTH-11/USER-01 | USER-02, USER-03/04 | invalidate me; doctor verification state; upload progress/error |
| Notifications drawer `/notifications` hoặc global panel | Current partial | All | NOTI-01 | NOTI-02/03/04 | subscribe `notification.v1.created`; unread badge; deep-link allowlist |
| About/Services/Contact | Current static | Public | static content/config | optional contact API | không phụ thuộc business collections |

## 9. Page contracts — Patient

| Page/route target | Mapping hiện tại | Dữ liệu/DTO | API | Realtime và hành động chính |
|---|---|---|---|---|
| Dashboard `/patient/dashboard` | `/patient-overview` | UserDto, recent HealthMetricDto, upcoming ConsultationDto, effective Subscription, AiQuotaDto | USER-01, HLTH-01, CON-07, BILL-02, AI-01 | notification/consultation updates; cards có loading độc lập |
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
| AI chat `/patient/ai` | `/ai-chat` | conversations/messages/quota | AI-01..07 | optimistic user message; pending AI response; quota rollback on provider failure |
| Plans `/patient/plans` | New | PlanDto[], effective entitlement | BILL-01/02 | plan comparison; hide inactive; no price from client in create order |
| Checkout/payment result `/patient/billing/orders/:id` | New | PaymentOrderDto | BILL-03/05/07 | open payment URL; poll/refetch after return; `payment.v1.updated`; never trust query success alone |
| Billing history `/patient/billing` | New | orders, subscriptions, refunds | BILL-02/04/05/10 | cancel allowed order via BILL-06; CTA based on `allowedActions` |
| Refund request `/patient/billing/orders/:id/refund` | New P1 | paid order + eligibility | BILL-05/09 | reason required; conflict/eligibility; feature flag fallback |
| Refund detail `/patient/refunds/:id` | New P1 | PaymentRefundDto + order summary | BILL-10 | `refund.v1.updated`; manual-review explanatory state; no client provider retry |

Patient page guards:

- `role=patient`, `accountStatus=active`.
- Consultation/health/billing ownership vẫn do backend kiểm tra.
- Queue/chat/call route phải xử lý 403 sau khi consultation bị cancel/completed hoặc session bị revoke.

## 10. Page contracts — Doctor

| Page/route target | Mapping hiện tại | Dữ liệu/DTO | API | Realtime và hành động chính |
|---|---|---|---|---|
| Dashboard `/doctor/dashboard` | `/doctor-overview` | UserDto/DoctorProfile, request/queue/upcoming/review summary | USER-01, CON-07, CON-14, DOC-08 | consultation/queue notifications; cards không tải toàn bộ lịch sử |
| Profile/verification `/doctor/profile` | `/profile` | UserDto + DoctorProfileDto | USER-01/02/03/04 | pending/rejected/approved states; reject reason; upload validation |
| Availability `/doctor/availability` | New | AvailabilitySlotDto[] + booking settings | CON-01..04, DOC-07 | calendar timezone; overlap conflict; booked slot không delete/block tùy policy |
| Requests `/doctor/requests` | trong `/consultations` | pending on-demand consultations | CON-07/08/09/10 | `consultation.v1.updated`; accept/decline idempotent; expiry countdown |
| Queue `/doctor/queue` | New | QueueEntryDto[] + current consultation | CON-14/15 | `queue.v1.changed`; call-next atomic; 409 refetch; no manual client reordering |
| Consultation list `/doctor/consultations` | `/consultations` | paged ConsultationDto | CON-07 | tabs request/upcoming/in-progress/history; message preview events |
| Consultation detail `/doctor/consultations/:id` | selected card/chat | consultation/messages/patient health context | CON-08/16/17/18/19, HLTH-05, AI-08 P1 | join room; start/complete; authorized health range only; AI brief is draft |
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
| Doctor verification `/admin/doctors/verification` | `/doc-verification` | applications/files/summary | DOC-04..06 | approve/reject reason; file preview; audit result notification |
| AI knowledge `/admin/ai/knowledge` | `/ai-knowledge-base` | documents + processing status | ADM-10..13 | upload progress; processing polling/event; deactivate instead of unsafe hard delete |
| AI blacklist `/admin/ai/blacklist` | tab hiện tại | keyword page | ADM-14..17 | normalized keyword conflicts; mutation invalidation |
| Plans `/admin/plans` | New | all plans | ADM-07..09 | edit creates future-facing plan version/snapshot behavior; existing orders unchanged |
| Payments `/admin/billing/orders` | New | orders/transactions/totals | BILL-11/12 | filters, detail, reconciliation status; no manual mark-paid button |
| Refund queue `/admin/billing/refunds` | New P1 | PaymentRefundDto page/totals | BILL-13..16 | approve/reject/reconcile; `refund.v1.updated`; processing action disabled |
| Violation list `/admin/violations` | `/violation-reports` | report page/totals | MOD-02 | filter status/severity/assignee |
| Violation detail `/admin/violations/:id` | modal/page hiện tại | full report/evidence/AI draft | MOD-03/04 | transition validation; admin decision required; ban action through user API |
| Notification campaigns `/admin/notifications/campaigns` | New P1 | campaign page/status | contract bổ sung khi feature vào cut-line | worker fan-out status; không gửi hàng loạt trong HTTP request |
| Admin profile `/admin/profile` | `/profile` | UserDto | USER-01/02/03/04, AUTH-10 | admin role readonly trừ super-admin workflow |

Admin authorization dùng `adminProfile.adminRole`; ẩn menu chỉ là UX, backend guard vẫn bắt buộc.

## 12. Mobile integration

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

Mobile MVP ưu tiên các page: login, dashboard, doctor discovery, booking/on-demand, consultation list/detail/chat, queue, notifications, health summary và profile. Admin mobile và production-grade background CallKeep là Deferred.

## 13. Legacy-to-target migration map

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

## 14. UI state bắt buộc cho mỗi page

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

## 15. Page-level security và privacy

- Patient health data chỉ xuất hiện ở patient owner hoặc doctor đang có consultation được phép.
- Chat/file URL cần authorization hoặc signed URL policy; không coi URL Cloudinary là quyền truy cập.
- Admin dashboard không trả raw health content, AI prompt hoặc chat content.
- Payment page không hiển thị gateway payload/signature.
- Refund page không hiển thị provider internal error cho patient; map sang trạng thái an toàn.
- AI page luôn hiển thị disclaimer; emergency response có CTA phù hợp.
- Không đưa access/refresh token, OTP, health content hoặc payment params vào analytics/log frontend.
- Deep-link từ Notification phải đi qua allowlist `resourceType → route builder`, không dùng URL tùy ý từ payload.

## 16. Definition of Done cho tích hợp một page

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
