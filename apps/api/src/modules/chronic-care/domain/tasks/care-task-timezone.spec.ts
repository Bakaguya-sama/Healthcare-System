import {
  localDate,
  localDateTimeToUtc,
  nextLocalDate,
} from './care-task-timezone';
import { validateCareTaskTemplates } from './care-task-template.validator';

describe('care task scheduling', () => {
  it('creates a deterministic UTC instant from an IANA-local daily schedule', () => {
    const scheduled = localDateTimeToUtc(
      '2026-10-15',
      '08:30',
      'Asia/Ho_Chi_Minh',
    );
    expect(scheduled.toISOString()).toBe('2026-10-15T01:30:00.000Z');
    expect(localDate(scheduled, 'Asia/Ho_Chi_Minh')).toBe('2026-10-15');
  });

  it('moves calendar days without relying on a fixed 24-hour UTC window', () => {
    expect(nextLocalDate('2026-03-08')).toBe('2026-03-09');
  });

  it('accepts only supported P0 daily templates', () => {
    expect(
      validateCareTaskTemplates([
        {
          key: 'morning_bp',
          type: 'metric',
          schedule: { frequency: 'daily', time: '08:00', windowMinutes: 120 },
          completionRule: { metricType: 'blood_pressure' },
        },
      ]),
    ).not.toBeNull();
    expect(
      validateCareTaskTemplates([
        {
          key: 'medication',
          type: 'medication',
          schedule: { frequency: 'daily', time: '08:00', windowMinutes: 120 },
        },
      ]),
    ).toBeNull();
  });
});
