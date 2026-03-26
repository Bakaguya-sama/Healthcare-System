"use client";

import { useState } from "react";
import {
  ActionCard,
  type ActionCardItem,
} from "@repo/ui/components/ui/action-card";
import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { Eye, PhoneOff, Flag, MoreVertical } from "lucide-react";

interface ActiveSessionCardProps {
  sessionId: string;
  patientId: string;
  patientUrl?: string;
  patientName: string;
  patientIsOnline: boolean;
  lastSent: Date;
  onOpenchat: () => void;
  onViewProfile: () => void;
  onEndConsultation: () => void;
  onReport: () => void;
}

export function ActiveSessionCard({
  sessionId,
  patientId,
  patientUrl,
  patientName,
  patientIsOnline,
  lastSent,
  onOpenchat,
  onViewProfile,
  onEndConsultation,
  onReport,
}: ActiveSessionCardProps) {
  const [showActions, setShowActions] = useState(false);

  const formatLastSent = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  const actions: ActionCardItem[] = [
    {
      id: `${sessionId}-view-profile`,
      title: "View profile",
      icon: <Eye className="h-4 w-4" />,
      onHandle: () => {
        onViewProfile();
        setShowActions(false);
      },
    },
    {
      id: `${sessionId}-end-consultation`,
      title: "End Consultation",
      icon: <PhoneOff className="h-4 w-4" />,
      iconColor: "text-red-600",
      onHandle: () => {
        onEndConsultation();
        setShowActions(false);
      },
    },
    {
      id: `${sessionId}-report`,
      title: "Report",
      icon: <Flag className="h-4 w-4" />,
      iconColor: "text-orange-600",
      onHandle: () => {
        onReport();
        setShowActions(false);
      },
    },
  ];

  return (
    <article className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <UserAvatar
            name={patientName}
            url={patientUrl}
            isOnline={patientIsOnline}
            avtStyle="h-14 w-14 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-tight text-slate-900">
              {patientName}
            </h3>
            <p className="text-xs text-slate-500">
              Last message: {formatLastSent(lastSent)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowActions(!showActions)}
          className="relative inline-flex items-center justify-center rounded-lg p-2 hover:bg-slate-100 transition-colors"
        >
          <MoreVertical className="h-5 w-5 text-slate-600" />
          {showActions && <ActionCard actions={actions} />}
        </button>

        <button
          type="button"
          onClick={onOpenchat}
          className="rounded-lg bg-lime-400 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-lime-500 transition-colors whitespace-nowrap"
        >
          Open Chat
        </button>
      </div>
    </article>
  );
}
