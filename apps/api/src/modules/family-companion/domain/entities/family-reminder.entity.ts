export type FamilyReminderType = 'missed_task' | 'weekly_progress';
export type FamilyReminderStatus = 'scheduled' | 'dispatched' | 'skipped';

export interface FamilyReminderSchedule {
  reminderType: FamilyReminderType;
  scheduledAt: Date;
  patientTimeZone: string;
  uniqueKey: string;
}
