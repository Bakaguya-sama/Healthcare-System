import { Types } from 'mongoose';
import { CareTaskStatus } from '../../../chronic-care/public-api';
import { FAMILY_MISSED_TASK_REMINDER_SCAN_PAGE_SIZE } from '../../domain/policies/family-reminder.policy';
import { DeliverFamilyReminder } from './deliver-family-reminder.use-case';
import { ScheduleFamilyReminders } from './schedule-family-reminders.use-case';

function makeReminder(overrides: Record<string, unknown> = {}) {
  return {
    id: new Types.ObjectId().toString(),
    patientId: new Types.ObjectId().toString(),
    familyLinkId: new Types.ObjectId().toString(),
    permissionId: new Types.ObjectId().toString(),
    careTaskId: new Types.ObjectId().toString(),
    reminderType: 'missed_task' as const,
    uniqueKey: 'synthetic-reminder',
    scheduledAt: new Date(Date.now() - 60_000),
    status: 'scheduled' as const,
    ...overrides,
  };
}

function makeDependencies(overrides?: {
  reminder?: Record<string, unknown>;
  eligibility?: Record<string, unknown> | null;
  patientReminderDelivered?: boolean;
}) {
  const reminder = makeReminder(overrides?.reminder);
  const store = {
    listActiveRecipients: jest.fn().mockResolvedValue([]),
    scheduleReminder: jest.fn().mockResolvedValue(reminder.id),
    findReminder: jest.fn().mockResolvedValue(reminder),
    skipReminder: jest.fn().mockResolvedValue(undefined),
    deferDispatch: jest.fn().mockResolvedValue(true),
    dispatchReminder: jest.fn().mockResolvedValue({ outcome: 'dispatched' }),
  };
  const reader = {
    readReminderEligibility: jest.fn().mockResolvedValue(
      overrides?.eligibility ?? {
        taskStatus: CareTaskStatus.MISSED,
        required: true,
        missedAt: new Date('2026-11-24T00:00:00.000Z'),
        patientCareProgramId: new Types.ObjectId().toString(),
        enrollmentStatus: 'active',
      },
    ),
    findMissedTaskCandidates: jest.fn(),
  };
  const patientReminderOutbox = {
    scheduleMissedTaskReminder: jest.fn().mockResolvedValue(undefined),
    getPatientReminderState: jest
      .fn()
      .mockResolvedValue(
        overrides?.patientReminderDelivered ? 'notified' : 'pending',
      ),
  };
  return {
    reminder,
    store,
    reader,
    patientReminderOutbox,
    scheduler: new ScheduleFamilyReminders(
      store as never,
      reader as never,
      patientReminderOutbox as never,
    ),
    delivery: new DeliverFamilyReminder(
      store as never,
      reader as never,
      patientReminderOutbox as never,
    ),
  };
}

