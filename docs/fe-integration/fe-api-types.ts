/**
 * Contract TypeScript dành cho Frontend.
 * Sinh từ controller/DTO/service hiện tại; không import package backend.
 * Quy ước: mọi field ngày/giờ được biểu diễn bằng string ISO 8601, không dùng Date.
 * Ngày đối chiếu: 2026-11-15.
 */

// ==================== COMMON ====================

/** Binary gửi bằng multipart/form-data trong browser. */
export type UploadBinary = Blob | File;

/** Envelope thành công phổ biến; một số API legacy trả object trực tiếp. */
export interface ApiSuccessResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

/** Global HttpExceptionFilter error envelope. */
export interface ApiErrorResponse {
  statusCode: number;
  /** ISO 8601 */
  timestamp: string;
  path: string;
  method: string;
  correlationId: string;
  error: string;
  message: string | string[];
  code?: string;
  details?: Record<string, unknown>;
}

/** Phân trang page/limit phổ biến; endpoint cụ thể có thể dùng totalPages/pages/hasNextPage. */
export interface PagePagination {
  page: number;
  limit: number;
  total: number;
  pages?: number;
  totalPages?: number;
  hasNextPage?: boolean;
}

/** Cursor pagination phổ biến. */
export interface CursorPagination {
  nextCursor: string | null;
  hasMore: boolean;
}

// ==================== HEALTH ====================

/** GET /api/v1/health/live — input (Params/Query/Headers/Body theo tên field). */
export interface HealthLiveRequest {

}

/** GET /api/v1/health/live — response thành công theo return type thực tế. */
export interface HealthLiveResponse {
  status?: string;
  info?: { [key: string]: { status: string;
  [key: string]: unknown;
  };
  } | null;
  error?: { [key: string]: { status: string;
  [key: string]: unknown;
  };
  } | null;
  details?: { [key: string]: { status: string;
  [key: string]: unknown;
  };
  };
}

/** GET /api/v1/health/ready — input (Params/Query/Headers/Body theo tên field). */
export interface HealthReadyRequest {

}

/** GET /api/v1/health/ready — response thành công theo return type thực tế. */
export interface HealthReadyResponse {
  status?: string;
  info?: { [key: string]: { status: string;
  [key: string]: unknown;
  };
  } | null;
  error?: { [key: string]: { status: string;
  [key: string]: unknown;
  };
  } | null;
  details?: { [key: string]: { status: string;
  [key: string]: unknown;
  };
  };
}

// ==================== AUTH ====================

/**
 * Phase A canonical authentication types (2026-11-18). These take precedence
 * over legacy generated Auth* types below. New frontend code must not use
 * `/auth/register`, role-bearing registration, or OAuth link/unlink types.
 */
export type AuthenticationRole = 'patient' | 'doctor' | 'admin' | 'ai_manager';

export interface RegisterPatientRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
}

export interface RegisterDoctorRequest extends RegisterPatientRequest {
  specialty: string;
  workplace: string;
  experienceYears: number;
  /** Sent only as multipart files under `newFilesToUpload`; never send URL strings. */
  newFilesToUpload?: UploadBinary[];
}

export interface PendingVerificationResponse {
  status: 'pending_verification';
  message: string;
}

export interface RequestEmailVerificationRequest {
  email: string;
}

export interface VerifyEmailRequest {
  email: string;
  otpCode: string;
}

export interface PasswordRecoveryRequest {
  email: string;
}

export interface ResetPasswordRequest extends VerifyEmailRequest {
  newPassword: string;
}

export interface RestoreDoctorReapplicationRequest {
  email: string;
  password: string;
}

export interface RestoreDoctorReapplicationResponse {
  fullName: string;
  phoneNumber: string | null;
  specialty: string;
  workplace: string;
  experienceYears: number;
  verificationDocuments: Array<{ id: string; label: string }>;
  verificationDocumentCount: number;
}

export interface RefreshSessionRequest {
  refreshToken: string;
}

/** Google OAuth is browser navigation, not a JSON request. No link/unlink API exists. */
export type BeginGooglePatientAuthentication = never;

/** POST /api/v1/auth/register — input (Params/Query/Headers/Body theo tên field). */
export interface AuthRegisterRequest {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  role?: "patient" | "doctor" | "admin";
  specialty?: string;
  experienceYears?: number;
  workplace?: string;
  verificationDocuments?: Array<string>;
  existingVerificationDocuments?: Array<string>;
  newFilesToUpload?: UploadBinary[];
}

/** POST /api/v1/auth/register — response thành công theo return type thực tế. */
export interface AuthRegisterResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string;
  email: undefined | string;
  fullName: string;
  role: "patient" | "doctor" | "admin";
  avatarUrl: string;
  };
}

/** POST /api/v1/auth/login — input (Params/Query/Headers/Body theo tên field). */
export interface AuthLoginRequest {
  email: string;
  password: string;
}

/** POST /api/v1/auth/login — response thành công theo return type thực tế. */
export interface AuthLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string;
  email: undefined | string;
  fullName: string;
  role: "patient" | "doctor" | "admin";
  avatarUrl: string;
  };
}

/** POST /api/v1/auth/refresh — input (Params/Query/Headers/Body theo tên field). */
export interface AuthRefreshRequest {
  userId: string;
  refreshToken: string;
}

/** POST /api/v1/auth/refresh — response thành công theo return type thực tế. */
export interface AuthRefreshResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string;
  email: undefined | string;
  fullName: string;
  role: "patient" | "doctor" | "admin";
  avatarUrl: string;
  };
}

/** POST /api/v1/auth/logout — input (Params/Query/Headers/Body theo tên field). */
export interface AuthLogoutRequest {

}

/** POST /api/v1/auth/logout — response thành công theo return type thực tế. */
export interface AuthLogoutResponse {
  message: string;
}

/** GET /api/v1/auth/me — input (Params/Query/Headers/Body theo tên field). */
export interface AuthGetProfileRequest {

}

/** GET /api/v1/auth/me — response thành công theo return type thực tế. */
export interface AuthGetProfileResponse {
  fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
}

/** POST /api/v1/auth/change-password — input (Params/Query/Headers/Body theo tên field). */
export interface AuthChangePasswordRequest {
  email: string;
  otpCode: string;
  newPassword: string;
}

/** POST /api/v1/auth/change-password — response thành công theo return type thực tế. */
export interface AuthChangePasswordResponse {
  message: string;
}

/** POST /api/v1/auth/forgot-password — input (Params/Query/Headers/Body theo tên field). */
export interface AuthForgotPasswordRequest {
  email: string;
}

/** POST /api/v1/auth/forgot-password — response thành công theo return type thực tế. */
export interface AuthForgotPasswordResponse {
  message: string;
}

/** POST /api/v1/auth/send-otp — input (Params/Query/Headers/Body theo tên field). */
export interface AuthSendOtpRequest {
  email: string;
}

/** POST /api/v1/auth/send-otp — response thành công theo return type thực tế. */
export interface AuthSendOtpResponse {
  message: string;
}

/** POST /api/v1/auth/confirm-otp — input (Params/Query/Headers/Body theo tên field). */
export interface AuthConfirmOtpRequest {
  email: string;
  otpCode: string;
}

/** POST /api/v1/auth/confirm-otp — response thành công theo return type thực tế. */
export interface AuthConfirmOtpResponse {
  message: string;
}

// ==================== UPLOAD ====================

/** POST /api/v1/upload/single — input (Params/Query/Headers/Body theo tên field). */
export interface UploadUploadSingleRequest {
  folder: "healthcare/profiles" | "healthcare/avatars/admin" | "healthcare/avatars/doctor" | "healthcare/avatars/patient" | "healthcare/doctors/verification" | "healthcare/documents/health" | "healthcare/documents/records" | "healthcare/chat/attachments" | "healthcare/ai/knowledge-base";
  fileType: "image" | "document";
  description?: string;
}

/** POST /api/v1/upload/single — response thành công theo return type thực tế. */
export interface UploadUploadSingleResponse {
  statusCode: number;
  message: string;
  data: { files: Array<{ originalName: string;
  publicId: string;
  url: string;
  secureUrl: string;
  size: number;
  }>;
  uploadedAt: string;
  totalSize: number;
  };
}

/** POST /api/v1/upload/multiple — input (Params/Query/Headers/Body theo tên field). */
export interface UploadUploadMultipleRequest {
  folder: "healthcare/profiles" | "healthcare/avatars/admin" | "healthcare/avatars/doctor" | "healthcare/avatars/patient" | "healthcare/doctors/verification" | "healthcare/documents/health" | "healthcare/documents/records" | "healthcare/chat/attachments" | "healthcare/ai/knowledge-base";
  fileType: "image" | "document";
  descriptions?: Array<string>;
  files?: UploadBinary[];
}

/** POST /api/v1/upload/multiple — response thành công theo return type thực tế. */
export interface UploadUploadMultipleResponse {
  statusCode: number;
  message: string;
  data: { files: Array<{ originalName: string;
  publicId: string;
  url: string;
  secureUrl: string;
  size: number;
  }>;
  uploadedAt: string;
  totalSize: number;
  };
}

/** GET /api/v1/upload/info — input (Params/Query/Headers/Body theo tên field). */
export interface UploadGetFileInfoRequest {
  query: { publicId: string;
  };
}

/** GET /api/v1/upload/info — response thành công theo return type thực tế. */
export interface UploadGetFileInfoResponse {
  statusCode: number;
  message: string;
  data: { publicId: unknown;
  url: unknown;
  secureUrl: unknown;
  size: unknown;
  format: unknown;
  uploadedAt: string;
  };
}

/** GET /api/v1/upload/debug/list — input (Params/Query/Headers/Body theo tên field). */
export interface UploadDebugListFilesRequest {

}

/** GET /api/v1/upload/debug/list — response thành công theo return type thực tế. */
export interface UploadDebugListFilesResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** DELETE /api/v1/upload/delete — input (Params/Query/Headers/Body theo tên field). */
export interface UploadDeleteFileRequest {
  query: { publicId: string;
  };
  body: { fileType?: "image" | "document";
  };
}

/** DELETE /api/v1/upload/delete — response thành công theo return type thực tế. */
export interface UploadDeleteFileResponse {
  statusCode: number;
  message: string;
  data: { success: boolean;
  message: string;
  };
}

/** POST /api/v1/upload/delete-multiple — input (Params/Query/Headers/Body theo tên field). */
export interface UploadDeleteMultipleRequest {
  publicIds: Array<string>;
  fileType?: "image" | "document";
}

/** POST /api/v1/upload/delete-multiple — response thành công theo return type thực tế. */
export interface UploadDeleteMultipleResponse {
  statusCode: number;
  message: string;
  data: { success: boolean;
  deleted: number;
  failed: number;
  };
}

/** POST /api/v1/upload/avatar — input (Params/Query/Headers/Body theo tên field). */
export interface UploadUploadAvatarRequest {
  file: UploadBinary;
}

/** POST /api/v1/upload/avatar — response thành công theo return type thực tế. */
export interface UploadUploadAvatarResponse {
  statusCode: number;
  message: string;
  data: { files: Array<{ originalName: string;
  publicId: string;
  url: string;
  secureUrl: string;
  size: number;
  }>;
  uploadedAt: string;
  totalSize: number;
  };
}

/** POST /api/v1/upload/doctor-verification — input (Params/Query/Headers/Body theo tên field). */
export interface UploadUploadDoctorVerificationRequest {
  files: Array<UploadBinary>;
}

/** POST /api/v1/upload/doctor-verification — response thành công theo return type thực tế. */
export interface UploadUploadDoctorVerificationResponse {
  statusCode: number;
  message: string;
  data: { files: Array<{ originalName: string;
  publicId: string;
  url: string;
  secureUrl: string;
  size: number;
  }>;
  uploadedAt: string;
  totalSize: number;
  };
}

// ==================== USERS ====================

/** GET /api/v1/users — input (Params/Query/Headers/Body theo tên field). */
export interface UsersFindAllRequest {

}

/** GET /api/v1/users — response thành công theo return type thực tế. */
export type UsersFindAllResponse = Array<{ fullName: string; email?: string; passwordHash?: string; gender: string; dateOfBirth: string; role: "patient" | "doctor" | "admin"; phoneNumber: string; avatarUrl: string; avatarPublicId: string; accountStatus: "active" | "banned"; isOnline: boolean; address: { street: string; ward: string; district: string; city: string; country: string; }; banReason: string; doctorProfile?: { specialty: string; workplace: string; verificationDocuments: Array<string>; experienceYears: number; averageRating: number; ratingSum: number; reviewCount: number; verifiedAt: string; rejectReason: string; verificationStatus: "pending" | "approved" | "rejected"; }; adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager"; }; } | { specialty: undefined | string; fullName: string; email?: string; passwordHash?: string; gender: string; dateOfBirth: string; role: "patient" | "doctor" | "admin"; phoneNumber: string; avatarUrl: string; avatarPublicId: string; accountStatus: "active" | "banned"; isOnline: boolean; address: { street: string; ward: string; district: string; city: string; country: string; }; banReason: string; doctorProfile?: { specialty: string; workplace: string; verificationDocuments: Array<string>; experienceYears: number; averageRating: number; ratingSum: number; reviewCount: number; verifiedAt: string; rejectReason: string; verificationStatus: "pending" | "approved" | "rejected"; }; adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager"; }; }>;

/** GET /api/v1/users/search — input (Params/Query/Headers/Body theo tên field). */
export interface UsersFindAllPagedRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  };
}

/** GET /api/v1/users/search — response thành công theo return type thực tế. */
export interface UsersFindAllPagedResponse {
  items: Array<{ fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** GET /api/v1/users/doctors — input (Params/Query/Headers/Body theo tên field). */
export interface UsersFindDoctorsRequest {

}

/** GET /api/v1/users/doctors — response thành công theo return type thực tế. */
export type UsersFindDoctorsResponse = Array<{ fullName: string; email?: string; passwordHash?: string; gender: string; dateOfBirth: string; role: "patient" | "doctor" | "admin"; phoneNumber: string; avatarUrl: string; avatarPublicId: string; accountStatus: "active" | "banned"; isOnline: boolean; address: { street: string; ward: string; district: string; city: string; country: string; }; banReason: string; doctorProfile?: { specialty: string; workplace: string; verificationDocuments: Array<string>; experienceYears: number; averageRating: number; ratingSum: number; reviewCount: number; verifiedAt: string; rejectReason: string; verificationStatus: "pending" | "approved" | "rejected"; }; adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager"; }; }>;

/** GET /api/v1/users/doctors/search — input (Params/Query/Headers/Body theo tên field). */
export interface UsersSearchDoctorsRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  };
}

/** GET /api/v1/users/doctors/search — response thành công theo return type thực tế. */
export interface UsersSearchDoctorsResponse {
  items: Array<{ fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** GET /api/v1/users/doctor/{email} — input (Params/Query/Headers/Body theo tên field). */
export interface UsersFindDoctorByEmailRequest {
  params: { email: string;
  };
}

/** GET /api/v1/users/doctor/{email} — response thành công theo return type thực tế. */
export interface UsersFindDoctorByEmailResponse {
  email: string;
  phoneNumber: string;
  fullName: string;
  specialty?: string;
  workplace?: string;
  experienceYears?: number;
  verificationDocuments?: Array<string>;
  verificationStatus: "pending" | "approved" | "rejected";
  rejectReason?: string;
}

/** GET /api/v1/users/me — input (Params/Query/Headers/Body theo tên field). */
export interface UsersGetMeRequest {

}

/** GET /api/v1/users/me — response thành công theo return type thực tế. */
export interface UsersGetMeResponse {
  fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
}

/** PATCH /api/v1/users/me — input (Params/Query/Headers/Body theo tên field). */
export interface UsersUpdateMeRequest {
  fullName?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  phoneNumber?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: { street?: string;
  ward?: string;
  district?: string;
  city?: string;
  country?: string;
  };
  specialty?: string;
  workplace?: string;
  verificationDocuments?: Array<string>;
  existingVerificationDocuments?: Array<string>;
  experienceYears?: number;
  averageRating?: number;
  isOnline?: false | true;
  newFilesToUpload?: UploadBinary[];
}

/** PATCH /api/v1/users/me — response thành công theo return type thực tế. */
export interface UsersUpdateMeResponse {
  fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
}

/** GET /api/v1/users/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface UsersFindOneRequest {
  params: { id: string;
  };
}

/** GET /api/v1/users/{id} — response thành công theo return type thực tế. */
export interface UsersFindOneResponse {
  fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
}

/** DELETE /api/v1/users/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface UsersDeactivateRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/users/{id} — response thành công theo return type thực tế. */
export interface UsersDeactivateResponse {
  fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
}

// ==================== PATIENTS ====================

/** GET /api/v1/patients/me — input (Params/Query/Headers/Body theo tên field). */
export interface PatientProfileGetProfileRequest {

}

/** GET /api/v1/patients/me — response thành công theo return type thực tế. */
export interface PatientProfileGetProfileResponse {
  statusCode: number;
  message: string;
  data: { userId: string;
  };
}

/** POST /api/v1/patients/me — input (Params/Query/Headers/Body theo tên field). */
export interface PatientProfileCreateRequest {

}

/** POST /api/v1/patients/me — response thành công theo return type thực tế. */
export interface PatientProfileCreateResponse {
  statusCode: number;
  message: string;
  data: { userId: string;
  };
}

/** DELETE /api/v1/patients/me — input (Params/Query/Headers/Body theo tên field). */
export interface PatientProfileDeleteRequest {

}

/** DELETE /api/v1/patients/me — response thành công theo return type thực tế. */
export interface PatientProfileDeleteResponse {
  statusCode: number;
  message: string;
}

/** GET /api/v1/patients — input (Params/Query/Headers/Body theo tên field). */
export interface PatientProfileFindAllRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  sortBy?: string;
  };
}

/** GET /api/v1/patients — response thành công theo return type thực tế. */
export interface PatientProfileFindAllResponse {
  statusCode: number;
  message: string;
  data: { patients: Array<{ userId: string;
  }>;
  pagination: { total: number;
  page: number;
  limit: number;
  totalPages: number;
  };
  };
}

// ==================== ADMINS ====================

/** GET /api/v1/admins — input (Params/Query/Headers/Body theo tên field). */
export interface AdminsFindAllRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  adminRole?: "super_admin" | "user_admin" | "ai_admin";
  sortBy?: string;
  };
}

/** GET /api/v1/admins — response thành công theo return type thực tế. */
export interface AdminsFindAllResponse {
  statusCode: number;
  message: string;
  data: { admins: Array<{ _id: unknown;
  userId: Record<string, unknown>;
  adminRole: undefined | "super_admin" | "user_admin" | "ai_admin";
  createdAt: unknown;
  updatedAt: unknown;
  }>;
  pagination: { total: number;
  page: number;
  limit: number;
  totalPages: number;
  };
  };
}

