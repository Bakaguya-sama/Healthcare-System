import type { CareTaskStatus } from '../../domain/entities/care-task.entity';
import type { PatientCareProgramStatus } from '../../domain/entities/patient-care-program.entity';

export const CARE_TASK_REMINDER_READER = Symbol('CARE_TASK_REMINDER_READER');

export interface MissedCareTaskCandidate {
  taskId: string;
  patientId: string;
}

export interface MissedCareTaskCandidatePage {
  tasks: MissedCareTaskCandidate[];
  nextCursor: string | null;
}

export interface CareTaskReminderEligibility {
  taskStatus: CareTaskStatus;
  required: boolean;
  missedAt: Date | null;
  patientCareProgramId: string;
  enrollmentStatus: PatientCareProgramStatus | null;
}

/** Public application query used by reminder workflows outside Chronic Care. */
export interface CareTaskReminderReader {
  findMissedTaskCandidates(input: {
    afterId?: string;
    missedBefore: Date;
    limit: number;
  }): Promise<MissedCareTaskCandidatePage>;
  readReminderEligibility(input: {
    taskId: string;
    patientId: string;
  }): Promise<CareTaskReminderEligibility | null>;
}
