export const SHARED_HEALTH_METRIC = Symbol('SHARED_HEALTH_METRIC');

export interface SharedHealthMetricPoint {
  metricType: string;
  unit: string;
  values: Record<string, number>;
  recordedAt: Date;
}

export interface SharedHealthMetricPort {
  supportedTypes(): readonly string[];
  summary(input: {
    patientId: string;
    metricType: string;
    from?: Date;
    to?: Date;
  }): Promise<{
    metricType: string;
    count: number;
    average: number;
    minimum: number;
    maximum: number;
    latest: SharedHealthMetricPoint;
  }>;
  trend(input: {
    patientId: string;
    metricType: string;
    from?: Date;
    to?: Date;
    cursor?: string;
    limit: number;
  }): Promise<{ items: SharedHealthMetricPoint[]; nextCursor: string | null }>;
}
