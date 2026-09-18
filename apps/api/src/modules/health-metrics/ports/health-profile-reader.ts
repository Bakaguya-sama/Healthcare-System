import { MetricType } from '../entities/health-metric.entity';

export const HEALTH_PROFILE_READER = Symbol('HEALTH_PROFILE_READER');

export type HealthProfileMetric = {
  type: MetricType;
  values: Record<string, unknown>;
  unit: string;
  source: string;
  timezone: string;
  recordedAt: Date;
};

export interface HealthProfileReader {
  readRecentMetrics(patientId: string, limit?: number): Promise<HealthProfileMetric[]>;
}
