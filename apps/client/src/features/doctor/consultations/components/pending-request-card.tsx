import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Clock3, MessageSquare, X } from "lucide-react";

interface PendingRequestCardProps {
  id: string;
  patientAvatarUrl?: string;
  patientIsOnline?: boolean;
  patientName: string;
  patientBirthDay: Date;
  patientNote?: string;
  patientGender: string;
  createdAt: Date;
  onAccept?: () => void;
  onDecline?: () => void;
  isAccepting?: boolean;
  isDeclining?: boolean;
}

function getAge(birthDay: Date) {
  const today = new Date();
  let age = today.getFullYear() - birthDay.getFullYear();
  const monthDiff = today.getMonth() - birthDay.getMonth();
  const dayDiff = today.getDate() - birthDay.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function formatRelativeTime(date: Date) {
  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) {
    const minutes = Math.max(1, Math.floor(diffMs / minuteMs));
    return `Requested ${minutes} min${minutes > 1 ? "s" : ""} ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs);
    return `Requested ${hours} hour${hours > 1 ? "s" : ""} ago`;
  }

  const days = Math.floor(diffMs / dayMs);
  return `Requested ${days} day${days > 1 ? "s" : ""} ago`;
}

export function PendingRequestCard({
  id,
  patientAvatarUrl,
  patientIsOnline = false,
  patientName,
  patientBirthDay,
  patientNote,
  patientGender,
  createdAt,
  onAccept,
  onDecline,
  isAccepting = false,
  isDeclining = false,
}: PendingRequestCardProps) {
  const age = getAge(patientBirthDay);
  const requestTime = formatRelativeTime(createdAt);
  const displayNote = patientNote?.trim() || "No note provided.";
  const isProcessing = isAccepting || isDeclining;

  return (
    <article
      data-request-id={id}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
    >
      <div className="flex items-center gap-3">
        <UserAvatar
          name={patientName}
          url={patientAvatarUrl}
          isOnline={patientIsOnline}
          avtStyle="h-14 w-14 rounded-xl"
        />
        <div>
          <h3 className="text-xl font-semibold leading-tight text-slate-900">
            {patientName}
          </h3>
          <p className="mt-1 text-base text-slate-500">
            {age} yrs - {patientGender}
          </p>
        </div>
      </div>

      <section className="mt-4 flex h-32 flex-col rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Patient note:
        </p>
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
          {displayNote}
        </p>
      </section>

      <div className="mt-4 border-t border-slate-200 pt-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex items-center gap-2 text-slate-400">
            <Clock3 className="h-4 w-4" />
            <span className="text-sm">{requestTime}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onDecline}
              disabled={isProcessing}
              className="h-10 rounded-2xl px-5 text-sm text-slate-500 whitespace-nowrap"
            >
              <X className="mr-1.5 h-4 w-4" />
              {isDeclining ? "Declining..." : "Decline"}
            </Button>
            <Button
              type="button"
              onClick={onAccept}
              disabled={isProcessing}
              className="h-10 rounded-2xl bg-lime-400 px-5 text-sm font-semibold text-slate-900 whitespace-nowrap hover:bg-lime-500"
            >
              <MessageSquare className="mr-1.5 h-4 w-4" />
              {isAccepting ? "Accepting..." : "Accept & Chat"}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
