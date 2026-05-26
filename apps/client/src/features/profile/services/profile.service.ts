import { api } from "@/lib/api";

export type UserRole = "admin" | "patient" | "doctor";

type GenderValue = "male" | "female" | "other" | string;

type AdminRole = "super_admin" | "user_admin" | "ai_admin";

type DoctorVerificationStatus = "approved" | "pending" | "rejected";

export interface ProfileDataReceiver {
  id: string;
  isOnline: boolean;
  avatarUrl?: string;
  avatarPublicId?: string;
  fullName: string;
  role: UserRole;
  email: string;
  phone: string;
  gender: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  country: string;
  adminAssignedRole?: string;
  yearsOfExperience?: string;
  documentsUrl?: string[];
  specialty?: string;
  workplace?: string;
}

type ApiAddress = {
  street?: string;
  ward?: string;
  district?: string;
  city?: string;
  country?: string;
};

type ApiDoctorProfile = {
  _id: string;
  userId: string;
  specialty?: string;
  workplace?: string;
  verificationDocuments?: string[];
  experienceYears?: number;
  averageRating?: number;
  verifiedAt?: string;
  verificationStatus?: DoctorVerificationStatus;
  rejectReason?: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
};

type ApiAdminProfile = {
  _id: string;
  userId: string;
  adminRole?: AdminRole;
  __v: number;
  createdAt: string;
  updatedAt: string;
};

type UserProfileResponse = {
  _id: string;
  email: string;
  fullName: string;
  role: UserRole;
  accountStatus: "active" | "banned";
  isOnline?: boolean;
  gender?: GenderValue;
  dateOfBirth?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  address?: ApiAddress;
  __v?: number;
  createdAt?: string;
  updatedAt?: string;
  doctorProfile?: ApiDoctorProfile | null;
  adminProfile?: ApiAdminProfile | null;
};

type UploadFolder =
  | "healthcare/avatars/admin"
  | "healthcare/avatars/doctor"
  | "healthcare/avatars/patient";

type CloudinaryUploadResponse = {
  statusCode: number;
  message: string;
  data: {
    files: Array<{
      originalName: string;
      publicId: string;
      url: string;
      secureUrl: string;
      size: number;
    }>;
    uploadedAt: string;
    totalSize: number;
  };
};

function capitalize(value?: string) {
  if (!value) {
    return "";
  }

  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function normalizeGender(value?: GenderValue) {
  if (!value) {
    return "";
  }

  const lowerCase = value.toLowerCase();
  if (lowerCase === "male" || lowerCase === "female" || lowerCase === "other") {
    return capitalize(lowerCase);
  }

  return value;
}

function normalizeAdminRole(value?: AdminRole) {
  if (!value) {
    return "";
  }

  return value
    .split("_")
    .map((part) => capitalize(part))
    .join(" ");
}

function resolveAvatarUploadFolder(role: UserRole): UploadFolder {
  if (role === "doctor") {
    return "healthcare/avatars/doctor";
  }

  if (role === "patient") {
    return "healthcare/avatars/patient";
  }

  return "healthcare/avatars/admin";
}

export function mapApiProfileToUiProfile(
  payload: UserProfileResponse,
): ProfileDataReceiver {
  const doctorProfile = payload.doctorProfile ?? null;
  const adminProfile = payload.adminProfile ?? null;

  return {
    id: payload._id,
    isOnline: Boolean(payload.isOnline),
    avatarUrl: payload.avatarUrl,
    avatarPublicId: payload.avatarPublicId,
    fullName: payload.fullName ?? "",
    role: payload.role,
    email: payload.email ?? "",
    phone: payload.phoneNumber ?? "",
    gender: normalizeGender(payload.gender),
    street: payload.address?.street ?? "",
    ward: payload.address?.ward ?? "",
    district: payload.address?.district ?? "",
    city: payload.address?.city ?? "",
    country: payload.address?.country ?? "",
    adminAssignedRole: normalizeAdminRole(adminProfile?.adminRole),
    yearsOfExperience:
      doctorProfile?.experienceYears != null
        ? String(doctorProfile.experienceYears)
        : "",
    documentsUrl: doctorProfile?.verificationDocuments ?? [],
    specialty: doctorProfile?.specialty ?? "",
    workplace: doctorProfile?.workplace ?? "",
  };
}

export async function getMyProfile() {
  const res = await api.get<UserProfileResponse>("/auth/me");
  return mapApiProfileToUiProfile(res.data);
}

export async function uploadProfileAvatar(file: File, role: UserRole) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", resolveAvatarUploadFolder(role));
  formData.append("fileType", "image");

  const response = await api.post<CloudinaryUploadResponse>(
    "/upload/single",
    formData,
  );

  return {
    avatarUrl:
      response.data.data.files[0]?.secureUrl ??
      response.data.data.files[0]?.url ??
      "",
    avatarPublicId: response.data.data.files[0]?.publicId ?? "",
  };
}

export async function deleteProfileAvatar(publicId: string) {
  const response = await api.delete(
    `/upload/delete?publicId=${encodeURIComponent(publicId)}`,
    {
      data: { fileType: "image" },
    },
  );

  return response;
}

export type UpdateMyProfileServicePayload = Omit<
  ProfileDataReceiver,
  "documentsUrl"
> & {
  newVerificationDocuments: File[];
  existingVerificationDocuments: string[];
};

export async function updateMyProfile(payload: UpdateMyProfileServicePayload) {
  const formData = new FormData();

  const appendIfSet = (
    key: string,
    value: string | number | undefined | null,
  ) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  };

  appendIfSet("avatarUrl", payload.avatarUrl);
  appendIfSet("avatarPublicId", payload.avatarPublicId);
  appendIfSet("fullName", payload.fullName);
  appendIfSet("phoneNumber", payload.phone);
  appendIfSet("gender", payload.gender?.toLowerCase());

  formData.append("address[street]", payload.street ?? "");
  formData.append("address[ward]", payload.ward ?? "");
  formData.append("address[district]", payload.district ?? "");
  formData.append("address[city]", payload.city ?? "");
  formData.append("address[country]", payload.country ?? "");

  if (payload.role === "doctor") {
    appendIfSet("specialty", payload.specialty);
    appendIfSet("workplace", payload.workplace);

    if (payload.yearsOfExperience?.trim()) {
      const years = Number(payload.yearsOfExperience);
      if (Number.isFinite(years) && years >= 0) {
        formData.append("experienceYears", String(years));
      }
    }

    payload.existingVerificationDocuments.forEach((url) => {
      formData.append("existingVerificationDocuments", url);
    });

    payload.newVerificationDocuments.forEach((file) => {
      formData.append("newFilesToUpload", file);
    });
  }

  await api.patch("/users/me", formData);
}
