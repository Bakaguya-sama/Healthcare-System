import { Types } from 'mongoose';
import { CareMetricEvaluationService } from './care-metric-evaluation.service';

describe('CareMetricEvaluationService', () => {
  it('evaluates a matching active program regardless of task window', async () => {
    const metric = {
      id: String(new Types.ObjectId()),
      patientId: String(new Types.ObjectId()),
      metricType: 'blood_pressure',
      values: { systolic: 180 },
      recordedAt: new Date('2020-01-01T00:00:00Z'),
      ingestedAt: new Date(),
    };
    const program = {
      _id: new Types.ObjectId(),
      programConfig: {
        taskTemplates: [
          {
            key: 'bp',
            type: 'metric',
            schedule: { frequency: 'daily', time: '08:00', windowMinutes: 30 },
            completionRule: { metricType: 'blood_pressure' },
          },
        ],
      },
    };
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
});
