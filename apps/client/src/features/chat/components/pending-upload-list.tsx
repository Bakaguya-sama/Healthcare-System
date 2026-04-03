import { AlertCircle, FileText, RotateCcw, X } from "lucide-react";
import type { ChatAttachment } from "./message";

interface PendingUploadListProps {
  attachments: ChatAttachment[];
  onRemove: (attachmentId: string) => void;
  onRetry: (attachmentId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(attachment: ChatAttachment): boolean {
  return (
    attachment.type === "image" || attachment.mimeType.startsWith("image/")
  );
}

export function PendingUploadList({
  attachments,
  onRemove,
  onRetry,
}: PendingUploadListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        if (isImageAttachment(attachment)) {
          return (
            <div
              key={attachment.id}
              className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            >
              <img
                src={attachment.thumbnailUrl || attachment.url}
                alt={attachment.name}
                className="h-full w-full object-cover"
              />
              {attachment.uploadStatus === "uploading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25 text-[11px] font-semibold text-white">
                  Uploading
                </div>
              )}
              {attachment.uploadStatus === "failed" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-rose-500/85 text-white">
                  <AlertCircle className="h-4 w-4" />
                  <button
                    type="button"
                    onClick={() => onRetry(attachment.id)}
                    className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        }

        return (
          <div
            key={attachment.id}
            className="flex max-w-56 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-slate-500">
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-700">
                {attachment.name}
              </p>
              <p className="text-[11px] text-slate-400">
                {formatFileSize(attachment.size)}
              </p>
              {attachment.uploadStatus === "failed" && (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-rose-500">
                  <AlertCircle className="h-3 w-3" />
                  Upload failed
                </p>
              )}
              {attachment.uploadStatus === "uploading" && (
                <p className="mt-0.5 text-[11px] font-medium text-amber-500">
                  Uploading...
                </p>
              )}
            </div>
            {attachment.uploadStatus === "failed" ? (
              <button
                type="button"
                onClick={() => onRetry(attachment.id)}
                className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-rose-200 px-2 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
              >
                <RotateCcw className="h-3 w-3" />
                Retry
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              aria-label="Remove file"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
