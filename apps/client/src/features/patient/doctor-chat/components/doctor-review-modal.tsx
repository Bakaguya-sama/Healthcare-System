import { useEffect, useMemo, useState } from "react";
import { MessageSquareText, Star, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { UserAvatar } from "@repo/ui/components/ui/user-avatar";

export interface DoctorReviewPayload {
  rate: number;
  comment: string;
  doctorId: string;
  patientId: string;
  sessionId: string;
}

interface DoctorReviewModalProps {
  isOpen: boolean;
  doctorId: string;
  patientId: string;
  sessionId: string;
  doctorName: string;
  doctorAvatarUrl?: string;
  doctorIsOnline: boolean;
  rate?: number;
  comment?: string;
  onClose: () => void;
  onSubmit: (payload: DoctorReviewPayload) => void;
}

const MAX_COMMENT_LENGTH = 1000;

function clampRate(value: number) {
  return Math.max(0, Math.min(5, Math.round(value)));
}

export function DoctorReviewModal({
  isOpen,
  doctorId,
  patientId,
  sessionId,
  doctorName,
  doctorAvatarUrl,
  doctorIsOnline,
  rate = 0,
  comment = "",
  onClose,
  onSubmit,
}: DoctorReviewModalProps) {
  const [selectedRate, setSelectedRate] = useState(rate);
  const [reviewComment, setReviewComment] = useState(comment);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedRate(clampRate(rate));
    setReviewComment(comment);
  }, [comment, isOpen, rate]);

  const canSubmit = selectedRate > 0;

  const remainingCharacters = useMemo(
    () => MAX_COMMENT_LENGTH - reviewComment.length,
    [reviewComment],
  );

  const handleSubmit = () => {
    if (!canSubmit) return;

    onSubmit({
      rate: selectedRate,
      comment: reviewComment.trim(),
      doctorId,
      patientId,
      sessionId,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close review modal"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55"
      />

      <div className="relative w-full max-w-[720px] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lime-400 text-slate-900 shadow-sm">
              <MessageSquareText className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">
                Rate Your Experience
              </h2>
              <p className="mt-2 text-base text-slate-500">
                Your feedback helps us maintain high-quality healthcare
                standards.
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-7 sm:px-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={doctorName}
                url={doctorAvatarUrl}
                isOnline={doctorIsOnline}
                avtStyle="h-14 w-14 rounded-full"
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-500">
                  Your consultation with:
                </p>
                <h3 className="truncate text-xl font-semibold text-slate-900">
                  {doctorName}
                </h3>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {Array.from({ length: 5 }).map((_, index) => {
                const value = index + 1;
                const isSelected = value <= selectedRate;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedRate(value)}
                    className="group rounded-full p-0.5 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    aria-label={`Rate ${value} out of 5`}
                  >
                    <Star
                      className={`h-11 w-11 transition-colors sm:h-12 sm:w-12 ${
                        isSelected
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300 group-hover:text-amber-300"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <p className="text-base text-slate-400">
              {selectedRate > 0
                ? `${selectedRate}/5 selected`
                : "Click to rate"}
            </p>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="text-base font-semibold text-slate-900">
                Leave a comment{" "}
                <span className="font-normal text-slate-500">(Optional)</span>
              </label>
              <span className="text-xs text-slate-400">
                {reviewComment.length}/{MAX_COMMENT_LENGTH}
              </span>
            </div>

            <Textarea
              value={reviewComment}
              maxLength={MAX_COMMENT_LENGTH}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Share your thoughts on the doctor's advice, bedside manner, and overall experience..."
              className="min-h-[180px] rounded-2xl border-slate-200 bg-white px-4 py-4 text-base leading-relaxed text-slate-700 placeholder:text-slate-400"
            />

            {remainingCharacters === 0 && (
              <p className="mt-2 text-xs text-amber-600">
                Maximum comment length reached.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={onClose}
            className="h-12 rounded-2xl px-6 text-slate-700 hover:bg-slate-100"
          >
            Skip for now
          </Button>

          <Button
            type="button"
            size="lg"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-12 rounded-2xl bg-lime-300 px-7 text-slate-700 hover:bg-lime-400"
          >
            Submit Review
          </Button>
        </div>
      </div>
    </div>
  );
}
