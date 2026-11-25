import { Injectable } from '@nestjs/common';
import { ClientSession, Types } from 'mongoose';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import type { CareEnrollmentTaskSyncOutboxPort } from '../../application/ports/care-enrollment-task-sync-outbox.port';
import type { PatientCareProgramStatus } from '../../domain/entities/patient-care-program.entity';

@Injectable()
export class OutboxCareEnrollmentTaskSyncAdapter
  implements CareEnrollmentTaskSyncOutboxPort
{
  constructor(private readonly outbox: OutboxService) {}

  async enqueue(
    input: {
      enrollmentId: string;
      revision: number;
      status: PatientCareProgramStatus;
    },
    transactionContext: unknown,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(input.enrollmentId))
      throw new Error('Invalid care enrollment task-sync identity');

    await this.outbox.enqueue(
      {
        eventType: 'care.enrollment.tasks.sync.v1',
        aggregateType: 'patientCareProgram',
        aggregateId: new Types.ObjectId(input.enrollmentId),
        idempotencyKey: `care.enrollment.tasks.sync.${input.enrollmentId}.${input.revision}`,
        payload: {
          eventVersion: 1,
          enrollmentId: input.enrollmentId,
          revision: input.revision,
          status: input.status,
        },
      },
      transactionContext as ClientSession,
    );
  }
}
