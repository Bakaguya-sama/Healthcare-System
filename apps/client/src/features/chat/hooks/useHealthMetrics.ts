import { useCallback, useEffect, useState } from "react";
import {
  getAllHealthMetrics,
  type HealthMetric,
  type HealthMetricsQuery,
} from "../services/health-metrics.service";

type UseHealthMetricsOptions = HealthMetricsQuery & {
  enabled?: boolean;
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

  return {
    data,
    isLoading,
    error,
    refresh: fetchMetrics,
  };
}