/** POST /api/v1/admins — input (Params/Query/Headers/Body theo tên field). */
export interface AdminsCreateRequest {
  fullName: string;
  email: string;
  password: string;
  assignedRole?: "super_admin" | "user_admin" | "ai_admin";
  accountStatus?: "active" | "banned";
}

/** POST /api/v1/admins — response thành công theo return type thực tế. */
export interface AdminsCreateResponse {
  statusCode: number;
  message: string;
  data: { _id: unknown;
  userId: Record<string, unknown>;
  adminRole: undefined | "super_admin" | "user_admin" | "ai_admin";
  createdAt: unknown;
  updatedAt: unknown;
  };
}

/** PATCH /api/v1/admins/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface AdminsUpdateRequest {
  params: { id: string;
  };
  body: { adminRole?: "super_admin" | "user_admin" | "ai_admin";
  };
}

/** PATCH /api/v1/admins/{id} — response thành công theo return type thực tế. */
export interface AdminsUpdateResponse {
  statusCode: number;
  message: string;
  data: { _id: unknown;
  userId: Record<string, unknown>;
  adminRole: undefined | "super_admin" | "user_admin" | "ai_admin";
  createdAt: unknown;
  updatedAt: unknown;
  };
}

/** DELETE /api/v1/admins/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface AdminsDeleteRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/admins/{id} — response thành công theo return type thực tế. */
export interface AdminsDeleteResponse {
  statusCode: number;
  message: string;
}

// ==================== NOTIFICATIONS ====================

/** GET /api/v1/notifications — input (Params/Query/Headers/Body theo tên field). */
export interface NotificationsFindAllRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  cursor?: string;
  type?: string;
  unreadOnly?: boolean;
  sortBy?: "createdAt";
  };
}

/** GET /api/v1/notifications — response thành công theo return type thực tế. */
export interface NotificationsFindAllResponse {
  statusCode: number;
  message: string;
  data: { notifications: Array<{ userId: string;
  type: "info" | "success" | "warning" | "critical";
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  attachments?: Array<Record<string, unknown>>;
  metadata?: { relatedEntityId?: string;
  relatedEntityType?: string;
  action?: string;
  };
  expiresAt?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  }>;
  hasNextPage: boolean;
  nextCursor: null | string;
  pagination: { total: number;
  page: number;
  limit: number;
  totalPages: number;
  };
  };
}

/** POST /api/v1/notifications — input (Params/Query/Headers/Body theo tên field). */
export interface NotificationsCreateRequest {
  userId: string;
  type: "info" | "success" | "warning" | "critical";
  title: string;
  message: string;
  idempotencyKey?: string;
}

/** POST /api/v1/notifications — response thành công theo return type thực tế. */
export interface NotificationsCreateResponse {
  statusCode: number;
  message: string;
  data: { userId: string;
  type: "info" | "success" | "warning" | "critical";
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  attachments?: Array<{ url: string;
  publicId: string;
  fileName: string;
  fileType: "image" | "document";
  size: number;
  uploadedAt: string;
  }>;
  metadata?: { relatedEntityId?: string;
  relatedEntityType?: string;
  action?: string;
  };
  expiresAt?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  };
}

/** PATCH /api/v1/notifications/mark-all-as-read — input (Params/Query/Headers/Body theo tên field). */
export interface NotificationsMarkAllAsReadRequest {

}

/** PATCH /api/v1/notifications/mark-all-as-read — response thành công theo return type thực tế. */
export interface NotificationsMarkAllAsReadResponse {
  statusCode: number;
  message: string;
  data: { modifiedCount: number;
  };
}

/** GET /api/v1/notifications/unread/count — input (Params/Query/Headers/Body theo tên field). */
export interface NotificationsCountUnreadRequest {

}

/** GET /api/v1/notifications/unread/count — response thành công theo return type thực tế. */
export interface NotificationsCountUnreadResponse {
  statusCode: number;
  message: string;
  data: { unreadCount: number;
  };
}

/** GET /api/v1/notifications/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface NotificationsFindOneRequest {
  params: { id: string;
  };
}

/** GET /api/v1/notifications/{id} — response thành công theo return type thực tế. */
export interface NotificationsFindOneResponse {
  statusCode: number;
  message: string;
  data: { userId: string;
  type: "info" | "success" | "warning" | "critical";
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  attachments?: Array<{ url: string;
  publicId: string;
  fileName: string;
  fileType: "image" | "document";
  size: number;
  uploadedAt: string;
  }>;
  metadata?: { relatedEntityId?: string;
  relatedEntityType?: string;
  action?: string;
  };
  expiresAt?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  };
}

/** PATCH /api/v1/notifications/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface NotificationsUpdateRequest {
  params: { id: string;
  };
  body: { read?: false | true;
  };
}

/** PATCH /api/v1/notifications/{id} — response thành công theo return type thực tế. */
export interface NotificationsUpdateResponse {
  statusCode: number;
  message: string;
  data: { userId: string;
  type: "info" | "success" | "warning" | "critical";
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  attachments?: Array<{ url: string;
  publicId: string;
  fileName: string;
  fileType: "image" | "document";
  size: number;
  uploadedAt: string;
  }>;
  metadata?: { relatedEntityId?: string;
  relatedEntityType?: string;
  action?: string;
  };
  expiresAt?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  };
}

/** DELETE /api/v1/notifications/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface NotificationsDeleteRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/notifications/{id} — response thành công theo return type thực tế. */
export interface NotificationsDeleteResponse {
  statusCode: number;
  message: string;
}

// ==================== PRESENCE ====================

/** POST /api/v1/presence/status — input (Params/Query/Headers/Body theo tên field). */
export interface PresenceCheckUsersStatusRequest {

}

/** POST /api/v1/presence/status — response thành công theo return type thực tế. */
export interface PresenceCheckUsersStatusResponse {
  statusCode: number;
  data: { onlineUserIds: Array<string>;
  };
}

// ==================== BLACKLIST KEYWORDS ====================

/** GET /api/v1/blacklist-keywords — input (Params/Query/Headers/Body theo tên field). */
export interface BlacklistKeywordsGetAllRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  search?: string;
  sortBy?: string;
  };
}

/** GET /api/v1/blacklist-keywords — response thành công theo return type thực tế. */
export interface BlacklistKeywordsGetAllResponse {
  data: Array<{ _id: string;
  keyword: string;
  }>;
  total: number;
}

/** POST /api/v1/blacklist-keywords — input (Params/Query/Headers/Body theo tên field). */
export interface BlacklistKeywordsCreateRequest {
  keyword: string;
}

/** POST /api/v1/blacklist-keywords — response thành công theo return type thực tế. */
export interface BlacklistKeywordsCreateResponse {
  _id: string;
  keyword: string;
}

/** POST /api/v1/blacklist-keywords/check — input (Params/Query/Headers/Body theo tên field). */
export interface BlacklistKeywordsCheckContentRequest {

}

/** POST /api/v1/blacklist-keywords/check — response thành công theo return type thực tế. */
export interface BlacklistKeywordsCheckContentResponse {
  flagged: boolean;
  flaggedWords: Array<string>;
}

/** GET /api/v1/blacklist-keywords/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface BlacklistKeywordsGetKeywordRequest {
  params: { id: string;
  };
}

/** GET /api/v1/blacklist-keywords/{id} — response thành công theo return type thực tế. */
export interface BlacklistKeywordsGetKeywordResponse {
  _id: string;
  keyword: string;
}

/** PATCH /api/v1/blacklist-keywords/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface BlacklistKeywordsUpdateKeywordRequest {
  params: { id: string;
  };
  body: { keyword?: string;
  };
}

/** PATCH /api/v1/blacklist-keywords/{id} — response thành công theo return type thực tế. */
export interface BlacklistKeywordsUpdateKeywordResponse {
  _id: string;
  keyword: string;
}

/** DELETE /api/v1/blacklist-keywords/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface BlacklistKeywordsDeleteKeywordRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/blacklist-keywords/{id} — response thành công theo return type thực tế. */
export interface BlacklistKeywordsDeleteKeywordResponse {
  _id: string;
  keyword: string;
}

// ==================== VIOLATIONS ====================

/** GET /api/v1/violations — input (Params/Query/Headers/Body theo tên field). */
export interface ViolationsFindAllRequest {
  query: { page?: number;
  limit?: number;
  status?: "pending" | "processing" | "resolved" | "dismissed";
  report_type?: "harassment" | "spam" | "misinformation" | "inappropriate_content" | "impersonation" | "fraud" | "ai_hallucination" | "other";
  };
}

/** GET /api/v1/violations — response thành công theo return type thực tế. */
export interface ViolationsFindAllResponse {
  data: Array<{ reporterId: null | string;
  reportedUserId: null | string;
  reportType: "harassment" | "spam" | "misinformation" | "inappropriate_content" | "impersonation" | "fraud" | "ai_hallucination" | "other";
  reason: string;
  status: "pending" | "processing" | "resolved" | "dismissed";
  resolutionNote?: string;
  actionTaken?: "warning" | "suspend" | "ban" | "none";
  resolvedBy?: string;
  resolvedAt?: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

/** POST /api/v1/violations — input (Params/Query/Headers/Body theo tên field). */
export interface ViolationsCreateRequest {
  reporter_id?: string;
  reported_user_id?: string;
  report_type: "harassment" | "spam" | "misinformation" | "inappropriate_content" | "impersonation" | "fraud" | "ai_hallucination" | "other";
  reason: string;
}

/** POST /api/v1/violations — response thành công theo return type thực tế. */
export interface ViolationsCreateResponse {
  reporterId: null | string;
  reportedUserId: null | string;
  reportType: "harassment" | "spam" | "misinformation" | "inappropriate_content" | "impersonation" | "fraud" | "ai_hallucination" | "other";
  reason: string;
  status: "pending" | "processing" | "resolved" | "dismissed";
  resolutionNote?: string;
  actionTaken?: "warning" | "suspend" | "ban" | "none";
  resolvedBy?: string;
  resolvedAt?: string;
}

/** GET /api/v1/violations/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ViolationsFindByIdRequest {
  params: { id: string;
  };
}

/** GET /api/v1/violations/{id} — response thành công theo return type thực tế. */
export interface ViolationsFindByIdResponse {
  reporterId: null | string;
  reportedUserId: null | string;
  reportType: "harassment" | "spam" | "misinformation" | "inappropriate_content" | "impersonation" | "fraud" | "ai_hallucination" | "other";
  reason: string;
  status: "pending" | "processing" | "resolved" | "dismissed";
  resolutionNote?: string;
  actionTaken?: "warning" | "suspend" | "ban" | "none";
  resolvedBy?: string;
  resolvedAt?: string;
}

/** PATCH /api/v1/violations/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ViolationsUpdateRequest {
  params: { id: string;
  };
  body: { resolution_note?: string;
  action_taken?: "warning" | "suspend" | "ban" | "none";
  status?: "pending" | "processing" | "resolved" | "dismissed";
  };
}

/** PATCH /api/v1/violations/{id} — response thành công theo return type thực tế. */
export interface ViolationsUpdateResponse {
  reporterId: null | string;
  reportedUserId: null | string;
  reportType: "harassment" | "spam" | "misinformation" | "inappropriate_content" | "impersonation" | "fraud" | "ai_hallucination" | "other";
  reason: string;
  status: "pending" | "processing" | "resolved" | "dismissed";
  resolutionNote?: string;
  actionTaken?: "warning" | "suspend" | "ban" | "none";
  resolvedBy?: string;
  resolvedAt?: string;
}

/** DELETE /api/v1/violations/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ViolationsDeleteRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/violations/{id} — response thành công theo return type thực tế. */
export type ViolationsDeleteResponse = void;

/** GET /api/v1/violations/user/{userId} — input (Params/Query/Headers/Body theo tên field). */
export interface ViolationsFindByUserIdRequest {
  params: { userId: string;
  };
  query: { page?: number;
  limit?: number;
  status?: "pending" | "processing" | "resolved" | "dismissed";
  report_type?: "harassment" | "spam" | "misinformation" | "inappropriate_content" | "impersonation" | "fraud" | "ai_hallucination" | "other";
  };
}

/** GET /api/v1/violations/user/{userId} — response thành công theo return type thực tế. */
export interface ViolationsFindByUserIdResponse {
  data: Array<{ reporterId: null | string;
  reportedUserId: null | string;
  reportType: "harassment" | "spam" | "misinformation" | "inappropriate_content" | "impersonation" | "fraud" | "ai_hallucination" | "other";
  reason: string;
  status: "pending" | "processing" | "resolved" | "dismissed";
  resolutionNote?: string;
  actionTaken?: "warning" | "suspend" | "ban" | "none";
  resolvedBy?: string;
  resolvedAt?: string;
  }>;
  total: number;
}

/** POST /api/v1/violations/{id}/resolve — input (Params/Query/Headers/Body theo tên field). */
export interface ViolationsResolveRequest {
  params: { id: string;
  };
  body: { resolution_note?: string;
  action_taken?: "warning" | "suspend" | "ban" | "none";
  status?: "pending" | "processing" | "resolved" | "dismissed";
  };
}

/** POST /api/v1/violations/{id}/resolve — response thành công theo return type thực tế. */
export interface ViolationsResolveResponse {
  reporterId: null | string;
  reportedUserId: null | string;
  reportType: "harassment" | "spam" | "misinformation" | "inappropriate_content" | "impersonation" | "fraud" | "ai_hallucination" | "other";
  reason: string;
  status: "pending" | "processing" | "resolved" | "dismissed";
  resolutionNote?: string;
  actionTaken?: "warning" | "suspend" | "ban" | "none";
  resolvedBy?: string;
  resolvedAt?: string;
}

/** GET /api/v1/violations/stats/overview — input (Params/Query/Headers/Body theo tên field). */
export interface ViolationsGetStatsRequest {

}

/** GET /api/v1/violations/stats/overview — response thành công theo return type thực tế. */
export interface ViolationsGetStatsResponse {
  total: number;
  pending: number;
  resolved: number;
  by_type: Record<string, unknown>;
}

// ==================== HEALTH-METRICS ====================

/** GET /api/v1/health-metrics — input (Params/Query/Headers/Body theo tên field). */
export interface HealthMetricsFindAllRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  cursor?: string;
  metricType?: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  startDate?: string;
  endDate?: string;
  patientId?: string;
  sortBy?: "recordedAt" | "createdAt";
  };
}

/** GET /api/v1/health-metrics — response thành công theo return type thực tế. */
export interface HealthMetricsFindAllResponse {
  statusCode: number;
  message: string;
  data: Array<{ createdAt: string;
  voidReason?: string;
  voidedAt?: string;
  recordedAt: string;
  ingestedAt: string;
  replacesMetricId?: string;
  recordedTimezone?: string;
  validationStatus: "valid" | "rejected" | "superseded" | "voided";
  validationReasonCodes: Array<string>;
  sourceRef?: { deviceId?: string;
  importBatchId?: string;
  enteredBy?: string;
  };
  id: string;
  patientId: string;
  metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  unit: string;
  values: Record<string, unknown>;
  source: "manual" | "device" | "clinician" | "import";
  }>;
  nextCursor: null | string;
  hasNextPage: boolean;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** POST /api/v1/health-metrics — input (Params/Query/Headers/Body theo tên field). */
export interface HealthMetricsCreateRequest {
  metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  values: Record<string, unknown>;
  source?: "manual" | "device" | "clinician" | "import";
  sourceRef?: { deviceId?: string;
  importBatchId?: string;
  };
  recordedTimezone?: string;
  recordedAt?: string;
}

/** POST /api/v1/health-metrics — response thành công theo return type thực tế. */
export interface HealthMetricsCreateResponse {
  statusCode: number;
  message: string;
  data: { createdAt: string;
  voidReason?: string;
  voidedAt?: string;
  recordedAt: string;
  ingestedAt: string;
  replacesMetricId?: string;
  recordedTimezone?: string;
  validationStatus: "valid" | "rejected" | "superseded" | "voided";
  validationReasonCodes: Array<string>;
  sourceRef?: { deviceId?: string;
  importBatchId?: string;
  enteredBy?: string;
  };
  id: string;
  patientId: string;
  metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  unit: string;
  values: Record<string, unknown>;
  source: "manual" | "device" | "clinician" | "import";
  };
}

/** GET /api/v1/health-metrics/statistics/{type} — input (Params/Query/Headers/Body theo tên field). */
export interface HealthMetricsGetStatisticsRequest {
  params: { type: string;
  };
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  cursor?: string;
  metricType?: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  startDate?: string;
  endDate?: string;
  patientId?: string;
  sortBy?: "recordedAt" | "createdAt";
  };
}

/** GET /api/v1/health-metrics/statistics/{type} — response thành công theo return type thực tế. */
export interface HealthMetricsGetStatisticsResponse {
  statusCode: number;
  message: string;
  data: { metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  count: number;
  average: number;
  minimum: number;
  maximum: number;
  latest: { createdAt: string;
  voidReason?: string;
  voidedAt?: string;
  recordedAt: string;
  ingestedAt: string;
  replacesMetricId?: string;
  recordedTimezone?: string;
  validationStatus: "valid" | "rejected" | "superseded" | "voided";
  validationReasonCodes: Array<string>;
  sourceRef?: { deviceId?: string;
  importBatchId?: string;
  enteredBy?: string;
  };
  id: string;
  patientId: string;
  metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  unit: string;
  values: Record<string, unknown>;
  source: "manual" | "device" | "clinician" | "import";
  };
  };
}

/** GET /api/v1/health-metrics/alerts — input (Params/Query/Headers/Body theo tên field). */
export interface HealthMetricsGetAlertsRequest {

}

/** GET /api/v1/health-metrics/alerts — response thành công theo return type thực tế. */
export interface HealthMetricsGetAlertsResponse {
  statusCode: number;
  message: string;
  data: Array<{ meta: { patientId: string;
  metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  unit: string;
  };
  values: Record<string, unknown>;
  source: "manual" | "device" | "clinician" | "import";
  sourceRef?: { deviceId?: string;
  importBatchId?: string;
  enteredBy?: string;
  };
  validationStatus: "valid" | "rejected" | "superseded" | "voided";
  validationReasonCodes: Array<string>;
  recordedTimezone?: string;
  replacesMetricId?: string;
  recordedAt: string;
  ingestedAt: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
  }>;
  count: number;
}

/** GET /api/v1/health-metrics/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface HealthMetricsFindOneRequest {
  params: { id: string;
  };
}

/** GET /api/v1/health-metrics/{id} — response thành công theo return type thực tế. */
export interface HealthMetricsFindOneResponse {
  statusCode: number;
  message: string;
  data: { createdAt: string;
  voidReason?: string;
  voidedAt?: string;
  recordedAt: string;
  ingestedAt: string;
  replacesMetricId?: string;
  recordedTimezone?: string;
  validationStatus: "valid" | "rejected" | "superseded" | "voided";
  validationReasonCodes: Array<string>;
  sourceRef?: { deviceId?: string;
  importBatchId?: string;
  enteredBy?: string;
  };
  id: string;
  patientId: string;
  metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  unit: string;
  values: Record<string, unknown>;
  source: "manual" | "device" | "clinician" | "import";
  };
}

