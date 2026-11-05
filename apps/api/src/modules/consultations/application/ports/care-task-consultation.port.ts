import type { ClientSession } from 'mongoose';

export const CARE_TASK_CONSULTATION_PORT = Symbol(
  'CARE_TASK_CONSULTATION_PORT',
);

export interface CareTaskConsultationPort {
  linkCareTask(input: {
    consultationId: string;
    careTaskId: string;
    patientId: string;
    doctorId: string;
    session: ClientSession;
  }): Promise<{ consultationId: string }>;
}
