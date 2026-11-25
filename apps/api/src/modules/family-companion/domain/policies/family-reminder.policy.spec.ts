import {
  FAMILY_MISSED_TASK_REMINDER_WINDOW_MS,
  getMissedTaskReminderTime,
  getNextMissedTaskReminderTime,
} from './family-reminder.policy';

describe('family reminder policy', () => {
  it('schedules a companion reminder no earlier than 60 minutes after Patient reminder time', () => {
    const missedAt = new Date('2026-11-24T01:00:00.000Z');
    expect(getMissedTaskReminderTime(missedAt).getTime()).toBe(
      missedAt.getTime() + 60 * 60 * 1000,
    );
  });

  it('uses a rolling 24-hour window from the last successful dispatch', () => {
    const lastDispatch = new Date('2026-11-23T12:45:00.000Z');
    const nextAllowed = getNextMissedTaskReminderTime(
      lastDispatch,
      new Date('2026-11-24T12:00:00.000Z'),
    );
    expect(nextAllowed.toISOString()).toBe('2026-11-24T12:45:00.000Z');
    expect(nextAllowed.getTime() - lastDispatch.getTime()).toBe(
      FAMILY_MISSED_TASK_REMINDER_WINDOW_MS,
    );
  });

  it('moves a quota retry out of quiet hours using the canonical timezone', () => {
    const nextAllowed = getNextMissedTaskReminderTime(
      new Date('2026-11-23T14:30:00.000Z'), // 21:30 in Ho Chi Minh City
      new Date('2026-11-24T12:00:00.000Z'),
    );
    expect(nextAllowed.toISOString()).toBe('2026-11-25T01:00:00.000Z');
  });
});
