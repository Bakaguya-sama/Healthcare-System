import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { Dot, Clock, CheckCircle, CircleX } from "lucide-react";

type SessionStatus = "pending" | "rejected" | "completed" | "active";

interface SessionCardProps {
  id: string;
  onClick?: () => void;
  status: SessionStatus;
  isSelected: boolean;
  updatedAt: Date;
  doctorName: string;
  doctorIsActive: boolean;
  doctorSpecialty: string;
  doctorAvatarUrl?: string;
}

export function SessionCard({
  onClick,
  status,
  isSelected,
  updatedAt,
  doctorName,
  doctorIsActive,
  doctorSpecialty,
  doctorAvatarUrl,
}: SessionCardProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getStatusBadge = () => {
    const baseClasses =
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium";

    switch (status) {
      case "active":
        return (
          <span className={`${baseClasses} bg-emerald-100 text-emerald-700`}>
            Active
          </span>
        );
      case "pending":
        return (
          <span className={`${baseClasses} bg-amber-100 text-amber-700`}>
            <Clock className="h-3.5 w-3.5" />
            Pending Approval
          </span>
        );
      case "completed":
        return (
          <span className={`${baseClasses} bg-slate-100 text-slate-600`}>
            <CheckCircle className="h-3.5 w-3.5" />
            Ended
          </span>
        );
      case "rejected":
        return (
          <span className={`${baseClasses} bg-red-100 text-red-700`}>
            <CircleX className="h-3.5 w-3.5" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const containerClasses = `w-full cursor-pointer rounded-2xl border p-4 transition-all ${
    isSelected
      ? "border-brand/35 bg-brand-light/50 shadow-md"
      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
  }`;

  const borderLeftClasses = `absolute left-0 top-0 h-full w-1 rounded-l-2xl ${
    isSelected ? "bg-brand" : "bg-transparent"
  }`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative ${containerClasses}`}
    >
      <div className={borderLeftClasses} />

      <div className="flex items-center gap-4">
        <UserAvatar
          name={doctorName}
          url={doctorAvatarUrl}
          isOnline={doctorIsActive}
          avtStyle="h-14 w-14 rounded-full"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col items-start">
              <h3 className="text-base font-semibold text-slate-900 truncate">
                {doctorName}
              </h3>
              <p className="text-sm text-slate-500 truncate">
                {doctorSpecialty}
              </p>
              <div className="mt-1">{getStatusBadge()}</div>
            </div>
            <p className="text-sm text-slate-400 shrink-0">
              {formatTime(updatedAt)}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