describe('Family Companion reminder use cases', () => {
  it('fails closed when the enrollment is no longer active at dispatch', async () => {
    const { reminder, store, delivery } = makeDependencies({
      eligibility: {
        taskStatus: CareTaskStatus.MISSED,
        required: true,
        missedAt: new Date(),
        patientCareProgramId: new Types.ObjectId().toString(),
        enrollmentStatus: 'paused',
      },
    });
    const outboxEventId = new Types.ObjectId().toString();
    await delivery.execute(reminder.id, outboxEventId);
    expect(store.skipReminder).toHaveBeenCalledWith(
      reminder.id,
      outboxEventId,
      'enrollment_not_active',
    );
    expect(store.dispatchReminder).not.toHaveBeenCalled();
  });

  it('suppresses a reminder when the task stopped being missed', async () => {
    const { reminder, store, delivery } = makeDependencies({
      eligibility: {
        taskStatus: CareTaskStatus.COMPLETED,
        required: true,
        missedAt: new Date(),
        patientCareProgramId: new Types.ObjectId().toString(),
        enrollmentStatus: 'active',
      },
    });
    const outboxEventId = new Types.ObjectId().toString();
    await delivery.execute(reminder.id, outboxEventId);
    expect(store.skipReminder).toHaveBeenCalledWith(
      reminder.id,
      outboxEventId,
      'task_not_missed',
    );
    expect(store.dispatchReminder).not.toHaveBeenCalled();
  });

  it('defers contact delivery until the Patient reminder outbox event succeeds', async () => {
    const { reminder, store, patientReminderOutbox, delivery } =
      makeDependencies({ patientReminderDelivered: false });
    const outboxEventId = new Types.ObjectId().toString();
    await expect(delivery.execute(reminder.id, outboxEventId)).resolves.toEqual(
      {
        deferred: true,
      },
    );
    expect(patientReminderOutbox.getPatientReminderState).toHaveBeenCalledWith(
      reminder.careTaskId,
    );
    expect(store.deferDispatch).toHaveBeenCalledWith(
      reminder.id,
      outboxEventId,
      expect.any(Date),
    );
    expect(store.dispatchReminder).not.toHaveBeenCalled();
  });

  it('suppresses contact delivery when the Patient reminder is dead-lettered', async () => {
    const { reminder, store, patientReminderOutbox, delivery } =
      makeDependencies();
    patientReminderOutbox.getPatientReminderState.mockResolvedValue('dead');

    const outboxEventId = new Types.ObjectId().toString();
    await delivery.execute(reminder.id, outboxEventId);

    expect(store.skipReminder).toHaveBeenCalledWith(
      reminder.id,
      outboxEventId,
      'patient_reminder_not_dispatched',
    );
    expect(store.dispatchReminder).not.toHaveBeenCalled();
  });

  it('moves a quota-limited reminder to the rolling 24-hour release time', async () => {
    const lastDispatchedAt = new Date(Date.now() - 23 * 60 * 60 * 1000);
    const { reminder, store, delivery } = makeDependencies();
    store.dispatchReminder.mockResolvedValue({
      outcome: 'quota_limited',
      lastDispatchedAt,
    });
    const outboxEventId = new Types.ObjectId().toString();
    await expect(delivery.execute(reminder.id, outboxEventId)).resolves.toEqual(
      {
        deferred: true,
      },
    );
    const retryAt = store.deferDispatch.mock.calls[0][2] as Date;
    expect(retryAt.getTime()).toBeGreaterThanOrEqual(
      lastDispatchedAt.getTime() + 24 * 60 * 60 * 1000,
    );
    expect(store.deferDispatch).toHaveBeenCalledWith(
      reminder.id,
      outboxEventId,
      retryAt,
    );
  });

  it('keyset-pages through every missed task after the 200-task page', async () => {
    const { store, reader, patientReminderOutbox, scheduler } =
      makeDependencies();
    const tasks = Array.from({ length: 205 }, () => ({
      taskId: new Types.ObjectId().toString(),
      patientId: new Types.ObjectId().toString(),
    }));
    reader.findMissedTaskCandidates
      .mockResolvedValueOnce({
        tasks: tasks.slice(0, 200),
        nextCursor: tasks[199].taskId,
      })
      .mockResolvedValueOnce({ tasks: tasks.slice(200), nextCursor: null });
    const scanAt = new Date('2026-11-24T00:00:00.000Z');
    const result = await scheduler.scheduleMissedTaskReminders(scanAt);
    expect(reader.findMissedTaskCandidates).toHaveBeenNthCalledWith(1, {
      afterId: undefined,
      missedBefore: scanAt,
      limit: FAMILY_MISSED_TASK_REMINDER_SCAN_PAGE_SIZE,
    });
    expect(reader.findMissedTaskCandidates).toHaveBeenNthCalledWith(2, {
      afterId: tasks[199].taskId,
      missedBefore: scanAt,
      limit: FAMILY_MISSED_TASK_REMINDER_SCAN_PAGE_SIZE,
    });
    expect(reader.readReminderEligibility).toHaveBeenCalledTimes(205);
    expect(
      patientReminderOutbox.scheduleMissedTaskReminder,
    ).toHaveBeenCalledTimes(205);
    expect(store.listActiveRecipients).toHaveBeenCalledTimes(205);
    expect(result).toEqual({ scheduled: 0, failedCandidates: 0 });
  });

  it('uses a stable reminder key for legacy missed tasks without missedAt', async () => {
    const { store, reader, scheduler } = makeDependencies();
    reader.readReminderEligibility.mockResolvedValue({
      taskStatus: CareTaskStatus.MISSED,
      required: true,
      missedAt: null,
      patientCareProgramId: new Types.ObjectId().toString(),
      enrollmentStatus: 'active',
    });
    store.listActiveRecipients.mockResolvedValue([
      {
        patientId: new Types.ObjectId().toString(),
        familyLinkId: new Types.ObjectId().toString(),
        familyUserId: new Types.ObjectId().toString(),
        permissionId: new Types.ObjectId().toString(),
      },
    ]);
    const taskId = new Types.ObjectId().toString();
    const patientId = new Types.ObjectId().toString();

    await scheduler.scheduleMissedTaskReminder(
      taskId,
      patientId,
      new Date('2026-11-24T00:00:00.000Z'),
    );
    await scheduler.scheduleMissedTaskReminder(
      taskId,
      patientId,
      new Date('2026-11-25T00:00:00.000Z'),
    );

    const keys = store.scheduleReminder.mock.calls.map(
      ([input]) => input.uniqueKey,
    );
    expect(keys[0]).toBe(keys[1]);
  });
});
