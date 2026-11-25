import { resolveFamilyHealthMetricWindow } from './health-metric-period.policy';

describe('Family Companion HealthMetric periods', () => {
  const now = new Date('2026-11-24T08:00:00.000Z');

  it('defaults to the current Monday-to-Monday week in Ho Chi Minh time', () => {
    expect(resolveFamilyHealthMetricWindow({ now })).toEqual({
      period: 'week',
      anchor: '2026-11-24',
      from: new Date('2026-11-22T17:00:00.000Z'),
      to: new Date('2026-11-29T17:00:00.000Z'),
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('uses the calendar period containing the anchor and rejects future anchors', () => {
    expect(
      resolveFamilyHealthMetricWindow({
        period: 'quarter',
        anchor: '2024-02-29',
        now: new Date('2026-11-24T08:00:00Z'),
      }),
    ).toEqual({
      period: 'quarter',
      anchor: '2024-02-29',
      from: new Date('2023-12-31T17:00:00Z'),
      to: new Date('2024-03-31T17:00:00Z'),
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    expect(() =>
      resolveFamilyHealthMetricWindow({
        period: 'month',
        anchor: '2026-12-01',
        now,
      }),
    ).toThrow();
  });

  it('handles leap-year month/year boundaries and week anchors on Sunday', () => {
    expect(
      resolveFamilyHealthMetricWindow({
        period: 'month',
        anchor: '2024-02-29',
        now: new Date('2026-11-24T08:00:00Z'),
      }),
    ).toMatchObject({
      from: new Date('2024-01-31T17:00:00Z'),
      to: new Date('2024-02-29T17:00:00Z'),
    });
    expect(
      resolveFamilyHealthMetricWindow({
        period: 'year',
        anchor: '2024-06-01',
        now: new Date('2026-11-24T08:00:00Z'),
      }),
    ).toMatchObject({
      from: new Date('2023-12-31T17:00:00Z'),
      to: new Date('2024-12-31T17:00:00Z'),
    });
    expect(
      resolveFamilyHealthMetricWindow({
        period: 'week',
        anchor: '2024-11-24',
        now: new Date('2026-11-24T08:00:00Z'),
      }),
    ).toMatchObject({
      from: new Date('2024-11-17T17:00:00Z'),
      to: new Date('2024-11-24T17:00:00Z'),
    });
  });

  it('supports end-exclusive custom windows and all history', () => {
    expect(
      resolveFamilyHealthMetricWindow({
        period: 'custom',
        from: '2026-01-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
        now,
      }),
    ).toMatchObject({
      period: 'custom',
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-02-01T00:00:00Z'),
    });
    expect(resolveFamilyHealthMetricWindow({ period: 'all', now })).toEqual({
      period: 'all',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    expect(() =>
      resolveFamilyHealthMetricWindow({
        period: 'custom',
        from: '2026-02-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
        now,
      }),
    ).toThrow();
  });

  it('preserves inclusive v1 from/to bounds for existing consumers', () => {
    expect(
      resolveFamilyHealthMetricWindow({
        from: '2026-01-01T00:00:00Z',
        to: '2026-01-31T23:59:59.999Z',
        now,
      }),
    ).toMatchObject({
      period: 'legacy-range',
      to: new Date('2026-02-01T00:00:00Z'),
    });
  });

  it('rejects ambiguous period and custom range combinations', () => {
    expect(() =>
      resolveFamilyHealthMetricWindow({
        period: 'week',
        from: '2026-01-01T00:00:00Z',
        to: '2026-02-01T00:00:00Z',
        now,
      }),
    ).toThrow();
    expect(() =>
      resolveFamilyHealthMetricWindow({
        period: 'all',
        anchor: '2026-01-01',
        now,
      }),
    ).toThrow();
  });

  it('requires a timezone offset for custom datetimes and rejects unknown periods', () => {
    expect(() =>
      resolveFamilyHealthMetricWindow({
        period: 'custom',
        from: '2026-01-01T00:00:00',
        to: '2026-01-02T00:00:00Z',
        now,
      }),
    ).toThrow();
    expect(() =>
      resolveFamilyHealthMetricWindow({ period: 'invalid' as never, now }),
    ).toThrow();
    expect(
      resolveFamilyHealthMetricWindow({
        period: 'custom',
        from: '2026-01-01T07:00:00+07:00',
        to: '2026-01-02T07:00:00+07:00',
        now,
      }).from,
    ).toEqual(new Date('2026-01-01T00:00:00Z'));
  });
});
