import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { Bot, Download, FileText, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export type ChatAttachment = {
  id: string;
  type: "image" | "file" | "video";
  name: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  uploadStatus?: "uploading" | "done" | "failed";
  uploadError?: string;
  file?: File;
};

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

function MessageAttachments({
  attachments,
  isMine,
}: {
  attachments: ChatAttachment[];
  isMine: boolean;
}) {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const imageAttachments = attachments.filter(isImageAttachment);
  const fileAttachments = attachments.filter(
    (attachment) => !isImageAttachment(attachment),
  );
  const imageGridColumns =
    imageAttachments.length === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className="mt-2 space-y-2">
      {imageAttachments.length > 0 && (
        <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
          <div className={`grid w-fit ${imageGridColumns} gap-2`}>
            {imageAttachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => setSelectedImageUrl(attachment.url)}
                className="group block w-32 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              >
                <img
                  src={attachment.thumbnailUrl || attachment.url}
                  alt={attachment.name}
                  className="h-32 w-32 object-contain transition-transform group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {fileAttachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.url}
          download={attachment.name}
          target="_blank"
          rel="noreferrer"
          className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors hover:bg-slate-50 ${
            isMine
              ? "border-lime-300 bg-lime-50/60"
              : "border-slate-200 bg-white"
          }`}
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <FileText className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700">
              {attachment.name}
            </p>
            <p className="text-xs text-slate-400">
              {formatFileSize(attachment.size)}
            </p>
          </span>
          <span className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500">
            <Download className="h-4 w-4" />
          </span>
        </a>
      ))}

      {selectedImageUrl && (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setSelectedImageUrl(null)}
        >
          <button
            type="button"
            aria-label="Close image preview"
            onClick={() => setSelectedImageUrl(null)}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={selectedImageUrl}
            alt="Attachment preview"
            className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export type ChatMessage = {
  id: string;
  sender: "doctor" | "patient" | "ai";
  content?: string;
  time: string;
  sentAt?: string | Date;
  attachments?: ChatAttachment[];
};

interface MessageProps {
  message: ChatMessage;
  viewerRole: "doctor" | "patient";
  patientName: string;
  patientUrl?: string;
  patientIsOnline: boolean;
  doctorName: string;
  doctorUrl?: string;
  doctorIsOnline: boolean;
  aiName?: string;
}

export function Message({
  message,
  viewerRole,
  patientName,
  patientUrl,
  patientIsOnline,
  doctorName,
  doctorUrl,
  doctorIsOnline,
  aiName = "MedBot",
}: MessageProps) {
  const isMine = message.sender === viewerRole;
  const hasText = Boolean(message.content?.trim());
  const hasAttachments = Boolean(message.attachments?.length);

  const senderMeta =
    message.sender === "patient"
      ? {
          name: patientName,
          url: patientUrl,
          isOnline: patientIsOnline,
        }
      : message.sender === "doctor"
        ? {
            name: doctorName,
            url: doctorUrl,
            isOnline: doctorIsOnline,
          }
        : {
            name: aiName,
            url: undefined,
            isOnline: true,
          };

  const renderFormattedContent = (content?: string): ReactNode => {
    if (!content) return null;

    const lines = content.split("\n");
    const blocks: ReactNode[] = [];
    const listItems: string[] = [];
    const orderedItems: string[] = [];
    const bulletPattern = /^\s*([*-])\s+/;
    const orderedPattern = /^\s*(\d+)\.\s+/;
    let keyIndex = 0;

    const renderInline = (value: string): ReactNode[] => {
      const parts: ReactNode[] = [];
      const pattern = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(value)) !== null) {
        if (match.index > lastIndex) {
          parts.push(value.slice(lastIndex, match.index));
        }

        const token = match[0];
        if (token.startsWith("**")) {
          parts.push(
            <strong key={`strong-${keyIndex++}`}>{token.slice(2, -2)}</strong>,
          );
        } else if (token.startsWith("_")) {
          parts.push(<em key={`em-${keyIndex++}`}>{token.slice(1, -1)}</em>);
        } else if (token.startsWith("*")) {
          parts.push(<em key={`em-${keyIndex++}`}>{token.slice(1, -1)}</em>);
        }

        lastIndex = match.index + token.length;
      }

      if (lastIndex < value.length) {
        parts.push(value.slice(lastIndex));
      }

      return parts;
    };

    const flushList = () => {
      if (!listItems.length) return;
      blocks.push(
        <ul key={`list-${keyIndex++}`} className="list-disc space-y-1 pl-5">
          {listItems.map((item, index) => (
            <li key={`item-${keyIndex}-${index}`}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      listItems.length = 0;
    };

    const flushOrderedList = () => {
      if (!orderedItems.length) return;
      blocks.push(
        <ol key={`olist-${keyIndex++}`} className="list-decimal space-y-1 pl-5">
          {orderedItems.map((item, index) => (
            <li key={`oitem-${keyIndex}-${index}`}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      orderedItems.length = 0;
    };

    lines.forEach((rawLine) => {
      const trimmed = rawLine.trimEnd();

      if (!trimmed.trim()) {
        flushList();
        flushOrderedList();
        blocks.push(<div key={`spacer-${keyIndex++}`} className="h-3" />);
        return;
      }

      if (bulletPattern.test(trimmed)) {
        flushOrderedList();
        listItems.push(trimmed.replace(bulletPattern, ""));
        return;
      }

      if (orderedPattern.test(trimmed)) {
        flushList();
        orderedItems.push(trimmed.replace(orderedPattern, ""));
        return;
      }

      flushList();
      flushOrderedList();
      blocks.push(
        <p key={`p-${keyIndex++}`} className="whitespace-pre-wrap">
          {renderInline(trimmed)}
        </p>,
      );
    });

    flushList();
    flushOrderedList();

    return <div className="space-y-2">{blocks}</div>;
  };

  return (
    <div className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[78%] gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
      >
        <div className="mt-auto shrink-0">
          {message.sender === "ai" ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
              <Bot className="h-4 w-4" />
            </span>
          ) : (
            <UserAvatar
              name={senderMeta.name}
              url={senderMeta.url}
              isOnline={senderMeta.isOnline}
              avtStyle="h-8 w-8 rounded-full"
            />
          )}
        </div>

        <div className="min-w-0">
          {hasText && (
            <div
              className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                isMine
                  ? "bg-lime-400 text-white"
                  : message.sender === "ai"
                    ? "border border-blue-200 bg-blue-50 text-slate-700"
                    : "border border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {renderFormattedContent(message.content)}
            </div>
          )}

          {hasAttachments && (
            <MessageAttachments
              attachments={message.attachments || []}
              isMine={isMine}
            />
          )}
          <p
            className={`mt-1 text-xs text-slate-400 ${
              isMine ? "pr-1 text-right" : "pl-2"
            }`}
          >
            {message.time}
          </p>
        </div>
      </div>
    </div>
  );
}
