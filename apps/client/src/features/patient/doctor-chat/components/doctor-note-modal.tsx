import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { NotebookText, X } from "lucide-react";

interface DoctorNoteModalProps {
  doctorNote?: string;
  doctorName: string;
  doctorAvatarUrl?: string;
  doctorIsOnline: boolean;
  onClose: () => void;
  isOpen: boolean;
}

export function DoctorNoteModal({
  doctorNote,
  doctorName,
  doctorAvatarUrl,
  doctorIsOnline,
  onClose,
  isOpen,
}: DoctorNoteModalProps) {
  if (!isOpen) return null;

  const hasNote = Boolean(doctorNote?.trim());

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close doctor note modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />

      <section className="relative w-full max-w-[680px] rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
        <button
          type="button"
          aria-label="Close modal"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] border border-blue-200 bg-blue-50">
          <NotebookText className="h-10 w-10 text-blue-600" />
        </div>

        <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
          Doctor's Note
        </h2>
        <p className="mx-auto mt-2 max-w-[560px] text-center text-medium leading-[1.45] text-slate-500">
          Review your doctor's advice from this consultation.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={doctorName}
              url={doctorAvatarUrl}
              isOnline={doctorIsOnline}
              avtStyle="h-11 w-11 rounded-full"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">
                {doctorName}
              </p>
              <p className="text-xs text-slate-500">Consulting doctor</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            {hasNote ? (
              <p className="max-h-[280px] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                {doctorNote}
              </p>
            ) : (
              <p className="text-sm italic text-slate-400">
                No note was provided for this consultation yet.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
