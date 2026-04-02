import { Clock, Dot, MessageCircleIcon } from "lucide-react";

interface HistoryCardProps {
  title: string;
  createdAt: Date;
  isCurrent?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

function formatHistoryTime(date: Date, isCurrent: boolean) {
  if (isCurrent) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const now = new Date();
  const target = new Date(date);

  const isSameDay =
    now.getDate() === target.getDate() &&
    now.getMonth() === target.getMonth() &&
    now.getFullYear() === target.getFullYear();

  if (isSameDay) {
    return target.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getDate() === target.getDate() &&
    yesterday.getMonth() === target.getMonth() &&
    yesterday.getFullYear() === target.getFullYear();

  if (isYesterday) {
    return "Yesterday";
  }

  return target.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function HistoryCard({
  title,
  createdAt,
  isCurrent = false,
  isSelected = false,
  onClick,
}: HistoryCardProps) {
  const displayTime = formatHistoryTime(createdAt, isCurrent);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors cursor-pointer ${
        isSelected
          ? "border-brand/35 bg-brand-light/50"
          : "border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50"
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center ${
          isSelected ? "text-brand" : "text-slate-400"
        }`}
      >
        {isCurrent ? (
          <MessageCircleIcon className="h-4 w-4 text-brand" />
        ) : (
          <Clock className="h-4 w-4" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-base font-semibold ${
            isSelected ? "text-brand" : "text-slate-600"
          }`}
        >
          {title}
        </p>
        <p
          className={`mt-0.5 text-sm ${isSelected ? "text-brand/70" : "text-slate-400"}`}
        >
          {displayTime}
        </p>
      </div>

      {isCurrent ? <Dot className="h-6 w-6 shrink-0 text-brand" /> : null}
    </button>
  );
}
