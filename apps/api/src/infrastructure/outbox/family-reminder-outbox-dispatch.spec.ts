import { Types } from 'mongoose';
import { OutboxWorkerService } from './outbox-worker.service';

function makeWorker(input: {
  enabled: boolean;
  result?: { deferred: true } | { acknowledged: true } | void;
}) {
  const event = {
    _id: new Types.ObjectId(),
    eventType: 'family.reminder.dispatch.v1',
    payload: { familyReminderId: new Types.ObjectId().toString() },
  };
  const outbox = {
    getProcessing: jest.fn().mockResolvedValue(event),
    deferUntil: jest.fn().mockResolvedValue(undefined),
    markDelivered: jest.fn().mockResolvedValue(undefined),
    recordAttemptFailure: jest.fn().mockResolvedValue(undefined),
  };
  const delivery = {
    execute: jest.fn().mockResolvedValue(input.result),
  };
  const worker = new OutboxWorkerService(
    {
      get: (key: string) => key === 'FAMILY_COMPANION_ENABLED' && input.enabled,
    } as never,
    outbox as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  (
    worker as unknown as { familyReminderDelivery: typeof delivery }
  ).familyReminderDelivery = delivery;
  return { worker, event, outbox, delivery };
}

describe('family reminder outbox dispatch', () => {
  it('keeps the event pending when the feature kill switch is off', async () => {
    const { worker, event, outbox, delivery } = makeWorker({ enabled: false });
    await (worker as any).deliverEvent(String(event._id), 0, 8);
    expect(outbox.deferUntil).toHaveBeenCalledWith(event._id, expect.any(Date));
    expect(delivery.execute).not.toHaveBeenCalled();
    expect(outbox.markDelivered).not.toHaveBeenCalled();
  });

  it('does not acknowledge a rescheduled event because reminder and outbox were deferred atomically', async () => {
    const { worker, event, outbox, delivery } = makeWorker({
      enabled: true,
      result: { deferred: true },
    });
    await (worker as any).deliverEvent(String(event._id), 0, 8);
    expect(delivery.execute).toHaveBeenCalledWith(
      event.payload.familyReminderId,
      String(event._id),
    );
    expect(outbox.deferUntil).not.toHaveBeenCalled();
    expect(outbox.markDelivered).not.toHaveBeenCalled();
  });

  it('does not acknowledge a dispatched reminder twice after the delivery transaction committed it', async () => {
    const { worker, event, outbox } = makeWorker({
      enabled: true,
      result: { acknowledged: true },
    });

    await (worker as any).deliverEvent(String(event._id), 0, 8);

    expect(outbox.markDelivered).not.toHaveBeenCalled();
  });

  it('acknowledges an already dispatched or suppressed reminder', async () => {
    const { worker, event, outbox } = makeWorker({ enabled: true });
    await (worker as any).deliverEvent(String(event._id), 0, 8);
    expect(outbox.markDelivered).toHaveBeenCalledWith(event._id);
  });

  it('sends a Patient missed-task reminder through Chronic Care before Companion delivery', async () => {
    const eventId = new Types.ObjectId();
    const taskId = new Types.ObjectId().toString();
    const patientId = new Types.ObjectId().toString();
    const outbox = {
      getProcessing: jest.fn().mockResolvedValue({
        _id: eventId,
        eventType: 'care.task.missed-reminder.v1',
        payload: {
          taskId,
          patientId,
          scheduledFor: new Date(Date.now() - 1_000).toISOString(),
        },
      }),
      markDelivered: jest.fn().mockResolvedValue(undefined),
      recordAttemptFailure: jest.fn().mockResolvedValue(undefined),
    };
    const notifications = {
      hasIdempotencyKey: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const careTaskReminders = {
      shouldNotifyMissed: jest.fn().mockResolvedValue(true),
    };
    const worker = new OutboxWorkerService(
      {
        get: (key: string) => key === 'CARE_MONITORING_AUTOMATION_ENABLED',
      } as never,
      outbox as never,
      {} as never,
      notifications as never,
      {} as never,
      careTaskReminders as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await (worker as any).deliverEvent(String(eventId), 0, 8);
    expect(careTaskReminders.shouldNotifyMissed).toHaveBeenCalledWith(
      taskId,
      patientId,
    );
    expect(notifications.create).toHaveBeenCalledWith(
      patientId,
      expect.objectContaining({
        idempotencyKey: `care.task.missed-reminder.${taskId}`,
      }),
    );
    expect(outbox.markDelivered).toHaveBeenCalledWith(eventId);
  });
});
