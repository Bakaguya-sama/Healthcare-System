import { api } from "@/lib/api";
import { type AppRole } from "@repo/ui/types/auth";

// Moved from doctor-sign-up.tsx
export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  filename: string;
  format: string;
  size: number;
  uploadedAt: Date;
}

// Moved from doctor-sign-up.tsx
export type UploadableFile = {
  originalname: string;
  mimetype?: string;
  buffer: Buffer;
  size: number;
  fileType: string;
};

export interface SignUpPatient {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
}

export interface SignUpDoctor {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  specialty: string;
  workplace: string;
  experienceYears: number;
  newVerificationDocuments: File[]; // Files to upload
  existingVerificationDocuments: string[]; // Secure URLs of files to keep
}

// Moved from doctor-sign-up.tsx
export type DoctorVerificationStatus = "rejected" | "pending" | "approved";

// Moved from doctor-sign-up.tsx
export type DoctorReRegisterPrefillApiResponse = {
  email?: string;
  phone?: string; // Legacy field
  phoneNumber?: string;
  fullName?: string;
  specialty?: string;
  workplace?: string;
  yearsOfExperience?: string | number | null; // Legacy field
  experienceYears?: string | number | null;
  verificationStatus?: DoctorVerificationStatus;
  verification_status?: DoctorVerificationStatus; // Legacy field
  rejectReason?: string | null;
  reason?: string | null; // Legacy field
  verificationDocuments?: string[]; // Array of secureUrls
};

type ApiUserSignUpResponse = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
};

export type ApiSignUpResponse = {
  accessToken: string;
  refreshToken: string;
  user: ApiUserSignUpResponse;
};

export async function submitSignUpPatient(
  payload: SignUpPatient,
): Promise<ApiSignUpResponse> {
  const res = await api.post("/auth/register", {
    email: payload.email,
    password: payload.password,
    fullName: payload.fullName,
    role: "patient",
  });

  return res.data;
}

export async function fetchDoctorPrefillData(
  email: string,
): Promise<DoctorReRegisterPrefillApiResponse> {
  const res = await api.get(`/users/doctor/${encodeURIComponent(email)}`);
  return res.data;
}

export async function submitSignUpDoctor(
  payload: SignUpDoctor,
): Promise<ApiSignUpResponse> {
  console.log(payload);
  const formData = new FormData();

  // Append text fields
  formData.append("email", payload.email);
  formData.append("password", payload.password);
  formData.append("fullName", payload.fullName);
  formData.append("phoneNumber", payload.phoneNumber);
  formData.append("role", "doctor");
  formData.append("specialty", payload.specialty);
  formData.append("workplace", payload.workplace);
  formData.append("experienceYears", payload.experienceYears.toString());

  // Append files
  for (const file of payload.newVerificationDocuments) {
    formData.append("newFilesToUpload", file); // Changed key to avoid conflict with DTO
  }

  // Append existing file URLs to keep
  for (const url of payload.existingVerificationDocuments) {
    formData.append("existingVerificationDocuments", url);
  }

  const res = await api.post("/auth/register", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}