/** POST /api/v1/health-metrics/{id}/corrections — input (Params/Query/Headers/Body theo tên field). */
export interface HealthMetricsCorrectRequest {
  params: { id: string;
  };
  body: { values: Record<string, unknown>;
  recordedAt: string;
  recordedTimezone?: string;
  reason: string;
  };
}

/** POST /api/v1/health-metrics/{id}/corrections — response thành công theo return type thực tế. */
export interface HealthMetricsCorrectResponse {
  statusCode: number;
  message: string;
  data: { createdAt: string;
  voidReason?: string;
  voidedAt?: string;
  recordedAt: string;
  ingestedAt: string;
  replacesMetricId?: string;
  recordedTimezone?: string;
  validationStatus: "valid" | "rejected" | "superseded" | "voided";
  validationReasonCodes: Array<string>;
  sourceRef?: { deviceId?: string;
  importBatchId?: string;
  enteredBy?: string;
  };
  id: string;
  patientId: string;
  metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  unit: string;
  values: Record<string, unknown>;
  source: "manual" | "device" | "clinician" | "import";
  };
}

/** POST /api/v1/health-metrics/{id}/review — input (Params/Query/Headers/Body theo tên field). */
export interface HealthMetricsMarkAsReviewedRequest {
  params: { id: string;
  };
}

/** POST /api/v1/health-metrics/{id}/review — response thành công theo return type thực tế. */
export interface HealthMetricsMarkAsReviewedResponse {
  statusCode: number;
  message: string;
  data: { meta: { patientId: string;
  metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  unit: string;
  };
  values: Record<string, unknown>;
  source: "manual" | "device" | "clinician" | "import";
  sourceRef?: { deviceId?: string;
  importBatchId?: string;
  enteredBy?: string;
  };
  validationStatus: "valid" | "rejected" | "superseded" | "voided";
  validationReasonCodes: Array<string>;
  recordedTimezone?: string;
  replacesMetricId?: string;
  recordedAt: string;
  ingestedAt: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  createdAt: string;
  updatedAt: string;
  };
}

/** POST /api/v1/health-metrics/{id}/void — input (Params/Query/Headers/Body theo tên field). */
export interface HealthMetricsVoidRequest {
  params: { id: string;
  };
  body: { reason: string;
  };
}

/** POST /api/v1/health-metrics/{id}/void — response thành công theo return type thực tế. */
export interface HealthMetricsVoidResponse {
  statusCode: number;
  message: string;
  data: { createdAt: string;
  voidReason?: string;
  voidedAt?: string;
  recordedAt: string;
  ingestedAt: string;
  replacesMetricId?: string;
  recordedTimezone?: string;
  validationStatus: "valid" | "rejected" | "superseded" | "voided";
  validationReasonCodes: Array<string>;
  sourceRef?: { deviceId?: string;
  importBatchId?: string;
  enteredBy?: string;
  };
  id: string;
  patientId: string;
  metricType: "blood_pressure" | "heart_rate" | "blood_glucose" | "oxygen_saturation" | "body_temperature" | "respiratory_rate" | "bmi" | "weight" | "height" | "water_intake" | "kcal_intake";
  unit: string;
  values: Record<string, unknown>;
  source: "manual" | "device" | "clinician" | "import";
  };
}

// ==================== CONSULTATIONS ====================

/** POST /api/v1/consultations/scheduled — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsCreateScheduledRequest {
  headers: { "Idempotency-Key": string;
  };
  body: { availabilitySlotId: string;
  patientNotes?: string;
  };
}

/** POST /api/v1/consultations/scheduled — response thành công theo return type thực tế. */
export interface ConsultationsCreateScheduledResponse {
  statusCode: number;
  data: { id: string;
  };
}

/** GET /api/v1/consultations — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsFindAllRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  mode?: "on_demand" | "scheduled";
  requestStatus?: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  sessionStatus?: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  doctorId?: string;
  patientId?: string;
  from?: string;
  to?: string;
  sortBy?: "requestedAt" | "scheduledStartAt" | "createdAt" | "updatedAt";
  };
}

/** GET /api/v1/consultations — response thành công theo return type thực tế. */
export interface ConsultationsFindAllResponse {
  statusCode: number;
  message: string;
  data: Array<{ patientId: string;
  doctorId: string;
  patientCareProgramId?: string;
  careAlertId?: string;
  careTaskId?: string;
  availabilitySlotId?: string;
  mode: "on_demand" | "scheduled";
  requestStatus: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  sessionStatus: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  requestedAt: string;
  respondedAt?: string;
  requestExpiresAt?: string;
  onDemandTimeoutWarningQueuedAt?: string;
  onDemandTimeoutExtensionExpiresAt?: string;
  scheduledStaleReviewQueuedAt?: string;
  declinedReason?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  timezone?: string;
  expectedDurationMinutes: number;
  estimatedWaitMinutes?: number;
  overtimeStartedAt?: string;
  bookingSettingsSnapshot?: Record<string, unknown>;
  scheduledBookingKey?: string;
  scheduledBookingRequestHash?: string;
  lastRescheduleKey?: string;
  lastRescheduleRequestHash?: string;
  quotaPolicy?: "consultation_limit" | "care_program_included";
  legacyQuotaExempt?: false | true;
  patientNotes?: string;
  doctorNotes?: string;
  followUp?: Record<string, unknown>;
  queueJoinedAt?: string;
  queuePriorityAt?: string;
  calledAt?: string;
  checkInKey?: string;
  checkInRequestHash?: string;
  lastCallNextKey?: string;
  lastCallNextRequestHash?: string;
  sessionStartedAt?: string;
  interruptedAt?: string;
  interruptionReason?: string;
  resumedAt?: string;
  completedAt?: string;
  followUpAt?: string;
  completedBy?: string;
  noShowAt?: string;
  noShowReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  roomId?: string;
  callStartedAt?: string;
  callEndedAt?: string;
  callEndReason?: string;
  consultationConsent?: Record<string, unknown>;
  aiConsultationBrief?: Record<string, unknown>;
  }>;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** POST /api/v1/consultations — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsCreateRequest {
  doctorId: string;
  scheduledStartAt?: string;
  expectedDurationMinutes?: number;
  timezone?: string;
  patientNotes?: string;
}

/** POST /api/v1/consultations — response thành công theo return type thực tế. */
export interface ConsultationsCreateResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** GET /api/v1/consultations/upcoming — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsUpcomingRequest {

}

/** GET /api/v1/consultations/upcoming — response thành công theo return type thực tế. */
export interface ConsultationsUpcomingResponse {
  statusCode: number;
  message: string;
  data: Array<{ patientId: string;
  doctorId: string;
  patientCareProgramId?: string;
  careAlertId?: string;
  careTaskId?: string;
  availabilitySlotId?: string;
  mode: "on_demand" | "scheduled";
  requestStatus: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  sessionStatus: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  requestedAt: string;
  respondedAt?: string;
  requestExpiresAt?: string;
  onDemandTimeoutWarningQueuedAt?: string;
  onDemandTimeoutExtensionExpiresAt?: string;
  scheduledStaleReviewQueuedAt?: string;
  declinedReason?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  timezone?: string;
  expectedDurationMinutes: number;
  estimatedWaitMinutes?: number;
  overtimeStartedAt?: string;
  bookingSettingsSnapshot?: Record<string, unknown>;
  scheduledBookingKey?: string;
  scheduledBookingRequestHash?: string;
  lastRescheduleKey?: string;
  lastRescheduleRequestHash?: string;
  quotaPolicy?: "consultation_limit" | "care_program_included";
  legacyQuotaExempt?: false | true;
  patientNotes?: string;
  doctorNotes?: string;
  followUp?: Record<string, unknown>;
  queueJoinedAt?: string;
  queuePriorityAt?: string;
  calledAt?: string;
  checkInKey?: string;
  checkInRequestHash?: string;
  lastCallNextKey?: string;
  lastCallNextRequestHash?: string;
  sessionStartedAt?: string;
  interruptedAt?: string;
  interruptionReason?: string;
  resumedAt?: string;
  completedAt?: string;
  followUpAt?: string;
  completedBy?: string;
  noShowAt?: string;
  noShowReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  roomId?: string;
  callStartedAt?: string;
  callEndedAt?: string;
  callEndReason?: string;
  consultationConsent?: Record<string, unknown>;
  aiConsultationBrief?: Record<string, unknown>;
  }>;
  count: number;
}

/** POST /api/v1/consultations/{id}/check-in — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsCheckInRequest {
  params: { id: string;
  };
  headers: { "Idempotency-Key": string;
  };
}

/** POST /api/v1/consultations/{id}/check-in — response thành công theo return type thực tế. */
export interface ConsultationsCheckInResponse {
  data: { id: string;
  patientId: string;
  doctorId: string;
  requestStatus: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  sessionStatus: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  scheduledStartAt: undefined | string;
  queueJoinedAt: undefined | string;
  queuePriorityAt: undefined | string;
  calledAt: undefined | string;
  updatedAt: string;
  };
  queue: { consultationId: string;
  status: "called" | "waiting";
  position: number;
  estimatedWaitMinutes: null;
  etaReason: string;
  updatedAt: string;
  };
  replayed: boolean;
}

/** GET /api/v1/consultations/{id}/queue — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsGetQueueRequest {
  params: { id: string;
  };
}

/** GET /api/v1/consultations/{id}/queue — response thành công theo return type thực tế. */
export interface ConsultationsGetQueueResponse {
  consultationId: string;
  status: "called" | "waiting";
  position: number;
  estimatedWaitMinutes: null;
  etaReason: string;
  updatedAt: string;
}

/** GET /api/v1/consultations/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsFindOneRequest {
  params: { id: string;
  };
}

/** GET /api/v1/consultations/{id} — response thành công theo return type thực tế. */
export interface ConsultationsFindOneResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** PATCH /api/v1/consultations/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsUpdateRequest {
  params: { id: string;
  };
  body: { patientNotes?: string;
  doctorNotes?: string;
  scheduledStartAt?: string;
  reason?: string;
  };
}

/** PATCH /api/v1/consultations/{id} — response thành công theo return type thực tế. */
export interface ConsultationsUpdateResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** POST /api/v1/consultations/{id}/accept — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsAcceptRequest {
  params: { id: string;
  };
}

/** POST /api/v1/consultations/{id}/accept — response thành công theo return type thực tế. */
export interface ConsultationsAcceptResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** POST /api/v1/consultations/{id}/decline — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsDeclineRequest {
  params: { id: string;
  };
  body: { patientNotes?: string;
  doctorNotes?: string;
  scheduledStartAt?: string;
  reason?: string;
  };
}

/** POST /api/v1/consultations/{id}/decline — response thành công theo return type thực tế. */
export interface ConsultationsDeclineResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** POST /api/v1/consultations/{id}/start — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsStartRequest {
  params: { id: string;
  };
}

/** POST /api/v1/consultations/{id}/start — response thành công theo return type thực tế. */
export interface ConsultationsStartResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** POST /api/v1/consultations/{id}/waiting-room-presence — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsRecordWaitingRoomPresenceRequest {
  params: { id: string;
  };
}

/** POST /api/v1/consultations/{id}/waiting-room-presence — response thành công theo return type thực tế. */
export interface ConsultationsRecordWaitingRoomPresenceResponse {
  consultationId: string;
  recordedAt: string;
}

/** POST /api/v1/consultations/{id}/complete — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsCompleteRequest {
  params: { id: string;
  };
  body: { patientNotes?: string;
  doctorNotes?: string;
  scheduledStartAt?: string;
  reason?: string;
  };
}

/** POST /api/v1/consultations/{id}/complete — response thành công theo return type thực tế. */
export interface ConsultationsCompleteResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** POST /api/v1/consultations/{id}/no-show — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsMarkNoShowRequest {
  params: { id: string;
  };
  body: { patientNotes?: string;
  doctorNotes?: string;
  scheduledStartAt?: string;
  reason?: string;
  };
}

/** POST /api/v1/consultations/{id}/no-show — response thành công theo return type thực tế. */
export interface ConsultationsMarkNoShowResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** POST /api/v1/consultations/{id}/cancel — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsCancelRequest {
  params: { id: string;
  };
  body: { patientNotes?: string;
  doctorNotes?: string;
  scheduledStartAt?: string;
  reason?: string;
  };
}

/** POST /api/v1/consultations/{id}/cancel — response thành công theo return type thực tế. */
export interface ConsultationsCancelResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** POST /api/v1/consultations/{id}/reschedule — input (Params/Query/Headers/Body theo tên field). */
export interface ConsultationsRescheduleRequest {
  params: { id: string;
  };
  headers: { "Idempotency-Key": string;
  };
  body: { availabilitySlotId: string;
  };
}

/** POST /api/v1/consultations/{id}/reschedule — response thành công theo return type thực tế. */
export interface ConsultationsRescheduleResponse {
  statusCode: number;
  data: { id: string;
  };
}

// ==================== AVAILABILITY-SLOTS ====================

/** GET /api/v1/availability-slots — input (Params/Query/Headers/Body theo tên field). */
export interface AvailabilitySlotsListMineRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  from: string;
  to: string;
  status?: "available" | "booked" | "blocked" | "expired";
  };
}

/** GET /api/v1/availability-slots — response thành công theo return type thực tế. */
export interface AvailabilitySlotsListMineResponse {
  data: Array<{ id: string;
  }>;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** POST /api/v1/availability-slots — input (Params/Query/Headers/Body theo tên field). */
export interface AvailabilitySlotsCreateRequest {
  headers: { "Idempotency-Key"?: string;
  };
  body: { startAt: string;
  endAt: string;
  timezone: string;
  };
}

/** POST /api/v1/availability-slots — response thành công theo return type thực tế. */
export interface AvailabilitySlotsCreateResponse {
  statusCode: number;
  data: { id: string;
  };
}

/** GET /api/v1/availability-slots/doctors/{doctorId} — input (Params/Query/Headers/Body theo tên field). */
export interface AvailabilitySlotsListAvailableRequest {
  params: { doctorId: string;
  };
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  from: string;
  to: string;
  };
}

/** GET /api/v1/availability-slots/doctors/{doctorId} — response thành công theo return type thực tế. */
export interface AvailabilitySlotsListAvailableResponse {
  data: Array<{ id: string;
  }>;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** PATCH /api/v1/availability-slots/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface AvailabilitySlotsUpdateRequest {
  params: { id: string;
  };
  body: { startAt?: string;
  endAt?: string;
  timezone?: string;
  };
}

/** PATCH /api/v1/availability-slots/{id} — response thành công theo return type thực tế. */
export interface AvailabilitySlotsUpdateResponse {
  statusCode: number;
  data: { id: string;
  };
}

/** DELETE /api/v1/availability-slots/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface AvailabilitySlotsRemoveRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/availability-slots/{id} — response thành công theo return type thực tế. */
export type AvailabilitySlotsRemoveResponse = void;

/** PATCH /api/v1/availability-slots/{id}/block — input (Params/Query/Headers/Body theo tên field). */
export interface AvailabilitySlotsBlockRequest {
  params: { id: string;
  };
  body: { reason: string;
  };
}

/** PATCH /api/v1/availability-slots/{id}/block — response thành công theo return type thực tế. */
export type AvailabilitySlotsBlockResponse = undefined | { statusCode: number; data: { id: string; }; };

// ==================== CONSULTATION-QUEUE ====================

/** GET /api/v1/doctors/me/queue — input (Params/Query/Headers/Body theo tên field). */
export interface DoctorQueueListRequest {
  query: { page?: number;
  limit?: number;
  };
}

/** GET /api/v1/doctors/me/queue — response thành công theo return type thực tế. */
export interface DoctorQueueListResponse {
  data: Array<{ consultationId: string;
  patient: { id: string;
  fullName?: undefined;
  avatarUrl?: undefined;
  } | { id: string;
  fullName: undefined | string;
  avatarUrl: undefined | string;
  };
  mode: "on_demand" | "scheduled";
  scheduledStartAt: string;
  queueJoinedAt: string;
  queuePosition: number;
  estimatedWaitMinutes: null;
  etaReason: string;
  isCurrent: boolean;
  isLate: boolean;
  calledAt: undefined | string;
  }>;
  currentSession: null | { consultationId: string;
  patientId: string;
  sessionStatus: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  sessionStartedAt: undefined | string;
  };
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** POST /api/v1/doctors/me/queue/call-next — input (Params/Query/Headers/Body theo tên field). */
export interface DoctorQueueCallNextRequest {
  headers: { "Idempotency-Key": string;
  };
}

/** POST /api/v1/doctors/me/queue/call-next — response thành công theo return type thực tế. */
export interface DoctorQueueCallNextResponse {
  data: { id: string;
  patientId: string;
  doctorId: string;
  requestStatus: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  sessionStatus: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  scheduledStartAt: undefined | string;
  queueJoinedAt: undefined | string;
  queuePriorityAt: undefined | string;
  calledAt: undefined | string;
  updatedAt: string;
  };
  replayed: boolean;
}

// ==================== CHAT ====================

/** POST /api/v1/chat/consultation/messages — input (Params/Query/Headers/Body theo tên field). */
export interface ChatSendMessageRequest {
  consultationId: string;
  senderType: "patient" | "doctor";
  content: string;
  attachments?: Array<UploadBinary>;
}

/** POST /api/v1/chat/consultation/messages — response thành công theo return type thực tế. */
export interface ChatSendMessageResponse {
  statusCode: number;
  message: string;
  data: { consultationId: string;
  clientMessageId?: string;
  senderId: string;
  senderType: "patient" | "doctor";
  content: string;
  attachments?: Array<{ fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  }>;
  sentAt: string;
  };
}

/** GET /api/v1/chat/consultation/{consultationId} — input (Params/Query/Headers/Body theo tên field). */
export interface ChatGetConsultationMessagesRequest {
  params: { consultationId: string;
  };
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  cursor?: string;
  consultationId?: string;
  sortBy?: "sentAt" | "createdAt";
  };
}

/** GET /api/v1/chat/consultation/{consultationId} — response thành công theo return type thực tế. */
export interface ChatGetConsultationMessagesResponse {
  statusCode: number;
  message: string;
  data: Array<{ consultationId: string;
  clientMessageId?: string;
  senderId: string;
  senderType: "patient" | "doctor";
  content: string;
  attachments?: Array<{ fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  }>;
  sentAt: string;
  }>;
  nextCursor: null | string;
  hasNextPage: boolean;
  pagination: { limit: number;
  };
}

/** GET /api/v1/chat — input (Params/Query/Headers/Body theo tên field). */
export interface ChatFindAllRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  cursor?: string;
  consultationId?: string;
  sortBy?: "sentAt" | "createdAt";
  };
}

