import { Types } from 'mongoose';
import { CareTaskStatus, CareTaskType } from '../../domain/entities/care-task.entity';
import { CareMetricEvaluationService } from './care-metric-evaluation.service';

describe('CareMetricEvaluationService', () => {
  const makeProgram = (metricType: string) => ({
    _id: new Types.ObjectId(),
    programConfig: {
      taskTemplates: [
        {
          key: 'bp',
          type: 'metric',
          schedule: { frequency: 'daily', time: '08:00', windowMinutes: 30 },
          completionRule: { metricType },
        },
      ],
    },
  });

  it('evaluates a matching active program regardless of task window', async () => {
    const metric = {
      id: String(new Types.ObjectId()),
      patientId: String(new Types.ObjectId()),
      metricType: 'blood_pressure',
      values: { systolic: 180 },
      recordedAt: new Date('2020-01-01T00:00:00Z'),
      ingestedAt: new Date(),
    };
    const program = makeProgram('blood_pressure');
    const evaluateMetric = jest.fn().mockResolvedValue({});
    const service = new CareMetricEvaluationService(
      { findForCareEvaluation: async () => metric } as never,
      {
        find: () => ({
          sort: () => ({ limit: () => ({ exec: async () => [program] }) }),
        }),
      } as never,
      { evaluateMetric } as never,
    );
    await service.evaluateRecordedMetric(metric.id);
    expect(evaluateMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: String(program._id),
        metricId: metric.id,
        recordedAt: metric.recordedAt,
      }),
    );
  });

  it('passes careTaskId and marks open metric CareTasks completed when valid metric is inside window', async () => {
    const metricId = new Types.ObjectId();
    const patientId = new Types.ObjectId();
    const taskId = new Types.ObjectId();
    const metric = {
      id: String(metricId),
      patientId: String(patientId),
      metricType: 'blood_glucose',
      values: { value: 112 },
      validationStatus: 'valid',
      recordedAt: new Date('2026-11-27T08:30:00.000Z'),
      ingestedAt: new Date('2026-11-27T08:30:05.000Z'),
    };
    const program = makeProgram('blood_glucose');
    const evaluateMetric = jest.fn().mockResolvedValue({ _id: new Types.ObjectId() });
    const updateManyExec = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    const updateMany = jest.fn().mockReturnValue({ exec: updateManyExec });
    const findTasks = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{ _id: taskId }]),
    });

    const service = new CareMetricEvaluationService(
      { findForCareEvaluation: async () => metric } as never,
      {
        find: () => ({
          sort: () => ({ limit: () => ({ exec: async () => [program] }) }),
        }),
      } as never,
      { evaluateMetric } as never,
      { find: findTasks, updateMany } as never,
    );

    await service.evaluateRecordedMetric(metric.id);

    expect(findTasks).toHaveBeenCalledWith(
      expect.objectContaining({
        patientCareProgramId: program._id,
        patientId,
        taskType: CareTaskType.METRIC,
        status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
        'completionRule.metricType': 'blood_glucose',
        windowStart: { $lte: metric.recordedAt },
        windowEnd: { $gte: metric.recordedAt },
      }),
    );
    expect(evaluateMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: String(program._id),
        careTaskId: String(taskId),
        metricId: metric.id,
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      {
        _id: { $in: [taskId] },
        status: { $in: [CareTaskStatus.SCHEDULED, CareTaskStatus.DUE] },
      },
      {
        $set: {
          status: CareTaskStatus.COMPLETED,
          completionSourceType: 'healthMetric',
          completionSourceId: metricId,
          completedAt: metric.recordedAt,
        },
      },
    );
  });

  it('does not complete CareTasks when evaluateMetric returns null', async () => {
    const taskId = new Types.ObjectId();
    const metric = {
      id: String(new Types.ObjectId()),
      patientId: String(new Types.ObjectId()),
      metricType: 'blood_glucose',
      values: { value: 95 },
      validationStatus: 'valid',
      recordedAt: new Date('2026-11-27T08:30:00.000Z'),
      ingestedAt: new Date(),
    };
    const program = makeProgram('blood_glucose');
    const evaluateMetric = jest.fn().mockResolvedValue(null);
    const updateMany = jest.fn();
    const findTasks = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{ _id: taskId }]),
    });

    const service = new CareMetricEvaluationService(
      { findForCareEvaluation: async () => metric } as never,
      {
        find: () => ({
          sort: () => ({ limit: () => ({ exec: async () => [program] }) }),
        }),
      } as never,
      { evaluateMetric } as never,
      { find: findTasks, updateMany } as never,
    );

    await service.evaluateRecordedMetric(metric.id);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('skips task completion for superseded metrics while still running evaluation', async () => {
    const metric = {
      id: String(new Types.ObjectId()),
      patientId: String(new Types.ObjectId()),
      metricType: 'blood_glucose',
      values: { value: 110 },
      validationStatus: 'superseded',
      recordedAt: new Date('2026-11-27T08:30:00.000Z'),
      ingestedAt: new Date(),
    };
    const program = makeProgram('blood_glucose');
    const evaluateMetric = jest.fn().mockResolvedValue({ _id: new Types.ObjectId() });
    const findTasks = jest.fn();
    const updateMany = jest.fn();

    const service = new CareMetricEvaluationService(
      { findForCareEvaluation: async () => metric } as never,
      {
        find: () => ({
          sort: () => ({ limit: () => ({ exec: async () => [program] }) }),
        }),
      } as never,
      { evaluateMetric } as never,
      { find: findTasks, updateMany } as never,
    );

    await service.evaluateRecordedMetric(metric.id);
    expect(findTasks).not.toHaveBeenCalled();
    expect(evaluateMetric).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
