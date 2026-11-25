import { OutboxStatus } from '../../../../infrastructure/outbox/entities/outbox-event.entity';
import { PatientTaskReminderOutboxAdapter } from './patient-task-reminder-outbox.adapter';

describe('PatientTaskReminderOutboxAdapter', () => {
  function createAdapter(input?: {
    notificationExists?: boolean;
    windowStatus?: OutboxStatus | null;
    missedStatus?: OutboxStatus | null;
  }) {
    const notifications = {
      hasIdempotencyKey: jest
        .fn()
        .mockResolvedValue(input?.notificationExists ?? false),
    };
    const outbox = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      getStatus: jest
        .fn()
        .mockResolvedValueOnce(input?.windowStatus ?? null)
        .mockResolvedValueOnce(input?.missedStatus ?? null),
    };
    return {
      adapter: new PatientTaskReminderOutboxAdapter(
        outbox as never,
        notifications as never,
      ),
      notifications,
      outbox,
    };
  }

  it('reports notification persistence as complete before checking event state', async () => {
    const { adapter, outbox } = createAdapter({ notificationExists: true });

    await expect(adapter.getPatientReminderState('task-id')).resolves.toBe(
      'notified',
    );
    expect(outbox.getStatus).not.toHaveBeenCalled();
  });

  it('keeps the Patient reminder pending while either outbox event is in flight', async () => {
    const { adapter } = createAdapter({
      windowStatus: OutboxStatus.DELIVERED,
      missedStatus: OutboxStatus.PROCESSING,
    });

    await expect(adapter.getPatientReminderState('task-id')).resolves.toBe(
      'pending',
    );
  });

  it('reports a dead Patient reminder so Companion delivery can fail closed', async () => {
    const { adapter } = createAdapter({ missedStatus: OutboxStatus.DEAD });

    await expect(adapter.getPatientReminderState('task-id')).resolves.toBe(
      'dead',
    );
  });

  it('schedules the missed Patient reminder with a task-scoped idempotency key', async () => {
    const { adapter, outbox } = createAdapter();
    const taskId = '507f1f77bcf86cd799439011';
    const patientId = '507f191e810c19729de860ea';
    const scheduledFor = new Date('2026-11-24T00:00:00.000Z');

    await adapter.scheduleMissedTaskReminder({
      taskId,
      patientId,
      scheduledFor,
    });

    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'care.task.missed-reminder.v1',
        idempotencyKey: `care.task.missed-reminder.${taskId}`,
        availableAt: scheduledFor,
      }),
    );
  });
});
