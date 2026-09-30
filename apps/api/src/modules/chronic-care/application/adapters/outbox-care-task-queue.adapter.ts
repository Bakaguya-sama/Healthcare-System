import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import type { CareTaskQueue } from '../ports/care-task-queue.port';

@Injectable()
export class OutboxCareTaskQueue implements CareTaskQueue {
  constructor(private readonly outbox: OutboxService) {}

  async enqueue(input: {
    taskId: string;
    patientId: string;
    scheduledFor: Date;
  }) {
    await this.outbox.enqueue({
      eventType: 'care.task.reminder',
      aggregateType: 'careTask',
      aggregateId: new Types.ObjectId(input.taskId),
      idempotencyKey: `care.task.reminder.${input.taskId}`,
      payload: {
        taskId: input.taskId,
        patientId: input.patientId,
        scheduledFor: input.scheduledFor.toISOString(),
      },
    });
  }
}
