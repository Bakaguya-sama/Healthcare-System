export const CARE_ALERT_CONSULTATION_PORT = Symbol('CARE_ALERT_CONSULTATION_PORT');

export interface CareAlertConsultationPort {
  createFromCareAlert(input: {
    careAlertId: string;
    patientCareProgramId: string;
    patientId: string;
    doctorId: string;
    scheduledStartAt?: Date;
    timezone?: string;
    expectedDurationMinutes: number;
    followUpNote?: string;
    nextAction?: string;
  }): Promise<{ id: string; created: boolean }>;
}
