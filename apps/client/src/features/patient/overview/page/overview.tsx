import { useMemo, useState } from "react";
import { MetricOverviewCard } from "../components/metric-overview-card";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useHealthMetrics } from "../../health-metric/hooks/useHealthMetrics";
import type {
  HealthMetric,
  MetricType,
} from "../../health-metric/services/health-metrics.service";

const METRIC_CARD_ORDER: Array<{ type: MetricType; defaultUnit: string }> = [
  { type: "blood_pressure", defaultUnit: "mmHg" },
  { type: "heart_rate", defaultUnit: "bpm" },
  { type: "bmi", defaultUnit: "kg/m2" },
  { type: "kcal_intake", defaultUnit: "kcal" },
  { type: "blood_glucose", defaultUnit: "mg/dL" },
  { type: "oxygen_saturation", defaultUnit: "%" },
  { type: "body_temperature", defaultUnit: "C" },
  { type: "respiratory_rate", defaultUnit: "breaths/min" },
  { type: "weight", defaultUnit: "kg" },
  { type: "height", defaultUnit: "cm" },
  { type: "water_intake", defaultUnit: "ml" },
];

const DEFAULT_PATIENT_ID = "patient-overview";

export function Overview() {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long", // "Monday"
    year: "numeric", // "2024"
    month: "long", // "March"
    day: "numeric", // "27"
  };
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: metrics,
    isLoading,
    error,
  } = useHealthMetrics({
    limit: 100,
  });

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

  const cardModels = useMemo(
    () =>
      METRIC_CARD_ORDER.map((metricDef) => {
        const metric = latestMetricByType.get(metricDef.type);
        return {
          patientId: metric?.patientId ?? DEFAULT_PATIENT_ID,
          metricsType: metricDef.type,
          values: metric?.values ?? {},
          unit: metric?.unit ?? metricDef.defaultUnit,
        };
      }),
    [latestMetricByType],
  );

  const syncDate = useMemo(() => {
    if (metrics.length === 0) return null;
    const sortedByRecordedAt = [...metrics].sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
    const latest = sortedByRecordedAt[0];
    return latest?.recordedAt ? new Date(latest.recordedAt) : null;
  }, [metrics]);

  const toMetricLabel = (metricType: MetricType) =>
    metricType.replaceAll("_", " ");

  const filteredCardModels = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return cardModels;
    }

    return cardModels.filter((card) =>
      toMetricLabel(card.metricsType).includes(normalizedQuery),
    );
  }, [cardModels, searchQuery]);

  const onViewMetric = (metricType: MetricType) => {
    navigate(`/health-metric?metric=${metricType}`);
  };

  return (
    <>
      <div className="w-full p-6 ">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="w-full">
              <h1 className="text-3xl font-semibold text-slate-900">
                Overview
              </h1>
              <div className="mt-4 rounded-2xl p-2 border bg-white text-sm text-[#6B7280]">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-2"></span>

                {syncDate
                  ? `Last sync: ${syncDate.toLocaleDateString("en-US", options)}`
                  : "Last sync: -"}
              </div>
              {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
              {isLoading && !error && (
                <p className="mt-2 text-xs text-slate-500">Loading data...</p>
              )}
            </div>
          </div>

          {/* <div className="flex justify-end">
          <Button>Add new metric</Button>
        </div> */}

          <div className="mt-4">
            <div className="flex h-12 w-full max-w-130 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 shadow-sm transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search metrics (e.g. blood, water, bmi)"
                className="h-full w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-1 xl:grid-cols-2">
            {filteredCardModels.map((card) => (
              <MetricOverviewCard
                key={`${card.patientId}-${card.metricsType}`}
                patientId={card.patientId}
                metricsType={card.metricsType}
                values={card.values}
                unit={card.unit}
                onView={() => onViewMetric(card.metricsType)}
              />
            ))}
          </div>

          {filteredCardModels.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No metric matched your search.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
