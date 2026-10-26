export const CARE_REPORT_PORT = Symbol('CARE_REPORT_PORT');

export type CareReportItem = {
  id: string;
  careAlertId?: string;
  sessionStatus: string;
  requestedAt: Date;
  completedAt?: Date;
  followUpAt?: Date;
};

export interface CareReportPort {
  listForCareReport(input: {
    patientCareProgramId: string;
    patientId: string;
    from: Date;
    to: Date;
    updatedUntil: Date;
    limit: number;
  }): Promise<{ items: CareReportItem[]; truncated: boolean }>;
}
