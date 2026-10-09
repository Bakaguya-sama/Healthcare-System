import { localDate, localDateTimeToUtc } from './care-task-timezone';

function addLocalDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function resolveCareReportWindow(input: {
  dataUntil: Date;
  timezone: string;
  days: 7 | 30;
}) {
  if (Number.isNaN(input.dataUntil.getTime()))
    throw new Error('Invalid report cutoff');
  const currentLocalDate = localDate(input.dataUntil, input.timezone);
  const windowEnd = localDateTimeToUtc(
    currentLocalDate,
    '00:00',
    input.timezone,
  );
  const windowStart = localDateTimeToUtc(
    addLocalDays(currentLocalDate, -input.days),
    '00:00',
    input.timezone,
  );
  return { windowStart, windowEnd };
}

export function resolveCareTaskStatusAtCutoff(input: {
  windowEnd: Date;
  completedAt?: Date;
  missedAt?: Date;
  cancelledAt?: Date;
  dataUntil: Date;
}): 'scheduled' | 'completed' | 'missed' | 'cancelled' {
  if (input.cancelledAt && input.cancelledAt <= input.dataUntil)
    return 'cancelled';
  if (input.completedAt && input.completedAt <= input.dataUntil)
    return 'completed';
  if (input.missedAt && input.missedAt <= input.dataUntil) return 'missed';
  if (input.windowEnd <= input.dataUntil) return 'missed';
  return 'scheduled';
}
