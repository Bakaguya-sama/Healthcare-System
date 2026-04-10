import { api } from "@/lib/api";

export type UserRole = "admin" | "patient" | "doctor";

type GenderValue = "male" | "female" | "other" | string;

type AdminRole = "super_admin" | "user_admin" | "ai_admin";

type DoctorVerificationStatus = "approved" | "pending" | "rejected";

export interface ProfileDataReceiver {
  id: string;
  isOnline: boolean;
  avatarUrl?: string;
  fullName: string;
  role: UserRole;
  email: string;
  phone: string;
  gender: string;
  street: string;
  ward: string;
  district: string;
  city: string;
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
  address?: ApiAddress;
  __v?: number;
  createdAt?: string;
  updatedAt?: string;
  doctorProfile?: ApiDoctorProfile | null;
  adminProfile?: ApiAdminProfile | null;
};

type UpdateMyProfilePayload = {
  fullName: string;
  phoneNumber: string;
  gender: string;
  avatarUrl?: string;
  address: {
    street: string;
    ward: string;
    district: string;
    city: string;
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

export function mapApiProfileToUiProfile(
  payload: UserProfileResponse,
): ProfileDataReceiver {
  const doctorProfile = payload.doctorProfile ?? null;
  const adminProfile = payload.adminProfile ?? null;

  return {
    id: payload._id,
    isOnline: Boolean(payload.isOnline),
    avatarUrl: payload.avatarUrl,
    fullName: payload.fullName ?? "",
    role: payload.role,
    email: payload.email ?? "",
    phone: payload.phoneNumber ?? "",
    gender: normalizeGender(payload.gender),
    street: payload.address?.street ?? "",
    ward: payload.address?.ward ?? "",
    district: payload.address?.district ?? "",
    city: payload.address?.city ?? "",
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

export async function updateMyProfile(payload: ProfileDataReceiver) {
  const body: UpdateMyProfilePayload = {
    fullName: payload.fullName,
    phoneNumber: payload.phone,
    gender: payload.gender.toLowerCase(),
    avatarUrl: payload.avatarUrl,
    address: {
      street: payload.street,
      ward: payload.ward,
      district: payload.district,
      city: payload.city,
    },
  };

  await api.patch("/users/me", body);
}
