export const HEALTH_METRIC = Symbol('HEALTH_METRIC');

export type HealthMetricReportItem = {
  id: string;
  metricType: string;
  unit: string;
  recordedAt: Date;
  ingestedAt: Date;
  values: Record<string, number>;
};

export interface HealthMetricPort {
  findForCareEvaluation?(metricId: string): Promise<{
    id: string;
    patientId: string;
    metricType: string;
    values: Record<string, number>;
    recordedAt: Date;
    ingestedAt: Date;
  } | null>;
  findFirstRecordedInWindow(input: {
    patientId: string;
    metricType: string;
    from: Date;
    to: Date;
  }): Promise<{
    id: string;
    recordedAt: Date;
    ingestedAt: Date;
    values: Record<string, number>;
  } | null>;

  listRecordedInWindow(input: {
    patientId: string;
    from: Date;
    to: Date;
    ingestedUntil: Date;
    limit: number;
  }): Promise<{
    items: HealthMetricReportItem[];
    truncated: boolean;
  }>;
}
