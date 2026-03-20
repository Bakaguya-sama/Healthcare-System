import {
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

export interface LineChartDataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor?: string;
  fill?: boolean;
  tension?: number;
  borderWidth?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
}

interface LineChartProps {
  labels: string[];
  datasets: LineChartDataset[];
  title?: string;
  subtitle?: string;
  className?: string;
  height?: number;
  showLegend?: boolean;
  options?: ChartOptions<"line">;
}

const defaultOptions: ChartOptions<"line"> = {
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

export function LineChart({
  labels,
  datasets,
  title,
  subtitle,
  className,
  height = 400,
  showLegend = true,
  options,
}: LineChartProps) {
  const data: ChartData<"line"> = {
    labels,
    datasets,
  };

  const mergedOptions: ChartOptions<"line"> = {
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
        <Line options={mergedOptions} data={data} />
      </div>
    </div>
  );
}
