import type { HealthMetricReportItem } from '../../../health-tracking/public-api';

type TaskFact = {
  id: string;
  templateKey: string;
  status: string;
  scheduledFor: Date;
  windowStart: Date;
  windowEnd: Date;
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function numericValues(metric: HealthMetricReportItem) {
  return Object.entries(metric.values).flatMap(([key, value]) => {
    return typeof value === 'number' && Number.isFinite(value)
      ? [{ key, value }]
      : [];
  });
}

export function aggregateCareReportFacts(input: {
  tasks: TaskFact[];
  metrics: HealthMetricReportItem[];
  alerts: Array<{
    id: string;
    severity: string;
    status: string;
    detectedAt: Date;
  }>;
  evaluations: Array<{
    id: string;
    severity: string;
    reasonCodes: string[];
    evaluatedAt: Date;
  }>;
}) {
  const expectedTasks = input.tasks.filter(
    (task) => task.status !== 'cancelled',
  );
  const completedTasks = expectedTasks.filter(
    (task) => task.status === 'completed',
  );
  const missingTasks = expectedTasks.filter(
    (task) => task.status !== 'completed',
  );
  const metricsByField = new Map<string, Array<{ value: number; at: Date }>>();
  for (const metric of input.metrics) {
    for (const item of numericValues(metric)) {
      const key = `${metric.metricType}.${item.key}`;
      const values = metricsByField.get(key) ?? [];
      values.push({ value: item.value, at: metric.recordedAt });
      metricsByField.set(key, values);
    }
  }
  const metricStatistics = Object.fromEntries(
    [...metricsByField.entries()].map(([key, entries]) => {
      const ordered = entries.sort(
        (left, right) => left.at.getTime() - right.at.getTime(),
      );
      const values = ordered.map((entry) => entry.value);
      const delta = round(values.at(-1)! - values[0]);
      return [
        key,
        {
          count: values.length,
          minimum: Math.min(...values),
          maximum: Math.max(...values),
          average: round(
            values.reduce((sum, value) => sum + value, 0) / values.length,
          ),
          median: round(median(values)),
          first: values[0],
          latest: values.at(-1),
          delta,
        },
      ];
    }),
  );
  const trends = Object.fromEntries(
    Object.entries(metricStatistics).map(([key, value]) => [
      key,
      {
        delta: value.delta,
        direction:
          value.delta === 0
            ? 'stable'
            : value.delta > 0
              ? 'increasing'
              : 'decreasing',
      },
    ]),
  );
  const countBy = <T extends { severity: string }>(items: T[]) =>
    Object.fromEntries(
      ['normal', 'attention', 'urgent'].map((severity) => [
        severity,
        items.filter((item) => item.severity === severity).length,
      ]),
    );
  const reasonCodes = [
    ...new Set(input.evaluations.flatMap((item) => item.reasonCodes)),
  ].sort();

  return {
    statistics: {
      tasks: {
        expected: expectedTasks.length,
        completed: completedTasks.length,
        missed: missingTasks.length,
        adherence: expectedTasks.length
          ? round(completedTasks.length / expectedTasks.length)
          : null,
      },
      metrics: metricStatistics,
      alerts: {
        total: input.alerts.length,
        bySeverity: countBy(input.alerts),
        open: input.alerts.filter((item) =>
          ['open', 'acknowledged'].includes(item.status),
        ).length,
      },
    },
    trends,
    missingData: missingTasks.map((task) => ({
      taskId: task.id,
      templateKey: task.templateKey,
      scheduledFor: task.scheduledFor,
      windowStart: task.windowStart,
      windowEnd: task.windowEnd,
      reasonCode: `task_${task.status === 'missed' ? 'missed' : 'not_completed'}`,
    })),
    healthEvaluationSummary: {
      total: input.evaluations.length,
      bySeverity: countBy(input.evaluations),
      reasonCodes,
      evaluationIds: input.evaluations.map((item) => item.id),
    },
  };
}
