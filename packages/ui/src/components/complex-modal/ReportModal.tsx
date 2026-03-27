import { useEffect, useMemo, useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

export type ReportType =
  | "harassment"
  | "spam"
  | "misinformation"
  | "inappropriate_content"
  | "impersonation"
  | "fraud"
  | "ai_hallucination"
  | "other";

interface ReportModalProps {
  isOpen: boolean;
  sessionId: string;
  patientId: string;
  doctorId: string;
  patientName: string;
  reason?: string;
  reportType?: ReportType;
  onClose: () => void;
  onConfirm: (payload: {
    sessionId: string;
    patientId: string;
    doctorId: string;
    reportType: ReportType;
    reason: string;
  }) => void;
}

const REPORT_TYPE_OPTIONS: Array<{ value: ReportType; label: string }> = [
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "misinformation", label: "Misinformation" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "fraud", label: "Fraud" },
  { value: "ai_hallucination", label: "AI hallucination" },
  { value: "other", label: "Other" },
];

const MAX_REASON_LENGTH = 1000;

export function ReportModal({
  isOpen,
  sessionId,
  patientId,
  doctorId,
  patientName,
  reason,
  reportType = "other",
  onClose,
  onConfirm,
}: ReportModalProps) {
  const [selectedType, setSelectedType] = useState<ReportType>(reportType);
  const [reportReason, setReportReason] = useState(reason ?? "");

  useEffect(() => {
    if (isOpen) {
      setSelectedType(reportType);
      setReportReason(reason ?? "");
    }
  }, [isOpen, reportType, reason, sessionId]);

  const remaining = useMemo(
    () => MAX_REASON_LENGTH - reportReason.length,
    [reportReason],
  );

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm({
      sessionId,
      patientId,
      doctorId,
      reportType: selectedType,
      reason: reportReason.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close report modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />

      <div className="relative w-full max-w-[640px] rounded-[28px] border border-slate-200 bg-white p-7 shadow-2xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] border border-amber-200 bg-amber-50">
          <Flag className="h-9 w-9 text-amber-500" />
        </div>

        <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
          Report Patient
        </h2>
        <p className="mx-auto mt-3 max-w-[540px] text-center text-medium leading-[1.45] text-slate-500">
          Submit a report for{" "}
          <span className="font-semibold text-slate-700">{patientName}</span>.
          This report will be reviewed by the moderation team.
        </p>

        <div className="mt-7 space-y-4">
          <div>
            <label className="mb-2 block text-medium font-semibold text-slate-800">
              Report Type <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(event.target.value as ReportType)
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-amber-400"
            >
              {REPORT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-medium font-semibold text-slate-800">
                Reason <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-400">
                {reportReason.length}/{MAX_REASON_LENGTH}
              </p>
            </div>

            <Textarea
              value={reportReason}
              maxLength={MAX_REASON_LENGTH}
              onChange={(event) => setReportReason(event.target.value)}
              placeholder="Describe what happened and why this consultation should be reviewed..."
              className="min-h-[160px] rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-base leading-relaxed text-slate-700 placeholder:text-slate-400"
            />

            {remaining === 0 && (
              <p className="mt-2 text-xs text-red-500">
                Maximum reason length reached.
              </p>
            )}
          </div>
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
            disabled={!reportReason.trim()}
          >
            Submit Report
          </Button>
        </div>
      </div>
    </div>
  );
}
