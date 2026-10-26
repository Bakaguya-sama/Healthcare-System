import { aggregateCareReportFacts } from './care-report-aggregator';

describe('care report deterministic aggregation', () => {
  it('calculates adherence, numeric statistics, trend and missing windows', () => {
    const day = (value: number) => new Date(`2026-10-0${value}T01:00:00.000Z`);
    const result = aggregateCareReportFacts({
      tasks: [
        {
          id: 'task-1',
          templateKey: 'morning_bp',
          status: 'completed',
          scheduledFor: day(1),
          windowStart: day(1),
          windowEnd: day(2),
        },
        {
          id: 'task-2',
          templateKey: 'morning_bp',
          status: 'missed',
          scheduledFor: day(2),
          windowStart: day(2),
          windowEnd: day(3),
        },
        {
          id: 'task-3',
          templateKey: 'morning_bp',
          status: 'completed',
          scheduledFor: day(3),
          windowStart: day(3),
          windowEnd: day(4),
        },
        {
          id: 'task-cancelled',
          templateKey: 'morning_bp',
          status: 'cancelled',
          scheduledFor: day(4),
          windowStart: day(4),
          windowEnd: day(5),
        },
      ],
      metrics: [120, 130, 160, 150].map((value, index) => ({
        id: `metric-${index}`,
        metricType: 'blood_pressure',
        unit: 'mmHg',
        recordedAt: day(index + 1),
        ingestedAt: day(index + 1),
        values: { systolic: value },
      })),
      alerts: [
        {
          id: 'alert-1',
          severity: 'urgent',
          status: 'open',
          detectedAt: day(3),
        },
      ],
      evaluations: [
        {
          id: 'evaluation-1',
          severity: 'urgent',
          reasonCodes: ['systolic_high'],
          evaluatedAt: day(3),
        },
      ],
    });

    expect(result.statistics.tasks).toEqual({
      expected: 3,
      completed: 2,
      missed: 1,
      adherence: 0.67,
    });
    expect(result.statistics.metrics['blood_pressure.systolic']).toEqual({
      count: 4,
      minimum: 120,
      maximum: 160,
      average: 140,
      median: 140,
      first: 120,
      latest: 150,
      delta: 30,
    });
    expect(result.trends['blood_pressure.systolic']).toEqual({
      delta: 30,
      direction: 'increasing',
    });
    expect(result.missingData).toEqual([
      expect.objectContaining({ taskId: 'task-2', reasonCode: 'task_missed' }),
    ]);
    expect(result.healthEvaluationSummary).toMatchObject({
      total: 1,
      reasonCodes: ['systolic_high'],
    });
  });

  it('returns null adherence and empty facts when there are no expected tasks', () => {
    const result = aggregateCareReportFacts({
      tasks: [],
      metrics: [],
      alerts: [],
      evaluations: [],
    });
    expect(result.statistics.tasks.adherence).toBeNull();
    expect(result.statistics.metrics).toEqual({});
    expect(result.missingData).toEqual([]);
  });
});
