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

export interface ApiCreateReport {
  reportedUserId: string;
  reportType: ReportType;
  reason: string;
}

export async function createReport(payload: ApiCreateReport) {
  const submitReport = await api.post(`violations`, {
    reported_user_id: payload.reportedUserId,
    report_type: payload.reportType,
    reason: payload.reason,
  });

  return submitReport.data;
}
