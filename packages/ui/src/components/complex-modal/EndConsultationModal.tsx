import { useEffect, useMemo, useState } from "react";
import { CircleX } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

interface EndConsultationModalProps {
  isOpen: boolean;
  sessionId: string;
  patientName: string;
  notes?: string;
  onClose: () => void;
  onConfirm: (payload: { sessionId: string; notes: string }) => void;
}

const MAX_NOTE_LENGTH = 1000;

export function EndConsultationModal({
  isOpen,
  sessionId,
  patientName,
  notes = "",
  onClose,
  onConfirm,
}: EndConsultationModalProps) {
  const [value, setValue] = useState(notes);

  useEffect(() => {
    if (isOpen) {
      setValue(notes);
    }
  }, [isOpen, notes, sessionId]);

  const remaining = useMemo(() => MAX_NOTE_LENGTH - value.length, [value]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      sessionId,
      notes: value.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close end consultation modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />

      <div className="relative w-full max-w-[640px] rounded-[28px] border border-slate-200 bg-white p-7 shadow-2xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] border border-red-200 bg-red-50">
          <CircleX className="h-10 w-10 text-red-500" />
        </div>

        <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
          End Consultation?
        </h2>
        <p className="mx-auto mt-3 max-w-[540px] text-center text-medium leading-[1.45] text-slate-500">
          Are you sure you want to end this consultation with{" "}
          <span className="font-semibold text-slate-700">{patientName}</span>? A
          session summary will be generated automatically.
        </p>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-medium font-semibold text-slate-800">
              Medical Notes / Advice <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-slate-400">
              {value.length}/{MAX_NOTE_LENGTH}
            </p>
          </div>

          <Textarea
            value={value}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(event) => setValue(event.target.value)}
            placeholder="E.g., Based on the symptoms, I suggest taking ibuprofen 400mg twice daily after meals for 3 days. Patient should rest and stay hydrated. Follow up in one week if symptoms persist..."
            className="min-h-[160px] rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-base leading-relaxed text-slate-700 placeholder:text-slate-400"
          />

          {remaining === 0 && (
            <p className="mt-2 text-xs text-red-500">
              Maximum note length reached.
            </p>
          )}
        </div>

        <div className="mt-7 grid grid-cols-2 gap-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onClose}
            className="h-12 rounded-2xl border-slate-300 text-slate-600"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={handleConfirm}
            className="h-12 rounded-2xl bg-red-500 text-white hover:bg-red-600"
          >
            End & Save
          </Button>
        </div>
      </div>
    </div>
  );
}
