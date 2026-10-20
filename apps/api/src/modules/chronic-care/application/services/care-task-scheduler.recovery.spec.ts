import { Types } from 'mongoose';
import { CareTaskSchedulerService } from './care-task-scheduler.service';

describe('CareTaskSchedulerService recovery', () => {
  it('does not complete a metric task when evaluation fails', async () => {
    const now = new Date('2026-10-19T10:00:00.000Z');
    const task = {
      _id: new Types.ObjectId(),
      patientCareProgramId: new Types.ObjectId(),
      patientId: new Types.ObjectId(),
      windowStart: new Date('2026-10-19T09:00:00.000Z'),
      windowEnd: new Date('2026-10-19T11:00:00.000Z'),
      completionRule: { metricType: 'blood_pressure' },
    };
    const updateOne = jest.fn();
    const updateMany = jest.fn().mockReturnValue({ exec: async () => ({}) });
    const service = new CareTaskSchedulerService(
      {
        updateMany,
        updateOne,
        find: () => ({
          select: () => ({
            sort: () => ({ limit: () => ({ exec: async () => [task] }) }),
          }),
        }),
      } as never,
      {} as never,
      {} as never,
      {
        findFirstRecordedInWindow: async () => ({
          id: String(new Types.ObjectId()),
          recordedAt: now,
          ingestedAt: now,
          values: { systolic: 180, diastolic: 110 },
        }),
        listRecordedInWindow: async () => ({ items: [], truncated: false }),
      },
      {
        evaluateMetric: jest.fn().mockRejectedValue(new Error('alert failed')),
      } as never,
    );

    await expect(service.advanceTaskStatuses(now)).rejects.toThrow(
      'alert failed',
    );
    expect(updateOne).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
