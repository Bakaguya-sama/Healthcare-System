import { useEffect, useRef, useState } from "react";
import { Camera, Paperclip, SendHorizontal } from "lucide-react";
import type { ChatAttachment } from "./message";
import { PendingUploadList } from "./pending-upload-list";

export type SendMessagePayload = {
  content?: string;
  attachments?: ChatAttachment[];
};

interface SendBarProps {
  isDisabled: boolean;
  onSend: (payload: SendMessagePayload) => void;
}

export function SendBar({ isDisabled, onSend }: SendBarProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      uploadTimersRef.current.forEach((timerId) =>
        window.clearTimeout(timerId),
      );
      uploadTimersRef.current = [];
    };
  }, []);

  // TODO: call api to upload
  const processAttachmentUpload = (attachmentId: string) => {
    setAttachments((prev) =>
      prev.map((attachment) =>
        attachment.id === attachmentId
          ? {
              ...attachment,
              uploadStatus: "uploading",
              uploadError: undefined,
            }
          : attachment,
      ),
    );

    const timerId = window.setTimeout(() => {
      setAttachments((prev) =>
        prev.map((attachment) => {
          if (attachment.id !== attachmentId) return attachment;

          const file = attachment.file;
          const isTooLarge = file ? file.size > 10 * 1024 * 1024 : false;
          const isEmpty = file ? file.size === 0 : false;

          if (!file || isTooLarge || isEmpty) {
            return {
              ...attachment,
              uploadStatus: "failed",
              uploadError: isTooLarge
                ? "File is too large. Max 10 MB."
                : isEmpty
                  ? "File is empty."
                  : "Upload failed.",
            };
          }

          return {
            ...attachment,
            uploadStatus: "done",
            uploadError: undefined,
          };
        }),
      );
    }, 500);

    uploadTimersRef.current.push(timerId);
  };

  const submit = () => {
    if (isDisabled) return;

    const trimmed = value.trim();
    const blockingUpload = attachments.some(
      (attachment) => attachment.uploadStatus !== "done",
    );

    if (!trimmed && attachments.length === 0) return;
    if (blockingUpload) return;

    onSend({
      content: trimmed || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    setValue("");
    setAttachments([]);
  };

  const handleFilePicked = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "file" | "image",
  ) => {
    if (isDisabled) return;
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const nextAttachments: ChatAttachment[] = files.map((file, index) => {
      const isImage =
        type === "image" || (file.type.startsWith("image/") && type !== "file");
      const blobUrl = URL.createObjectURL(file);

      return {
        id: `${Date.now()}-${index}-${file.name}`,
        type: isImage ? "image" : "file",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        url: blobUrl,
        thumbnailUrl: isImage ? blobUrl : undefined,
        uploadStatus: "uploading",
        file,
      };
    });

    setAttachments((prev) => [...prev, ...nextAttachments]);

    nextAttachments.forEach((attachment) => {
      processAttachmentUpload(attachment.id);
    });

    // Reset value so choosing the same file again still triggers onChange.
    event.target.value = "";
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((prev) => {
      const removed = prev.find((item) => item.id === attachmentId);
      if (removed && removed.url.startsWith("blob:")) {
        URL.revokeObjectURL(removed.url);
      }
      return prev.filter((item) => item.id !== attachmentId);
    });
  };

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        disabled={isDisabled}
        onChange={(event) => handleFilePicked(event, "file")}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={isDisabled}
        onChange={(event) => handleFilePicked(event, "image")}
      />

      <PendingUploadList
        attachments={attachments}
        onRemove={handleRemoveAttachment}
        onRetry={processAttachmentUpload}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors enabled:hover:bg-slate-100 enabled:hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send file"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={isDisabled}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors enabled:hover:bg-slate-100 enabled:hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send image"
        >
          <Camera className="h-5 w-5" />
        </button>

        <input
          value={value}
          disabled={isDisabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            isDisabled
              ? "This consultation has finished"
              : "Type your medical advice..."
          }
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500 disabled:cursor-not-allowed disabled:opacity-60"
        />

        <button
          type="button"
          onClick={submit}
          disabled={
            isDisabled ||
            (!value.trim() && attachments.length === 0) ||
            attachments.some((attachment) => attachment.uploadStatus !== "done")
          }
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-colors enabled:hover:bg-lime-400 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
