import { LineChart } from "@repo/ui/components/ui/line-chart";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

type MetricReading = {
  id: string;
  recordedAt: string;
  primaryValue: number;
  secondaryValue?: number;
};

type TrackingChartProps = {
  title: string;
  metricType: string;
  selectedDate: Date;
  entries: MetricReading[];
  hasData: boolean;
  unit: string;
};

type RangeOption = {
  label: "1D" | "7D" | "1M" | "3M";
  days: number;
};

const RANGE_OPTIONS: RangeOption[] = [
  { label: "1D", days: 1 },
  { label: "7D", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
];

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );

const formatLabel = (date: Date, compact: boolean) => {
  if (compact) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString("en-US", { weekday: "short" });
};

export function TrackingChart({
  title,
  metricType,
  selectedDate,
  entries,
  hasData,
  unit,
}: TrackingChartProps) {
  const [selectedRange, setSelectedRange] = useState<RangeOption>(
    RANGE_OPTIONS[0],
  );

  const chartModel = useMemo(() => {
    const selectedDayStart = startOfDay(selectedDate);
    const selectedDayEnd = endOfDay(selectedDate);
    const fromDate = addDays(selectedDayStart, -(selectedRange.days - 1));

    const filteredEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.recordedAt).getTime();
      return (
        entryDate >= fromDate.getTime() && entryDate <= selectedDayEnd.getTime()
      );
    });

    // 1D: show each record by time (12h), no daily averaging
    if (selectedRange.label === "1D") {
      const sortedEntries = [...filteredEntries].sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
      );

      const labels = sortedEntries.map((entry) =>
        new Date(entry.recordedAt).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }),
      );

      const primaryData = sortedEntries.map((entry) => entry.primaryValue);
      const secondaryData = sortedEntries.map((entry) =>
        typeof entry.secondaryValue === "number" ? entry.secondaryValue : null,
      );

      return { labels, primaryData, secondaryData };
    }

    const labels: string[] = [];
    const dateKeys: string[] = [];

    // other ranges
    for (let i = 0; i < selectedRange.days; i += 1) {
      const date = addDays(fromDate, i);
      labels.push(formatLabel(date, selectedRange.days > 7));
      dateKeys.push(toDateKey(date));
    }

    const grouped = new Map<
      string,
      { primaryValues: number[]; secondaryValues: number[] }
    >();

    for (const entry of filteredEntries) {
      const entryDate = new Date(entry.recordedAt);
      const key = toDateKey(entryDate);
      const current = grouped.get(key) ?? {
        primaryValues: [],
        secondaryValues: [],
      };
      current.primaryValues.push(entry.primaryValue);
      if (typeof entry.secondaryValue === "number") {
        current.secondaryValues.push(entry.secondaryValue);
      }
      grouped.set(key, current);
    }

    const primaryData = dateKeys.map((key) => {
      const bucket = grouped.get(key);
      if (!bucket || bucket.primaryValues.length === 0) return null;
      const avg =
        bucket.primaryValues.reduce((sum, value) => sum + value, 0) /
        bucket.primaryValues.length;
      return Math.round(avg * 10) / 10;
    });

    const secondaryData = dateKeys.map((key) => {
      const bucket = grouped.get(key);
      if (!bucket || bucket.secondaryValues.length === 0) return null;
      const avg =
        bucket.secondaryValues.reduce((sum, value) => sum + value, 0) /
        bucket.secondaryValues.length;
      return Math.round(avg * 10) / 10;
    });

    return { labels, primaryData, secondaryData };
  }, [entries, selectedDate, selectedRange]);

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-800">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">
              No readings yet - Chart will generate after first log
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs text-slate-400">
            {RANGE_OPTIONS.map((option) => (
              <span key={option.label} className="rounded-lg px-2 py-1">
                {option.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-emerald-200">
            <Plus className="h-7 w-7" />
          </div>
          <p className="text-lg font-semibold text-slate-500">
            No data available yet
          </p>
          <p className="mt-1 max-w-md text-sm text-slate-400">
            Log your first reading on the left to generate your{" "}
            {metricType.replaceAll("_", " ")} trend chart.
          </p>
        </div>
      </div>
    );
  }

  const datasets = [
    {
      label:
        metricType === "blood_pressure"
          ? `Systolic: ${unit}`
          : `${title}: ${unit}`,
      data: chartModel.primaryData,
      borderColor: "#3B82F6",
      backgroundColor: "rgba(59, 130, 246, 0.15)",
      borderWidth: 2,
      tension: 0.35,
      pointRadius: 3,
      pointHoverRadius: 5,
    },
  ];

  if (metricType === "blood_pressure") {
    datasets.push({
      label: `Diastolic: ${unit}`,
      data: chartModel.secondaryData,
      borderColor: "#84CC16",
      backgroundColor: "rgba(132, 204, 22, 0.15)",
      borderWidth: 2,
      tension: 0.35,
      pointRadius: 3,
      pointHoverRadius: 5,
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-800">
            {title} Trend
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Showing data up to{" "}
            {selectedDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                selectedRange.label === option.label
                  ? "bg-lime-400 text-slate-900"
                  : "text-slate-500 hover:bg-white"
              }`}
              onClick={() => setSelectedRange(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <LineChart
        labels={chartModel.labels}
        datasets={datasets}
        showLegend
        className="border-none p-0 shadow-none"
        height={320}
        options={{
          scales: {
            y: {
              beginAtZero: false,
              grid: {
                color: "rgba(148, 163, 184, 0.2)",
              },
              ticks: {
                color: "#94A3B8",
              },
            },
            x: {
              grid: {
                display: false,
              },
              ticks: {
                color: "#94A3B8",
              },
            },
          },
          plugins: {
            legend: {
              position: "bottom",
            },
          },
        }}
      />
    </div>
  );
}