/** GET /api/v1/chat — response thành công theo return type thực tế. */
export interface ChatFindAllResponse {
  statusCode: number;
  message: string;
  data: Array<{ consultationId: string;
  clientMessageId?: string;
  senderId: string;
  senderType: "patient" | "doctor";
  content: string;
  attachments?: Array<{ fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  }>;
  sentAt: string;
  }>;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** GET /api/v1/chat/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ChatFindOneRequest {
  params: { id: string;
  };
}

/** GET /api/v1/chat/{id} — response thành công theo return type thực tế. */
export interface ChatFindOneResponse {
  statusCode: number;
  message: string;
  data: { consultationId: string;
  clientMessageId?: string;
  senderId: string;
  senderType: "patient" | "doctor";
  content: string;
  attachments?: Array<{ fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  }>;
  sentAt: string;
  };
}

/** PATCH /api/v1/chat/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ChatUpdateMessageRequest {
  params: { id: string;
  };
  body: { content?: string;
  };
}

/** PATCH /api/v1/chat/{id} — response thành công theo return type thực tế. */
export interface ChatUpdateMessageResponse {
  statusCode: number;
  message: string;
  data: { consultationId: string;
  clientMessageId?: string;
  senderId: string;
  senderType: "patient" | "doctor";
  content: string;
  attachments?: Array<{ fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  }>;
  sentAt: string;
  };
}

/** DELETE /api/v1/chat/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ChatRemoveMessageRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/chat/{id} — response thành công theo return type thực tế. */
export interface ChatRemoveMessageResponse {
  statusCode: number;
  message: string;
}

// ==================== REVIEWS ====================

/** GET /api/v1/reviews — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsFindAllRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  cursor?: string;
  consultationId?: string;
  patientId?: string;
  doctorId?: string;
  rating?: number;
  sortBy?: "createdAt" | "rating";
  };
}

/** GET /api/v1/reviews — response thành công theo return type thực tế. */
export interface ReviewsFindAllResponse {
  statusCode: number;
  message: string;
  data: Array<{ patientId: string;
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
  helpfulBy: Array<string>;
  helpfulCount: number;
  flagged: boolean;
  adminNotes?: string;
  }>;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** POST /api/v1/reviews — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsCreateRequest {
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
}

/** POST /api/v1/reviews — response thành công theo return type thực tế. */
export interface ReviewsCreateResponse {
  statusCode: number;
  message: string;
  data: { patientId: string;
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
  helpfulBy: Array<string>;
  helpfulCount: number;
  flagged: boolean;
  adminNotes?: string;
  };
}

/** GET /api/v1/reviews/doctor/{doctorId}/rating — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsGetDoctorRatingRequest {
  params: { doctorId: string;
  };
}

/** GET /api/v1/reviews/doctor/{doctorId}/rating — response thành công theo return type thực tế. */
export interface ReviewsGetDoctorRatingResponse {
  statusCode: number;
  message: string;
  data: { doctorId: string;
  averageRating: number;
  totalReviews: unknown;
  starDistribution: { fiveStar: unknown;
  fourStar: unknown;
  threeStar: unknown;
  twoStar: unknown;
  oneStar: unknown;
  };
  };
}

/** GET /api/v1/reviews/doctor/{doctorId} — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsFindByDoctorRequest {
  params: { doctorId: string;
  };
}

/** GET /api/v1/reviews/doctor/{doctorId} — response thành công theo return type thực tế. */
export interface ReviewsFindByDoctorResponse {
  statusCode: number;
  message: string;
  data: Array<{ patientId: string;
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
  helpfulBy: Array<string>;
  helpfulCount: number;
  flagged: boolean;
  adminNotes?: string;
  }>;
  nextCursor: null | string;
  hasNextPage: boolean;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** GET /api/v1/reviews/top/doctors — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsGetTopDoctorsRequest {
  query: { limit?: number;
  };
}

/** GET /api/v1/reviews/top/doctors — response thành công theo return type thực tế. */
export interface ReviewsGetTopDoctorsResponse {
  statusCode: number;
  message: string;
  data: Array<{ doctorId: string;
  doctorName: string;
  specialty: undefined | string;
  avatarUrl: string;
  averageRating: number;
  totalReviews: number;
  }>;
}

/** GET /api/v1/reviews/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsFindOneRequest {
  params: { id: string;
  };
}

/** GET /api/v1/reviews/{id} — response thành công theo return type thực tế. */
export interface ReviewsFindOneResponse {
  statusCode: number;
  message: string;
  data: { patientId: string;
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
  helpfulBy: Array<string>;
  helpfulCount: number;
  flagged: boolean;
  adminNotes?: string;
  };
}

/** PATCH /api/v1/reviews/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsUpdateRequest {
  params: { id: string;
  };
  body: { rating?: number;
  comment?: string;
  };
}

/** PATCH /api/v1/reviews/{id} — response thành công theo return type thực tế. */
export interface ReviewsUpdateResponse {
  statusCode: number;
  message: string;
  data: { patientId: string;
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
  helpfulBy: Array<string>;
  helpfulCount: number;
  flagged: boolean;
  adminNotes?: string;
  };
}

/** DELETE /api/v1/reviews/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsRemoveRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/reviews/{id} — response thành công theo return type thực tế. */
export interface ReviewsRemoveResponse {
  statusCode: number;
  message: string;
}

/** GET /api/v1/reviews/consultation/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsFindByConsultationIdRequest {
  params: { id: string;
  };
}

/** GET /api/v1/reviews/consultation/{id} — response thành công theo return type thực tế. */
export interface ReviewsFindByConsultationIdResponse {
  statusCode: number;
  message: string;
  data: { patientId: string;
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
  helpfulBy: Array<string>;
  helpfulCount: number;
  flagged: boolean;
  adminNotes?: string;
  };
}

/** POST /api/v1/reviews/{id}/helpful — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsMarkHelpfulRequest {
  params: { id: string;
  };
}

/** POST /api/v1/reviews/{id}/helpful — response thành công theo return type thực tế. */
export interface ReviewsMarkHelpfulResponse {
  statusCode: number;
  message: string;
  data: { patientId: string;
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
  helpfulBy: Array<string>;
  helpfulCount: number;
  flagged: boolean;
  adminNotes?: string;
  };
}

/** DELETE /api/v1/reviews/{id}/helpful — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsUnmarkHelpfulRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/reviews/{id}/helpful — response thành công theo return type thực tế. */
export interface ReviewsUnmarkHelpfulResponse {
  statusCode: number;
  message: string;
  data: { patientId: string;
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
  helpfulBy: Array<string>;
  helpfulCount: number;
  flagged: boolean;
  adminNotes?: string;
  };
}

/** POST /api/v1/reviews/{id}/flag — input (Params/Query/Headers/Body theo tên field). */
export interface ReviewsFlagReviewRequest {
  params: { id: string;
  };
}

/** POST /api/v1/reviews/{id}/flag — response thành công theo return type thực tế. */
export interface ReviewsFlagReviewResponse {
  statusCode: number;
  message: string;
  data: { patientId: string;
  doctorId: string;
  consultationId: string;
  rating: number;
  comment: string;
  helpfulBy: Array<string>;
  helpfulCount: number;
  flagged: boolean;
  adminNotes?: string;
  };
}

// ==================== BILLING-PLANS ====================

/** GET /api/v1/billing/plans — input (Params/Query/Headers/Body theo tên field). */
export interface PlansListRequest {

}

/** GET /api/v1/billing/plans — response thành công theo return type thực tế. */
export type PlansListResponse = Array<{ code: string; version: number; name: string; description?: string; price: number; currency: string; durationDays: number; aiRequestLimit: number; aiTokenLimit: number; aiQuotaPeriod: "day" | "subscription_cycle"; consultationLimitPerCycle: number; activeCareProgramLimit: number; benefits: Record<string, unknown>; refundPolicy: Record<string, unknown>; status: "draft" | "published" | "retired"; effectiveFrom?: string; effectiveUntil?: string; createdBy: string; publishedBy?: string; publishedAt?: string; retiredBy?: string; retiredAt?: string; }>;

/** POST /api/v1/billing/plans/drafts — input (Params/Query/Headers/Body theo tên field). */
export interface PlansCreateRequest {

}

/** POST /api/v1/billing/plans/drafts — response thành công theo return type thực tế. */
export interface PlansCreateResponse {
  code: string;
  version: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationDays: number;
  aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: "day" | "subscription_cycle";
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  benefits: Record<string, unknown>;
  refundPolicy: Record<string, unknown>;
  status: "draft" | "published" | "retired";
  effectiveFrom?: string;
  effectiveUntil?: string;
  createdBy: string;
  publishedBy?: string;
  publishedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
}

/** POST /api/v1/billing/plans/deploy-defaults — input (Params/Query/Headers/Body theo tên field). */
export interface PlansDeployDefaultsRequest {

}

/** POST /api/v1/billing/plans/deploy-defaults — response thành công theo return type thực tế. */
export type PlansDeployDefaultsResponse = Array<{ code: string; version: number; name: string; description?: string; price: number; currency: string; durationDays: number; aiRequestLimit: number; aiTokenLimit: number; aiQuotaPeriod: "day" | "subscription_cycle"; consultationLimitPerCycle: number; activeCareProgramLimit: number; benefits: Record<string, unknown>; refundPolicy: Record<string, unknown>; status: "draft" | "published" | "retired"; effectiveFrom?: string; effectiveUntil?: string; createdBy: string; publishedBy?: string; publishedAt?: string; retiredBy?: string; retiredAt?: string; }>;

/** POST /api/v1/billing/plans/{id}/publish — input (Params/Query/Headers/Body theo tên field). */
export interface PlansPublishRequest {
  params: { id: string;
  };
}

/** POST /api/v1/billing/plans/{id}/publish — response thành công theo return type thực tế. */
export interface PlansPublishResponse {
  code: string;
  version: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationDays: number;
  aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: "day" | "subscription_cycle";
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  benefits: Record<string, unknown>;
  refundPolicy: Record<string, unknown>;
  status: "draft" | "published" | "retired";
  effectiveFrom?: string;
  effectiveUntil?: string;
  createdBy: string;
  publishedBy?: string;
  publishedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
}

/** POST /api/v1/billing/plans/{id}/retire — input (Params/Query/Headers/Body theo tên field). */
export interface PlansRetireRequest {
  params: { id: string;
  };
}

/** POST /api/v1/billing/plans/{id}/retire — response thành công theo return type thực tế. */
export interface PlansRetireResponse {
  code: string;
  version: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationDays: number;
  aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: "day" | "subscription_cycle";
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  benefits: Record<string, unknown>;
  refundPolicy: Record<string, unknown>;
  status: "draft" | "published" | "retired";
  effectiveFrom?: string;
  effectiveUntil?: string;
  createdBy: string;
  publishedBy?: string;
  publishedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
}

// ==================== BILLING-PAYMENTS ====================

/** GET /api/v1/billing/payments/orders — input (Params/Query/Headers/Body theo tên field). */
export interface PaymentsListRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  status?: "created" | "pending" | "processing" | "paid" | "expired" | "cancelled" | "failed" | "refund_pending" | "refunded";
  sortBy?: "createdAt";
  };
}

/** GET /api/v1/billing/payments/orders — response thành công theo return type thực tế. */
export interface PaymentsListResponse {
  items: Array<{ cancelledAt?: string;
  paidAt?: string;
  id: string;
  orderCode: string;
  status: "created" | "pending" | "processing" | "paid" | "expired" | "cancelled" | "failed" | "refund_pending" | "refunded";
  amount: number;
  currency: string;
  plan: { code: string;
  name: string;
  version: number;
  };
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  }>;
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

/** POST /api/v1/billing/payments/orders — input (Params/Query/Headers/Body theo tên field). */
export interface PaymentsCreateRequest {
  headers: { "idempotency-key": string;
  };
  body: {  };
}

/** POST /api/v1/billing/payments/orders — response thành công theo return type thực tế. */
export type PaymentsCreateResponse = { order: { userId: string; planId: string; orderCode: string; idempotencyKey: string; orderSnapshot: { code: string; version: number; name: string; durationDays: number; aiRequestLimit: number; aiTokenLimit: number; aiQuotaPeriod: "day" | "subscription_cycle"; consultationLimitPerCycle: number; activeCareProgramLimit: number; benefits: Record<string, unknown>; price: number; currency: string; }; amount: number; currency: string; status: "created" | "pending" | "processing" | "paid" | "expired" | "cancelled" | "failed" | "refund_pending" | "refunded"; expiresAt: string; paidAt?: string; cancelledAt?: string; cancelledBy?: string; cancellationReason?: string; }; paymentUrl: null; paymentQrDataUrl: null; } | { order: null | { userId: string; planId: string; orderCode: string; idempotencyKey: string; orderSnapshot: { code: string; version: number; name: string; durationDays: number; aiRequestLimit: number; aiTokenLimit: number; aiQuotaPeriod: "day" | "subscription_cycle"; consultationLimitPerCycle: number; activeCareProgramLimit: number; benefits: Record<string, unknown>; price: number; currency: string; }; amount: number; currency: string; status: "created" | "pending" | "processing" | "paid" | "expired" | "cancelled" | "failed" | "refund_pending" | "refunded"; expiresAt: string; paidAt?: string; cancelledAt?: string; cancelledBy?: string; cancellationReason?: string; }; paymentUrl: null; paymentQrDataUrl: null; } | { order: null | { userId: string; planId: string; orderCode: string; idempotencyKey: string; orderSnapshot: { code: string; version: number; name: string; durationDays: number; aiRequestLimit: number; aiTokenLimit: number; aiQuotaPeriod: "day" | "subscription_cycle"; consultationLimitPerCycle: number; activeCareProgramLimit: number; benefits: Record<string, unknown>; price: number; currency: string; }; amount: number; currency: string; status: "created" | "pending" | "processing" | "paid" | "expired" | "cancelled" | "failed" | "refund_pending" | "refunded"; expiresAt: string; paidAt?: string; cancelledAt?: string; cancelledBy?: string; cancellationReason?: string; }; paymentUrl: string; paymentQrDataUrl: string; };

/** POST /api/v1/billing/payments/orders/{id}/cancel — input (Params/Query/Headers/Body theo tên field). */
export interface PaymentsCancelRequest {
  params: { id: string;
  };
}

/** POST /api/v1/billing/payments/orders/{id}/cancel — response thành công theo return type thực tế. */
export interface PaymentsCancelResponse {
  userId: string;
  planId: string;
  orderCode: string;
  idempotencyKey: string;
  orderSnapshot: { code: string;
  version: number;
  name: string;
  durationDays: number;
  aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: "day" | "subscription_cycle";
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  benefits: Record<string, unknown>;
  price: number;
  currency: string;
  };
  amount: number;
  currency: string;
  status: "created" | "pending" | "processing" | "paid" | "expired" | "cancelled" | "failed" | "refund_pending" | "refunded";
  expiresAt: string;
  paidAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
}

/** GET /api/v1/billing/payments/orders/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface PaymentsGetRequest {
  params: { id: string;
  };
}

/** GET /api/v1/billing/payments/orders/{id} — response thành công theo return type thực tế. */
export interface PaymentsGetResponse {
  userId: string;
  planId: string;
  orderCode: string;
  idempotencyKey: string;
  orderSnapshot: { code: string;
  version: number;
  name: string;
  durationDays: number;
  aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: "day" | "subscription_cycle";
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  benefits: Record<string, unknown>;
  price: number;
  currency: string;
  };
  amount: number;
  currency: string;
  status: "created" | "pending" | "processing" | "paid" | "expired" | "cancelled" | "failed" | "refund_pending" | "refunded";
  expiresAt: string;
  paidAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
}

/** GET /api/v1/billing/payments/orders/{id}/evidence — input (Params/Query/Headers/Body theo tên field). */
export interface PaymentsGetEvidenceRequest {
  params: { id: string;
  };
}

/** GET /api/v1/billing/payments/orders/{id}/evidence — response thành công theo return type thực tế. */
export interface PaymentsGetEvidenceResponse {
  order: { id: string;
  status: "created" | "pending" | "processing" | "paid" | "expired" | "cancelled" | "failed" | "refund_pending" | "refunded";
  amount: number;
  currency: string;
  paidAt: null | string;
  };
  transaction: null | { status: "pending" | "succeeded" | "failed";
  responseCode: null | string;
  bankCode: null | string;
  providerTransactionNo: null | string;
  ipnReceivedAt: null | string;
  signatureVerifiedAt: null | string;
  };
  outbox: null | { status: "pending" | "processing" | "delivered" | "dead";
  attemptCount: number;
  maxAttempts: number;
  deliveredAt: null | string;
  hasLastError: boolean;
  };
  subscriptionGrant: null | { status: "active" | "expired" | "cancelled";
  source: "payment" | "free_grant" | "admin_demo";
  grantMode: string;
  startedAt: string;
  expiresAt: string;
  nextPlanStartsAt: null | string;
  };
}

/** GET /api/v1/billing/payments/vnpay/return — input (Params/Query/Headers/Body theo tên field). */
export interface PaymentsReturnFromVnpayRequest {

}

/** GET /api/v1/billing/payments/vnpay/return — response thành công theo return type thực tế. */
export interface PaymentsReturnFromVnpayResponse {
  status: string;
  message: string;
}

/** GET /api/v1/billing/payments/vnpay/ipn — input (Params/Query/Headers/Body theo tên field). */
export interface PaymentsIpnRequest {

}

/** GET /api/v1/billing/payments/vnpay/ipn — response thành công theo return type thực tế. */
export interface PaymentsIpnResponse {
  RspCode: string;
  Message: string;
}

// ==================== PATIENT-BILLING ====================

/** GET /api/v1/plans — input (Params/Query/Headers/Body theo tên field). */
export interface PatientBillingReadListPlansRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  sortBy?: "code" | "name" | "price" | "version" | "effectiveFrom";
  };
}

/** GET /api/v1/plans — response thành công theo return type thực tế. */
export interface PatientBillingReadListPlansResponse {
  items: Array<{ effectiveUntil?: string;
  effectiveFrom?: string;
  price: number;
  currency: string;
  durationDays: number;
  quota: { aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: unknown;
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  };
  benefits: Record<string, unknown>;
  available: boolean;
  purchasable: boolean;
  description?: string;
  id: string;
  code: string;
  version: number;
  name: string;
  }>;
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

/** GET /api/v1/plans/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface PatientBillingReadGetPlanRequest {
  params: { id: string;
  };
}

/** GET /api/v1/plans/{id} — response thành công theo return type thực tế. */
export interface PatientBillingReadGetPlanResponse {
  effectiveUntil?: string;
  effectiveFrom?: string;
  price: number;
  currency: string;
  durationDays: number;
  quota: { aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: unknown;
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  };
  benefits: Record<string, unknown>;
  available: boolean;
  purchasable: boolean;
  description?: string;
  id: string;
  code: string;
  version: number;
  name: string;
}

/** GET /api/v1/subscriptions/me — input (Params/Query/Headers/Body theo tên field). */
export interface PatientBillingReadSubscriptionsRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  status?: "active" | "expired" | "cancelled";
  sortBy?: "startedAt" | "currentPeriodStart" | "currentPeriodEnd" | "expiresAt";
  };
}

