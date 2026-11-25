import { Inject, Injectable } from '@nestjs/common';
import {
  CARE_TASK_REMINDER_READER,
  CareTaskStatus,
} from '../../../chronic-care/public-api';
import type { CareTaskReminderReader } from '../../../chronic-care/public-api';
import type { PatientTaskReminderOutbox } from '../ports/patient-task-reminder-outbox.port';
import { PATIENT_TASK_REMINDER_OUTBOX } from '../ports/patient-task-reminder-outbox.port';
import { FAMILY_REMINDER_DELIVERY_STORE } from '../ports/family-reminder-delivery.store';
import type { FamilyReminderDeliveryStore } from '../ports/family-reminder-delivery.store';
import {
  FAMILY_MISSED_TASK_REMINDER_WINDOW_MS,
  getNextMissedTaskReminderTime,
} from '../../domain/policies/family-reminder.policy';
import { nextQuietHoursTime } from '../../domain/policies/family-companion.policy';

@Injectable()
export class DeliverFamilyReminder {
  constructor(
    @Inject(FAMILY_REMINDER_DELIVERY_STORE)
    private readonly reminders: FamilyReminderDeliveryStore,
    @Inject(CARE_TASK_REMINDER_READER)
    private readonly careTaskReader: CareTaskReminderReader,
    @Inject(PATIENT_TASK_REMINDER_OUTBOX)
    private readonly patientReminderOutbox: PatientTaskReminderOutbox,
  ) {}

  async execute(
    reminderId: string,
    outboxEventId: string,
  ): Promise<{ deferred: true } | { acknowledged: true } | void> {
    const reminder = await this.reminders.findReminder(reminderId);
    if (!reminder || reminder.status !== 'scheduled') return;
    const now = new Date();
    if (reminder.scheduledAt > now) {
      return this.defer(reminder.id, outboxEventId, reminder.scheduledAt);
    }

    if (reminder.reminderType === 'missed_task') {
      if (!reminder.careTaskId) {
        await this.reminders.skipReminder(
          reminder.id,
          outboxEventId,
          'task_not_missed',
        );
        return { acknowledged: true };
      }
      const eligibility = await this.careTaskReader.readReminderEligibility({
        taskId: reminder.careTaskId,
        patientId: reminder.patientId,
      });
      if (
        !eligibility ||
        eligibility.taskStatus !== CareTaskStatus.MISSED ||
        !eligibility.required
      ) {
        await this.reminders.skipReminder(
          reminder.id,
          outboxEventId,
          'task_not_missed',
        );
        return { acknowledged: true };
      }
      if (eligibility.enrollmentStatus !== 'active') {
        await this.reminders.skipReminder(
          reminder.id,
          outboxEventId,
          'enrollment_not_active',
        );
        return { acknowledged: true };
      }
      const patientReminderState =
        await this.patientReminderOutbox.getPatientReminderState(
          reminder.careTaskId,
        );
      if (patientReminderState !== 'notified') {
        if (
          patientReminderState === 'dead' ||
          patientReminderState === 'delivered_without_notification'
        ) {
          await this.reminders.skipReminder(
            reminder.id,
            outboxEventId,
            'patient_reminder_not_dispatched',
          );
          return { acknowledged: true };
        }
        return this.defer(
          reminder.id,
          outboxEventId,
          nextQuietHoursTime(new Date(now.getTime() + 60_000)),
        );
      }
    }

    const allowedTime = nextQuietHoursTime(now);
    if (allowedTime.getTime() > now.getTime())
      return this.defer(reminder.id, outboxEventId, allowedTime);

    const result = await this.reminders.dispatchReminder({
      reminderId: reminder.id,
      outboxEventId,
      now,
      quotaWindowMs: FAMILY_MISSED_TASK_REMINDER_WINDOW_MS,
    });
    if (result.outcome === 'dispatched' || result.outcome === 'skipped')
      return { acknowledged: true };
    if (result.outcome === 'quota_limited')
      return this.defer(
        reminder.id,
        outboxEventId,
        getNextMissedTaskReminderTime(result.lastDispatchedAt, now),
      );
  }

  private async defer(
    reminderId: string,
    outboxEventId: string,
    scheduledAt: Date,
  ) {
    const deferred = await this.reminders.deferDispatch(
      reminderId,
      outboxEventId,
      scheduledAt,
    );
    return deferred ? ({ deferred: true } as const) : undefined;
  }
}
