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
    careProgramId: new Types.ObjectId(),
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

  it('evaluates check-in facts only while the exact snapshot Rule is active', async () => {
    const checkInEnrollment = {
      ...enrollment,
      programConfig: {
        ruleSnapshot: {
          careRuleId: String(ruleId),
          version: 1,
          revision: 1,
          rules: [
            {
              operator: 'equal',
              key: 'check_in.severity',
              value: 'severe',
              severity: 'urgent',
              reasonCode: 'severe_check_in',
            },
          ],
        },
      },
    };
    const evaluation = { _id: new Types.ObjectId(), severity: 'urgent' };
    const create = jest.fn().mockResolvedValue(evaluation);
    const alert = jest.fn().mockResolvedValue(null);
    const service = new HealthEvaluationService(
      { findOne: () => ({ exec: async () => checkInEnrollment }) } as never,
      {
        findOne: () => ({ exec: async () => null }),
        create,
      } as never,
      { createForEvaluation: alert } as never,
      {
        findOne: () => ({
          select: () => ({ lean: () => ({ exec: async () => ({ _id: ruleId }) }) }),
        }),
      } as never,
    );

    await expect(
      service.evaluateCheckIn({
        enrollmentId: String(enrollmentId),
        careTaskId: String(new Types.ObjectId()),
        facts: { 'check_in.severity': 'severe' },
        submittedAt: new Date('2026-11-05T00:00:00.000Z'),
      }),
    ).resolves.toBe(evaluation);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'care_task_check_in',
        severity: 'urgent',
        reasonCodes: ['severe_check_in'],
      }),
    );
    expect(alert).toHaveBeenCalledWith(evaluation);
  });

  it('does not evaluate or alert when the snapshot Rule is no longer active', async () => {
    const create = jest.fn();
    const alert = jest.fn();
    const service = new HealthEvaluationService(
      { findOne: () => ({ exec: async () => enrollment }) } as never,
      { findOne: jest.fn(), create } as never,
      { createForEvaluation: alert } as never,
      {
        findOne: () => ({
          select: () => ({ lean: () => ({ exec: async () => null }) }),
        }),
      } as never,
    );
    await expect(
      service.evaluateCheckIn({
        enrollmentId: String(enrollmentId),
        careTaskId: String(new Types.ObjectId()),
        facts: { 'check_in.severity': 'severe' },
        submittedAt: new Date(),
      }),
    ).resolves.toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });
});
