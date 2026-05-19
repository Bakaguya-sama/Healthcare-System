import { Button } from "@repo/ui/components/ui/button";
import {
  Activity,
  Droplet,
  Droplets,
  Flame,
  Gauge,
  Heart,
  MoveLeft,
  Ruler,
  Thermometer,
  Weight,
  Wind,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TrackingCalendar } from "../../../../components/TrackingCalendar";
import { TrackingChart } from "../../../../components/TrackingChart";
import { TrackingTable } from "../../../../components/TrackingTable";
import { useHealthMetrics } from "../hooks/useHealthMetrics";
import {
  type MetricReading,
  type MetricsTypes,
  useMetricStatus,
} from "../utils/useMetricStatus";

type VariantStyle = {
  icon: ReactNode;
  label: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  iconBgColor: string;
};

const VARIANT_STYLES: Record<MetricsTypes, VariantStyle> = {
  blood_pressure: {
    icon: <Heart className="h-5 w-5" />,
    label: "Blood Pressure",
    borderColor: "border-red-200",
    bgColor: "bg-red-50",
    textColor: "text-red-600",
    iconBgColor: "bg-red-100",
  },
  heart_rate: {
    icon: <Activity className="h-5 w-5" />,
    label: "Heart Rate",
    borderColor: "border-pink-200",
    bgColor: "bg-pink-50",
    textColor: "text-pink-600",
    iconBgColor: "bg-pink-100",
  },
  bmi: {
    icon: <Weight className="h-5 w-5" />,
    label: "BMI",
    borderColor: "border-orange-200",
    bgColor: "bg-orange-50",
    textColor: "text-orange-600",
    iconBgColor: "bg-orange-100",
  },
  weight: {
    icon: <Weight className="h-5 w-5" />,
    label: "Weight",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
    textColor: "text-amber-600",
    iconBgColor: "bg-amber-100",
  },
  height: {
    icon: <Ruler className="h-5 w-5" />,
    label: "Height",
    borderColor: "border-blue-200",
    bgColor: "bg-blue-50",
    textColor: "text-blue-600",
    iconBgColor: "bg-blue-100",
  },
  water_intake: {
    icon: <Droplet className="h-5 w-5" />,
    label: "Water Intake",
    borderColor: "border-cyan-200",
    bgColor: "bg-cyan-50",
    textColor: "text-cyan-600",
    iconBgColor: "bg-cyan-100",
  },
  kcal_intake: {
    icon: <Flame className="h-5 w-5" />,
    label: "Calories",
    borderColor: "border-yellow-200",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-600",
    iconBgColor: "bg-yellow-100",
  },
  blood_glucose: {
    icon: <Droplets className="h-5 w-5" />,
    label: "Blood Glucose",
    borderColor: "border-purple-200",
    bgColor: "bg-purple-50",
    textColor: "text-purple-600",
    iconBgColor: "bg-purple-100",
  },
  oxygen_saturation: {
    icon: <Wind className="h-5 w-5" />,
    label: "O2 Saturation",
    borderColor: "border-sky-200",
    bgColor: "bg-sky-50",
    textColor: "text-sky-600",
    iconBgColor: "bg-sky-100",
  },
  body_temperature: {
    icon: <Thermometer className="h-5 w-5" />,
    label: "Temperature",
    borderColor: "border-red-200",
    bgColor: "bg-red-50",
    textColor: "text-red-600",
    iconBgColor: "bg-red-100",
  },
  respiratory_rate: {
    icon: <Gauge className="h-5 w-5" />,
    label: "Respiratory Rate",
    borderColor: "border-green-200",
    bgColor: "bg-green-50",
    textColor: "text-green-600",
    iconBgColor: "bg-green-100",
  },
};

