import {
  Activity,
  CalendarDays,
  Notebook,
  NotebookTextIcon,
  UserRound,
} from "lucide-react";
import { useMemo, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { MetricCard } from "../components/metric-card";
import { TrackingChart } from "@/components/TrackingChart";
import { useHealthMetrics } from "../hooks/useHealthMetrics";
import type { HealthMetric } from "../services/health-metrics.service";

interface HealthProfileProps {
  patientId: string;
  patientName: string;
  className?: string;
  showMetrics?: boolean;
  birthday?: Date | string;
  gender?: string;
  lastUpdatedAt?: Date | string;
  patientNote?: string;
  doctorNote?: string;
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
  weightKg?: number;
  bmi?: number;
  bloodGlucose?: number;
  oxygenSaturation?: number;
  bodyTemperature?: number;
  respiratoryRate?: number;
}

type MetricCardMock = Pick<
  ComponentProps<typeof MetricCard>,
  "metricsType" | "values" | "unit"
>;

type MetricType = ComponentProps<typeof MetricCard>["metricsType"];

type ChartEntry = {
  id: string;
  recordedAt: string;
  primaryValue: number;
  secondaryValue?: number;
};

type MetricChartConfig = {
  title: string;
  entries: ChartEntry[];
  hasData: boolean;
};

const METRIC_CARD_ORDER: Array<{ type: MetricType; defaultUnit: string }> = [
  { type: "heart_rate", defaultUnit: "bpm" },
  { type: "blood_pressure", defaultUnit: "mmHg" },
  { type: "blood_glucose", defaultUnit: "mg/dL" },
  { type: "oxygen_saturation", defaultUnit: "%" },
  { type: "body_temperature", defaultUnit: "°C" },
  { type: "respiratory_rate", defaultUnit: "breaths/min" },
];

const CHART_METRIC_TYPES: MetricType[] = [
  "heart_rate",
  "blood_pressure",
  "blood_glucose",
  "oxygen_saturation",
  "body_temperature",
  "respiratory_rate",
  "bmi",
  "height",
  "weight",
  "water_intake",
  "kcal_intake",
];

function formatDate(value?: Date | string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: Date | string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toSafeDate(value?: Date | string) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getPrimaryMetricValue(metric: HealthMetric): number | undefined {
  if (metric.type === "blood_pressure") {
    return metric.values.systolic?.value;
  }

  return metric.values.value?.value ?? metric.values.amount?.value;
}

function getSecondaryMetricValue(metric: HealthMetric): number | undefined {
  if (metric.type !== "blood_pressure") {
    return undefined;
  }

  return metric.values.diastolic?.value;
}

function buildChartEntries(
  metricType: MetricType,
  metrics: HealthMetric[],
): ChartEntry[] {
  return metrics
    .filter((metric) => metric.type === metricType)
    .map((metric) => {
      const recordedAt = metric.recordedAt;
      const recordedTime = new Date(recordedAt).getTime();
      if (!recordedAt || Number.isNaN(recordedTime)) return null;

      const primaryValue = getPrimaryMetricValue(metric);
      if (typeof primaryValue !== "number") return null;

      const secondaryValue = getSecondaryMetricValue(metric);

      return {
        id: metric.id,
        recordedAt,
        primaryValue,
        secondaryValue,
      };
    })
    .filter((entry): entry is ChartEntry => Boolean(entry));
}

export function HealthProfile({
  patientId,
  patientName,
  className,
  showMetrics = true,
  patientNote,
  doctorNote,
  birthday,
  gender,
  lastUpdatedAt,
}: HealthProfileProps) {
  const {
    data: metrics,
    isLoading,
    error,
  } = useHealthMetrics({
    enabled: showMetrics,
    patientId,
    sortBy: "recordedAt",
    sortOrder: -1,
    limit: 50,
  });

  console.log("metrics", metrics);

  const latestRecordedAt = useMemo(() => {
    if (!metrics.length) {
      return undefined;
    }

    return metrics.reduce<string | undefined>((latest, metric) => {
      if (!metric.recordedAt) return latest;
      if (!latest) return metric.recordedAt;

      return new Date(metric.recordedAt).getTime() > new Date(latest).getTime()
        ? metric.recordedAt
        : latest;
    }, undefined);
  }, [metrics]);

  const effectiveUpdatedAt = latestRecordedAt ?? lastUpdatedAt;
  const updatedDate = formatDate(effectiveUpdatedAt);
  const updatedTime = formatTime(effectiveUpdatedAt);
  const [expandedMetricTypes, setExpandedMetricTypes] = useState<MetricType[]>(
    [],
  );

  const selectedDate = useMemo(
    () => toSafeDate(effectiveUpdatedAt),
    [effectiveUpdatedAt],
  );

  const latestMetricByType = useMemo(() => {
    const latestMap = new Map<MetricType, HealthMetric>();

    for (const metric of metrics) {
      const current = latestMap.get(metric.type);
      if (!current) {
        latestMap.set(metric.type, metric);
        continue;
      }

      const currentTime = new Date(current.recordedAt).getTime();
      const nextTime = new Date(metric.recordedAt).getTime();
      if (Number.isFinite(nextTime) && nextTime > currentTime) {
        latestMap.set(metric.type, metric);
      }
    }

    return latestMap;
  }, [metrics]);

  const metricCardMocks = useMemo<MetricCardMock[]>(
    () =>
      METRIC_CARD_ORDER.map((metricDef) => {
        const metric = latestMetricByType.get(metricDef.type);

        return {
          metricsType: metricDef.type,
          values: metric?.values ?? {},
          unit: metric?.unit ?? metricDef.defaultUnit,
        };
      }),
    [latestMetricByType],
  );

  const metricChartConfig = useMemo<
    Record<MetricType, MetricChartConfig>
  >(() => {
    const entriesByType = new Map<MetricType, ChartEntry[]>();
    for (const metricType of CHART_METRIC_TYPES) {
      entriesByType.set(metricType, buildChartEntries(metricType, metrics));
    }

    return {
      heart_rate: {
        title: "Heart Rate",
        entries: entriesByType.get("heart_rate") ?? [],
        hasData: (entriesByType.get("heart_rate") ?? []).length > 0,
      },
      blood_pressure: {
        title: "Blood Pressure",
        entries: entriesByType.get("blood_pressure") ?? [],
        hasData: (entriesByType.get("blood_pressure") ?? []).length > 0,
      },
      blood_glucose: {
        title: "Blood Glucose",
        entries: entriesByType.get("blood_glucose") ?? [],
        hasData: (entriesByType.get("blood_glucose") ?? []).length > 0,
      },
      oxygen_saturation: {
        title: "O2 Saturation",
        entries: entriesByType.get("oxygen_saturation") ?? [],
        hasData: (entriesByType.get("oxygen_saturation") ?? []).length > 0,
      },
      body_temperature: {
        title: "Body Temperature",
        entries: entriesByType.get("body_temperature") ?? [],
        hasData: (entriesByType.get("body_temperature") ?? []).length > 0,
      },
      respiratory_rate: {
        title: "Respiratory Rate",
        entries: entriesByType.get("respiratory_rate") ?? [],
        hasData: (entriesByType.get("respiratory_rate") ?? []).length > 0,
      },
      bmi: {
        title: "BMI",
        entries: entriesByType.get("bmi") ?? [],
        hasData: (entriesByType.get("bmi") ?? []).length > 0,
      },
      height: {
        title: "Height",
        entries: entriesByType.get("height") ?? [],
        hasData: (entriesByType.get("height") ?? []).length > 0,
      },
      weight: {
        title: "Weight",
        entries: entriesByType.get("weight") ?? [],
        hasData: (entriesByType.get("weight") ?? []).length > 0,
      },
      water_intake: {
        title: "Water Intake",
        entries: entriesByType.get("water_intake") ?? [],
        hasData: (entriesByType.get("water_intake") ?? []).length > 0,
      },
      kcal_intake: {
        title: "Calories",
        entries: entriesByType.get("kcal_intake") ?? [],
        hasData: (entriesByType.get("kcal_intake") ?? []).length > 0,
      },
    };
  }, [metrics]);

  const handleClickMetricCard = (metricsType: MetricType) => {
    setExpandedMetricTypes((prev) =>
      prev.includes(metricsType)
        ? prev.filter((item) => item !== metricsType)
        : [...prev, metricsType],
    );
  };

  return (
    <aside
      className={cn(
        "hidden w-[850px] min-w-[850px] shrink-0 overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 lg:block",
        className,
      )}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-center gap-2 text-slate-800">
          <div className="flex gap-4 items-center">
            <Activity className="h-6 w-6" />
            <h3 className="text-3xl font-semibold">Health Profile</h3>
          </div>
        </div>
        <p className="mt-1 text-center text-[11px] text-slate-400">
          Last updated: {updatedDate}, {updatedTime}
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-lg font-semibold text-slate-900">{patientName}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 text-base text-slate-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            <span>Birthday: {formatDate(birthday)}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5 text-slate-400" />
            <span>Gender: {gender}</span>
          </div>
          <div className="flex items-start gap-2">
            <Notebook className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 break-all">
              Patient's note: {patientNote || "-"}
            </span>
          </div>
        </div>
      </div>

      {doctorNote ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-2 text-base text-slate-600">
            <NotebookTextIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 break-all">
              Doctor's note: {doctorNote}
            </span>
          </div>
        </div>
      ) : null}

      {showMetrics && (
        <div className="mt-4">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Current Vitals
          </p>
          <div className="mt-2 text-xs text-slate-500">
            {isLoading && "Loading health metrics..."}
            {!isLoading && error && "Unable to load health metrics."}
            {!isLoading &&
              !error &&
              metrics.length === 0 &&
              "No metrics for this patient."}
          </div>
          {!isLoading && !error && metrics.length === 0 ? null : (
            <div className="mt-2 flex flex-col gap-2">
              {metricCardMocks.map((card) => {
                const isExpanded = expandedMetricTypes.includes(
                  card.metricsType,
                );
                const chartConfig = metricChartConfig[card.metricsType];

                return (
                  <div
                    key={`${patientId}-${card.metricsType}`}
                    className="space-y-2"
                  >
                    <MetricCard
                      patientId={patientId}
                      metricsType={card.metricsType}
                      values={card.values}
                      unit={card.unit}
                      handleClick={() =>
                        handleClickMetricCard(card.metricsType)
                      }
                    />
                    {isExpanded && (
                      <TrackingChart
                        title={chartConfig.title}
                        metricType={card.metricsType}
                        selectedDate={selectedDate}
                        entries={chartConfig.entries}
                        hasData={chartConfig.hasData}
                        unit={card.unit}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
