import { Button } from "@repo/ui/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

interface HealthAlertModalProps {
  id: string;
  title: string;
  message: string;
  isOpen: boolean;
  onClose: () => void;
}

export function HealthAlertModal({
  id,
  title,
  message,
  isOpen,
  onClose,
}: HealthAlertModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close notification detail"
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl">
        <div className="border-b border-red-200 bg-gradient-to-r from-red-600 to-rose-600 p-6 text-white sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
                <AlertTriangle className="h-7 w-7" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-100">
                  Health Alert
                </p>
                <h3 className="mt-1 text-2xl font-semibold">{title}</h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-7">
          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-red-500">
              Alert Details
            </p>
            <div className="whitespace-pre-line text-base leading-relaxed text-slate-700">
              {message}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white p-5 sm:p-6">
          <Button
            variant="outline"
            size="lg"
            className="h-11 rounded-xl border-slate-300 px-5 text-slate-600"
            onClick={onClose}
          >
            Close
          </Button>

          {/* <Button
            size="lg"
            className="h-11 rounded-xl bg-red-600 px-5 text-white hover:bg-red-700"
            onClick={onClose}
          >
            Understood
          </Button> */}
        </div>
      </div>
    </div>
  );
}
