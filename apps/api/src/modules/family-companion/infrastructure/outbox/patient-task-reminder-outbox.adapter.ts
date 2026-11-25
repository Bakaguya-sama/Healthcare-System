import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import { OutboxStatus } from '../../../../infrastructure/outbox/entities/outbox-event.entity';
import { NotificationsService } from '../../../notifications/public-api';
import type {
  PatientTaskReminderOutbox,
  PatientTaskReminderState,
} from '../../application/ports/patient-task-reminder-outbox.port';

@Injectable()
export class PatientTaskReminderOutboxAdapter implements PatientTaskReminderOutbox {
  constructor(
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
  ) {}

  async scheduleMissedTaskReminder(input: {
    taskId: string;
    patientId: string;
    scheduledFor: Date;
  }) {
    if ((await this.getPatientReminderState(input.taskId)) === 'notified')
      return;
    await this.outbox.enqueue({
      eventType: 'care.task.missed-reminder.v1',
      aggregateType: 'careTask',
      aggregateId: new Types.ObjectId(input.taskId),
      idempotencyKey: `care.task.missed-reminder.${input.taskId}`,
      availableAt: input.scheduledFor,
      payload: {
        taskId: input.taskId,
        patientId: input.patientId,
        scheduledFor: input.scheduledFor.toISOString(),
      },
    });
  }

  async getPatientReminderState(
    taskId: string,
  ): Promise<PatientTaskReminderState> {
    const [windowReminder, missedReminder] = await Promise.all([
      this.notifications.hasIdempotencyKey(`care.task.reminder.${taskId}`),
      this.notifications.hasIdempotencyKey(
        `care.task.missed-reminder.${taskId}`,
      ),
    ]);
    if (windowReminder || missedReminder) return 'notified';

    const [windowEvent, missedEvent] = await Promise.all([
      this.outbox.getStatus(`care.task.reminder.${taskId}`),
      this.outbox.getStatus(`care.task.missed-reminder.${taskId}`),
    ]);

    const statuses = [windowEvent, missedEvent].filter(
      (status): status is OutboxStatus => status !== null,
    );
    if (
      statuses.includes(OutboxStatus.PENDING) ||
      statuses.includes(OutboxStatus.PROCESSING)
    )
      return 'pending';
    if (statuses.includes(OutboxStatus.DEAD)) return 'dead';
    if (statuses.includes(OutboxStatus.DELIVERED))
      return 'delivered_without_notification';
    return 'not_scheduled';
  }
}
