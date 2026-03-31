import {
  Activity,
  Droplet,
  Droplets,
  Flame,
  Gauge,
  Heart,
  Ruler,
  Thermometer,
  Weight,
  Wind,
} from "lucide-react";

{
  /* <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>; */
}

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

interface MetricEntry {
  value: number;
  recordedAt: Date | string;
}

interface MetricOverviewCardProps {
  patientId: string;
  metricsType: MetricsTypes;
  values: Record<string, MetricEntry>;
  unit: string;
  onView: () => void;
}

type VariantStyle = {
  icon: React.ReactNode;
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

function formatMetricValue(
  metricsType: MetricsTypes,
  values: Record<string, MetricEntry>,
): string {
  switch (metricsType) {
    case "blood_pressure": {
      const systolic = values.systolic?.value;
      const diastolic = values.diastolic?.value;
      if (systolic !== undefined && diastolic !== undefined) {
        return `${Math.round(systolic)}/${Math.round(diastolic)}`;
      }
      return "N/A";
    }

    case "heart_rate":
    case "bmi":
    case "weight":
    case "height":
    case "water_intake":
    case "kcal_intake":
    case "blood_glucose":
    case "oxygen_saturation":
    case "body_temperature":
    case "respiratory_rate": {
      const primaryKey =
        metricsType === "water_intake" || metricsType === "kcal_intake"
          ? "amount"
          : "value";
      const val = values[primaryKey]?.value;
      return val !== undefined ? Math.round(val).toString() : "N/A";
    }

    default:
      return "N/A";
  }
}

function formatTime(recordedAt?: Date | string): string {
  if (!recordedAt) return "-";
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) return "-";

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  let dayStr = "";
  if (isToday) dayStr = "Today";
  else if (isYesterday) dayStr = "Yesterday";
  else
    dayStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${dayStr}, ${timeStr}`;
}

export function MetricOverviewCard({
  patientId,
  metricsType,
  values,
  unit,
  onView,
}: MetricOverviewCardProps) {
  const variant = VARIANT_STYLES[metricsType];
  const displayValue = formatMetricValue(metricsType, values);

  // Get the most recent record timestamp
  const getLatestTimestamp = (): Date | string | undefined => {
    const entries = Object.values(values);
    if (entries.length === 0) return undefined;
    return entries[entries.length - 1]?.recordedAt;
  };

  const latestTime = getLatestTimestamp();
  const formattedTime = formatTime(latestTime);

  // Determine if there's data
  const hasData = displayValue !== "N/A";

  return (
    <div
      className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 transition-all hover:shadow-md"
      data-patient-id={patientId}
    >
      {/* Header with icon and badge */}
      <div className="flex items-center justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${variant.iconBgColor} ${variant.textColor}`}
        >
          {variant.icon}
        </div>
        {hasData ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            Active
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
            No Data
          </span>
        )}
      </div>

      {/* Title */}
      <div>
        <p className="text-xl font-semibold text-slate-900">{variant.label}</p>
      </div>

      {/* Value with status indicator */}
      {hasData ? (
        <>
          <div className="flex justify-center items-center gap-2">
            <p className={`text-4xl font-bold ${variant.textColor}`}>
              {displayValue}
              <span className="ml-1 text-sm font-normal text-slate-500">
                {unit}
              </span>
            </p>
          </div>

          <div className="flex items-center justify-between mt-2">
            {/* Timestamp */}
            <p className="text-xs text-slate-500">
              Last update: {formattedTime}
            </p>

            {/* View link */}
            <button
              onClick={onView}
              className={`inline-flex items-center gap-1 text-sm font-semibold ${variant.textColor} transition-colors hover:opacity-75 cursor-pointer`}
            >
              View
              <span>›</span>
            </button>
          </div>
        </>
      ) : (
        <>
          {/* No Data Message */}
          <div className="flex items-center">
            <p className="text-sm text-slate-500">No data available yet</p>
          </div>

          {/* Add Data Button */}
          <div className="flex justify-end">
            <button
              onClick={onView}
              className={`inline-flex items-center gap-1 text-sm font-semibold transition-colors hover:opacity-75 cursor-pointer`}
            >
              Add Data
              <span>›</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
