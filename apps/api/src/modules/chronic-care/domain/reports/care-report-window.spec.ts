import {
  resolveCareReportWindow,
  resolveCareTaskStatusAtCutoff,
} from './care-report-window';

describe('care report window', () => {
  it('uses seven complete local calendar days across DST start', () => {
    const result = resolveCareReportWindow({
      dataUntil: new Date('2026-03-10T16:00:00.000Z'),
      timezone: 'America/New_York',
      days: 7,
    });

    expect(result.windowStart.toISOString()).toBe('2026-03-03T05:00:00.000Z');
    expect(result.windowEnd.toISOString()).toBe('2026-03-10T04:00:00.000Z');
    expect(result.windowEnd.getTime() - result.windowStart.getTime()).toBe(
      167 * 60 * 60 * 1000,
    );
  });

  it('uses thirty complete local days in Asia/Saigon', () => {
    const result = resolveCareReportWindow({
      dataUntil: new Date('2026-10-06T05:00:00.000Z'),
      timezone: 'Asia/Saigon',
      days: 30,
    });
    expect(result.windowStart.toISOString()).toBe('2026-09-05T17:00:00.000Z');
    expect(result.windowEnd.toISOString()).toBe('2026-10-05T17:00:00.000Z');
  });
});

describe('care task status at report cutoff', () => {
  const dataUntil = new Date('2026-10-06T00:00:00.000Z');
  const expiredWindow = new Date('2026-10-05T10:00:00.000Z');

  it('does not count a completion recorded after the cutoff', () => {
    expect(
      resolveCareTaskStatusAtCutoff({
        windowEnd: expiredWindow,
        completedAt: new Date('2026-10-07T09:00:00.000Z'),
        dataUntil,
      }),
    ).toBe('missed');
  });

  it('does not remove a task cancelled after the cutoff', () => {
    expect(
      resolveCareTaskStatusAtCutoff({
        windowEnd: expiredWindow,
        cancelledAt: new Date('2026-10-07T09:00:00.000Z'),
        dataUntil,
      }),
    ).toBe('missed');
  });

  it('uses terminal transitions that occurred on or before the cutoff', () => {
    expect(
      resolveCareTaskStatusAtCutoff({
        windowEnd: expiredWindow,
        completedAt: new Date('2026-10-05T09:00:00.000Z'),
        dataUntil,
      }),
    ).toBe('completed');
    expect(
      resolveCareTaskStatusAtCutoff({
        windowEnd: expiredWindow,
        cancelledAt: new Date('2026-10-05T09:00:00.000Z'),
        dataUntil,
      }),
    ).toBe('cancelled');
  });
});
