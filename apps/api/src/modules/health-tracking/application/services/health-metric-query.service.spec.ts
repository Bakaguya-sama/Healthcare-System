import { HealthMetricQueryService } from './health-metric-query.service';

describe('HealthMetricQueryService shared statistics window', () => {
  it('uses end-exclusive boundaries for Companion and preserves Patient end-inclusive dates', async () => {
    const pipelines: Record<string, unknown>[][] = [];
    const model = {
      aggregate: jest.fn((pipeline: Record<string, unknown>[]) => {
        pipelines.push(pipeline);
        return Promise.resolve([{ stats: [], numericStats: [], latest: [] }]);
      }),
    };
    const service = new HealthMetricQueryService(model as never);
    const from = new Date('2026-11-23T17:00:00.000Z');
    const to = new Date('2026-11-30T17:00:00.000Z');

    await expect(
      service.getStatisticsInWindow(
        '507f1f77bcf86cd799439011',
        'weight',
        from,
        to,
      ),
    ).rejects.toThrow('No metrics found for this type');
    await expect(
      service.getStatistics('507f1f77bcf86cd799439011', 'weight', {
        startDate: from.toISOString(),
        endDate: to.toISOString(),
      } as never),
    ).rejects.toThrow('No metrics found for this type');

    const companionRange = (
      pipelines[0][0] as { $match: { recordedAt: Record<string, Date> } }
    ).$match.recordedAt;
    const patientRange = (
      pipelines[1][0] as { $match: { recordedAt: Record<string, Date> } }
    ).$match.recordedAt;
    expect(companionRange).toEqual({ $gte: from, $lt: to });
    expect(patientRange).toEqual({ $gte: from, $lte: to });
  });
});
