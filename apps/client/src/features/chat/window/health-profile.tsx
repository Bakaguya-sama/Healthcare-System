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

interface HealthProfileProps {
  patientId: string;
  patientName: string;
  className?: string;
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

type MetricValueDetail = {
  value: number;
  recordedAt: Date | string;
};

type MetricSnapshot = {
  patientId: string;
  type: MetricType;
  values: Record<string, MetricValueDetail>;
  unit: string;
  recordedAt: Date | string;
};

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

function createSingleValueEntries(
  metricType: MetricType,
  baseValue: number,
): ChartEntry[] {
  // TODO(real-data): Remove this mock generator and map entries from API response.
  // Expected shape for chart: [{ id, recordedAt, primaryValue }].
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(8 + (index % 3) * 4, 0, 0, 0);

    const variation = (index % 3) - 1;

    return {
      id: `${metricType}-${index + 1}`,
      recordedAt: date.toISOString(),
      primaryValue: Math.max(0, baseValue + variation),
    };
  });
}

function createBloodPressureEntries(
  systolic: number,
  diastolic: number,
): ChartEntry[] {
  // TODO(real-data): Remove this mock generator and map blood pressure entries
  // from API response to [{ id, recordedAt, primaryValue, secondaryValue }].
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(7 + (index % 2) * 10, 0, 0, 0);

    return {
      id: `blood-pressure-${index + 1}`,
      recordedAt: date.toISOString(),
      primaryValue: systolic + ((index % 3) - 1) * 2,
      secondaryValue: diastolic + ((index % 3) - 1),
    };
  });
}

