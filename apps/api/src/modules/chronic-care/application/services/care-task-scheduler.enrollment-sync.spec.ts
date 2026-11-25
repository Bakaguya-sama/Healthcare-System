import { Types } from 'mongoose';
import { CareTaskSchedulerService } from './care-task-scheduler.service';
import { PatientCareProgramStatus } from '../../domain/entities/patient-care-program.entity';

describe('CareTaskSchedulerService enrollment synchronization', () => {
  function createService(enrollment: unknown) {
    const query = { exec: jest.fn().mockResolvedValue(enrollment) };
    const enrollments = { findById: jest.fn().mockReturnValue(query) };
    const service = new CareTaskSchedulerService(
      {} as never,
      enrollments as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, enrollments };
  }

  it('uses the latest inactive enrollment state even when handling an older activation event', async () => {
    const id = new Types.ObjectId();
    const { service } = createService({
      _id: id,
      revision: 4,
      status: PatientCareProgramStatus.CANCELLED,
    });
    const cancel = jest.spyOn(service, 'cancelEnrollmentTasks').mockResolvedValue({} as never);
    const schedule = jest.spyOn(service, 'scheduleEnrollment').mockResolvedValue(0);

    await service.syncEnrollmentTasksToCurrentState(String(id), 2);

    expect(cancel).toHaveBeenCalledWith(id, 'enrollment_cancelled');
    expect(schedule).not.toHaveBeenCalled();
  });

  it('schedules from the latest active enrollment revision', async () => {
    const id = new Types.ObjectId();
    const enrollment = {
      _id: id,
      revision: 7,
      status: PatientCareProgramStatus.ACTIVE,
    };
    const { service } = createService(enrollment);
    const schedule = jest.spyOn(service, 'scheduleEnrollment').mockResolvedValue(3);
    jest.spyOn(service, 'advanceTaskStatuses').mockResolvedValue(undefined);

    await expect(service.syncEnrollmentTasksToCurrentState(String(id), 5)).resolves.toMatchObject({
      status: 'active',
      revision: 7,
    });
    expect(schedule).toHaveBeenCalledWith(enrollment, expect.any(Date));
  });

  it('fails and leaves the outbox event retryable if its revision is ahead of stored state', async () => {
    const id = new Types.ObjectId();
    const { service } = createService({
      _id: id,
      revision: 3,
      status: PatientCareProgramStatus.ACTIVE,
    });
    await expect(
      service.syncEnrollmentTasksToCurrentState(String(id), 4),
    ).rejects.toThrow('Care enrollment event is ahead of persisted state');
  });
});
