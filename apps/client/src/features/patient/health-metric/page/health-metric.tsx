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
import { TrackingCalendar } from "../components/TrackingCalendar";
import { TrackingChart } from "../components/TrackingChart";
import { TrackingTable } from "../components/TrackingTable";
import { useMetricStatus } from "../utils/useMetricStatus";
import {
  ActionCard,
  type ActionCardItem,
} from "@repo/ui/components/ui/action-card";

type MetricsTypes =
  | "blood_pressure"
  | "heart_rate"
  | "bmi"
  | "height"
  | "weight"
  | "water_intake"
  | "kcal_intake"
  | "blood_glucose"
  | "oxygen_saturation"
  | "body_temperature"
  | "respiratory_rate";

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

type MetricReading = {
  id: string;
  recordedAt: string;
  primaryValue: number;
  secondaryValue?: number;
  status: "normal" | "high" | "low";
};

const MOCK_METRIC_READINGS: Record<MetricsTypes, MetricReading[]> = {
  blood_pressure: [
    // 2026-03-30
    {
      id: "r-001",
      recordedAt: "2026-03-30T06:30:00.000Z",
      primaryValue: 118,
      secondaryValue: 76,
      status: "normal",
    },
    {
      id: "r-002",
      recordedAt: "2026-03-30T12:10:00.000Z",
      primaryValue: 126,
      secondaryValue: 82,
      status: "high",
    },
    {
      id: "r-003",
      recordedAt: "2026-03-30T18:45:00.000Z",
      primaryValue: 121,
      secondaryValue: 79,
      status: "normal",
    },

    // 2026-03-29
    {
      id: "r-004",
      recordedAt: "2026-03-29T07:00:00.000Z",
      primaryValue: 115,
      secondaryValue: 74,
      status: "normal",
    },
    {
      id: "r-005",
      recordedAt: "2026-03-29T13:20:00.000Z",
      primaryValue: 129,
      secondaryValue: 84,
      status: "high",
    },
    {
      id: "r-006",
      recordedAt: "2026-03-29T21:05:00.000Z",
      primaryValue: 119,
      secondaryValue: 78,
      status: "normal",
    },

    // 2026-03-27
    {
      id: "r-007",
      recordedAt: "2026-03-27T06:40:00.000Z",
      primaryValue: 110,
      secondaryValue: 70,
      status: "low",
    },
    {
      id: "r-008",
      recordedAt: "2026-03-27T14:00:00.000Z",
      primaryValue: 117,
      secondaryValue: 75,
      status: "normal",
    },
    {
      id: "r-009",
      recordedAt: "2026-03-27T19:30:00.000Z",
      primaryValue: 123,
      secondaryValue: 80,
      status: "normal",
    },

    // 2026-03-24
    {
      id: "r-010",
      recordedAt: "2026-03-24T08:15:00.000Z",
      primaryValue: 132,
      secondaryValue: 86,
      status: "high",
    },
    {
      id: "r-011",
      recordedAt: "2026-03-24T16:25:00.000Z",
      primaryValue: 127,
      secondaryValue: 83,
      status: "high",
    },
    {
      id: "r-012",
      recordedAt: "2026-03-24T22:00:00.000Z",
      primaryValue: 120,
      secondaryValue: 78,
      status: "normal",
    },
  ],
  heart_rate: [
    {
      id: "hr-1",
      recordedAt: "2026-03-29T07:30:00.000Z",
      primaryValue: 72,
      status: "normal",
    },
    {
      id: "hr-2",
      recordedAt: "2026-03-28T13:20:00.000Z",
      primaryValue: 112,
      status: "high",
    },
  ],
  bmi: [
    {
      id: "bmi-1",
      recordedAt: "2026-03-28T06:15:00.000Z",
      primaryValue: 22.4,
      status: "normal",
    },
  ],
  height: [
    {
      id: "height-1",
      recordedAt: "2026-03-20T06:00:00.000Z",
      primaryValue: 172,
      status: "normal",
    },
  ],
  weight: [
    {
      id: "weight-1",
      recordedAt: "2026-03-29T06:10:00.000Z",
      primaryValue: 66,
      status: "normal",
    },
    {
      id: "weight-2",
      recordedAt: "2026-03-27T06:10:00.000Z",
      primaryValue: 67,
      status: "normal",
    },
  ],
  water_intake: [
    {
      id: "water-1",
      recordedAt: "2026-03-28T08:10:00.000Z",
      primaryValue: 1200,
      status: "normal",
    },
    {
      id: "water-2",
      recordedAt: "2026-03-28T13:30:00.000Z",
      primaryValue: 1100,
      status: "normal",
    },
    {
      id: "water-3",
      recordedAt: "2026-03-28T09:45:00.000Z",
      primaryValue: 900,
      status: "normal",
    },
    {
      id: "water-4",
      recordedAt: "2026-03-29T07:20:00.000Z",
      primaryValue: 2000,
      status: "normal",
    },
    {
      id: "water-5",
      recordedAt: "2026-03-29T12:00:00.000Z",
      primaryValue: 1800,
      status: "normal",
    },
    {
      id: "water-6",
      recordedAt: "2026-03-29T10:40:00.000Z",
      primaryValue: 2000,
      status: "normal",
    },
    {
      id: "water-7",
      recordedAt: "2026-03-30T09:15:00.000Z",
      primaryValue: 1300,
      status: "normal",
    },
    {
      id: "water-8",
      recordedAt: "2026-03-30T14:10:00.000Z",
      primaryValue: 1400,
      status: "normal",
    },
    {
      id: "water-9",
      recordedAt: "2026-03-30T12:05:00.000Z",
      primaryValue: 1500,
      status: "normal",
    },
  ],
  kcal_intake: [
    {
      id: "kcal-1",
      recordedAt: "2026-03-29T12:00:00.000Z",
      primaryValue: 2100,
      status: "normal",
    },
  ],
  blood_glucose: [
    {
      id: "bg-1",
      recordedAt: "2026-03-29T07:45:00.000Z",
      primaryValue: 96,
      status: "normal",
    },
  ],
  oxygen_saturation: [],
  body_temperature: [
    {
      id: "temp-1",
      recordedAt: "2026-03-29T08:50:00.000Z",
      primaryValue: 36.8,
      status: "normal",
    },
  ],
  respiratory_rate: [
    {
      id: "rr-1",
      recordedAt: "2026-03-29T08:30:00.000Z",
      primaryValue: 16,
      status: "normal",
    },
  ],
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

  const style = VARIANT_STYLES[activeMetric];
  const sourceEntries = useMemo(() => {
    const source = data ?? MOCK_METRIC_READINGS[activeMetric] ?? [];
    return [...source].sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
  }, [activeMetric, data]);

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
          />
        </div>
      </div>
    </div>
  );
}
