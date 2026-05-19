import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createHealthMetric,
  deleteHealthMetric,
  getAllHealthMetrics,
  type HealthMetric,
  type HealthMetricsQuery,
  type MetricValueDetail,
  updateHealthMetric,
} from "../services/health-metrics.service";
import type { MetricReading, MetricsTypes } from "../utils/useMetricStatus";

type UseHealthMetricsOptions = HealthMetricsQuery & {
  enabled?: boolean;
};

export type CreateEntryInput = {
  metricType: MetricsTypes;
  recordedAt: string;
  primaryValue: number;
  secondaryValue?: number;
};

export type UpdateEntryInput = CreateEntryInput & {
  id: string;
};

export function useHealthMetrics(options: UseHealthMetricsOptions = {}) {
  const { enabled = true, ...query } = options;
  const [data, setData] = useState<HealthMetric[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const metrics = await getAllHealthMetrics(query);
      setData(metrics);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load health metrics",
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    enabled,
    query.patientId,
    query.endDate,
    query.limit,
    query.page,
    query.sortBy,
    query.sortOrder,
    query.startDate,
    query.type,
  ]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const readings = useMemo(() => {
    const mapped = data
      .map((metric) => toMetricReading(metric))
      .filter((entry): entry is MetricReading => entry !== null);

    return mapped;
  }, [data]);

  const addEntry = useCallback(async (input: CreateEntryInput) => {
    setError(null);
    const values = buildMetricValues(
      input.metricType,
      input.primaryValue,
      input.secondaryValue,
      input.recordedAt,
    );

    const created = await createHealthMetric({
      type: input.metricType,
      values,
      recordedAt: input.recordedAt,
    });

    setData((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateEntry = useCallback(async (input: UpdateEntryInput) => {
    setError(null);
    const values = buildMetricValues(
      input.metricType,
      input.primaryValue,
      input.secondaryValue,
      input.recordedAt,
    );

    const updated = await updateHealthMetric(input.id, {
      type: input.metricType,
      values,
      recordedAt: input.recordedAt,
    });

    setData((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    );
    return updated;
  }, []);

  const removeEntry = useCallback(async (id: string) => {
    setError(null);
    await deleteHealthMetric(id);
    setData((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return {
    data,
    readings,
    isLoading,
    error,
    addEntry,
    updateEntry,
    removeEntry,
    refresh: fetchMetrics,
  };
}

function buildMetricValues(
  metricType: MetricsTypes,
  primaryValue: number,
  secondaryValue: number | undefined,
  recordedAt: string,
): Record<string, MetricValueDetail> {
  const recordedDetail = (value: number) => ({
    value,
    recordedAt,
  });

  if (metricType === "blood_pressure") {
    if (!Number.isFinite(secondaryValue)) {
      throw new Error("Diastolic value is required for blood pressure");
    }
    return {
      systolic: recordedDetail(primaryValue),
      diastolic: recordedDetail(secondaryValue as number),
    };
  }

  if (metricType === "water_intake" || metricType === "kcal_intake") {
    return {
      amount: recordedDetail(primaryValue),
    };
  }

  return {
    value: recordedDetail(primaryValue),
  };
}

function toMetricReading(metric: HealthMetric): MetricReading | null {
  const metricType = metric.type as MetricsTypes;
  const values = metric.values ?? {};

  if (metricType === "blood_pressure") {
    const systolic = values.systolic?.value;
    const diastolic = values.diastolic?.value;

    if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
      return null;
    }

    return {
      id: metric.id,
      recordedAt: metric.recordedAt,
      primaryValue: Number(systolic),
      secondaryValue: Number(diastolic),
      status: "normal",
    };
  }

  const primary = values.value?.value ?? values.amount?.value;
  if (!Number.isFinite(primary)) {
    return null;
  }

  return {
    id: metric.id,
    recordedAt: metric.recordedAt,
    primaryValue: Number(primary),
    status: "normal",
  };
}