/** GET /api/v1/subscriptions/me — response thành công theo return type thực tế. */
export interface PatientBillingReadSubscriptionsResponse {
  items: Array<{ updatedAt: string;
  renewal?: { id: string;
  code: string;
  version: number;
  name: string;
  effectiveAt: string;
  };
  subscriptionId: string;
  status: unknown;
  plan: { id: string;
  code: string;
  version: number;
  name: string;
  };
  cycle: { number: number;
  startedAt: string;
  endsAt: string;
  };
  entitlement: { aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: "day" | "subscription_cycle";
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  benefits: Record<string, unknown>;
  };
  startedAt: string;
  expiresAt: string;
  }>;
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  effective: null | { updatedAt: string;
  renewal?: { id: string;
  code: string;
  version: number;
  name: string;
  effectiveAt: string;
  };
  subscriptionId: string;
  status: unknown;
  plan: { id: string;
  code: string;
  version: number;
  name: string;
  };
  cycle: { number: number;
  startedAt: string;
  endsAt: string;
  };
  entitlement: { aiRequestLimit: number;
  aiTokenLimit: number;
  aiQuotaPeriod: "day" | "subscription_cycle";
  consultationLimitPerCycle: number;
  activeCareProgramLimit: number;
  benefits: Record<string, unknown>;
  };
  startedAt: string;
  expiresAt: string;
  };
}

/** GET /api/v1/subscriptions/me/usage — input (Params/Query/Headers/Body theo tên field). */
export interface PatientBillingReadUsageRequest {

}

/** GET /api/v1/subscriptions/me/usage — response thành công theo return type thực tế. */
export interface PatientBillingReadUsageResponse {
  subscriptionId: string;
  cycle: { number: number;
  startedAt: string;
  endsAt: string;
  };
  consultations: { limit: number;
  counted: number;
  reserved: number;
  available: number;
  unlimited: boolean;
  };
  asOf: string;
}

// ==================== ADMIN ====================

/** GET /api/v1/admin/doctors/applications — input (Params/Query/Headers/Body theo tên field). */
export interface AdminGetDoctorApplicationRequest {
  query: { page?: number;
  limit?: number;
  };
}

/** GET /api/v1/admin/doctors/applications — response thành công theo return type thực tế. */
export interface AdminGetDoctorApplicationResponse {
  data: Array<{ userId: { fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
  };
  specialty?: string;
  workplace?: string;
  verificationDocuments?: Array<string>;
  experienceYears?: number;
  averageRating?: number;
  ratingSum?: number;
  reviewCount?: number;
  verifiedAt?: string;
  rejectReason?: string;
  verificationStatus?: "pending" | "approved" | "rejected";
  }>;
  pagination: { total: number;
  page: number;
  limit: number;
  pages: number;
  };
  summary: { total: number;
  pending: number;
  approved: number;
  rejected: number;
  };
}

/** POST /api/v1/admin/doctors/{id}/verify — input (Params/Query/Headers/Body theo tên field). */
export interface AdminVerifyDoctorRequest {
  params: { id: string;
  };
  body: { verificationNotes?: string;
  };
}

/** POST /api/v1/admin/doctors/{id}/verify — response thành công theo return type thực tế. */
export type AdminVerifyDoctorResponse = { userId: { fullName: string; email?: string; passwordHash?: string; gender: string; dateOfBirth: string; role: "patient" | "doctor" | "admin"; phoneNumber: string; avatarUrl: string; avatarPublicId: string; accountStatus: "active" | "banned"; isOnline: boolean; address: { street: string; ward: string; district: string; city: string; country: string; }; banReason: string; doctorProfile?: { specialty: string; workplace: string; verificationDocuments: Array<string>; experienceYears: number; averageRating: number; ratingSum: number; reviewCount: number; verifiedAt: string; rejectReason: string; verificationStatus: "pending" | "approved" | "rejected"; }; adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager"; }; }; } | { userId: { fullName: string; email?: string; passwordHash?: string; gender: string; dateOfBirth: string; role: "patient" | "doctor" | "admin"; phoneNumber: string; avatarUrl: string; avatarPublicId: string; accountStatus: "active" | "banned"; isOnline: boolean; address: { street: string; ward: string; district: string; city: string; country: string; }; banReason: string; doctorProfile?: { specialty: string; workplace: string; verificationDocuments: Array<string>; experienceYears: number; averageRating: number; ratingSum: number; reviewCount: number; verifiedAt: string; rejectReason: string; verificationStatus: "pending" | "approved" | "rejected"; }; adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager"; }; }; specialty: string; workplace: string; verificationDocuments: Array<string>; experienceYears: number; averageRating: number; ratingSum: number; reviewCount: number; verifiedAt: string; rejectReason: string; verificationStatus: "pending" | "approved" | "rejected"; };

/** POST /api/v1/admin/doctors/{id}/reject — input (Params/Query/Headers/Body theo tên field). */
export interface AdminRejectDoctorRequest {
  params: { id: string;
  };
  body: {  };
}

/** POST /api/v1/admin/doctors/{id}/reject — response thành công theo return type thực tế. */
export type AdminRejectDoctorResponse = { userId: { fullName: string; email?: string; passwordHash?: string; gender: string; dateOfBirth: string; role: "patient" | "doctor" | "admin"; phoneNumber: string; avatarUrl: string; avatarPublicId: string; accountStatus: "active" | "banned"; isOnline: boolean; address: { street: string; ward: string; district: string; city: string; country: string; }; banReason: string; doctorProfile?: { specialty: string; workplace: string; verificationDocuments: Array<string>; experienceYears: number; averageRating: number; ratingSum: number; reviewCount: number; verifiedAt: string; rejectReason: string; verificationStatus: "pending" | "approved" | "rejected"; }; adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager"; }; }; } | { userId: { fullName: string; email?: string; passwordHash?: string; gender: string; dateOfBirth: string; role: "patient" | "doctor" | "admin"; phoneNumber: string; avatarUrl: string; avatarPublicId: string; accountStatus: "active" | "banned"; isOnline: boolean; address: { street: string; ward: string; district: string; city: string; country: string; }; banReason: string; doctorProfile?: { specialty: string; workplace: string; verificationDocuments: Array<string>; experienceYears: number; averageRating: number; ratingSum: number; reviewCount: number; verifiedAt: string; rejectReason: string; verificationStatus: "pending" | "approved" | "rejected"; }; adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager"; }; }; specialty: string; workplace: string; verificationDocuments: Array<string>; experienceYears: number; averageRating: number; ratingSum: number; reviewCount: number; verifiedAt: string; rejectReason: string; verificationStatus: "pending" | "approved" | "rejected"; };

/** POST /api/v1/admin/users/{id}/lock — input (Params/Query/Headers/Body theo tên field). */
export interface AdminLockAccountRequest {
  params: { id: string;
  };
  body: {  };
}

/** POST /api/v1/admin/users/{id}/lock — response thành công theo return type thực tế. */
export interface AdminLockAccountResponse {
  fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
}

/** POST /api/v1/admin/users/{id}/unlock — input (Params/Query/Headers/Body theo tên field). */
export interface AdminUnlockAccountRequest {
  params: { id: string;
  };
}

/** POST /api/v1/admin/users/{id}/unlock — response thành công theo return type thực tế. */
export interface AdminUnlockAccountResponse {
  fullName: string;
  email?: string;
  passwordHash?: string;
  gender: string;
  dateOfBirth: string;
  role: "patient" | "doctor" | "admin";
  phoneNumber: string;
  avatarUrl: string;
  avatarPublicId: string;
  accountStatus: "active" | "banned";
  isOnline: boolean;
  address: { street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  };
  banReason: string;
  doctorProfile?: { specialty: string;
  workplace: string;
  verificationDocuments: Array<string>;
  experienceYears: number;
  averageRating: number;
  ratingSum: number;
  reviewCount: number;
  verifiedAt: string;
  rejectReason: string;
  verificationStatus: "pending" | "approved" | "rejected";
  };
  adminProfile?: { adminRole: "super_admin" | "user_manager" | "ai_manager";
  };
}

/** GET /api/v1/admin/consultations — input (Params/Query/Headers/Body theo tên field). */
export interface AdminGetAllConsultationsRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  mode?: "on_demand" | "scheduled";
  requestStatus?: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  sessionStatus?: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  doctorId?: string;
  patientId?: string;
  from?: string;
  to?: string;
  sortBy?: "requestedAt" | "scheduledStartAt" | "createdAt" | "updatedAt";
  };
}

/** GET /api/v1/admin/consultations — response thành công theo return type thực tế. */
export interface AdminGetAllConsultationsResponse {
  data: Array<{ patientId: string;
  doctorId: string;
  patientCareProgramId?: string;
  careAlertId?: string;
  careTaskId?: string;
  availabilitySlotId?: string;
  mode: "on_demand" | "scheduled";
  requestStatus: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  sessionStatus: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  requestedAt: string;
  respondedAt?: string;
  requestExpiresAt?: string;
  onDemandTimeoutWarningQueuedAt?: string;
  onDemandTimeoutExtensionExpiresAt?: string;
  scheduledStaleReviewQueuedAt?: string;
  declinedReason?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  timezone?: string;
  expectedDurationMinutes: number;
  estimatedWaitMinutes?: number;
  overtimeStartedAt?: string;
  bookingSettingsSnapshot?: Record<string, unknown>;
  scheduledBookingKey?: string;
  scheduledBookingRequestHash?: string;
  lastRescheduleKey?: string;
  lastRescheduleRequestHash?: string;
  quotaPolicy?: "consultation_limit" | "care_program_included";
  legacyQuotaExempt?: false | true;
  patientNotes?: string;
  doctorNotes?: string;
  followUp?: Record<string, unknown>;
  queueJoinedAt?: string;
  queuePriorityAt?: string;
  calledAt?: string;
  checkInKey?: string;
  checkInRequestHash?: string;
  lastCallNextKey?: string;
  lastCallNextRequestHash?: string;
  sessionStartedAt?: string;
  interruptedAt?: string;
  interruptionReason?: string;
  resumedAt?: string;
  completedAt?: string;
  followUpAt?: string;
  completedBy?: string;
  noShowAt?: string;
  noShowReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  roomId?: string;
  callStartedAt?: string;
  callEndedAt?: string;
  callEndReason?: string;
  consultationConsent?: Record<string, unknown>;
  aiConsultationBrief?: Record<string, unknown>;
  }>;
  pagination: { total: number;
  page: number;
  limit: number;
  pages: number;
  };
}

/** GET /api/v1/admin/consultations/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface AdminGetConsultationByIdRequest {
  params: { id: string;
  };
}

/** GET /api/v1/admin/consultations/{id} — response thành công theo return type thực tế. */
export interface AdminGetConsultationByIdResponse {
  patientId: string;
  doctorId: string;
  patientCareProgramId?: string;
  careAlertId?: string;
  careTaskId?: string;
  availabilitySlotId?: string;
  mode: "on_demand" | "scheduled";
  requestStatus: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  sessionStatus: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  requestedAt: string;
  respondedAt?: string;
  requestExpiresAt?: string;
  onDemandTimeoutWarningQueuedAt?: string;
  onDemandTimeoutExtensionExpiresAt?: string;
  scheduledStaleReviewQueuedAt?: string;
  declinedReason?: string;
  scheduledStartAt?: string;
  scheduledEndAt?: string;
  timezone?: string;
  expectedDurationMinutes: number;
  estimatedWaitMinutes?: number;
  overtimeStartedAt?: string;
  bookingSettingsSnapshot?: Record<string, unknown>;
  scheduledBookingKey?: string;
  scheduledBookingRequestHash?: string;
  lastRescheduleKey?: string;
  lastRescheduleRequestHash?: string;
  quotaPolicy?: "consultation_limit" | "care_program_included";
  legacyQuotaExempt?: false | true;
  patientNotes?: string;
  doctorNotes?: string;
  followUp?: Record<string, unknown>;
  queueJoinedAt?: string;
  queuePriorityAt?: string;
  calledAt?: string;
  checkInKey?: string;
  checkInRequestHash?: string;
  lastCallNextKey?: string;
  lastCallNextRequestHash?: string;
  sessionStartedAt?: string;
  interruptedAt?: string;
  interruptionReason?: string;
  resumedAt?: string;
  completedAt?: string;
  followUpAt?: string;
  completedBy?: string;
  noShowAt?: string;
  noShowReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  lastMessageAt?: string;
  lastMessageId?: string;
  roomId?: string;
  callStartedAt?: string;
  callEndedAt?: string;
  callEndReason?: string;
  consultationConsent?: Record<string, unknown>;
  aiConsultationBrief?: Record<string, unknown>;
}

/** GET /api/v1/admin/dashboard/stats — input (Params/Query/Headers/Body theo tên field). */
export interface AdminGetDashboardStatsRequest {

}

/** GET /api/v1/admin/dashboard/stats — response thành công theo return type thực tế. */
export interface AdminGetDashboardStatsResponse {
  users: { total: number;
  doctors: number;
  pendingDoctors: number;
  };
  consultations: { total: number;
  };
  security: { bannedAccounts: number;
  };
}

// ==================== USERS ====================

/** GET /api/v1/users/{id}/profile — input (Params/Query/Headers/Body theo tên field). */
export interface UsersFindProfileRequest {
  params: { id: string;
  };
}

/** GET /api/v1/users/{id}/profile — response thành công theo return type thực tế. */
export interface UsersFindProfileResponse {
  id: string;
  full_name: string;
  email?: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  account_status: "active" | "banned";
  created_at: string;
  address_display: string;
  role: "doctor" | "patient" | "admin";
  avatar_url?: string;
  reports?: Array<{ id: string;
  reason: string;
  date: string;
  resolved: boolean;
  }>;
  doctor_reviews?: Array<{ id: string;
  reviewer_name: string;
  reviewer_avatar_initials?: string;
  rating: number;
  comment: string;
  created_at: string;
  }>;
  doctor_review_metrics?: { average_rating: number;
  total_reviews: number;
  rating_distribution: Record<string, unknown>;
  };
  role_specific?: { specialty?: string;
  workplace?: string;
  experience_years?: number;
  verified_at?: string;
  verification_status?: "pending" | "approved" | "rejected";
  reject_reason?: string;
  admin_role?: "super_admin" | "user_manager" | "ai_manager";
  };
}

// ==================== AI-ASSISTANT ====================

/** POST /api/v1/ai-assistant/conversations/start — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantStartConversationRequest {
  type?: "health_inquiry" | "symptom_analysis" | "health_education" | "test_result_explanation" | "medication_info" | "general_consultation";
  initialQuestion: string;
  tags?: Array<string>;
}

/** POST /api/v1/ai-assistant/conversations/start — response thành công theo return type thực tế. */
export interface AiAssistantStartConversationResponse {
  statusCode: number;
  message: string;
  data: { userId: string;
  type: "health_inquiry" | "symptom_analysis" | "health_education" | "test_result_explanation" | "medication_info" | "general_consultation";
  topic: string;
  summary?: string;
  followUpAction?: { type: "schedule_appointment" | "consult_doctor" | "visit_clinic" | "none";
  description: string;
  priority: "low" | "medium" | "high";
  };
  totalTokensUsed: number;
  messageCount: number;
  lastMessageAt: string;
  archivedAt?: string;
  isFavorite: boolean;
  rating?: number;
  ratingComment?: string;
  tags: Array<string>;
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  };
}

/** POST /api/v1/ai-assistant/conversations/{conversationId}/message — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantSendMessageRequest {
  params: { conversationId: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { message?: string;
  conversationType?: "health_inquiry" | "symptom_analysis" | "health_education" | "test_result_explanation" | "medication_info" | "general_consultation";
  images?: Array<UploadBinary>;
  };
  images?: UploadBinary[];
}

/** POST /api/v1/ai-assistant/conversations/{conversationId}/message — response thành công theo return type thực tế. */
export interface AiAssistantSendMessageResponse {
  statusCode: number;
  message: string;
  data: { conversationId: string;
  topic: string;
  userMessage: string;
  attachments: Array<{ publicId: string;
  secureUrl: string;
  }>;
  finalAiResponse: string;
  messageCount: number;
  groundedByRag: boolean;
  citations: Array<{ source: string;
  chunkId: string;
  documentId: string;
  score: number;
  excerpt: string;
  }>;
  confidence: number;
  };
}

/** GET /api/v1/ai-assistant/conversations — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantGetConversationsRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  cursor?: string;
  type?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  sortBy?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  tags?: Array<string>;
  };
}

/** GET /api/v1/ai-assistant/conversations — response thành công theo return type thực tế. */
export interface AiAssistantGetConversationsResponse {
  statusCode: number;
  message: string;
  data: Array<{ userId: string;
  type: "health_inquiry" | "symptom_analysis" | "health_education" | "test_result_explanation" | "medication_info" | "general_consultation";
  topic: string;
  summary?: string;
  followUpAction?: { type: "schedule_appointment" | "consult_doctor" | "visit_clinic" | "none";
  description: string;
  priority: "low" | "medium" | "high";
  };
  totalTokensUsed: number;
  messageCount: number;
  lastMessageAt: string;
  archivedAt?: string;
  isFavorite: boolean;
  rating?: number;
  ratingComment?: string;
  tags: Array<string>;
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  }>;
  nextCursor: null | string;
  hasNextPage: boolean;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** GET /api/v1/ai-assistant/conversations/{conversationId} — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantGetConversationRequest {
  params: { conversationId: string;
  };
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  cursor?: string;
  sortBy?: "timestamp";
  };
}

