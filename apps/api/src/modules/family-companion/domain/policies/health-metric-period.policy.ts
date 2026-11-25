export const FAMILY_HEALTH_METRIC_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export type FamilyHealthMetricPeriod =
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'all'
  | 'custom';

export interface HealthMetricTimeWindow {
  period: FamilyHealthMetricPeriod | 'legacy-range';
  anchor?: string;
  from?: Date;
  to?: Date;
  timeZone: string;
}

export class HealthMetricPeriodError extends Error {}

type CalendarDate = { year: number; month: number; day: number };

export function resolveFamilyHealthMetricWindow(input: {
  period?: FamilyHealthMetricPeriod;
  anchor?: string;
  from?: string;
  to?: string;
  now?: Date;
}): HealthMetricTimeWindow {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new HealthMetricPeriodError();

  // Preserve the original v1 from/to behavior for clients that already use it.
  if (!input.period && (input.from || input.to)) {
    if (input.anchor) throw new HealthMetricPeriodError();
    const from = parseInstant(input.from);
    const inclusiveTo = parseInstant(input.to);
    if (from && inclusiveTo && from > inclusiveTo)
      throw new HealthMetricPeriodError();
    return {
      period: 'legacy-range',
      from,
      // Existing v1 used an inclusive upper boundary ($lte).
      to: inclusiveTo ? new Date(inclusiveTo.getTime() + 1) : undefined,
      timeZone: FAMILY_HEALTH_METRIC_TIME_ZONE,
    };
  }

  const period = input.period ?? 'week';
  if (!['week', 'month', 'quarter', 'year', 'all', 'custom'].includes(period))
    throw new HealthMetricPeriodError();
  if (period === 'all') {
    if (input.anchor || input.from || input.to)
      throw new HealthMetricPeriodError();
    return { period, timeZone: FAMILY_HEALTH_METRIC_TIME_ZONE };
  }
  if (period === 'custom') {
    if (input.anchor || !input.from || !input.to)
      throw new HealthMetricPeriodError();
    const from = parseInstant(input.from, true);
    const to = parseInstant(input.to, true);
    if (!from || !to || from >= to) throw new HealthMetricPeriodError();
    return { period, from, to, timeZone: FAMILY_HEALTH_METRIC_TIME_ZONE };
  }
  if (input.from || input.to) throw new HealthMetricPeriodError();

  const anchor = input.anchor
    ? parseCalendarDate(input.anchor)
    : localDate(now);
  if (!anchor) throw new HealthMetricPeriodError();
  const today = localDate(now);
  if (compareCalendarDate(anchor, today) > 0)
    throw new HealthMetricPeriodError();

  let start: CalendarDate;
  let end: CalendarDate;
  if (period === 'week') {
    const day = new Date(Date.UTC(anchor.year, anchor.month - 1, anchor.day));
    const daysSinceMonday = (day.getUTCDay() + 6) % 7;
    start = addCalendarDays(anchor, -daysSinceMonday);
    end = addCalendarDays(start, 7);
  } else if (period === 'month') {
    start = { year: anchor.year, month: anchor.month, day: 1 };
    end = addCalendarMonths(start, 1);
  } else if (period === 'quarter') {
    const firstMonth = Math.floor((anchor.month - 1) / 3) * 3 + 1;
    start = { year: anchor.year, month: firstMonth, day: 1 };
    end = addCalendarMonths(start, 3);
  } else {
    start = { year: anchor.year, month: 1, day: 1 };
    end = { year: anchor.year + 1, month: 1, day: 1 };
  }
  return {
    period,
    anchor: formatCalendarDate(anchor),
    from: localDateTimeToUtc(start),
    to: localDateTimeToUtc(end),
    timeZone: FAMILY_HEALTH_METRIC_TIME_ZONE,
  };
}

function formatCalendarDate(date: CalendarDate) {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function parseCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

function parseInstant(value?: string, requireOffset = false): Date | undefined {
  if (!value) return undefined;
  if (
    requireOffset &&
    !/T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
  )
    throw new HealthMetricPeriodError();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new HealthMetricPeriodError();
  return date;
}

function localDate(instant: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FAMILY_HEALTH_METRIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return {
    year: Number(value.year),
    month: Number(value.month),
    day: Number(value.day),
  };
}

function localDateTimeToUtc(date: CalendarDate): Date {
  const targetUtc = Date.UTC(date.year, date.month - 1, date.day);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FAMILY_HEALTH_METRIC_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(targetUtc));
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const observedAsUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second),
  );
  // The pilot zone has no midnight transition in the supported calendar range.
  // This offset conversion avoids depending on the server's local timezone.
  return new Date(targetUtc + (targetUtc - observedAsUtc));
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function addCalendarMonths(date: CalendarDate, months: number): CalendarDate {
  const value = new Date(
    Date.UTC(date.year, date.month - 1 + months, date.day),
  );
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function compareCalendarDate(left: CalendarDate, right: CalendarDate) {
  return (
    Date.UTC(left.year, left.month - 1, left.day) -
    Date.UTC(right.year, right.month - 1, right.day)
  );
}
