import { api } from "@/lib/api";

type ReviewApiResponse = {
  _id: string;
  patientId: PatientProfile;
  doctorId: DoctorProfile;
  doctorSessionId?: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type ConsultationReview = {
  id: string;
  patientId: PatientProfile;
  doctorId: DoctorProfile;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

interface ConsultationApiResponse {
  _id: string;
  patientId: PatientProfile;
  doctorId: DoctorProfile;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  status: "pending" | "active" | "completed" | "rejected";
  patientNotes?: string;
  doctorNotes?: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  lastMessageId?: string;
}

type PatientProfile = {
  _id: string;
  fullName: string;
  avatarUrl?: string;
  email: string;
};

type DoctorProfile = {
  _id: string;
  fullName: string;
  avatarUrl?: string;
  email: string;
};

export interface Consultation {
  id: string;
  patientId: PatientProfile;
  doctorId: DoctorProfile;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  status: "pending" | "active" | "completed" | "rejected";
  patientNotes?: string;
  doctorNotes?: string;
  createdAt: string;
  updatedAt: string;
  review?: ConsultationReview | null;
  lastMessageAt?: string;
  lastMessageId?: string;
}

export async function getConsultations(): Promise<Consultation[]> {
  const res = await api.get<{ data: ConsultationApiResponse[] }>("/sessions");

  return res.data.data.map((item) => ({
    id: item._id,
    patientId: item.patientId,
    doctorId: item.doctorId,
    scheduledAt: item.scheduledAt,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    status: item.status,
    patientNotes: item.patientNotes,
    doctorNotes: item.doctorNotes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastMessageAt: item.lastMessageAt,
    lastMessageId: item.lastMessageId,
  }));
}

export async function getConsultationsEnriched(): Promise<Consultation[]> {
  const consultations = await getConsultations();

  const completedWithReviews = await Promise.all(
    consultations.map(async (consultation) => {
      if (consultation.status === "completed") {
        try {
          const review = await getConsultationReview(consultation.id);
          return { ...consultation, review };
        } catch {
          return consultation;
        }
      }
      return consultation;
    }),
  );

  return completedWithReviews;
}

export async function rejectConsultation(
  sessionId: string,
): Promise<Consultation> {
  const res = await api.post<{ data: ConsultationApiResponse }>(
    `/sessions/${sessionId}/reject`,
  );

  const item = res.data.data;
  return {
    id: item._id,
    patientId: item.patientId,
    doctorId: item.doctorId,
    scheduledAt: item.scheduledAt,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    status: item.status,
    patientNotes: item.patientNotes,
    doctorNotes: item.doctorNotes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function approveConsultation(
  sessionId: string,
): Promise<Consultation> {
  const res = await api.post<{ data: ConsultationApiResponse }>(
    `/sessions/${sessionId}/confirm`,
  );

  const item = res.data.data;
  return {
    id: item._id,
    patientId: item.patientId,
    doctorId: item.doctorId,
    scheduledAt: item.scheduledAt,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    status: item.status,
    patientNotes: item.patientNotes,
    doctorNotes: item.doctorNotes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function completeConsultation(
  sessionId: string,
  doctorNotes?: string,
): Promise<Consultation> {
  const body = doctorNotes ? { doctorNotes } : {};
  const res = await api.post<{ data: ConsultationApiResponse }>(
    `/sessions/${sessionId}/complete`,
    body,
  );

  const item = res.data.data;
  return {
    id: item._id,
    patientId: item.patientId,
    doctorId: item.doctorId,
    scheduledAt: item.scheduledAt,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    status: item.status,
    patientNotes: item.patientNotes,
    doctorNotes: item.doctorNotes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function getConsultationReview(
  sessionId: string,
): Promise<ConsultationReview | null> {
  const res = await api.get<{ data: ReviewApiResponse[] }>(`/reviews`, {
    params: { doctorSessionId: sessionId },
  });

  const list = res.data.data;
  if (!list || list.length === 0) return null;

  const item = list[0];
  return {
    id: item._id,
    patientId: item.patientId,
    doctorId: item.doctorId,
    rating: item.rating,
    comment: item.comment,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
