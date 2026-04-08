import { OverviewCard } from "@repo/ui/components/data-display/overview-card";
import {
  MessageSquareText,
  ShieldAlert,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import type { ChartOptions } from "chart.js";
import { LineChart } from "@repo/ui/components/ui/line-chart";
import { BarChart } from "@repo/ui/components/ui/vertical-bar-chart";
import { useOverview } from "../hooks/useOverview";

export function Overview() {
  const { summary, isLoading, error } = useOverview();

  const lineChartLabels = summary.monthly.labels;

  const barChartLabels = summary.weekly.labels;

  const lineChartDatasets = [
    {
      label: "Patients",
      data: summary.monthly.totalUsers,
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
      data: summary.monthly.activeDoctors,
      borderColor: "rgb(16, 185, 129)",
      backgroundColor: "rgba(16, 185, 129, 0.08)",
      tension: 0.35,
      fill: false,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
    },
    {
      label: "AI Sessions",
      data: summary.monthly.aiChatSessions,
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
      data: summary.weekly.doctorSessions,
      borderColor: "rgb(59, 130, 246)",
      backgroundColor: "rgb(59, 130, 246)",
      borderRadius: 6,
      maxBarThickness: 14,
    },
    {
      label: "Reports",
      data: summary.weekly.violationReports,
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
      stats: isLoading ? 0 : summary.totalUsers,
      subText: "vs last month",
      comparedStats: 12.5,
      iconClassName: "bg-blue-50 text-blue-600",
    },
    {
      title: "Active Doctors",
      icon: <Stethoscope size={18} />,
      stats: isLoading ? 0 : summary.activeDoctors,
      subText: "vs last month",
      comparedStats: 8.2,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "AI Chat Sessions",
      icon: <MessageSquareText size={18} />,
      stats: isLoading ? 0 : summary.aiChatSessions,
      subText: "this month",
      comparedStats: 31.4,
      iconClassName: "bg-amber-50 text-amber-600",
    },
    {
      title: "Pending Verifications",
      icon: <ShieldAlert size={18} />,
      stats: isLoading ? 0 : summary.pendingVerifications,
      subText: "needs review",
      comparedStats: -5,
      iconClassName: "bg-red-50 text-red-500",
    },
  ];

  const date = new Date();
  const today = date.toLocaleDateString("en-US", {
    weekday: "long", // "Monday"
    year: "numeric", // "2024"
    month: "long", // "May"
    day: "numeric", // "15"
  });

  return (
    <div className="w-full p-6 ">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Overview</h1>
            <p className="text-sm text-slate-500">{today}</p>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {isLoading ? "Loading..." : null}
          </button>
        </div>

        <ul className="m-0 grid w-full list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-4">
          {overviewStats.map((item) => (
            <OverviewCard key={item.title} {...item} />
          ))}
        </ul>

        <div className="mt-5 grid min-h-130 grid-cols-1 gap-4 xl:grid-cols-3">
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
    </div>
  );
}
