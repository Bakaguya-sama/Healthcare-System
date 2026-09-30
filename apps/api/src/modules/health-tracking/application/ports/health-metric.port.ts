export const HEALTH_METRIC = Symbol('HEALTH_METRIC');

export interface HealthMetricPort {
  findFirstRecordedInWindow(input: {
    patientId: string;
    metricType: string;
    from: Date;
    to: Date;
  }): Promise<{ id: string; recordedAt: Date; updatedAt: Date; values: Record<string, unknown> } | null>;
}
