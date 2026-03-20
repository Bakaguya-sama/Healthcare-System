import { OverviewCard } from "@/features/overview/components/overview-card";
import {
  MessageSquareText,
  ShieldAlert,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import type { ChartOptions } from "chart.js";
import { LineChart } from "@repo/ui/components/ui/line-chart";
import { BarChart } from "@repo/ui/components/ui/vertical-bar-chart";

export function Overview() {
  const lineChartLabels = [
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
  ];
  const barChartLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const lineChartDatasets = [
    {
      label: "Patients",
      data: [1200, 1450, 1380, 1710, 1650, 2200, 2400, 2220],
      borderColor: "rgb(59, 130, 246)",
      backgroundColor: "rgba(59, 130, 246, 0.14)",
      tension: 0.4,
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
    },
    {
      label: "Doctors",
      data: [85, 95, 92, 105, 108, 112, 118, 121],
      borderColor: "rgb(16, 185, 129)",
      backgroundColor: "rgba(16, 185, 129, 0.08)",
      tension: 0.35,
      fill: false,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
    },
    {
      label: "AI Usage",
      data: [320, 520, 480, 720, 680, 980, 1120, 1060],
      borderColor: "rgb(245, 158, 11)",
      backgroundColor: "rgba(245, 158, 11, 0.12)",
      tension: 0.4,
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
    },
  ];

  const barChartDatasets = [
    {
      label: "Consultations",
      data: [48, 72, 61, 86, 95, 43, 29],
      borderColor: "rgb(59, 130, 246)",
      backgroundColor: "rgb(59, 130, 246)",
      borderRadius: 6,
      maxBarThickness: 14,
    },
    {
      label: "Reports",
      data: [6, 8, 4, 12, 7, 3, 2],
      borderColor: "rgb(239, 68, 68)",
      backgroundColor: "rgb(239, 68, 68)",
      borderRadius: 6,
      maxBarThickness: 14,
    },
  ];

  const lineOptions: ChartOptions<"line"> = {
    plugins: {
      legend: {
        align: "end",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxHeight: 6,
          boxWidth: 6,
          padding: 14,
          color: "rgb(100, 116, 139)",
          font: {
            size: 11,
          },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 2400,
        ticks: {
          stepSize: 600,
          color: "rgb(148, 163, 184)",
          font: {
            size: 11,
          },
        },
        grid: {
          color: "rgba(148, 163, 184, 0.18)",
        },
        border: {
          display: false,
        },
      },
      x: {
        ticks: {
          color: "rgb(148, 163, 184)",
          font: {
            size: 11,
          },
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
      },
    },
  };

  const barOptions: ChartOptions<"bar"> = {
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 25,
          color: "rgb(148, 163, 184)",
          font: {
            size: 11,
          },
        },
        grid: {
          color: "rgba(148, 163, 184, 0.18)",
        },
        border: {
          display: false,
        },
      },
      x: {
        ticks: {
          color: "rgb(148, 163, 184)",
          font: {
            size: 11,
          },
        },
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
      },
    },
  };

  const overviewStats = [
    {
      title: "Total Users",
      icon: <UsersRound size={18} />,
      stats: 24891,
      subText: "vs last month",
      comparedStats: 12.5,
      iconClassName: "bg-blue-50 text-blue-600",
    },
    {
      title: "Active Doctors",
      icon: <Stethoscope size={18} />,
      stats: 1382,
      subText: "vs last month",
      comparedStats: 8.2,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "AI Chat Usages",
      icon: <MessageSquareText size={18} />,
      stats: 98432,
      subText: "this month",
      comparedStats: 31.4,
      iconClassName: "bg-amber-50 text-amber-600",
    },
    {
      title: "Pending Verifications",
      icon: <ShieldAlert size={18} />,
      stats: 47,
      subText: "needs review",
      comparedStats: -5,
      iconClassName: "bg-red-50 text-red-500",
    },
  ];

  return (
    <div className="w-full p-6 ">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">Tuesday, March 3, 2026</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Last 30 days
        </button>
      </div>

      <ul className="m-0 grid w-full list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map((item) => (
          <OverviewCard key={item.title} {...item} />
        ))}
      </ul>

      <div className="mt-5 grid min-h-[520px] grid-cols-1 gap-4 xl:grid-cols-3">
        <LineChart
          title="Platform Growth"
          subtitle="Patients, Doctors & AI usage over 8 months"
          labels={lineChartLabels}
          datasets={lineChartDatasets}
          options={lineOptions}
          className="xl:col-span-2"
          height={460}
        />

        <BarChart
          title="Weekly Activity"
          subtitle="Consultations vs Reports"
          labels={barChartLabels}
          datasets={barChartDatasets}
          options={barOptions}
          className="xl:col-span-1"
          height={460}
        />
      </div>
    </div>
  );
}
