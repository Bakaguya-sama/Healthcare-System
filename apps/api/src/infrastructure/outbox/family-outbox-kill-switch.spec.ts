import { OutboxWorkerService } from './outbox-worker.service';

describe('family outbox kill switch', () => {
  it('excludes family delivery even when care automation is enabled', async () => {
    const worker = Object.create(OutboxWorkerService.prototype) as any;
    worker.careAutomationEnabled = true;
    worker.familyCompanionEnabled = false;
    worker.lastObservedAt = Date.now();
    worker.outbox = { claimBatch: jest.fn().mockResolvedValue([]) };
    await worker.dispatchOnce();
    expect(worker.outbox.claimBatch).toHaveBeenCalledWith(
      50,
      30_000,
      expect.arrayContaining([
        'family.reminder.dispatch.v1',
        'family.health-metric-sharing.changed.v1',
      ]),
    );
  });
  it('defers already claimed family delivery while disabled', async () => {
    const worker = Object.create(OutboxWorkerService.prototype) as any;
    worker.familyCompanionEnabled = false;
    worker.outbox = {
      getProcessing: jest
        .fn()
        .mockResolvedValue({
          _id: 'synthetic',
          eventType: 'family.reminder.dispatch.v1',
        }),
      deferUntil: jest.fn().mockResolvedValue(undefined),
    };
    await worker.deliverEvent('synthetic', 0, 1);
    expect(worker.outbox.deferUntil).toHaveBeenCalledWith(
      'synthetic',
      expect.any(Date),
    );
  });
});
