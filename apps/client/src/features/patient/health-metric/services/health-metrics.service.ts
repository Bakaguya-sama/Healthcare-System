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

export type MetricValueDetail = {
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

type HealthMetricSingleResponse = {
  statusCode: number;
  message: string;
  data: ApiHealthMetric;
};

export type HealthMetricMutationResponse = {
  statusCode: number;
  message: string;
  data?: ApiHealthMetric;
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

export type CreateHealthMetricPayload = {
  type: MetricType;
  values: Record<string, MetricValueDetail>;
  recordedAt?: string;
};

export type UpdateHealthMetricPayload = {
  type?: MetricType;
  values?: Record<string, MetricValueDetail>;
  recordedAt?: string;
};

function mapApiMetric(item: ApiHealthMetric): HealthMetric {
  return {
    id: item._id,
    patientId: String(item.patientId),
    type: item.type,
    values: item.values,
    unit: item.unit,
    recordedAt: item.recordedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function normalizeQuery(query: HealthMetricsQuery): HealthMetricsQuery {
  const limit = query.limit ?? undefined;
  const normalizedLimit =
    typeof limit === "number" ? Math.min(limit, 100) : undefined;

  return {
    ...query,
    limit: normalizedLimit,
  };
}

export async function getHealthMetrics(
  query: HealthMetricsQuery = {},
): Promise<HealthMetric[]> {
  const normalizedQuery = normalizeQuery(query);
  const response = await api.get<HealthMetricsResponse>("/health-metrics", {
    params: normalizedQuery,
  });

  const items = response.data.data || [];
  return items.map(mapApiMetric);
}

export async function getHealthMetricsPage(
  query: HealthMetricsQuery = {},
): Promise<{
  data: HealthMetric[];
  pagination?: HealthMetricsResponse["pagination"];
}> {
  const normalizedQuery = normalizeQuery(query);
  const response = await api.get<HealthMetricsResponse>("/health-metrics", {
    params: normalizedQuery,
  });

  const items = response.data.data || [];
  return {
    data: items.map(mapApiMetric),
    pagination: response.data.pagination,
  };
}

export async function getAllHealthMetrics(
  query: HealthMetricsQuery = {},
): Promise<HealthMetric[]> {
  const limit = Math.min(query.limit ?? 100, 100);
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

export async function createHealthMetric(
  payload: CreateHealthMetricPayload,
): Promise<HealthMetric> {
  const response = await api.post<HealthMetricSingleResponse>(
    "/health-metrics",
    payload,
  );

  return mapApiMetric(response.data.data);
}

export async function updateHealthMetric(
  id: string,
  payload: UpdateHealthMetricPayload,
): Promise<HealthMetric> {
  const response = await api.patch<HealthMetricSingleResponse>(
    `/health-metrics/${id}`,
    payload,
  );

  return mapApiMetric(response.data.data);
}

export async function deleteHealthMetric(
  id: string,
): Promise<HealthMetricMutationResponse> {
  const response = await api.delete<HealthMetricMutationResponse>(
    `/health-metrics/${id}`,
  );

  return response.data;
}
