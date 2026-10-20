import { Types } from 'mongoose';
import { CareTaskReminderService } from './care-task-reminder.service';

describe('CareTaskReminderService', () => {
  const patientId = String(new Types.ObjectId());
  const taskId = String(new Types.ObjectId());
  const enrollmentId = new Types.ObjectId();
  const now = new Date('2026-10-19T01:00:00.000Z');

  function createService(task: object | null, active: boolean) {
    const findOne = jest.fn().mockReturnValue({
      select: () => ({ lean: () => ({ exec: async () => task }) }),
    });
    const exists = jest
      .fn()
      .mockResolvedValue(active ? { _id: enrollmentId } : null);
    return {
      service: new CareTaskReminderService(
        { findOne } as never,
        { exists } as never,
      ),
      findOne,
      exists,
    };
  }

  it('sends only when the task is in its window and enrollment is active', async () => {
    const { service, findOne, exists } = createService(
      { patientCareProgramId: enrollmentId },
      true,
    );
    await expect(service.shouldNotify(taskId, patientId, now)).resolves.toBe(
      true,
    );
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        windowStart: { $lte: now },
        windowEnd: { $gte: now },
        status: { $in: ['scheduled', 'due'] },
      }),
    );
    expect(exists).toHaveBeenCalledWith({
      _id: enrollmentId,
      status: 'active',
    });
  });

  it('skips missing or terminal tasks and inactive enrollments', async () => {
    const missing = createService(null, true);
    await expect(
      missing.service.shouldNotify(taskId, patientId, now),
    ).resolves.toBe(false);
    expect(missing.exists).not.toHaveBeenCalled();
    await expect(
      createService(
        { patientCareProgramId: enrollmentId },
        false,
      ).service.shouldNotify(taskId, patientId, now),
    ).resolves.toBe(false);
  });
});
