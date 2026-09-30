import { MetricType } from '../../domain/entities/health-metric.entity';

export const HEALTH_PROFILE = Symbol('HEALTH_PROFILE');

export type HealthProfileMetric = {
  type: MetricType;
  values: Record<string, unknown>;
  unit: string;
  source: string;
  timezone: string;
  recordedAt: Date;
};

export interface HealthProfilePort {
  readRecentMetrics(
    patientId: string,
    limit?: number,
  ): Promise<HealthProfileMetric[]>;
}
