import { Types } from 'mongoose';
import { HealthEvaluationService } from './health-evaluation.service';

describe('HealthEvaluationService recovery', () => {
  const enrollmentId = new Types.ObjectId();
  const metricId = new Types.ObjectId();
  const ruleId = new Types.ObjectId();
  const enrollment = {
    id: String(enrollmentId),
    _id: enrollmentId,
    patientId: new Types.ObjectId(),
    timezone: 'UTC',
    programConfig: {
      ruleSnapshot: { careRuleId: String(ruleId), revision: 1, rules: [] },
    },
  };
  const input = {
    enrollmentId: String(enrollmentId),
    metricId: String(metricId),
    values: { value: 1 },
    recordedAt: new Date('2026-10-19T00:00:00.000Z'),
    ingestedAt: new Date('2026-10-19T00:00:00.000Z'),
  };

  it('retries alert creation when the evaluation already exists', async () => {
    const evaluation = { _id: new Types.ObjectId(), severity: 'urgent' };
    const alert = jest.fn().mockResolvedValue(null);
    const service = new HealthEvaluationService(
      { findOne: () => ({ exec: async () => enrollment }) } as never,
      { findOne: () => ({ exec: async () => evaluation }) } as never,
      { createForEvaluation: alert } as never,
    );

    await expect(service.evaluateMetric(input)).resolves.toBe(evaluation);
    expect(alert).toHaveBeenCalledWith(evaluation);
  });

  it('recovers a concurrently inserted evaluation and creates its alert', async () => {
    const evaluation = { _id: new Types.ObjectId(), severity: 'urgent' };
    const findOne = jest
      .fn()
      .mockReturnValueOnce({ exec: async () => null })
      .mockReturnValueOnce({ sort: () => ({ exec: async () => null }) })
      .mockReturnValueOnce({ exec: async () => evaluation });
    const alert = jest.fn().mockResolvedValue(null);
    const service = new HealthEvaluationService(
      { findOne: () => ({ exec: async () => enrollment }) } as never,
      {
        findOne,
        create: jest.fn().mockRejectedValue({ code: 11000 }),
      } as never,
      { createForEvaluation: alert } as never,
    );

    await expect(service.evaluateMetric(input)).resolves.toBe(evaluation);
    expect(alert).toHaveBeenCalledWith(evaluation);
  });
});
