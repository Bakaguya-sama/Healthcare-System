import {
  FAMILY_REMINDER_GRACE_MINUTES,
  nextQuietHoursTime,
} from './family-companion.policy';

export const FAMILY_MISSED_TASK_REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
export const FAMILY_MISSED_TASK_REMINDER_SCAN_PAGE_SIZE = 200;

export function getMissedTaskReminderTime(missedAt: Date) {
  const afterPatientGracePeriod = new Date(
    missedAt.getTime() + FAMILY_REMINDER_GRACE_MINUTES * 60_000,
  );
  return nextQuietHoursTime(afterPatientGracePeriod);
}

export function getNextMissedTaskReminderTime(
  lastDispatchedAt: Date,
  now: Date,
) {
  const nextAllowedAt = new Date(
    lastDispatchedAt.getTime() + FAMILY_MISSED_TASK_REMINDER_WINDOW_MS,
  );
  return nextQuietHoursTime(nextAllowedAt > now ? nextAllowedAt : now);
}
