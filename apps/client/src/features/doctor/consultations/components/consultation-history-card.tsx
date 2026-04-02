import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import {
  ActionCard,
  type ActionCardItem,
} from "@repo/ui/components/ui/action-card";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  Eye,
  Flag,
  MessageCircle,
  MoreVertical,
  NotebookPen,
  Star,
} from "lucide-react";

type SessionStatus = "completed" | "pending" | "rejected";

interface ConsultationHistoryCardProps {
  sessionId: string;
  patientId: string;
  patientName: string;
  patientAvatarUrl?: string;
  patientRating?: number;
  patientReview?: string;
  sessionStatus: SessionStatus;
  endedAt?: Date;
  onOpenchat: () => void;
  onViewProfile: () => void;
  onOpenReview: () => void;
  onReport: () => void;
}

function formatEndedAt(value?: Date) {
  if (!value) return "-";

  const now = new Date();
  const endedDate = new Date(value);

  const isSameDay =
    now.getDate() === endedDate.getDate() &&
    now.getMonth() === endedDate.getMonth() &&
    now.getFullYear() === endedDate.getFullYear();

  const time = endedDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isSameDay) return `Today, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getDate() === endedDate.getDate() &&
    yesterday.getMonth() === endedDate.getMonth() &&
    yesterday.getFullYear() === endedDate.getFullYear();

  if (isYesterday) return `Yesterday, ${time}`;

  const date = endedDate.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
  return `${date}, ${time}`;
}

function getStatusStyle(sessionStatus: SessionStatus) {
  if (sessionStatus === "completed") {
    return "bg-emerald-50 text-emerald-600";
  }

  if (sessionStatus === "rejected") {
    return "bg-rose-50 text-rose-500";
  }

  return "bg-amber-50 text-amber-600";
}

function getStatusLabel(sessionStatus: SessionStatus) {
  if (sessionStatus === "completed") return "Completed";
  if (sessionStatus === "rejected") return "Rejected";
  return "Pending";
}

export function ConsultationHistoryCard({
  sessionId,
  patientName,
  patientAvatarUrl,
  patientRating = 0,
  patientReview,
  sessionStatus,
  endedAt,
  onOpenchat,
  onViewProfile,
  onOpenReview,
  onReport,
}: ConsultationHistoryCardProps) {
  const [showActions, setShowActions] = useState(false);

  const actions: ActionCardItem[] = useMemo(() => {
    const menu: ActionCardItem[] = [
      {
        id: `${sessionId}-open-chat`,
        title: "Open chat",
        icon: <MessageCircle className="h-4 w-4" />,
        onHandle: () => {
          onOpenchat();
          setShowActions(false);
        },
      },
      {
        id: `${sessionId}-view-profile`,
        title: "View profile",
        icon: <Eye className="h-4 w-4" />,
        onHandle: () => {
          onViewProfile();
          setShowActions(false);
        },
      },
    ];

    if (sessionStatus !== "rejected") {
      menu.push({
        id: `${sessionId}-open-review`,
        title: "Open review",
        icon: <NotebookPen className="h-4 w-4" />,
        onHandle: () => {
          onOpenReview();
          setShowActions(false);
        },
      });
    }

    menu.push({
      id: `${sessionId}-report`,
      title: "Report",
      icon: <Flag className="h-4 w-4" />,
      iconColor: "text-red-600",
      onHandle: () => {
        onReport();
        setShowActions(false);
      },
    });

    return menu;
  }, [
    onOpenReview,
    onOpenchat,
    onReport,
    onViewProfile,
    sessionId,
    sessionStatus,
  ]);

  const ratingValue = Math.max(0, Math.min(5, Math.round(patientRating || 0)));

  return (
    <article className="relative grid grid-cols-[2fr_3fr_2fr_1.2fr_1.2fr_0.8fr] items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar
          name={patientName}
          url={patientAvatarUrl}
          isOnline={false}
          avtStyle="h-11 w-11 rounded-full"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {patientName}
          </p>
          <p className="truncate text-xs text-slate-400">
            Session #{sessionId}
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500">{formatEndedAt(endedAt)}</p>

      <div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyle(sessionStatus)}`}
        >
          {getStatusLabel(sessionStatus)}
        </span>
      </div>

      <div className="flex items-center gap-0.5 text-amber-400">
        {sessionStatus === "rejected" ? (
          <span className="text-xs text-slate-400">-</span>
        ) : (
          Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className={`h-3.5 w-3.5 ${
                index < ratingValue
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-300"
              }`}
            />
          ))
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm text-slate-700">
          {patientReview || "No written review was provided by this patient."}
        </p>
      </div>

      <div className="relative flex justify-end">
        <button
          type="button"
          onClick={() => setShowActions((prev) => !prev)}
          className="inline-flex items-center rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open history actions</span>
        </button>
        {showActions && (
          <ActionCard
            onClickOutside={() => setShowActions(false)}
            actions={actions}
            className="top-7"
          />
        )}
      </div>
    </article>
  );
}
