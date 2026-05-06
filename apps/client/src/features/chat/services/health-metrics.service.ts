import { api } from "@/lib/api";

export type MetricType =
  | "blood_pressure"
  | "heart_rate"
  | "blood_glucose"
  | "oxygen_saturation"
  | "body_temperature"
  | "respiratory_rate"
  | "bmi"
  | "weight"
  | "height"
  | "water_intake"
  | "kcal_intake";

type MetricValueDetail = {
  value: number;
  recordedAt: string;
};

export type HealthMetric = {
  id: string;
  patientId: string;
  type: MetricType;
  values: Record<string, MetricValueDetail>;
  unit: string;
  recordedAt: string;
  createdAt?: string;
  updatedAt?: string;
};

type ApiHealthMetric = {
  _id: string;
  patientId: string;
  type: MetricType;
  values: Record<string, MetricValueDetail>;
  unit: string;
  recordedAt: string;
  createdAt?: string;
  updatedAt?: string;
};

export type HealthMetricsResponse = {
  statusCode: number;
  message: string;
  data: ApiHealthMetric[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type HealthMetricsQuery = {
  type?: MetricType;
  patientId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 1 | -1;
};

export async function getHealthMetrics(
  query: HealthMetricsQuery = {},
): Promise<HealthMetric[]> {
  const response = await api.get<HealthMetricsResponse>("/health-metrics", {
    params: query,
  });

  const items = response.data.data || [];
  return items.map((item) => ({
    id: item._id,
    patientId: String(item.patientId),
    type: item.type,
    values: item.values,
    unit: item.unit,
    recordedAt: item.recordedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export async function getHealthMetricsPage(
  query: HealthMetricsQuery = {},
): Promise<{
  data: HealthMetric[];
  pagination?: HealthMetricsResponse["pagination"];
}> {
  const response = await api.get<HealthMetricsResponse>("/health-metrics", {
    params: query,
  });

  const items = response.data.data || [];
  return {
    data: items.map((item) => ({
      id: item._id,
      patientId: String(item.patientId),
      type: item.type,
      values: item.values,
      unit: item.unit,
      recordedAt: item.recordedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
    pagination: response.data.pagination,
  };
}

export async function getAllHealthMetrics(
  query: HealthMetricsQuery = {},
): Promise<HealthMetric[]> {
  const limit = query.limit ?? 100;
  let page = query.page ?? 1;
  let all: HealthMetric[] = [];
  let totalPages = 1;

  do {
    const { data, pagination } = await getHealthMetricsPage({
      ...query,
      page,
      limit,
    });

    all = all.concat(data);
    totalPages = pagination?.pages ?? page;
    page += 1;
  } while (page <= totalPages);

  return all;
}
