import { type ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

interface CardProps {
  title: string;
  icon?: ReactNode;
  stats: number;
  subText?: string;
  comparedStats?: number;
  iconClassName?: string;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function OverviewCard({
  title,
  icon,
  stats,
  subText = "",
  comparedStats,
  iconClassName = "bg-[var(--color-brand-light)] text-slate-800",
}: CardProps) {
  const isPositive = comparedStats ? comparedStats >= 0 : null;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${iconClassName}`}
        >
          {icon}
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isPositive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>
            {isPositive ? "+" : ""}
            {comparedStats}%
          </span>
        </div>
      </div>

      <p className="text-2xl font-bold leading-none text-slate-900">
        {formatNumber(stats)}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subText}</p>
    </li>
  );
}
