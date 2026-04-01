import { Button } from "@repo/ui/components/ui/button";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";

interface RequestModalProps {
  isOpen: boolean;
  name: string;
  specialty: string;
  avatarUrl?: string;
  isOnline?: boolean;
  patientNote: string;
  onClose: () => void;
  onSendRequest: (patientNote: string) => void;
}

export function RequestModal({
  isOpen,
  name,
  specialty,
  avatarUrl,
  isOnline,
  patientNote,
  onClose,
  onSendRequest,
}: RequestModalProps) {
  const [reason, setReason] = useState(patientNote);

  useEffect(() => {
    if (!isOpen) {
      setReason("");
      return;
    }

    setReason(patientNote);
  }, [isOpen, patientNote]);

  const canSubmit = reason.trim().length > 0;

  const handleClose = () => {
    setReason("");
    onClose();
  };

  const handleSend = () => {
    onSendRequest(reason.trim());
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close request consultation modal"
        onClick={handleClose}
        className="absolute inset-0 bg-black/50"
      />

      <article
        className="relative z-10 flex w-full max-w-[760px] max-h-[92vh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Request Consultation
              </h2>
              <p className="mt-1 text-base text-slate-500">
                Please provide some initial details so the doctor can review
                your request.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={name}
                url={avatarUrl}
                isOnline={isOnline}
                avtStyle="h-12 w-12 rounded-full"
              />

              <div className="min-w-0">
                <p className="truncate text-xl font-semibold text-slate-900">
                  Dr. {name}
                </p>
                <p className="text-sm text-slate-600">{specialty}</p>
              </div>
            </div>
          </section>

          <section className="mt-6">
            <label
              htmlFor="consultation-reason"
              className="mb-2 block text-xl font-semibold text-slate-900"
            >
              Reason for consultation / Current symptoms
            </label>

            <Textarea
              id="consultation-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Please describe what you are experiencing..."
              className="min-h-[200px] rounded-2xl border-slate-200 bg-white px-4 py-3 text-base text-slate-700 placeholder:text-slate-400"
            />
          </section>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="h-11 rounded-2xl border-slate-300 px-6 text-slate-700"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSend}
            disabled={!canSubmit}
            className="h-11 rounded-2xl bg-lime-300 px-6 text-slate-900 hover:bg-lime-400 disabled:bg-lime-200"
          >
            Send Request
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </footer>
      </article>
    </div>
  );
}
