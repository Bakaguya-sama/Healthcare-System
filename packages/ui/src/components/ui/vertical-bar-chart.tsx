import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

export interface BarChartDataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  maxBarThickness?: number;
}

interface BarChartProps {
  labels: string[];
  datasets: BarChartDataset[];
  title?: string;
  subtitle?: string;
  className?: string;
  height?: number;
  showLegend?: boolean;
  options?: ChartOptions<"bar">;
}

const defaultOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: {
      bottom: 8,
    },
  },
  interaction: {
    mode: "index",
    intersect: false,
  },
  plugins: {
    legend: {
      position: "top",
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: "rgba(148, 163, 184, 0.2)",
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
};

export function BarChart({
  labels,
  datasets,
  title,
  subtitle,
  className,
  height = 400,
  showLegend = true,
  options,
}: BarChartProps) {
  const data: ChartData<"bar"> = {
    labels,
    datasets,
  };

  const mergedOptions: ChartOptions<"bar"> = {
    ...defaultOptions,
    ...options,
    plugins: {
      ...defaultOptions.plugins,
      ...options?.plugins,
      legend: {
        ...defaultOptions.plugins?.legend,
        ...options?.plugins?.legend,
        display: showLegend,
      },
      title: {
        display: false,
        ...options?.plugins?.title,
      },
    },
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className ?? ""}`}
      style={{ height }}
    >
      {(title || subtitle) && (
        <div className="mb-3 shrink-0">
          {title && (
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          )}
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      )}
      <div className="min-h-0 flex-1 pb-1">
        <Bar options={mergedOptions} data={data} />
      </div>
    </div>
  );
}
