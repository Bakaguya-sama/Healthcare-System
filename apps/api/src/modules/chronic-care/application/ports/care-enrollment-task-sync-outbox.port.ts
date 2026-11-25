import type { PatientCareProgramStatus } from '../../domain/entities/patient-care-program.entity';

export const CARE_ENROLLMENT_TASK_SYNC_OUTBOX = Symbol(
  'CARE_ENROLLMENT_TASK_SYNC_OUTBOX',
);

export interface CareEnrollmentTaskSyncOutboxPort {
  enqueue(
    input: {
      enrollmentId: string;
      revision: number;
      status: PatientCareProgramStatus;
    },
    transactionContext: unknown,
  ): Promise<void>;
}
