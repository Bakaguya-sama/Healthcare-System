import { MetricType } from '../../domain/entities/health-metric.entity';

export const HEALTH_PROFILE = Symbol('HEALTH_PROFILE');

export type HealthProfileMetric = {
  metricType: MetricType;
  values: Record<string, number>;
  unit: string;
  source: string;
  recordedTimezone?: string;
  recordedAt: Date;
};

export interface HealthProfilePort {
  readRecentMetrics(
    patientId: string,
    limit?: number,
  ): Promise<HealthProfileMetric[]>;
}
