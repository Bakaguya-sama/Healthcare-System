export const CARE_REPORT_CONSULTATION = Symbol('CARE_REPORT_CONSULTATION');

export type CareReportConsultationItem = {
  id: string;
  careAlertId?: string;
  sessionStatus: string;
  requestedAt: Date;
  completedAt?: Date;
  followUpAt?: Date;
};

export interface CareReportConsultationPort {
  listForCareReport(input: {
    patientCareProgramId: string;
    patientId: string;
    from: Date;
    to: Date;
    updatedUntil: Date;
    limit: number;
  }): Promise<{ items: CareReportConsultationItem[]; truncated: boolean }>;
}
