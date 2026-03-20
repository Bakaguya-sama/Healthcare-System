import {
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldAlert,
  X,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";

export type NotificationType = "info" | "success" | "warning" | "critical";

export type NotificationTypeMeta = {
  icon: typeof Bell;
  iconColor: string;
  iconBg: string;
  badgeText: string;
  badgeClass: string;
};

interface NotificationDetailCardProps {
  id: string | number;
  title?: string;
  message?: string;
  isRead?: boolean;
  createdAt?: Date | string;
  type?: NotificationType;
  isOpen: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  dismissLabel?: string;
}

export const notificationTypeMap: Record<
  NotificationType,
  NotificationTypeMeta
> = {
  info: {
    icon: Bell,
    iconColor: "text-sky-600",
    iconBg: "bg-sky-50",
    badgeText: "Information",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
  },
  success: {
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-50",
    badgeText: "Completed",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  warning: {
    icon: FileText,
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
    badgeText: "Attention Required",
    badgeClass: "border-amber-300 bg-amber-50 text-amber-600",
  },
  critical: {
    icon: ShieldAlert,
    iconColor: "text-red-600",
    iconBg: "bg-red-50",
    badgeText: "Critical",
    badgeClass: "border-red-300 bg-red-50 text-red-700",
  },
};

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function NotificationDetailCard({
  id,
  title = "Untitled notification",
  message = "No additional details for this notification.",
  isRead = false,
  createdAt = new Date(),
  type = "info",
  isOpen,
  onClose,
  onDismiss,
  onPrimaryAction,
  primaryActionLabel = "Review",
  dismissLabel = "Dismiss",
}: NotificationDetailCardProps) {
  if (!isOpen) return null;

  const currentType = notificationTypeMap[type];
  const TypeIcon = currentType.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close notification detail"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
      />

      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div
                className={`inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${currentType.iconBg}`}
              >
                <TypeIcon className={`h-8 w-8 ${currentType.iconColor}`} />
              </div>

              <div className="min-w-0">
                <h3 className="text-2xl font-semibold text-slate-900">
                  {title}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-4 w-4" />
                    {formatDateTime(createdAt)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${currentType.badgeClass}`}
                  >
                    <span className="mr-1.5 h-2 w-2 rounded-full bg-current/70" />
                    {currentType.badgeText}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-500"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="my-6 border-t border-slate-200" />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Details
            </p>
            <div className="mt-3 whitespace-pre-line rounded-3xl border border-slate-200 bg-slate-50 p-6 text-base leading-relaxed text-slate-600">
              {message}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <div className="inline-flex items-center gap-2 text-slate-400">
              <Bell className="h-4 w-4" />
              <span>Notification ID #{id}</span>
            </div>
            {/* <div
              className={`inline-flex items-center gap-2 font-semibold ${isRead ? "text-emerald-500" : "text-amber-500"}`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{isRead ? "Read" : "Unread"}</span>
            </div> */}
          </div>
        </div>

        <div className="flex align-center justify-center gap-3 border-t border-slate-200 bg-white p-6 ">
          <Button
            variant="outline"
            size="lg"
            className="h-14 w-xs rounded-2xl text-slate-600"
            onClick={() => {
              onDismiss?.();
              onClose();
            }}
          >
            {dismissLabel}
          </Button>
          {/* <Button
            size="lg"
            className="h-14 rounded-2xl bg-amber-500 text-white hover:bg-amber-600"
            onClick={() => {
              onPrimaryAction?.();
              onClose();
            }}
          >
            {primaryActionLabel}
          </Button> */}
        </div>
      </div>
    </div>
  );
}
