import { api } from "@/lib/api";

export const doctorSpecialty = [
  { id: "general_practitioner", name: "General Practitioner" },
  { id: "internal_medicine", name: "Internal Medicine" },
  { id: "cardiology", name: "Cardiology" },
  { id: "dermatology", name: "Dermatology" },
  { id: "neurology", name: "Neurology" },
  { id: "orthopedics", name: "Orthopedics" },
  { id: "pediatrics", name: "Pediatrics" },
  { id: "obstetrics_gynecology", name: "Obstetrics & Gynecology" },
  { id: "ophthalmology", name: "Ophthalmology" },
  { id: "ent", name: "Ear, Nose, and Throat (ENT)" },
  { id: "psychiatry", name: "Psychiatry" },
  { id: "radiology", name: "Radiology" },
  { id: "anesthesiology", name: "Anesthesiology" },
  { id: "emergency_medicine", name: "Emergency Medicine" },
  { id: "family_medicine", name: "Family Medicine" },
  { id: "endocrinology", name: "Endocrinology" },
  { id: "gastroenterology", name: "Gastroenterology" },
  { id: "hematology", name: "Hematology" },
  { id: "nephrology", name: "Nephrology" },
  { id: "oncology", name: "Oncology" },
  { id: "pulmonology", name: "Pulmonology" },
  { id: "urology", name: "Urology" },
  { id: "rheumatology", name: "Rheumatology" },
  { id: "infectious_disease", name: "Infectious Disease" },
  { id: "plastic_surgery", name: "Plastic Surgery" },
  { id: "general_surgery", name: "General Surgery" },
  { id: "neurosurgery", name: "Neurosurgery" },
  { id: "cardiothoracic_surgery", name: "Cardiothoracic Surgery" },
  { id: "rehabilitation", name: "Physical Medicine & Rehabilitation" },
  { id: "sports_medicine", name: "Sports Medicine" },
  { id: "allergy_immunology", name: "Allergy & Immunology" },
  { id: "geriatrics", name: "Geriatrics" },
  { id: "preventive_medicine", name: "Preventive Medicine" },
];

export type DoctorItem = {
  id: string;
  fullName: string;
  yearsOfExperience: number;
  isOnline: boolean;
  avatarUrl?: string;
  specialty: string;
  specialtyId: string;
  workplace: string;
  averageRating: string;
  totalReview: number;
};

type ApiDoctor = {
  _id?: string;
  id?: string;
  fullName?: string;
  avatarUrl?: string;
  isOnline?: boolean;
  specialty?: string;
  workplace?: string;
  experienceYears?: number;
  averageRating?: number;
  reviewCount?: number;
  accountStatus?: "active" | "banned";
};

function resolveSpecialtyId(specialty?: string): string {
  if (!specialty) {
    return "general_practitioner";
  }

  const directMatch = doctorSpecialty.find((item) => item.id === specialty);
  if (directMatch) {
    return directMatch.id;
  }

  const nameMatch = doctorSpecialty.find(
    (item) => item.name.toLowerCase() === specialty.toLowerCase(),
  );

  return nameMatch?.id ?? "general_practitioner";
}

function mapDoctor(item: ApiDoctor): DoctorItem {
  const specialtyName =
    item.specialty ||
    doctorSpecialty.find((spec) => spec.id === resolveSpecialtyId(""))?.name ||
    "General Practitioner";

  const specialtyId = resolveSpecialtyId(item.specialty || specialtyName);

  return {
    id: item._id || item.id || "",
    fullName: item.fullName || "Unknown Doctor",
    yearsOfExperience: item.experienceYears ?? 0,
    isOnline: Boolean(item.isOnline),
    avatarUrl: item.avatarUrl,
    specialty: item.specialty || specialtyName,
    specialtyId,
    workplace: item.workplace || "Unknown workplace",
    averageRating: (item.averageRating ?? 0).toFixed(1),
    totalReview: item.reviewCount ?? 0,
  };
}

export async function getDoctors(): Promise<DoctorItem[]> {
  const response = await api.get<ApiDoctor[]>("/users/doctors");
  const items = response.data || [];

  return items
    .filter((item) => item.accountStatus !== "banned")
    .map(mapDoctor)
    .filter((doctor) => doctor.id);
}

type CreateSessionPayload = {
  doctorId: string;
  scheduledAt: string;
  patientNotes?: string;
};

type SessionResponse = {
  statusCode: number;
  message: string;
  data: {
    _id: string;
  };
};

export async function createSession(payload: CreateSessionPayload) {
  const response = await api.post<SessionResponse>("/sessions", payload);
  return response.data;
}

export type SessionStatus = "pending" | "active" | "completed" | "rejected";

type SessionQuery = {
  status?: SessionStatus;
  doctorId?: string;
  patientId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 1 | -1;
};

type ApiSessionDoctor = {
  _id?: string;
  id?: string;
};

type ApiSession = {
  _id: string;
  doctorId?: string | ApiSessionDoctor | null;
  status?: SessionStatus;
};

type SessionsResponse = {
  statusCode: number;
  message: string;
  data: ApiSession[];
};

export async function getSessions(query: SessionQuery = {}) {
  const response = await api.get<SessionsResponse>("/sessions", {
    params: query,
  });

  return response.data;
}
