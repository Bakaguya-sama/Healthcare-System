import { api } from "@/lib/api";

type UserRole = "admin" | "patient" | "doctor";
type AccountStatus = "active" | "banned";

export interface Profile {
  userInformation: UserInformation;
}

export type ApiUser = {
  id: string;
};

export type UserInformation = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  gender: string;
  account_status: AccountStatus;
  created_at: string;
  address_display: string;
  role: UserRole;
  avatar_url?: string;
  reports?: ProfileReport[];
  doctor_reviews?: DoctorReview[];
  doctor_review_metrics?: DoctorReviewMetrics;
  role_specific?: DoctorRoleSpecific;
};

export type ProfileReport = {
  id: string;
  reason: string;
  date: string;
  resolved: boolean;
};

export type DoctorReview = {
  id: string;
  reviewer_name: string;
  reviewer_avatar_initials?: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type DoctorReviewMetrics = {
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<number, number>; // { 5: 4, 4: 1, 3: 0, 2: 0, 1: 0 }
};

export type DoctorRoleSpecific = {
  specialty?: string;
  workplace?: string;
  experience_years?: number;
  verified_at?: string;
  verification_status?: "pending" | "approved" | "rejected";
  admin_role?: "super_admin" | "user_admin" | "ai_admin";
};

type ApiProfileResponse = UserInformation;

export async function getProfile(payload: ApiUser) {
  const userInformationResponse = await api.get<ApiProfileResponse>(
    `/users/${payload.id}/profile`,
  );

  return {
    userInformation: userInformationResponse.data,
  } as Profile;
}
