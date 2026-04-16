import { api } from "@/lib/api";

export type VerificationFile = {
  name: string;
  url: string;
  type: "pdf" | "jpg" | "jpeg" | "png";
  size: number;
};

export type VerificationStatus = "pending" | "approved" | "rejected";

export type DoctorApplicationQuery = {
  status?: VerificationStatus;
  page?: number;
  limit?: number;
  search?: string;
};

export type DocumentItemReceiver = {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  experience: string;
  workplace: string;
  sent_at: string;
  status: VerificationStatus;
  verificationFiles: VerificationFile[];
  rejectionReason?: string;
};

type User = {
  _id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
};

type ApiDoctor = {
  _id: string;
  userId: User;
  specialty?: string;
  workplace?: string;
  verificationDocuments?: string[];
  experienceYears?: number;
  verificationStatus: VerificationStatus;
  rejectReason?: string;
  createdAt: string;
};

type ApiDoctorApplicationsResponse = {
  data: ApiDoctor[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
};

export interface DoctorDocumentList {
  doctorDocumentList: DocumentItemReceiver[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

function resolveJoinedDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mapApitoUi(item: ApiDoctor): DocumentItemReceiver | null {
  if (!item._id || !item.userId._id) return null;

  return {
    id: item.userId._id,
    name: item.userId.fullName,
    email: item.userId.email,
    phone: item.userId.phoneNumber ?? "",
    specialty: item.specialty ?? "",
    experience:
      item.experienceYears != null ? `${item.experienceYears} years` : "",
    workplace: item.workplace ?? "",
    sent_at: resolveJoinedDate(item.createdAt),
    status: item.verificationStatus,
    verificationFiles: (item.verificationDocuments ?? []).map((url) => {
      const normalizedUrl = String(url);
      const fileName = normalizedUrl.split("/").pop() ?? "document";
      const extension = fileName.split(".").pop()?.toLowerCase();
      const type: VerificationFile["type"] =
        extension === "jpg" || extension === "jpeg" || extension === "png"
          ? extension
          : "pdf";

      return {
        name: fileName,
        url: normalizedUrl,
        type,
        size: 0,
      };
    }),
    rejectionReason: item.rejectReason,
  };
}

export async function getDoctorDocuments(
  query: DoctorApplicationQuery = {},
): Promise<DoctorDocumentList> {
  const doctorDocumentResponse = await api.get<ApiDoctorApplicationsResponse>(
    "/admin/doctors/applications",
    {
      params: {
        status: query.status,
        page: query.page,
        limit: query.limit,
        search: query.search,
      },
    },
  );

  return {
    doctorDocumentList: doctorDocumentResponse.data.data
      .map(mapApitoUi)
      .filter((item): item is DocumentItemReceiver => item !== null),
    pagination: doctorDocumentResponse.data.pagination,
    summary: doctorDocumentResponse.data.summary,
  };
}

export async function approveDoctorDocument(id: string) {
  const response = await api.post(`/admin/doctors/${id}/verify`, {});
  return response.data;
}

export async function rejectDoctorDocument(id: string, reason: string) {
  const response = await api.post(`/admin/doctors/${id}/reject`, {
    reason,
  });
  return response.data;
}
