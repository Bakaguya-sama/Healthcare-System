export const FAMILY_REMINDER_DELIVERY_STORE = Symbol(
  'FAMILY_REMINDER_DELIVERY_STORE',
);

export type FamilyReminderKind = 'missed_task' | 'weekly_progress';
export type FamilyReminderSkipReason =
  | 'task_not_missed'
  | 'enrollment_not_active'
  | 'patient_reminder_not_dispatched'
  | 'link_not_active'
  | 'permission_not_active';

export interface FamilyReminderCandidate {
  id: string;
  patientId: string;
  familyLinkId: string;
  permissionId: string;
  careTaskId?: string;
  reminderType: FamilyReminderKind;
  uniqueKey: string;
  scheduledAt: Date;
  status: 'scheduled' | 'dispatched' | 'skipped';
}

export interface ScheduleFamilyReminderInput {
  patientId: string;
  familyLinkId: string;
  permissionId: string;
  careTaskId?: string;
  reminderType: FamilyReminderKind;
  uniqueKey: string;
  scheduledAt: Date;
  patientTimeZone: string;
}

export type FamilyReminderDispatchResult =
  | { outcome: 'dispatched' }
  | { outcome: 'already_processed' }
  | { outcome: 'skipped'; reason: FamilyReminderSkipReason }
  | { outcome: 'quota_limited'; lastDispatchedAt: Date };

/** Persistence boundary for family reminder scheduling and transactional delivery. */
export interface FamilyReminderDeliveryStore {
  listActiveRecipients(
    patientId: string | undefined,
    permission: 'missed_task_reminder' | 'weekly_progress',
  ): Promise<
    Array<{
      patientId: string;
      familyLinkId: string;
      familyUserId: string;
      permissionId: string;
    }>
  >;
  scheduleReminder(input: ScheduleFamilyReminderInput): Promise<string>;
  findReminder(reminderId: string): Promise<FamilyReminderCandidate | null>;
  skipReminder(
    reminderId: string,
    outboxEventId: string,
    reason: FamilyReminderSkipReason,
  ): Promise<void>;
  deferDispatch(
    reminderId: string,
    outboxEventId: string,
    scheduledAt: Date,
  ): Promise<boolean>;
  dispatchReminder(input: {
    reminderId: string;
    outboxEventId: string;
    now: Date;
    quotaWindowMs: number;
  }): Promise<FamilyReminderDispatchResult>;
}
