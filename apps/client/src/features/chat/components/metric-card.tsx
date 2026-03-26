import { Heart, Activity, Weight, Droplet, Flame, Ruler } from "lucide-react";

type MetricsTypes =
  | "blood_pressure"
  | "heart_rate"
  | "bmi"
  | "height"
  | "weight"
  | "water_intake"
  | "kcal_intake";

interface MetricEntry {
  value: number;
  recordedAt: Date | string;
}

interface MetricCardProps {
  patientId: string;
  metricsType: MetricsTypes;
  values: Record<string, MetricEntry>;
  unit: string;
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
};

function formatMetricValue(
  metricsType: MetricsTypes,
  values: Record<string, MetricEntry>,
  unit: string,
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
    case "kcal_intake": {
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

export function MetricCard({
  patientId,
  metricsType,
  values,
  unit,
}: MetricCardProps) {
  const variant = VARIANT_STYLES[metricsType];
  const displayValue = formatMetricValue(metricsType, values, unit);
  return (
    <div
      data-patient-id={patientId}
      className={`flex items-center gap-3 rounded-2xl border ${variant.borderColor} ${variant.bgColor} p-3 min-w-min`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${variant.iconBgColor} ${variant.textColor}`}
      >
        {variant.icon}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs font-medium text-slate-500">{variant.label}</p>
        <p className={`text-lg font-semibold ${variant.textColor}`}>
          {displayValue}
          {displayValue !== "N/A" && (
            <span className="ml-1 text-sm font-normal text-slate-500">
              {unit}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
