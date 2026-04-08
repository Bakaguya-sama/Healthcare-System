import { api } from "@/lib/api";
export type ReportType =
  | "harassment"
  | "spam"
  | "misinformation"
  | "inappropriate_content"
  | "impersonation"
  | "fraud"
  | "ai_hallucination"
  | "other";

export type ReportStatus = "pending" | "resolved";

type ApiObject = {
  _id: string;
  email: string;
  fullName: string;
};

type ApiReportItem = {
  _id: string;
  reporterId: ApiObject;
  reportedUserId: ApiObject;
  reportType: ReportType;
  reason: string;
  status: ReportStatus;
  createdAt: string;
};

export type ApiReportReceive = {
  id: string;
  reportedUserId: string;
  reporterName: string;
  reportedAccount: string;
  reportType: ReportType;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  accountStatus: "active" | "banned";
};

type ApiReportListResponse = {
  data: ApiReportItem[];
  total: number;
  page: number;
  limit: number;
};

export interface ApiChangeReportStatus {
  id: string;
  status: ReportStatus;
}

export interface ReportListReceiver {
  reportListReceiver: ApiReportReceive[];
  total: number;
  page: number;
  limit: number;
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

function mapApitoUI(item: ApiReportItem): ApiReportReceive | null {
  if (!item._id) return null;

  return {
    id: item._id,
    reportedUserId: item.reportedUserId?._id ?? "",
    reporterName: item.reporterId?.fullName ?? "Unknown",
    reportedAccount: item.reportedUserId?.fullName ?? "Unknown",
    reportType: item.reportType,
    reason: item.reason,
    status: item.status,
    createdAt: resolveJoinedDate(item.createdAt),
    accountStatus: "active", //???
  };
}

export async function getReportList(): Promise<ReportListReceiver> {
  const reportResponse = await api.get<ApiReportListResponse>("/violations");
  const reportListReceiver = reportResponse.data.data
    .map(mapApitoUI)
    .filter((item): item is ApiReportReceive => item !== null);

  return {
    reportListReceiver,
    total: reportResponse.data.total,
    page: reportResponse.data.page,
    limit: reportResponse.data.limit,
  };
}

export async function changeReportStatus(payload: ApiChangeReportStatus) {
  const reportChangeStatusResponse = await api.patch(
    `/violations/${payload.id}`,
    {
      status: payload.status,
    },
  );

  return reportChangeStatusResponse.data;
}