/** GET /api/v1/ai-assistant/conversations/{conversationId} — response thành công theo return type thực tế. */
export interface AiAssistantGetConversationResponse {
  statusCode: number;
  message: string;
  data: { userId: string;
  type: "health_inquiry" | "symptom_analysis" | "health_education" | "test_result_explanation" | "medication_info" | "general_consultation";
  topic: string;
  summary?: string;
  followUpAction?: { type: "schedule_appointment" | "consult_doctor" | "visit_clinic" | "none";
  description: string;
  priority: "low" | "medium" | "high";
  };
  totalTokensUsed: number;
  messageCount: number;
  lastMessageAt: string;
  archivedAt?: string;
  isFavorite: boolean;
  rating?: number;
  ratingComment?: string;
  tags: Array<string>;
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  };
  messages: Array<{ conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  attachments?: Array<{ publicId: string;
  secureUrl: string;
  fileType: "image";
  mimeType: string;
  originalName: string;
  size: number;
  description?: string;
  }>;
  sentiment?: "positive" | "neutral" | "negative" | "urgent";
  tokens?: number;
  }>;
  nextCursor: null | string;
  hasNextPage: boolean;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** PATCH /api/v1/ai-assistant/conversations/{conversationId} — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantUpdateConversationRequest {
  params: { conversationId: string;
  };
  body: { topic?: string;
  internalNotes?: string;
  tags?: Array<string>;
  };
}

/** PATCH /api/v1/ai-assistant/conversations/{conversationId} — response thành công theo return type thực tế. */
export interface AiAssistantUpdateConversationResponse {
  statusCode: number;
  message: string;
  data: { userId: string;
  type: "health_inquiry" | "symptom_analysis" | "health_education" | "test_result_explanation" | "medication_info" | "general_consultation";
  topic: string;
  summary?: string;
  followUpAction?: { type: "schedule_appointment" | "consult_doctor" | "visit_clinic" | "none";
  description: string;
  priority: "low" | "medium" | "high";
  };
  totalTokensUsed: number;
  messageCount: number;
  lastMessageAt: string;
  archivedAt?: string;
  isFavorite: boolean;
  rating?: number;
  ratingComment?: string;
  tags: Array<string>;
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  };
}

/** DELETE /api/v1/ai-assistant/conversations/{conversationId} — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantDeleteConversationRequest {
  params: { conversationId: string;
  };
}

/** DELETE /api/v1/ai-assistant/conversations/{conversationId} — response thành công theo return type thực tế. */
export interface AiAssistantDeleteConversationResponse {
  statusCode: number;
  message: string;
}

/** POST /api/v1/ai-assistant/conversations/{conversationId}/favorite — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantToggleFavoriteRequest {
  params: { conversationId: string;
  };
}

/** POST /api/v1/ai-assistant/conversations/{conversationId}/favorite — response thành công theo return type thực tế. */
export interface AiAssistantToggleFavoriteResponse {
  statusCode: number;
  message: string;
  data: { isFavorite: boolean;
  };
}

/** POST /api/v1/ai-assistant/conversations/{conversationId}/archive — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantArchiveConversationRequest {
  params: { conversationId: string;
  };
  body: { isArchived: boolean;
  };
}

/** POST /api/v1/ai-assistant/conversations/{conversationId}/archive — response thành công theo return type thực tế. */
export interface AiAssistantArchiveConversationResponse {
  statusCode: number;
  message: string;
  data: { archivedAt: null | string;
  };
}

/** POST /api/v1/ai-assistant/conversations/{conversationId}/rate — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantRateConversationRequest {
  params: { conversationId: string;
  };
  body: { rating: number;
  comment?: string;
  };
}

/** POST /api/v1/ai-assistant/conversations/{conversationId}/rate — response thành công theo return type thực tế. */
export interface AiAssistantRateConversationResponse {
  statusCode: number;
  message: string;
  data: { rating: number;
  comment: undefined | string;
  };
}

/** GET /api/v1/ai-assistant/conversations/{conversationId}/stats — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantGetConversationStatsRequest {
  params: { conversationId: string;
  };
}

/** GET /api/v1/ai-assistant/conversations/{conversationId}/stats — response thành công theo return type thực tế. */
export interface AiAssistantGetConversationStatsResponse {
  statusCode: number;
  message: string;
  data: { totalMessages: unknown;
  userMessages: unknown;
  assistantMessages: unknown;
  totalTokensUsed: number;
  averageMessageLength: unknown;
  conversationType: "health_inquiry" | "symptom_analysis" | "health_education" | "test_result_explanation" | "medication_info" | "general_consultation";
  rating: undefined | number;
  createdAt: undefined | string;
  updatedAt: undefined | string;
  };
}

/** GET /api/v1/ai-assistant/summary — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantGetUserConversationSummaryRequest {

}

/** GET /api/v1/ai-assistant/summary — response thành công theo return type thực tế. */
export interface AiAssistantGetUserConversationSummaryResponse {
  statusCode: number;
  message: string;
  data: unknown;
}

/** GET /api/v1/ai-assistant/search — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantSearchConversationsRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  cursor?: string;
  type?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  sortBy?: string;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  tags?: Array<string>;
  q: string;
  };
}

/** GET /api/v1/ai-assistant/search — response thành công theo return type thực tế. */
export interface AiAssistantSearchConversationsResponse {
  statusCode: number;
  message: string;
  data: Array<{ userId: string;
  type: "health_inquiry" | "symptom_analysis" | "health_education" | "test_result_explanation" | "medication_info" | "general_consultation";
  topic: string;
  summary?: string;
  followUpAction?: { type: "schedule_appointment" | "consult_doctor" | "visit_clinic" | "none";
  description: string;
  priority: "low" | "medium" | "high";
  };
  totalTokensUsed: number;
  messageCount: number;
  lastMessageAt: string;
  archivedAt?: string;
  isFavorite: boolean;
  rating?: number;
  ratingComment?: string;
  tags: Array<string>;
  internalNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  }>;
  pagination: { page: number;
  limit: number;
  total: number;
  pages: number;
  };
}

/** POST /api/v1/ai-assistant/conversations/summary — input (Params/Query/Headers/Body theo tên field). */
export interface AiAssistantGetHealthProfileSummaryRequest {
  patientProfile?: unknown;
}

/** POST /api/v1/ai-assistant/conversations/summary — response thành công theo return type thực tế. */
export type AiAssistantGetHealthProfileSummaryResponse = string;

// ==================== AI FEEDBACKS ====================

/** GET /api/v1/ai-feedbacks — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksGetAllFeedbacksRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  aiConversationId?: string;
  sortBy?: string;
  };
}

/** GET /api/v1/ai-feedbacks — response thành công theo return type thực tế. */
export interface AiFeedbacksGetAllFeedbacksResponse {
  data: Array<{ patientId: string;
  aiConversationId: string;
  content: string;
  }>;
  total: number;
}

/** POST /api/v1/ai-feedbacks — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksCreateRequest {
  aiConversationId: string;
  content: string;
}

/** POST /api/v1/ai-feedbacks — response thành công theo return type thực tế. */
export interface AiFeedbacksCreateResponse {
  patientId: string;
  aiConversationId: string;
  content: string;
}

/** GET /api/v1/ai-feedbacks/my-feedbacks — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksGetMyFeedbacksRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  aiConversationId?: string;
  sortBy?: string;
  };
}

/** GET /api/v1/ai-feedbacks/my-feedbacks — response thành công theo return type thực tế. */
export interface AiFeedbacksGetMyFeedbacksResponse {
  data: Array<{ patientId: string;
  aiConversationId: string;
  content: string;
  }>;
  total: number;
}

/** GET /api/v1/ai-feedbacks/conversation/{conversationId} — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksGetConversationFeedbacksRequest {
  params: { conversationId: string;
  };
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  aiConversationId?: string;
  sortBy?: string;
  };
}

/** GET /api/v1/ai-feedbacks/conversation/{conversationId} — response thành công theo return type thực tế. */
export interface AiFeedbacksGetConversationFeedbacksResponse {
  data: Array<{ patientId: string;
  aiConversationId: string;
  content: string;
  }>;
  total: number;
}

/** GET /api/v1/ai-feedbacks/conversation/{conversationId}/stats — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksGetConversationStatsRequest {
  params: { conversationId: string;
  };
}

/** GET /api/v1/ai-feedbacks/conversation/{conversationId}/stats — response thành công theo return type thực tế. */
export interface AiFeedbacksGetConversationStatsResponse {
  totalFeedbacks: number;
}

/** GET /api/v1/ai-feedbacks/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksGetFeedbackRequest {
  params: { id: string;
  };
}

/** GET /api/v1/ai-feedbacks/{id} — response thành công theo return type thực tế. */
export interface AiFeedbacksGetFeedbackResponse {
  patientId: string;
  aiConversationId: string;
  content: string;
}

/** PATCH /api/v1/ai-feedbacks/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksUpdateFeedbackRequest {
  params: { id: string;
  };
  body: { content?: string;
  };
}

/** PATCH /api/v1/ai-feedbacks/{id} — response thành công theo return type thực tế. */
export interface AiFeedbacksUpdateFeedbackResponse {
  patientId: string;
  aiConversationId: string;
  content: string;
}

/** DELETE /api/v1/ai-feedbacks/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksDeleteFeedbackRequest {
  params: { id: string;
  };
}

/** DELETE /api/v1/ai-feedbacks/{id} — response thành công theo return type thực tế. */
export interface AiFeedbacksDeleteFeedbackResponse {
  patientId: string;
  aiConversationId: string;
  content: string;
}

/** PATCH /api/v1/ai-feedbacks/{id}/helpful — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksMarkHelpfulRequest {
  params: { id: string;
  };
}

/** PATCH /api/v1/ai-feedbacks/{id}/helpful — response thành công theo return type thực tế. */
export interface AiFeedbacksMarkHelpfulResponse {
  patientId: string;
  aiConversationId: string;
  content: string;
}

/** PATCH /api/v1/ai-feedbacks/{id}/verify — input (Params/Query/Headers/Body theo tên field). */
export interface AiFeedbacksVerifyFeedbackRequest {
  params: { id: string;
  };
}

/** PATCH /api/v1/ai-feedbacks/{id}/verify — response thành công theo return type thực tế. */
export interface AiFeedbacksVerifyFeedbackResponse {
  patientId: string;
  aiConversationId: string;
  content: string;
}

// ==================== AI DOCUMENTS ====================

/** GET /api/v1/care-programs — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleListProgramsRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  diseaseKey?: string;
  status?: "draft" | "published" | "retired";
  sortBy?: "publishedAt" | "name" | "programCode" | "version";
  };
}

/** GET /api/v1/care-programs — response thành công theo return type thực tế. */
export interface CareProgramRuleListProgramsResponse {
  items: Array<Record<string, unknown>>;
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

/** POST /api/v1/care-programs — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleCreateProgramRequest {
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { programCode: string;
  name: string;
  diseaseKey: string;
  description?: string;
  eligibilityForm?: Record<string, unknown>;
  baselineForm: Record<string, unknown>;
  taskTemplates: Array<Record<string, unknown>>;
  reminderPolicy: Record<string, unknown>;
  reviewPolicy?: Record<string, unknown>;
  completionCriteria?: Record<string, unknown>;
  doctorEditableFields?: Array<string>;
  contentJourney?: Array<Record<string, unknown>>;
  dataSources?: Array<Record<string, unknown>>;
  };
}

/** POST /api/v1/care-programs — response thành công theo return type thực tế. */
export interface CareProgramRuleCreateProgramResponse {
  programCode: string;
  version: number;
  revision: number;
  name: string;
  diseaseKey: string;
  description?: string;
  status: "draft" | "published" | "retired";
  eligibilityForm?: Record<string, unknown>;
  baselineForm: Record<string, unknown>;
  taskTemplates: Array<Record<string, unknown>>;
  reminderPolicy: Record<string, unknown>;
  reviewPolicy?: Record<string, unknown>;
  completionCriteria?: Record<string, unknown>;
  doctorEditableFields: Array<string>;
  contentJourney: Array<Record<string, unknown>>;
  dataSources: Array<Record<string, unknown>>;
  createdBy: string;
  publishedBy?: string;
  publishedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/v1/care-programs/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleGetProgramRequest {
  params: { id: string;
  };
}

/** GET /api/v1/care-programs/{id} — response thành công theo return type thực tế. */
export interface CareProgramRuleGetProgramResponse {
  id: string;
  programCode: string;
  version: number;
  name: string;
  diseaseKey: string;
  description?: string;
  status: "draft" | "published" | "retired";
  publishedAt?: string;
  retiredAt?: string;
  eligibilityForm?: { [key: string]: unknown;
  };
  baselineForm?: { [key: string]: unknown;
  };
  taskTemplates?: Array<{ [key: string]: unknown;
  }>;
  reminderPolicy?: { [key: string]: unknown;
  };
  reviewPolicy?: { [key: string]: unknown;
  };
  completionCriteria?: { [key: string]: unknown;
  };
  doctorEditableFields?: Array<string>;
  contentJourney?: Array<{ [key: string]: unknown;
  }>;
  dataSources?: Array<{ [key: string]: unknown;
  }>;
  revision?: number;
  createdBy?: string;
  publishedBy?: string;
  retiredBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** PATCH /api/v1/care-programs/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleUpdateProgramRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  };
}

/** PATCH /api/v1/care-programs/{id} — response thành công theo return type thực tế. */
export interface CareProgramRuleUpdateProgramResponse {
  programCode: string;
  version: number;
  revision: number;
  name: string;
  diseaseKey: string;
  description?: string;
  status: "draft" | "published" | "retired";
  eligibilityForm?: Record<string, unknown>;
  baselineForm: Record<string, unknown>;
  taskTemplates: Array<Record<string, unknown>>;
  reminderPolicy: Record<string, unknown>;
  reviewPolicy?: Record<string, unknown>;
  completionCriteria?: Record<string, unknown>;
  doctorEditableFields: Array<string>;
  contentJourney: Array<Record<string, unknown>>;
  dataSources: Array<Record<string, unknown>>;
  createdBy: string;
  publishedBy?: string;
  publishedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/v1/care-programs/{id}/rules — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleGetRuleRequest {
  params: { id: string;
  };
  query: { view?: "active" | "draft";
  };
}

/** GET /api/v1/care-programs/{id}/rules — response thành công theo return type thực tế. */
export type CareProgramRuleGetRuleResponse = { id: string; careProgramId: string; version: number; status: "active"; testSummary?: { status: "passed" | "failed" | "unavailable"; total?: number; passed?: number; failed?: number; reasonCodes?: Array<string>; interpreterVersion?: string; executedAt?: string; }; } | { id: string; careProgramId: string; version: number; revision: number; status: "draft" | "active"; rules: Array<{ operator: string; key?: string; value?: string | number | false | true; min?: number; max?: number; rules?: Array<Record<string, unknown>>; reasonCode?: string; severity?: "attention" | "urgent"; }>; dataSources: Array<{ kind: "care_task_check_in"; schemaVersion: "health-check-in.v1"; templateKey: string; allowedFactPrefixes: Array<string>; }>; testSummary?: { status: "passed" | "failed" | "unavailable"; total?: number; passed?: number; failed?: number; reasonCodes?: Array<string>; interpreterVersion?: string; executedAt?: string; }; testResults?: Array<{ scenarioKey: string; passed: boolean; expectedSeverity?: "attention" | "urgent" | "normal"; actualSeverity?: "attention" | "urgent" | "normal"; reasonCodes?: Array<string>; }>; };

/** POST /api/v1/care-programs/{id}/rules — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleCreateRuleRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { rules: Array<Record<string, unknown>>;
  dataSources?: Array<Record<string, unknown>>;
  testResults?: Record<string, unknown>;
  };
}

/** POST /api/v1/care-programs/{id}/rules — response thành công theo return type thực tế. */
export interface CareProgramRuleCreateRuleResponse {
  careProgramId: string;
  version: number;
  revision: number;
  status: "draft" | "active" | "retired";
  rules: Array<Record<string, unknown>>;
  dataSources: Array<Record<string, unknown>>;
  testResults?: Record<string, unknown>;
  createdBy: string;
  activatedBy?: string;
  activatedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
}

/** POST /api/v1/care-programs/{id}/publish — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRulePublishProgramRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-programs/{id}/publish — response thành công theo return type thực tế. */
export interface CareProgramRulePublishProgramResponse {
  programCode: string;
  version: number;
  revision: number;
  name: string;
  diseaseKey: string;
  description?: string;
  status: "draft" | "published" | "retired";
  eligibilityForm?: Record<string, unknown>;
  baselineForm: Record<string, unknown>;
  taskTemplates: Array<Record<string, unknown>>;
  reminderPolicy: Record<string, unknown>;
  reviewPolicy?: Record<string, unknown>;
  completionCriteria?: Record<string, unknown>;
  doctorEditableFields: Array<string>;
  contentJourney: Array<Record<string, unknown>>;
  dataSources: Array<Record<string, unknown>>;
  createdBy: string;
  publishedBy?: string;
  publishedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/v1/care-programs/{id}/retire — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleRetireProgramRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-programs/{id}/retire — response thành công theo return type thực tế. */
export interface CareProgramRuleRetireProgramResponse {
  programCode: string;
  version: number;
  revision: number;
  name: string;
  diseaseKey: string;
  description?: string;
  status: "draft" | "published" | "retired";
  eligibilityForm?: Record<string, unknown>;
  baselineForm: Record<string, unknown>;
  taskTemplates: Array<Record<string, unknown>>;
  reminderPolicy: Record<string, unknown>;
  reviewPolicy?: Record<string, unknown>;
  completionCriteria?: Record<string, unknown>;
  doctorEditableFields: Array<string>;
  contentJourney: Array<Record<string, unknown>>;
  dataSources: Array<Record<string, unknown>>;
  createdBy: string;
  publishedBy?: string;
  publishedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** PATCH /api/v1/care-programs/{id}/rules/{ruleId} — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleUpdateRuleRequest {
  params: { id: string;
  ruleId: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  };
}

/** PATCH /api/v1/care-programs/{id}/rules/{ruleId} — response thành công theo return type thực tế. */
export interface CareProgramRuleUpdateRuleResponse {
  careProgramId: string;
  version: number;
  revision: number;
  status: "draft" | "active" | "retired";
  rules: Array<Record<string, unknown>>;
  dataSources: Array<Record<string, unknown>>;
  testResults?: Record<string, unknown>;
  createdBy: string;
  activatedBy?: string;
  activatedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
}

/** POST /api/v1/care-programs/{id}/rules/{ruleId}/activate — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleActivateRuleRequest {
  params: { id: string;
  ruleId: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-programs/{id}/rules/{ruleId}/activate — response thành công theo return type thực tế. */
export interface CareProgramRuleActivateRuleResponse {
  careProgramId: string;
  version: number;
  revision: number;
  status: "draft" | "active" | "retired";
  rules: Array<Record<string, unknown>>;
  dataSources: Array<Record<string, unknown>>;
  testResults?: Record<string, unknown>;
  createdBy: string;
  activatedBy?: string;
  activatedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
}

/** POST /api/v1/care-programs/{id}/rules/{ruleId}/retire — input (Params/Query/Headers/Body theo tên field). */
export interface CareProgramRuleRetireRuleRequest {
  params: { id: string;
  ruleId: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-programs/{id}/rules/{ruleId}/retire — response thành công theo return type thực tế. */
export interface CareProgramRuleRetireRuleResponse {
  careProgramId: string;
  version: number;
  revision: number;
  status: "draft" | "active" | "retired";
  rules: Array<Record<string, unknown>>;
  dataSources: Array<Record<string, unknown>>;
  testResults?: Record<string, unknown>;
  createdBy: string;
  activatedBy?: string;
  activatedAt?: string;
  retiredBy?: string;
  retiredAt?: string;
}

// ==================== CARE-ENROLLMENTS ====================

/** GET /api/v1/care-enrollments — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentListRequest {
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  status?: "pending" | "active" | "paused" | "completed" | "cancelled";
  programCode?: string;
  patientId?: string;
  sortBy?: "createdAt" | "updatedAt";
  };
}

/** GET /api/v1/care-enrollments — response thành công theo return type thực tế. */
export interface CareEnrollmentListResponse {
  items: Array<Record<string, unknown>>;
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

/** POST /api/v1/care-enrollments — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentCreateRequest {
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { patientId: string;
  programId: string;
  timezone: string;
  customSettings?: Record<string, unknown>;
  };
}

/** POST /api/v1/care-enrollments — response thành công theo return type thực tế. */
export interface CareEnrollmentCreateResponse {
  revision: number;
  patientId: string;
  doctorId: string;
  careProgramId: string;
  careRuleId: string;
  programAccessSlot?: number;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  timezone: string;
  consent: Record<string, unknown>;
  baselineAnswers?: Record<string, unknown>;
  baselineCompletedAt?: string;
  pauseRequestedAt?: string;
  pauseRequestReason?: string;
  customSettings?: Record<string, unknown>;
  programConfig: Record<string, unknown>;
  startedAt?: string;
  expectedEndAt?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  completedAt?: string;
  completedBy?: string;
  completionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/v1/care-enrollments/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentDetailRequest {
  params: { id: string;
  };
}

/** GET /api/v1/care-enrollments/{id} — response thành công theo return type thực tế. */
export interface CareEnrollmentDetailResponse {
  id: string;
  program: { id: string;
  programCode: string;
  version: number;
  name: string;
  diseaseKey: string;
  description?: string;
  status: "draft" | "published" | "retired";
  publishedAt?: string;
  retiredAt?: string;
  };
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  patient?: { id: string;
  fullName: string;
  avatarUrl?: string;
  specialty?: string;
  };
  assignedDoctor?: { id: string;
  fullName: string;
  avatarUrl?: string;
  specialty?: string;
  };
  timezone: string;
  allowedActions: Array<string>;
  startedAt?: string;
  expectedEndAt?: string;
  createdAt: string;
  updatedAt: string;
  consent?: { [key: string]: unknown;
  };
  baseline?: { [key: string]: unknown;
  };
  taskSummary: { [key: string]: unknown;
  };
  alertSummary: { [key: string]: unknown;
  };
  latestReport?: { [key: string]: unknown;
  };
}

/** POST /api/v1/care-enrollments/{id}/consent — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentConsentRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { policyVersion: string;
  purposes: Array<string>;
  };
}

/** POST /api/v1/care-enrollments/{id}/consent — response thành công theo return type thực tế. */
export interface CareEnrollmentConsentResponse {
  revision: number;
  patientId: string;
  doctorId: string;
  careProgramId: string;
  careRuleId: string;
  programAccessSlot?: number;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  timezone: string;
  consent: Record<string, unknown>;
  baselineAnswers?: Record<string, unknown>;
  baselineCompletedAt?: string;
  pauseRequestedAt?: string;
  pauseRequestReason?: string;
  customSettings?: Record<string, unknown>;
  programConfig: Record<string, unknown>;
  startedAt?: string;
  expectedEndAt?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  completedAt?: string;
  completedBy?: string;
  completionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/v1/care-enrollments/{id}/baseline — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentBaselineRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { answers: Record<string, unknown>;
  };
}

/** POST /api/v1/care-enrollments/{id}/baseline — response thành công theo return type thực tế. */
export interface CareEnrollmentBaselineResponse {
  revision: number;
  patientId: string;
  doctorId: string;
  careProgramId: string;
  careRuleId: string;
  programAccessSlot?: number;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  timezone: string;
  consent: Record<string, unknown>;
  baselineAnswers?: Record<string, unknown>;
  baselineCompletedAt?: string;
  pauseRequestedAt?: string;
  pauseRequestReason?: string;
  customSettings?: Record<string, unknown>;
  programConfig: Record<string, unknown>;
  startedAt?: string;
  expectedEndAt?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  completedAt?: string;
  completedBy?: string;
  completionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/v1/care-enrollments/{id}/pause — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentPauseRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-enrollments/{id}/pause — response thành công theo return type thực tế. */
export interface CareEnrollmentPauseResponse {
  revision: number;
  patientId: string;
  doctorId: string;
  careProgramId: string;
  careRuleId: string;
  programAccessSlot?: number;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  timezone: string;
  consent: Record<string, unknown>;
  baselineAnswers?: Record<string, unknown>;
  baselineCompletedAt?: string;
  pauseRequestedAt?: string;
  pauseRequestReason?: string;
  customSettings?: Record<string, unknown>;
  programConfig: Record<string, unknown>;
  startedAt?: string;
  expectedEndAt?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  completedAt?: string;
  completedBy?: string;
  completionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/v1/care-enrollments/{id}/resume — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentResumeRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-enrollments/{id}/resume — response thành công theo return type thực tế. */
export interface CareEnrollmentResumeResponse {
  revision: number;
  patientId: string;
  doctorId: string;
  careProgramId: string;
  careRuleId: string;
  programAccessSlot?: number;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  timezone: string;
  consent: Record<string, unknown>;
  baselineAnswers?: Record<string, unknown>;
  baselineCompletedAt?: string;
  pauseRequestedAt?: string;
  pauseRequestReason?: string;
  customSettings?: Record<string, unknown>;
  programConfig: Record<string, unknown>;
  startedAt?: string;
  expectedEndAt?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  completedAt?: string;
  completedBy?: string;
  completionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/v1/care-enrollments/{id}/complete — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentCompleteRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-enrollments/{id}/complete — response thành công theo return type thực tế. */
export interface CareEnrollmentCompleteResponse {
  revision: number;
  patientId: string;
  doctorId: string;
  careProgramId: string;
  careRuleId: string;
  programAccessSlot?: number;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  timezone: string;
  consent: Record<string, unknown>;
  baselineAnswers?: Record<string, unknown>;
  baselineCompletedAt?: string;
  pauseRequestedAt?: string;
  pauseRequestReason?: string;
  customSettings?: Record<string, unknown>;
  programConfig: Record<string, unknown>;
  startedAt?: string;
  expectedEndAt?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  completedAt?: string;
  completedBy?: string;
  completionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/v1/care-enrollments/{id}/cancel — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentCancelRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-enrollments/{id}/cancel — response thành công theo return type thực tế. */
export interface CareEnrollmentCancelResponse {
  revision: number;
  patientId: string;
  doctorId: string;
  careProgramId: string;
  careRuleId: string;
  programAccessSlot?: number;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  timezone: string;
  consent: Record<string, unknown>;
  baselineAnswers?: Record<string, unknown>;
  baselineCompletedAt?: string;
  pauseRequestedAt?: string;
  pauseRequestReason?: string;
  customSettings?: Record<string, unknown>;
  programConfig: Record<string, unknown>;
  startedAt?: string;
  expectedEndAt?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  completedAt?: string;
  completedBy?: string;
  completionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/v1/care-enrollments/{id}/withdraw-consent — input (Params/Query/Headers/Body theo tên field). */
export interface CareEnrollmentWithdrawRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
}

/** POST /api/v1/care-enrollments/{id}/withdraw-consent — response thành công theo return type thực tế. */
export interface CareEnrollmentWithdrawResponse {
  revision: number;
  patientId: string;
  doctorId: string;
  careProgramId: string;
  careRuleId: string;
  programAccessSlot?: number;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  timezone: string;
  consent: Record<string, unknown>;
  baselineAnswers?: Record<string, unknown>;
  baselineCompletedAt?: string;
  pauseRequestedAt?: string;
  pauseRequestReason?: string;
  customSettings?: Record<string, unknown>;
  programConfig: Record<string, unknown>;
  startedAt?: string;
  expectedEndAt?: string;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  completedAt?: string;
  completedBy?: string;
  completionReason?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== CARE-TASKS ====================

/** POST /api/v1/care-tasks/schedule — input (Params/Query/Headers/Body theo tên field). */
export interface CareTaskScheduleRequest {

}

/** POST /api/v1/care-tasks/schedule — response thành công theo return type thực tế. */
export interface CareTaskScheduleResponse {
  enrollments: number;
  created: number;
}

/** GET /api/v1/care-enrollments/{id}/tasks — input (Params/Query/Headers/Body theo tên field). */
export interface CareTaskTasksRequest {
  params: { id: string;
  };
  query: { page?: number;
  limit?: number;
  sortOrder?: -1 | 1;
  status?: "scheduled" | "due" | "completed" | "missed" | "cancelled";
  type?: "metric" | "check_in" | "education" | "appointment" | "doctor_review";
  from?: string;
  to?: string;
  sortBy?: "scheduledFor" | "windowStart" | "updatedAt";
  };
}

/** GET /api/v1/care-enrollments/{id}/tasks — response thành công theo return type thực tế. */
export interface CareTaskTasksResponse {
  items: Array<Record<string, unknown>>;
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

/** GET /api/v1/care-enrollments/{id}/completion-rate — input (Params/Query/Headers/Body theo tên field). */
export interface CareTaskCompletionRateRequest {
  params: { id: string;
  };
}

/** GET /api/v1/care-enrollments/{id}/completion-rate — response thành công theo return type thực tế. */
export interface CareTaskCompletionRateResponse {
  expected: number;
  completed: number;
  missed: number;
  completionRate: null | number;
}

/** GET /api/v1/care-tasks/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface CareTaskDetailRequest {
  params: { id: string;
  };
}

/** GET /api/v1/care-tasks/{id} — response thành công theo return type thực tế. */
export interface CareTaskDetailResponse {
  id: string;
  enrollmentId: string;
  taskType: "metric" | "check_in" | "education" | "appointment" | "doctor_review";
  templateKey: string;
  status: "scheduled" | "due" | "completed" | "missed" | "cancelled";
  required: boolean;
  scheduledFor: string;
  windowStart: string;
  windowEnd: string;
  completedAt?: string;
  missedAt?: string;
  cancelledAt?: string;
  allowedActions: Array<string>;
  presentation: { [key: string]: unknown;
  };
  progress: { [key: string]: unknown;
  };
  consultationReference?: { [key: string]: unknown;
  };
}

/** POST /api/v1/care-tasks/{id}/responses — input (Params/Query/Headers/Body theo tên field). */
export interface CareTaskRespondRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { action?: "acknowledge";
  overallStatus?: "improved" | "stable" | "worsened";
  symptomCodes?: Array<string>;
  severity?: "none" | "mild" | "moderate" | "severe";
  };
}

/** POST /api/v1/care-tasks/{id}/responses — response thành công theo return type thực tế. */
export interface CareTaskRespondResponse {
  task: Record<string, unknown>;
  replayed: boolean;
}

/** POST /api/v1/care-tasks/{id}/doctor-review — input (Params/Query/Headers/Body theo tên field). */
export interface CareTaskDoctorReviewRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { reasonCode: "reviewed_no_action" | "follow_up_needed" | "consultation_recommended" | "care_plan_adjustment_needed";
  note?: string;
  };
}

/** POST /api/v1/care-tasks/{id}/doctor-review — response thành công theo return type thực tế. */
export interface CareTaskDoctorReviewResponse {
  task: Record<string, unknown>;
  replayed: boolean;
}

/** POST /api/v1/care-tasks/{id}/appointment-link — input (Params/Query/Headers/Body theo tên field). */
export interface CareTaskAppointmentLinkRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { consultationId: string;
  };
}

/** POST /api/v1/care-tasks/{id}/appointment-link — response thành công theo return type thực tế. */
export interface CareTaskAppointmentLinkResponse {
  task: Record<string, unknown>;
  replayed: boolean;
}

// ==================== CARE-ALERTS ====================

/** GET /api/v1/care-alerts — input (Params/Query/Headers/Body theo tên field). */
export interface CareAlertInboxRequest {
  query: { cursor?: string;
  limit?: number;
  status?: "open" | "acknowledged" | "resolved" | "dismissed";
  severity?: "attention" | "urgent";
  };
}

/** GET /api/v1/care-alerts — response thành công theo return type thực tế. */
export interface CareAlertInboxResponse {
  items: Array<{ revision: number;
  patientCareProgramId: string;
  evaluationId: string;
  patientId: string;
  assignedDoctorId: string;
  severity: "normal" | "attention" | "urgent";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  reasonCodes: Array<string>;
  uniqueKey: string;
  activeDeduplicationKey?: string;
  detectedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  dismissedBy?: string;
  dismissedAt?: string;
  dismissalReason?: string;
  }>;
  hasNextPage: boolean;
  nextCursor: null | string;
}

/** GET /api/v1/care-alerts/{id}/detail — input (Params/Query/Headers/Body theo tên field). */
export interface CareAlertDoctorDetailRequest {
  params: { id: string;
  };
}

/** GET /api/v1/care-alerts/{id}/detail — response thành công theo return type thực tế. */
export interface CareAlertDoctorDetailResponse {
  evaluation: null | { patientCareProgramId: string;
  patientId: string;
  careTaskId?: string;
  sourceType: "health_metric" | "care_task_check_in";
  healthMetricId?: string;
  careRuleId: string;
  severity: "normal" | "attention" | "urgent";
  reasonCodes: Array<string>;
  inputData: Record<string, unknown>;
  timeRange: Record<string, unknown>;
  uniqueKey: string;
  evaluatedAt: string;
  replacesEvaluationId?: string;
  };
  timeline: Array<{ domain: string;
  entityType: string;
  entityId?: string;
  action: string;
  userId?: string;
  actorId?: string;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  expiresAt?: string;
  }>;
  allowedActions: Array<string>;
  revision: number;
  patientCareProgramId: string;
  evaluationId: string;
  patientId: string;
  assignedDoctorId: string;
  severity: "normal" | "attention" | "urgent";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  reasonCodes: Array<string>;
  uniqueKey: string;
  activeDeduplicationKey?: string;
  detectedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  dismissedBy?: string;
  dismissedAt?: string;
  dismissalReason?: string;
}

/** GET /api/v1/care-alerts/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface CareAlertGetRequest {
  params: { id: string;
  };
}

/** GET /api/v1/care-alerts/{id} — response thành công theo return type thực tế. */
export interface CareAlertGetResponse {
  id: string;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  severity: "normal" | "attention" | "urgent";
  detectedAt: string;
  reasonCodes: Array<string>;
}

/** GET /api/v1/care-alerts/{id}/audit — input (Params/Query/Headers/Body theo tên field). */
export interface CareAlertAuditRequest {
  params: { id: string;
  };
}

/** GET /api/v1/care-alerts/{id}/audit — response thành công theo return type thực tế. */
export type CareAlertAuditResponse = Array<{ domain: string; entityType: string; entityId?: string; action: string; userId?: string; actorId?: string; fromStatus?: string; toStatus?: string; reason?: string; metadata?: Record<string, unknown>; ipAddress?: string; userAgent?: string; expiresAt?: string; }>;

/** POST /api/v1/care-alerts/{id}/acknowledge — input (Params/Query/Headers/Body theo tên field). */
export interface CareAlertAcknowledgeRequest {
  params: { id: string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-alerts/{id}/acknowledge — response thành công theo return type thực tế. */
export interface CareAlertAcknowledgeResponse {
  revision: number;
  patientCareProgramId: string;
  evaluationId: string;
  patientId: string;
  assignedDoctorId: string;
  severity: "normal" | "attention" | "urgent";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  reasonCodes: Array<string>;
  uniqueKey: string;
  activeDeduplicationKey?: string;
  detectedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  dismissedBy?: string;
  dismissedAt?: string;
  dismissalReason?: string;
}

/** POST /api/v1/care-alerts/{id}/resolve — input (Params/Query/Headers/Body theo tên field). */
export interface CareAlertResolveRequest {
  params: { id: string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-alerts/{id}/resolve — response thành công theo return type thực tế. */
export interface CareAlertResolveResponse {
  revision: number;
  patientCareProgramId: string;
  evaluationId: string;
  patientId: string;
  assignedDoctorId: string;
  severity: "normal" | "attention" | "urgent";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  reasonCodes: Array<string>;
  uniqueKey: string;
  activeDeduplicationKey?: string;
  detectedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  dismissedBy?: string;
  dismissedAt?: string;
  dismissalReason?: string;
}

/** POST /api/v1/care-alerts/{id}/dismiss — input (Params/Query/Headers/Body theo tên field). */
export interface CareAlertDismissRequest {
  params: { id: string;
  };
  body: { expectedRevision: number;
  reason: string;
  };
}

/** POST /api/v1/care-alerts/{id}/dismiss — response thành công theo return type thực tế. */
export interface CareAlertDismissResponse {
  revision: number;
  patientCareProgramId: string;
  evaluationId: string;
  patientId: string;
  assignedDoctorId: string;
  severity: "normal" | "attention" | "urgent";
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  reasonCodes: Array<string>;
  uniqueKey: string;
  activeDeduplicationKey?: string;
  detectedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  dismissedBy?: string;
  dismissedAt?: string;
  dismissalReason?: string;
}

/** POST /api/v1/care-alerts/{id}/consultations — input (Params/Query/Headers/Body theo tên field). */
export interface CareAlertCreateConsultationRequest {
  params: { id: string;
  };
  body: {  };
}

/** POST /api/v1/care-alerts/{id}/consultations — response thành công theo return type thực tế. */
export interface CareAlertCreateConsultationResponse {
  id: string;
  created: boolean;
}

// ==================== CARE-REPORTS ====================

/** GET /api/v1/care-enrollments/{id}/reports — input (Params/Query/Headers/Body theo tên field). */
export interface CareReportListRequest {
  params: { id: string;
  };
  query: { reportType?: "weekly" | "thirty_day";
  };
}

/** GET /api/v1/care-enrollments/{id}/reports — response thành công theo return type thực tế. */
export type CareReportListResponse = Array<Record<string, unknown>>;

/** POST /api/v1/care-enrollments/{id}/reports — input (Params/Query/Headers/Body theo tên field). */
export interface CareReportGenerateRequest {
  params: { id: string;
  };
  body: { reportType: "weekly" | "thirty_day";
  dataUntil: string;
  };
}

/** POST /api/v1/care-enrollments/{id}/reports — response thành công theo return type thực tế. */
export type CareReportGenerateResponse = Record<string, unknown>;

/** GET /api/v1/care-reports/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface CareReportGetRequest {
  params: { id: string;
  };
}

/** GET /api/v1/care-reports/{id} — response thành công theo return type thực tế. */
export type CareReportGetResponse = Record<string, unknown>;

/** POST /api/v1/care-reports/{id}/summaries — input (Params/Query/Headers/Body theo tên field). */
export interface CareReportGenerateSummaryRequest {
  params: { id: string;
  };
  body: { audience?: "doctor" | "patient";
  };
}

/** POST /api/v1/care-reports/{id}/summaries — response thành công theo return type thực tế. */
export type CareReportGenerateSummaryResponse = null | { reportId: string; patientCareProgramId: string; patientId: string; careRuleId: string; audience: "doctor" | "patient"; status: "generated" | "fallback" | "failed"; summaryVersion: number; uniqueKey: string; content?: Record<string, unknown>; citations: Array<unknown>; provider?: string; promptVersion: string; ruleVersion: number; inputHash: string; validation: Record<string, unknown>; inputTokens?: number; outputTokens?: number; latencyMs?: number; errorCode?: string; };

/** POST /api/v1/care-reports/{id}/exports — input (Params/Query/Headers/Body theo tên field). */
export interface CareReportCreateExportRequest {
  params: { id: string;
  };
  headers: { "idempotency-key": string;
  "Idempotency-Key": string;
  };
  body: { format: "pdf" | "csv";
  };
}

/** POST /api/v1/care-reports/{id}/exports — response thành công theo return type thực tế. */
export interface CareReportCreateExportResponse {
  id: string;
  careReportId: string;
  reportVersion: number;
  format: "pdf" | "csv";
  status: "pending" | "processing" | "ready" | "failed" | "expired";
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  download?: { url: string;
  expiresAt: string;
  };
  failureReasonCode?: string;
  replayed?: boolean;
}

/** GET /api/v1/care-report-exports/{id} — input (Params/Query/Headers/Body theo tên field). */
export interface CareReportGetExportRequest {
  params: { id: string;
  };
}

/** GET /api/v1/care-report-exports/{id} — response thành công theo return type thực tế. */
export interface CareReportGetExportResponse {
  id: string;
  careReportId: string;
  reportVersion: number;
  format: "pdf" | "csv";
  status: "pending" | "processing" | "ready" | "failed" | "expired";
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  download?: { url: string;
  expiresAt: string;
  };
  failureReasonCode?: string;
  replayed?: boolean;
}

// ==================== REALTIME (SOCKET.IO) ====================

/** /chat client→server join_consultation (wire payload thực tế là consultationId string). */
export interface ChatJoinConsultationPayload {
  consultationId: string;
}

/** /chat client→server leave_consultation (wire payload thực tế là consultationId string). */
export interface ChatLeaveConsultationPayload {
  consultationId: string;
}

/** /chat client→server send_consultation_message. */
export interface ChatSendConsultationMessagePayload {
  consultationId: string;
  senderType: "patient" | "doctor";
  content: string;
  clientMessageId?: string;
}

/** /chat client→server get_consultation_messages. */
export interface ChatGetConsultationMessagesPayload {
  consultationId: string;
  cursor?: string;
  limit?: number;
}

/** /consultations client→server consultation_heartbeat. */
export interface ConsultationHeartbeatPayload {
  consultationId: string;
}

/** /consultations acknowledgement của consultation_heartbeat. */
export interface ConsultationHeartbeatResponse {
  consultationId: string;
  recordedAt: string;
}

/** /chat server→client joined_consultation/left_consultation. */
export interface RealtimeConsultationRoomResult {
  consultationId: string;
}

/** /chat server→client các event *_error. */
export interface RealtimeConsultationError {
  message: string;
}

/** /chat server→client consultation_message/consultation_message_sent; service trả Mongoose message document. */
export type RealtimeMessageDocument = Record<string, unknown>;

/** /chat server→client consultation_messages; paginated chat result. */
export type RealtimeConsultationMessages = Record<string, unknown>;

/** /consultations server→client consultation_changed. */
export interface RealtimeConsultationChanged {
  action: "created" | "updated" | "accepted" | "declined" | "started" | "completed" | "no_show" | "cancelled" | "checked_in" | "called";
  consultationId: string;
  patientId: string;
  doctorId: string;
}

/** /consultations server→client queue.v1.changed. */
export interface RealtimeQueueChanged {
  consultationId: string;
  position: number;
  estimatedWaitMinutes: number | null;
  version: string;
}

/** /consultations server→client queue.v1.called. */
export interface RealtimeQueueCalled {
  consultationId: string;
  calledAt: string;
}

/** /notifications server→client notifications. */
export interface RealtimeNotificationChanged {
  userId: string;
  action: "send" | "mark_read" | "mark_all_read" | "deleted" | "care_alerts_invalidated";
  notification?: { id: string;
  title: string;
  message: string;
  isRead: boolean;
  type?: string;
  createdAt?: string;
  readAt?: string;
  };
}

/** /notifications server→client consultation_message_notification. */
export interface RealtimeConsultationMessageNotification {

}

/** /notifications server→client connected. */
export interface RealtimeNotificationConnected {
  message: string;
  userId: string;
  socketId: string;
  timestamp: string;
}

/** /notifications server→client account_banned. */
export type RealtimeAccountBanned = null;

/** / server→client userStatusChanged. */
export interface RealtimePresenceChanged {
  userId: string;
  status: "online" | "offline";
}

// ==================== DA2 CURATED CONSUMER CONTRACT ====================
//
// The inventory types above describe observed legacy runtime responses. They are
// not a license for a new frontend to depend on persistence documents or fields
// marked unknown. New DA2 consumers should import the bounded types below and
// use OpenAPI as the generated HTTP source of truth. All timestamps are ISO 8601
// strings; no type below contains provider, audit, outbox, or raw clinical data.

export type Da2IsoDateTime = string;

export interface Da2Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Da2Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Da2ApiError {
  statusCode: number;
  timestamp: Da2IsoDateTime;
  path: string;
  method: string;
  correlationId: string;
  error: string;
  message: string | string[];
  code?: string;
  details?: Record<string, unknown>;
}

export interface Da2IdempotentResult<T> {
  data: T;
  replayed: boolean;
}

export interface Da2AvailableSlot {
  id: string;
  doctorId: string;
  startAt: Da2IsoDateTime;
  endAt: Da2IsoDateTime;
  timezone: string;
  status: "available";
}

export interface Da2DoctorAvailabilitySlot {
  id: string;
  doctorId: string;
  startAt: Da2IsoDateTime;
  endAt: Da2IsoDateTime;
  timezone: string;
  status: "available" | "booked" | "blocked" | "expired";
  createdAt: Da2IsoDateTime;
  updatedAt: Da2IsoDateTime;
}

export interface Da2ScheduledConsultation {
  id: string;
  patientId: string;
  doctorId: string;
  availabilitySlotId: string;
  mode: "scheduled";
  requestStatus: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  sessionStatus: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
  quotaPolicy: "consultation_limit" | "care_program_included";
  scheduledStartAt: Da2IsoDateTime;
  scheduledEndAt: Da2IsoDateTime;
  timezone: string;
  expectedDurationMinutes: number;
  createdAt: Da2IsoDateTime;
  updatedAt: Da2IsoDateTime;
}

export interface Da2QueueSnapshot {
  consultationId: string;
  status: "waiting" | "called";
  position: number;
  /** Null means that the server deliberately has no ETA policy/estimate. */
  estimatedWaitMinutes: number | null;
  etaReason: string | null;
  updatedAt: Da2IsoDateTime;
}

export interface Da2DoctorQueueEntry extends Da2QueueSnapshot {
  patient: { id: string; fullName?: string; avatarUrl?: string };
  mode: "scheduled";
  scheduledStartAt: Da2IsoDateTime;
  queueJoinedAt: Da2IsoDateTime;
  queuePosition: number;
  isCurrent: boolean;
  isLate: boolean;
  calledAt?: Da2IsoDateTime;
}

export interface Da2DoctorQueuePage {
  data: Da2DoctorQueueEntry[];
  currentSession: {
    consultationId: string;
    patientId: string;
    sessionStatus: "not_started" | "waiting" | "in_consultation" | "interrupted" | "completed" | "no_show";
    sessionStartedAt?: Da2IsoDateTime;
  } | null;
  pagination: Da2Pagination;
}

export interface Da2CareProgramSummary {
  id: string;
  programCode: string;
  version: number;
  name: string;
  diseaseKey: string;
  description?: string;
  status: "draft" | "published" | "retired";
  publishedAt?: Da2IsoDateTime;
  retiredAt?: Da2IsoDateTime;
}

export interface Da2CareIdentitySummary {
  id: string;
  fullName: string;
  avatarUrl?: string;
  specialty?: string;
}

export interface Da2CareEnrollmentSummary {
  id: string;
  program: Da2CareProgramSummary;
  status: "pending" | "active" | "paused" | "completed" | "cancelled";
  patient?: Da2CareIdentitySummary;
  assignedDoctor?: Da2CareIdentitySummary;
  timezone: string;
  allowedActions: string[];
  startedAt?: Da2IsoDateTime;
  expectedEndAt?: Da2IsoDateTime;
  createdAt: Da2IsoDateTime;
  updatedAt: Da2IsoDateTime;
}

export interface Da2CareTaskSummary {
  id: string;
  enrollmentId: string;
  taskType: "metric" | "check_in" | "education" | "appointment" | "doctor_review";
  templateKey: string;
  status: "scheduled" | "due" | "completed" | "missed" | "cancelled";
  required: boolean;
  scheduledFor: Da2IsoDateTime;
  windowStart: Da2IsoDateTime;
  windowEnd: Da2IsoDateTime;
  completedAt?: Da2IsoDateTime;
  missedAt?: Da2IsoDateTime;
  cancelledAt?: Da2IsoDateTime;
  allowedActions: string[];
}

/** Dynamic presentation is server-curated; frontend must not infer a schema not in OpenAPI. */
export interface Da2CareTaskDetail extends Da2CareTaskSummary {
  presentation: unknown;
  progress: unknown;
  consultationReference?: unknown;
}

export interface Da2HealthCheckInRequest {
  overallStatus: "improved" | "stable" | "worsened";
  symptomCodes: string[];
  severity: "none" | "mild" | "moderate" | "severe";
}

export interface Da2EducationAcknowledgementRequest {
  action: "acknowledge";
}

export interface Da2DoctorReviewRequest {
  reasonCode: "reviewed_no_action" | "follow_up_needed" | "consultation_recommended" | "care_plan_adjustment_needed";
  note?: string;
}

export interface Da2CareRuleTestSummary {
  status: "passed" | "failed" | "unavailable";
  total?: number;
  passed?: number;
  failed?: number;
  reasonCodes?: string[];
  interpreterVersion?: string;
  executedAt?: Da2IsoDateTime;
}

export interface Da2DoctorCareRule {
  id: string;
  careProgramId: string;
  version: number;
  status: "active";
  testSummary?: Da2CareRuleTestSummary;
}

export interface Da2SanitizedDeclarativeRule {
  operator: "all" | "any" | "not" | "gt" | "gte" | "lt" | "lte" | "between" | "exists" | "equal" | "not_equal";
  key?: string;
  value?: number | string | boolean;
  min?: number;
  max?: number;
  rules?: Da2SanitizedDeclarativeRule[];
  reasonCode?: string;
  severity?: "attention" | "urgent";
}

export interface Da2AdminCareRule extends Omit<Da2DoctorCareRule, "status"> {
  revision: number;
  status: "active" | "draft";
  rules: Da2SanitizedDeclarativeRule[];
  dataSources: Array<{
    kind: "care_task_check_in";
    schemaVersion: "health-check-in.v1";
    templateKey: string;
    allowedFactPrefixes: string[];
  }>;
  testResults?: Array<{
    scenarioKey: string;
    passed: boolean;
    expectedSeverity?: "normal" | "attention" | "urgent";
    actualSeverity?: "normal" | "attention" | "urgent";
    reasonCodes?: string[];
  }>;
}

export interface Da2PatientPlan {
  id: string;
  code: string;
  version: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  durationDays: number;
  quota: {
    aiRequestLimit: number;
    aiTokenLimit: number;
    aiQuotaPeriod: "day" | "subscription_cycle";
    consultationLimitPerCycle: number;
    activeCareProgramLimit: number;
  };
  available: boolean;
  purchasable: boolean;
  effectiveFrom?: Da2IsoDateTime;
  effectiveUntil?: Da2IsoDateTime;
}

export interface Da2PatientSubscriptionUsage {
  subscriptionId: string;
  cycle: { number: number; startedAt: Da2IsoDateTime; endsAt: Da2IsoDateTime };
  consultations: {
    limit: number | null;
    counted: number;
    reserved: number;
    available: number | null;
    unlimited: boolean;
  };
  asOf: Da2IsoDateTime;
}

export interface Da2PaymentOrder {
  id: string;
  orderCode: string;
  status: "created" | "pending" | "processing" | "paid" | "expired" | "cancelled" | "failed" | "refund_pending" | "refunded";
  amount: number;
  currency: string;
  plan: { code: string; name: string; version: number };
  expiresAt: Da2IsoDateTime;
  createdAt: Da2IsoDateTime;
  updatedAt: Da2IsoDateTime;
  paidAt?: Da2IsoDateTime;
  cancelledAt?: Da2IsoDateTime;
}

export interface Da2CareReportExport {
  id: string;
  careReportId: string;
  reportVersion: number;
  format: "pdf" | "csv";
  status: "pending" | "processing" | "ready" | "failed" | "expired";
  createdAt: Da2IsoDateTime;
  updatedAt: Da2IsoDateTime;
  expiresAt?: Da2IsoDateTime;
  download?: { url: string; expiresAt: Da2IsoDateTime };
  failureReasonCode?: string;
  replayed?: boolean;
}

// ============================================================================
// GIAI ĐOẠN C — RAG VÀ QUẢN TRỊ NGUỒN BẰNG CHỨNG BÊN NGOÀI
// Đây là các type trong hợp đồng công khai cho frontend. Cố ý không bao gồm
// thông tin nội bộ về storage, vector, chunk và provider.
// ============================================================================

/** Trạng thái xử lý tài liệu do các endpoint tài liệu tri thức trả về. */
export type KnowledgeDocumentStatus =
  | 'pending_ingestion'
  | 'processing'
  | 'ready_for_activation'
  | 'active'
  | 'error'
  | 'inactive';

export type KnowledgeDocumentReviewStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'archived';

export interface KnowledgeDocument {
  _id: string;
  title: string;
  fileType: string;
  status: KnowledgeDocumentStatus;
  reviewStatus: KnowledgeDocumentReviewStatus;
  documentVersion: number;
  parentDocumentId?: string | null;
  scope: string;
  knowledgeLanguage: string;
  source: string;
  ingestionVersion?: number;
  validUntil?: Da2IsoDateTime | null;
  uploadedBy: string;
  reviewedBy?: string | null;
  reviewedAt?: Da2IsoDateTime | null;
  reviewReason?: string | null;
  approvedBy?: string;
  approvedAt?: Da2IsoDateTime;
  createdAt: Da2IsoDateTime;
  updatedAt: Da2IsoDateTime;
}

export interface KnowledgeDocumentUpdateRequest {
  title?: string;
  fileUrl?: string;
  fileType?: string;
  status?: KnowledgeDocumentStatus;
  validUntil?: Da2IsoDateTime | null;
}

export interface KnowledgeDocumentRejectRequest {
  reason?: string;
}

export interface KnowledgeDocumentsListRequest {
  page?: number;
  limit?: number;
  status?: KnowledgeDocumentStatus;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 1 | -1;
}

export interface KnowledgeDocumentsListResponse {
  data: KnowledgeDocument[];
  total: number;
}

/** Response của `GET /api/v1/ai-documents/search/{query}`. */
export type KnowledgeDocumentSearchResponse = KnowledgeDocument[];

/** `multipart/form-data`; `file` is a PDF, DOC, DOCX or TXT file. */
export interface KnowledgeDocumentSubmissionRequest {
  file: File;
  title?: string;
  validUntil?: Da2IsoDateTime | null;
}

export type KnowledgeDocumentReplacementRequest =
  KnowledgeDocumentSubmissionRequest;

/** Request của `POST /api/v1/ai-documents/{id}/reject`. */
export type RejectKnowledgeDocumentRequest = KnowledgeDocumentRejectRequest;

/** Citation công khai trong câu trả lời AI; không chứa nội bộ storage, vector hoặc provider. */
export interface AiEvidenceCitation {
  source: string;
  title?: string;
  excerpt: string;
  documentVersion?: number;
  pageNumber?: number | null;
  sectionTitle?: string | null;
}

/** Các trường bằng chứng trong câu trả lời AI dành cho bệnh nhân. */
export interface AiRagEvidence {
  groundedByRag: boolean;
  citations: AiEvidenceCitation[];
  confidence: number;
}

export type KnowledgeCandidateStatus =
  | 'pending_review'
  | 'promoted'
  | 'rejected';

/** Chỉ chứa metadata PubMed công khai; API không nhận hoặc trả về abstract. */
export interface KnowledgeCandidate {
  _id: string;
  pmid: string;
  title: string;
  sourceUrl: string;
  status: KnowledgeCandidateStatus;
  reviewedAt?: Da2IsoDateTime | null;
  reviewReason?: string | null;
  createdAt: Da2IsoDateTime;
  updatedAt: Da2IsoDateTime;
}

/** Response của `GET /api/v1/ai-knowledge-candidates`. */
export type KnowledgeCandidateListResponse = KnowledgeCandidate[];

export interface ProposeKnowledgeCandidateRequest {
  pmid: string;
  title: string;
  sourceUrl: string;
}

export interface RejectKnowledgeCandidateRequest {
  reason?: string;
}

export interface PromoteKnowledgeCandidateResponse {
  candidate: KnowledgeCandidate;
  document: KnowledgeDocument;
}

/** Cấu hình canonical áp dụng cho các lịch scheduled được tạo sau thời điểm lưu. */
export interface DoctorBookingSettings {
  bookingPolicy: 'instant';
  bufferMinutes: number;
  minNoticeMinutes: number;
  cancellationDeadlineMinutes: number;
  checkInEarlyMinutes: number;
  noShowAfterMinutes: number;
  effectiveFrom: Da2IsoDateTime;
  updatedAt: Da2IsoDateTime;
  updatedBy?: string;
}

export type UpdateDoctorBookingSettingsRequest = Pick<
  DoctorBookingSettings,
  | 'bookingPolicy'
  | 'bufferMinutes'
  | 'minNoticeMinutes'
  | 'cancellationDeadlineMinutes'
  | 'checkInEarlyMinutes'
  | 'noShowAfterMinutes'
>;

export interface OverrideDoctorBookingSettingsRequest
  extends UpdateDoctorBookingSettingsRequest {
  overrideReason: string;
}

export interface DoctorBookingSettingsResponse {
  statusCode: number;
  data: DoctorBookingSettings;
}
