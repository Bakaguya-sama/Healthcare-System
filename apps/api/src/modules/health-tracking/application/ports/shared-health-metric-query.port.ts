export const SHARED_HEALTH_METRIC_QUERY = Symbol('SHARED_HEALTH_METRIC_QUERY');

/** Query boundary for approved cross-context metric reads. */
export interface SharedHealthMetricQueryPort {
  getStatisticsInWindow(
    patientId: string,
    metricType: string,
    from?: Date,
    to?: Date,
  ): Promise<{
    data: {
      metricType: string;
      count: number;
      average: number;
      minimum: number;
      maximum: number;
      latest: {
        metricType: string;
        unit: string;
        values: Record<string, number>;
        recordedAt: Date;
      };
    };
  }>;
}