export function HealthProfile({
  patientId,
  patientName,
  className,
  // TODO(real-data): Remove mock defaults and bind these props to patient profile API.
  patientNote = "I'm highhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh!",
  doctorNote = "Take care of yourself",
  birthday = "1998-04-17",
  gender = "Female",
  lastUpdatedAt = new Date(),
  heartRate = 78,
  systolic = 120,
  diastolic = 80,
  weightKg = 62,
  bmi = 22.4,
  bloodGlucose = 100,
  oxygenSaturation = 98,
  bodyTemperature = 36.5,
  respiratoryRate = 16,
}: HealthProfileProps) {
  const updatedDate = formatDate(lastUpdatedAt);
  const updatedTime = formatTime(lastUpdatedAt);
  const [expandedMetricTypes, setExpandedMetricTypes] = useState<MetricType[]>(
    [],
  );

  const selectedDate = useMemo(
    () => toSafeDate(lastUpdatedAt),
    [lastUpdatedAt],
  );

  // TODO(real-data): Replace this mock source with API response list.
  // Suggested endpoint contract: GET /patients/:patientId/metrics/latest (or list + client preprocessing).
  const metricSource = useMemo<MetricSnapshot[]>(
    () => [
      {
        patientId,
        type: "heart_rate",
        values: {
          value: {
            value: heartRate,
            recordedAt: lastUpdatedAt,
          },
        },
        unit: "bpm",
        recordedAt: lastUpdatedAt,
      },
      {
        patientId,
        type: "blood_pressure",
        values: {
          systolic: {
            value: systolic,
            recordedAt: lastUpdatedAt,
          },
          diastolic: {
            value: diastolic,
            recordedAt: lastUpdatedAt,
          },
        },
        unit: "mmHg",
        recordedAt: lastUpdatedAt,
      },
      {
        patientId,
        type: "blood_glucose",
        values: {
          value: {
            value: bloodGlucose,
            recordedAt: lastUpdatedAt,
          },
        },
        unit: "mg/dL",
        recordedAt: lastUpdatedAt,
      },
      {
        patientId,
        type: "oxygen_saturation",
        values: {
          value: {
            value: oxygenSaturation,
            recordedAt: lastUpdatedAt,
          },
        },
        unit: "%",
        recordedAt: lastUpdatedAt,
      },
      {
        patientId,
        type: "body_temperature",
        values: {
          value: {
            value: bodyTemperature,
            recordedAt: lastUpdatedAt,
          },
        },
        unit: "°C",
        recordedAt: lastUpdatedAt,
      },
      {
        patientId,
        type: "respiratory_rate",
        values: {
          value: {
            value: respiratoryRate,
            recordedAt: lastUpdatedAt,
          },
        },
        unit: "breaths/min",
        recordedAt: lastUpdatedAt,
      },
    ],
    [
      bloodGlucose,
      bodyTemperature,
      diastolic,
      heartRate,
      lastUpdatedAt,
      oxygenSaturation,
      patientId,
      respiratoryRate,
      systolic,
    ],
  );

  // Reuse the same latest-by-type preprocessing idea from Overview page.
  const latestMetricByType = useMemo(() => {
    const latestMap = new Map<MetricType, MetricSnapshot>();

    for (const metric of metricSource) {
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
  }, [metricSource]);

  // TODO(real-data): Keep this mapping layer when switching to backend response.
  // It gives a stable card order and safe fallbacks if one metric is missing.
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

  const metricChartConfig = useMemo<Record<MetricType, MetricChartConfig>>(
    () => ({
      // TODO(real-data): Replace static chart config with data fetched by metricType + date range.
      // Suggested endpoint contract: GET /patients/:patientId/metrics/:metricType/trend?from&to
      heart_rate: {
        title: "Heart Rate",
        entries: createSingleValueEntries("heart_rate", heartRate),
        hasData: true,
      },
      blood_pressure: {
        title: "Blood Pressure",
        entries: createBloodPressureEntries(systolic, diastolic),
        hasData: true,
      },
      blood_glucose: {
        title: "Blood Glucose",
        entries: createSingleValueEntries("blood_glucose", bloodGlucose),
        hasData: true,
      },
      oxygen_saturation: {
        title: "O2 Saturation",
        entries: createSingleValueEntries(
          "oxygen_saturation",
          oxygenSaturation,
        ),
        hasData: true,
      },
      body_temperature: {
        title: "Body Temperature",
        entries: createSingleValueEntries("body_temperature", bodyTemperature),
        hasData: true,
      },
      respiratory_rate: {
        title: "Respiratory Rate",
        entries: createSingleValueEntries("respiratory_rate", respiratoryRate),
        hasData: true,
      },
      bmi: {
        title: "BMI",
        entries: createSingleValueEntries("bmi", bmi),
        hasData: false,
      },
      height: {
        title: "Height",
        entries: [],
        hasData: false,
      },
      weight: {
        title: "Weight",
        entries: createSingleValueEntries("weight", weightKg),
        hasData: true,
      },
      water_intake: {
        title: "Water Intake",
        entries: [],
        hasData: false,
      },
      kcal_intake: {
        title: "Calories",
        entries: [],
        hasData: false,
      },
    }),
    [
      bmi,
      bloodGlucose,
      bodyTemperature,
      diastolic,
      heartRate,
      oxygenSaturation,
      respiratoryRate,
      systolic,
      weightKg,
    ],
  );

  // TODO(real-data): Add loading/error state for metric summary and chart trend requests.
  // TODO(real-data): Cache trend responses by metricType + range to avoid refetch on re-open.

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
              Patient's note: {patientNote}
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

      <div className="mt-4">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Current Vitals
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {metricCardMocks.map((card) => {
            const isExpanded = expandedMetricTypes.includes(card.metricsType);
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
                  handleClick={() => handleClickMetricCard(card.metricsType)}
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

          {/* <div className="flex items-center gap-3 rounded-2xl border border-lime-200 bg-lime-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-100 text-lime-700">
              <Scale className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Weight / BMI</p>
              <p className="text-lg font-semibold text-lime-700">
                {weightKg} kg
                <span className="ml-1 text-sm font-normal text-slate-500">
                  BMI {bmi}
                </span>
              </p>
            </div>
          </div> */}
        </div>
      </div>
    </aside>
  );
}
