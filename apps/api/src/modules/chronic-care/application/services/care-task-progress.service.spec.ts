import { HttpException, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserRole } from '../../../../core/domain/user.enums';
import {
  CareTaskStatus,
  CareTaskType,
} from '../../domain/entities/care-task.entity';
import { PatientCareProgramStatus } from '../../domain/entities/patient-care-program.entity';
import {
  DoctorReviewReasonCode,
  QueryEnrollmentCareTasksDto,
} from '../../presentation/dto/care-task.dto';
import { CareTaskProgressService } from './care-task-progress.service';

describe('CareTaskProgressService - doctorReview window & allowedActions', () => {
  const doctorId = new Types.ObjectId();
  const patientId = new Types.ObjectId();
  const enrollmentId = new Types.ObjectId();
  const futureTaskId = new Types.ObjectId();
  const dueTaskId = new Types.ObjectId();
  const now = new Date('2026-11-27T09:00:00.000Z');

  function makeChain(value: unknown) {
    const chain = {
      session: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(value),
    };
    return chain;
  }

  function createHarness(options: {
    task?: Record<string, unknown> | null;
    updatedTask?: Record<string, unknown> | null;
    listRows?: Record<string, unknown>[];
  }) {
    const tasksModel = {
      findOne: jest.fn().mockReturnValue(makeChain(options.task ?? null)),
      findOneAndUpdate: jest
        .fn()
        .mockReturnValue(makeChain(options.updatedTask ?? null)),
      find: jest.fn().mockReturnValue(makeChain(options.listRows ?? [])),
      countDocuments: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(options.listRows?.length ?? 0) }),
    };
    const enrollmentsModel = {
      findOne: jest.fn().mockReturnValue(
        makeChain({
          _id: enrollmentId,
          patientId,
          doctorId,
          status: PatientCareProgramStatus.ACTIVE,
        }),
      ),
    };
    const idempotencyModel = {
      findOne: jest.fn().mockReturnValue(makeChain(null)),
      create: jest.fn().mockResolvedValue([]),
    };
    const auditsModel = {
      create: jest.fn().mockResolvedValue([]),
    };
    const session = {
      withTransaction: jest.fn(async (cb: () => Promise<void>) => {
        await cb();
      }),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = {
      startSession: jest.fn().mockResolvedValue(session),
    };
    const patients = { isActive: jest.fn().mockResolvedValue(true) };
    const doctors = { isActiveAndApproved: jest.fn().mockResolvedValue(true) };

    const service = new CareTaskProgressService(
      tasksModel as never,
      enrollmentsModel as never,
      idempotencyModel as never,
      auditsModel as never,
      connection as never,
      patients as never,
      doctors as never,
    );

    return { service, tasksModel, auditsModel, idempotencyModel };
  }

  const doctorActor = { id: String(doctorId), role: UserRole.DOCTOR };

  it('rejects a future scheduled doctor_review task before windowStart with CARE_TASK_OUTSIDE_RESPONSE_WINDOW', async () => {
    const futureTask = {
      _id: futureTaskId,
      patientCareProgramId: enrollmentId,
      patientId,
      doctorId,
      taskType: CareTaskType.DOCTOR_REVIEW,
      templateKey: 'doctor_review_task_5',
      status: CareTaskStatus.SCHEDULED,
      required: true,
      scheduledFor: new Date('2026-11-28T01:00:00.000Z'),
      windowStart: new Date('2026-11-28T01:00:00.000Z'),
      windowEnd: new Date('2026-11-28T03:00:00.000Z'),
      completionRule: { responseMode: 'confirm' },
    };
    const { service, tasksModel } = createHarness({ task: futureTask });

    try {
      await service.doctorReview(
        doctorActor,
        String(futureTaskId),
        { reasonCode: DoctorReviewReasonCode.REVIEWED_NO_ACTION },
        'idem-future-1',
        now,
      );
      fail('Expected CARE_TASK_OUTSIDE_RESPONSE_WINDOW exception');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(httpErr.getResponse()).toEqual({
        code: 'CARE_TASK_OUTSIDE_RESPONSE_WINDOW',
        message: 'Care Task is outside its response window',
      });
    }
    expect(tasksModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('completes an in-window due doctor_review task cleanly', async () => {
    const dueTask = {
      _id: dueTaskId,
      patientCareProgramId: enrollmentId,
      patientId,
      doctorId,
      taskType: CareTaskType.DOCTOR_REVIEW,
      templateKey: 'doctor_review_task_5',
      status: CareTaskStatus.DUE,
      required: true,
      scheduledFor: new Date('2026-11-27T01:00:00.000Z'),
      windowStart: new Date('2026-11-27T01:00:00.000Z'),
      windowEnd: new Date('2026-11-27T11:00:00.000Z'),
      completionRule: { responseMode: 'confirm' },
    };
    const completedTask = {
      ...dueTask,
      status: CareTaskStatus.COMPLETED,
      completedAt: now,
      completionSourceType: 'doctorReview',
      completionSourceId: doctorId,
    };
    const { service, tasksModel, auditsModel, idempotencyModel } = createHarness({
      task: dueTask,
      updatedTask: completedTask,
    });

    const res = await service.doctorReview(
      doctorActor,
      String(dueTaskId),
      {
        reasonCode: DoctorReviewReasonCode.REVIEWED_NO_ACTION,
        note: 'Stable vitals',
      },
      'idem-due-1',
      now,
    );

    expect(tasksModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(auditsModel.create).toHaveBeenCalledTimes(1);
    expect(idempotencyModel.create).toHaveBeenCalledTimes(1);
    expect(res.replayed).toBe(false);
    expect(res.task.status).toBe(CareTaskStatus.COMPLETED);
    expect(res.task.allowedActions).toEqual([]);
  });

  it('reports allowedActions=[] for future doctor_review tasks and ["doctor_review"] for in-window tasks', async () => {
    const nowTime = new Date();
    const inWindowTask = {
      _id: dueTaskId,
      patientCareProgramId: enrollmentId,
      patientId,
      doctorId,
      taskType: CareTaskType.DOCTOR_REVIEW,
      templateKey: 'doctor_review_task_5',
      status: CareTaskStatus.DUE,
      required: true,
      scheduledFor: new Date(nowTime.getTime() - 30 * 60 * 1000),
      windowStart: new Date(nowTime.getTime() - 30 * 60 * 1000),
      windowEnd: new Date(nowTime.getTime() + 60 * 60 * 1000),
      completionRule: { responseMode: 'confirm' },
    };
    const futureTask = {
      _id: futureTaskId,
      patientCareProgramId: enrollmentId,
      patientId,
      doctorId,
      taskType: CareTaskType.DOCTOR_REVIEW,
      templateKey: 'doctor_review_task_5',
      status: CareTaskStatus.SCHEDULED,
      required: true,
      scheduledFor: new Date(nowTime.getTime() + 24 * 60 * 60 * 1000),
      windowStart: new Date(nowTime.getTime() + 24 * 60 * 60 * 1000),
      windowEnd: new Date(nowTime.getTime() + 26 * 60 * 60 * 1000),
      completionRule: { responseMode: 'confirm' },
    };

    const { service } = createHarness({ listRows: [inWindowTask, futureTask] });
    const query = Object.assign(new QueryEnrollmentCareTasksDto(), {
      type: CareTaskType.DOCTOR_REVIEW,
      page: 1,
      limit: 10,
      sortBy: 'scheduledFor' as const,
      sortOrder: 1 as const,
    });

    const page = await service.list(doctorActor, String(enrollmentId), query);
    expect(page.items).toHaveLength(2);
    expect(page.items[0].allowedActions).toEqual(['doctor_review']);
    expect(page.items[1].allowedActions).toEqual([]);
  });

  it('exposes metricType on metric CareTask summaries when configured in completionRule', async () => {
    const nowTime = new Date();
    const metricTask = {
      _id: dueTaskId,
      patientCareProgramId: enrollmentId,
      patientId,
      doctorId,
      taskType: CareTaskType.METRIC,
      templateKey: 'morning_vital_measurement',
      status: CareTaskStatus.DUE,
      required: true,
      scheduledFor: nowTime,
      windowStart: new Date(nowTime.getTime() - 30 * 60 * 1000),
      windowEnd: new Date(nowTime.getTime() + 60 * 60 * 1000),
      completionRule: { metricType: 'blood_glucose' },
    };

    const { service } = createHarness({ listRows: [metricTask] });
    const query = Object.assign(new QueryEnrollmentCareTasksDto(), {
      page: 1,
      limit: 10,
      sortBy: 'scheduledFor' as const,
      sortOrder: 1 as const,
    });

    const page = await service.list(doctorActor, String(enrollmentId), query);
    expect(page.items).toHaveLength(1);
    expect(page.items[0].metricType).toBe('blood_glucose');
  });
});

