import { Activity, CalendarDays, Scale, UserRound } from "lucide-react";
import type { ComponentProps } from "react";
import { MetricCard } from "../components/metric-card";

interface HealthProfileProps {
  patientId: string;
  patientName: string;
  birthday?: Date | string;
  gender?: string;
  lastUpdatedAt?: Date | string;
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
  weightKg?: number;
  bmi?: number;
}

type MetricCardMock = Pick<
  ComponentProps<typeof MetricCard>,
  "metricsType" | "values" | "unit"
>;

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

export function HealthProfile({
  patientId,
  patientName,
  birthday = "1998-04-17",
  gender = "Female",
  lastUpdatedAt = new Date(),
  heartRate = 78,
  systolic = 120,
  diastolic = 80,
  weightKg = 62,
  bmi = 22.4,
}: HealthProfileProps) {
  const updatedDate = formatDate(lastUpdatedAt);
  const updatedTime = formatTime(lastUpdatedAt);
  const metricCardMocks: MetricCardMock[] = [
    {
      metricsType: "heart_rate",
      values: {
        value: {
          value: heartRate,
          recordedAt: lastUpdatedAt,
        },
      },
      unit: "bpm",
    },
    {
      metricsType: "blood_pressure",
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
    },
  ];

  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-slate-200 bg-slate-50 p-4 lg:block">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 text-slate-800">
          <Activity className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Health Profile</h3>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Last updated: {updatedDate}, {updatedTime}
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">{patientName}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            <span>Birthday: {formatDate(birthday)}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5 text-slate-400" />
            <span>Gender: {gender}</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Current Vitals
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {metricCardMocks.map((card) => (
            <MetricCard
              key={`${patientId}-${card.metricsType}`}
              patientId={patientId}
              metricsType={card.metricsType}
              values={card.values}
              unit={card.unit}
            />
          ))}

          <div className="flex items-center gap-3 rounded-2xl border border-lime-200 bg-lime-50 p-3">
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
          </div>
        </div>
      </div>
    </aside>
  );
}
