export const CARE_ALERT_CONSULTATION_PORT = Symbol(
  'CARE_ALERT_CONSULTATION_PORT',
);

export type CareAlertQuotaPolicy =
  | 'consultation_limit'
  | 'care_program_included';

export interface CareAlertConsultationPort {
  createFromCareAlert(input: {
    careAlertId: string;
    patientCareProgramId: string;
    patientId: string;
    doctorId: string;
    /** Internal, server-derived snapshot. It is never accepted from HTTP input. */
    quotaPolicy: CareAlertQuotaPolicy;
    scheduledStartAt?: Date;
    timezone?: string;
    expectedDurationMinutes: number;
    followUpNote?: string;
    nextAction?: string;
  }): Promise<{ id: string; created: boolean }>;
}
