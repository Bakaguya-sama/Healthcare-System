import { Star, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { UserAvatar } from "@repo/ui/components/ui/user-avatar";

interface ReviewModalProps {
  isOpen: boolean;
  sessionId: string;
  patientName: string;
  patientAvatarUrl?: string;
  rating?: number;
  review?: string;
  endedAt?: Date;
  onClose: () => void;
}

function formatEndedAt(value?: Date) {
  if (!value) return "-";

  const endedDate = new Date(value);
  const date = endedDate.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = endedDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${date}, ${time}`;
}

export function ReviewModal({
  isOpen,
  sessionId,
  patientName,
  patientAvatarUrl,
  rating = 0,
  review,
  endedAt,
  onClose,
}: ReviewModalProps) {
  if (!isOpen) return null;

  const safeRating = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close review modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />

      <div className="relative w-full max-w-140 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-2xl font-semibold text-slate-900">
          Patient Review
        </h2>
        <p className="mt-1 text-sm text-slate-500">Session #{sessionId}</p>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <UserAvatar
            name={patientName}
            url={patientAvatarUrl}
            isOnline={false}
            avtStyle="h-12 w-12 rounded-full"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {patientName}
            </p>
            <p className="text-xs text-slate-500">
              Submitted on {formatEndedAt(endedAt)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-slate-600">Rating</p>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={`h-5 w-5 ${
                  index < safeRating
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-300"
                }`}
              />
            ))}
            <span className="ml-2 text-sm text-slate-500">{safeRating}/5</span>
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-slate-600">Review</p>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {review || "No written review was provided by this patient."}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
