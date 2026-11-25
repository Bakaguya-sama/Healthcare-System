import { MongooseSharedHealthMetricReader } from './mongoose-shared-health-metric-reader';
import { Types } from 'mongoose';

describe('shared health metric projection', () => {
  it('returns only approved numeric values and time, excluding other patient fields', async () => {
    const row = {
      _id: new Types.ObjectId(),
      meta: { metricType: 'weight', unit: 'kg' },
      values: { value: 70, secret: 17 },
      recordedAt: new Date('2026-01-01T00:00:00Z'),
      note: 'sensitive note',
      sourceRef: { deviceId: 'private' },
    };
    const query = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([row]),
    };
    const model = { find: jest.fn().mockReturnValue(query) };
    const canonical = { getStatisticsInWindow: jest.fn() };
    const reader = new MongooseSharedHealthMetricReader(
      model as never,
      canonical as never,
    );
    const result = await reader.trend({
      patientId: '507f1f77bcf86cd799439011',
      metricType: 'weight',
      limit: 10,
    });
    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({
        'meta.patientId': expect.any(Types.ObjectId),
        'meta.metricType': 'weight',
        validationStatus: 'valid',
      }),
    );
    expect(result.items).toEqual([
      {
        metricType: 'weight',
        unit: 'kg',
        values: { value: 70 },
        recordedAt: row.recordedAt,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('sensitive');
    expect(JSON.stringify(result)).not.toContain('deviceId');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('fails closed for a metric without an approved projection', async () => {
    const reader = new MongooseSharedHealthMetricReader(
      {} as never,
      { listSharedMetricTrend: jest.fn() } as never,
    );
    await expect(
      reader.trend({
        patientId: '507f1f77bcf86cd799439011',
        metricType: 'future_unknown',
        limit: 10,
      }),
    ).rejects.toThrow('INVALID_SHARED_METRIC_QUERY');
  });

  it('rejects invalid page sizes before reading the database', async () => {
    const reader = new MongooseSharedHealthMetricReader(
      {} as never,
      {} as never,
    );
    await expect(
      reader.trend({
        patientId: '507f1f77bcf86cd799439011',
        metricType: 'weight',
        limit: 0,
      }),
    ).rejects.toThrow('INVALID_SHARED_METRIC_LIMIT');
  });
});