const METRIC_UNIT: Record<MetricsTypes, string> = {
  blood_pressure: "mmHg",
  heart_rate: "bpm",
  bmi: "kg/m2",
  height: "cm",
  weight: "kg",
  water_intake: "ml",
  kcal_intake: "kcal",
  blood_glucose: "mg/dL",
  oxygen_saturation: "%",
  body_temperature: "C",
  respiratory_rate: "breaths/min",
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateKeyFromRecordedAt = (recordedAt: string) => {
  // Keep the source calendar day from ISO string to avoid UTC/local rollover.
  if (/^\d{4}-\d{2}-\d{2}/.test(recordedAt)) {
    return recordedAt.slice(0, 10);
  }

  return toDateKey(new Date(recordedAt));
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

interface HealthMetricProps {
  metric?: MetricsTypes;
  hasData?: boolean;
  onBack?: () => void;
  data?: MetricReading[];
}

export function HealthMetric({
  metric,
  hasData,
  onBack,
  data,
}: HealthMetricProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const today = useMemo(() => startOfToday(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const metricFromQuery = searchParams.get("metric") as MetricsTypes | null;
  const activeMetric: MetricsTypes =
    metric ??
    (metricFromQuery && metricFromQuery in VARIANT_STYLES
      ? metricFromQuery
      : "blood_pressure");

  const shouldFetch = !data;
  const {
    readings: apiEntries,
    isLoading,
    error,
    addEntry,
    updateEntry,
    removeEntry,
  } = useHealthMetrics({
    type: activeMetric,
    enabled: shouldFetch,
  });

  const style = VARIANT_STYLES[activeMetric];
  const sourceEntries = useMemo(() => {
    const source = data ?? apiEntries ?? [];
    return [...source].sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
  }, [apiEntries, data]);

  const allEntries = useMetricStatus({
    metricType: activeMetric,
    entries: sourceEntries,
  });

  const resolvedHasData = hasData ?? allEntries.length > 0;

  const recordedDateKeys = useMemo(
    () =>
      new Set(
        allEntries.map((entry) => toDateKeyFromRecordedAt(entry.recordedAt)),
      ),
    [allEntries],
  );

  const entriesOnSelectedDate = useMemo(() => {
    const selectedKey = toDateKey(selectedDate);
    return allEntries
      .filter(
        (entry) => toDateKeyFromRecordedAt(entry.recordedAt) === selectedKey,
      )
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
  }, [allEntries, selectedDate]);

  const entriesUntilSelectedDate = useMemo(() => {
    const selectedEnd = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();

    return allEntries.filter(
      (entry) => new Date(entry.recordedAt).getTime() <= selectedEnd,
    );
  }, [allEntries, selectedDate]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    navigate(-1);
  };

  return (
    <div className="w-full p-6">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="p-3" onClick={handleBack}>
              <MoveLeft className="h-5 w-5" />
            </Button>

            <div
              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${style.bgColor} ${style.textColor}`}
            >
              {style.icon}
            </div>

            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                {style.label}
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Selected date:{" "}
                {selectedDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
              {isLoading && !error && (
                <p className="mt-1 text-xs text-slate-500">Loading data...</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <div className="min-w-0 overflow-hidden">
          <TrackingCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            today={today}
            recordedDateKeys={recordedDateKeys}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <TrackingChart
            title={style.label}
            metricType={activeMetric}
            selectedDate={selectedDate}
            entries={entriesUntilSelectedDate}
            unit={METRIC_UNIT[activeMetric]}
            hasData={resolvedHasData}
          />

          <TrackingTable
            metricTitle={style.label}
            metricType={activeMetric}
            selectedDate={selectedDate}
            today={today}
            unit={METRIC_UNIT[activeMetric]}
            entries={entriesOnSelectedDate}
            hasData={resolvedHasData}
            onCreateEntry={(input) => addEntry(input)}
            onUpdateEntry={(input) => updateEntry(input)}
            onDeleteEntry={(entryId) => removeEntry(entryId)}
          />
        </div>
      </div>
    </div>
  );
}
