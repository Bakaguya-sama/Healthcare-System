import { Inject, Injectable, Logger } from '@nestjs/common';
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
  FAMILY_MISSED_TASK_REMINDER_SCAN_PAGE_SIZE,
  getMissedTaskReminderTime,
} from '../../domain/policies/family-reminder.policy';
import { nextQuietHoursTime } from '../../domain/policies/family-companion.policy';

const FAMILY_REMINDER_TIME_ZONE = 'Asia/Ho_Chi_Minh';

@Injectable()
export class ScheduleFamilyReminders {
  private readonly logger = new Logger(ScheduleFamilyReminders.name);

  constructor(
    @Inject(FAMILY_REMINDER_DELIVERY_STORE)
    private readonly reminders: FamilyReminderDeliveryStore,
    @Inject(CARE_TASK_REMINDER_READER)
    private readonly careTaskReader: CareTaskReminderReader,
    @Inject(PATIENT_TASK_REMINDER_OUTBOX)
    private readonly patientReminderOutbox: PatientTaskReminderOutbox,
  ) {}

  async scheduleMissedTaskReminder(
    taskId: string,
    patientId: string,
    now = new Date(),
  ) {
    if (!isObjectId(taskId) || !isObjectId(patientId)) return null;
    const task = await this.careTaskReader.readReminderEligibility({
      taskId,
      patientId,
    });
    if (
      !task ||
      task.taskStatus !== CareTaskStatus.MISSED ||
      !task.required ||
      task.enrollmentStatus !== 'active'
    )
      return null;

    const missedAt = task.missedAt ?? now;
    await this.patientReminderOutbox.scheduleMissedTaskReminder({
      taskId,
      patientId,
      scheduledFor: missedAt,
    });
    const recipients = await this.reminders.listActiveRecipients(
      patientId,
      'missed_task_reminder',
    );
    for (const recipient of recipients) {
      // CareTask is the unit of missed-task lifecycle. A stable key prevents
      // repeated full scans (including legacy tasks without missedAt) from
      // creating another reminder/outbox event on the next calendar day.
      const uniqueKey = `family.missed_task.${recipient.familyLinkId}.${taskId}`;
      await this.reminders.scheduleReminder({
        patientId,
        familyLinkId: recipient.familyLinkId,
        permissionId: recipient.permissionId,
        careTaskId: taskId,
        reminderType: 'missed_task',
        uniqueKey,
        scheduledAt: getMissedTaskReminderTime(missedAt),
        patientTimeZone: FAMILY_REMINDER_TIME_ZONE,
      });
    }
    return { scheduled: recipients.length };
  }

  async scheduleMissedTaskReminders(now = new Date()) {
    const scanStartedAt = new Date(now);
    let afterId: string | undefined;
    let scheduled = 0;
    let failedCandidates = 0;
    let hasMorePages = true;
    while (hasMorePages) {
      const page = await this.careTaskReader.findMissedTaskCandidates({
        afterId,
        missedBefore: scanStartedAt,
        limit: FAMILY_MISSED_TASK_REMINDER_SCAN_PAGE_SIZE,
      });
      for (const task of page.tasks) {
        try {
          const result = await this.scheduleMissedTaskReminder(
            task.taskId,
            task.patientId,
            scanStartedAt,
          );
          scheduled += result?.scheduled ?? 0;
        } catch {
          // A later full scan retries this candidate; do not starve later tasks.
          failedCandidates += 1;
        }
      }
      if (!page.nextCursor) {
        hasMorePages = false;
        continue;
      }
      if (page.nextCursor === afterId)
        throw new Error('Missed Care Task cursor did not advance');
      afterId = page.nextCursor;
    }

    if (failedCandidates > 0)
      this.logger.warn(
        `Missed-task reminder scheduling failed for ${failedCandidates} candidate(s)`,
      );
    return { scheduled, failedCandidates };
  }

  async scheduleWeeklyProgressReminders(now = new Date()) {
    const recipients = await this.reminders.listActiveRecipients(
      undefined,
      'weekly_progress',
    );
    const week = this.weekKey(now);
    let scheduled = 0;
    for (const recipient of recipients) {
      const uniqueKey = `family.weekly_progress.${recipient.familyLinkId}.${week}`;
      await this.reminders.scheduleReminder({
        patientId: recipient.patientId,
        familyLinkId: recipient.familyLinkId,
        permissionId: recipient.permissionId,
        reminderType: 'weekly_progress',
        uniqueKey,
        scheduledAt: nextQuietHoursTime(now),
        patientTimeZone: FAMILY_REMINDER_TIME_ZONE,
      });
      scheduled += 1;
    }
    return { scheduled };
  }

  private weekKey(now: Date) {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return `${date.getUTCFullYear()}-${Math.ceil(((date.getTime() - first.getTime()) / 86_400_000 + first.getUTCDay() + 1) / 7)}`;
  }
}

function isObjectId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}
