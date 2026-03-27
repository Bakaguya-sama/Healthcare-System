import { useRef, useState } from "react";
import { Camera, Paperclip, SendHorizontal } from "lucide-react";

interface SendBarProps {
  onSend: (content: string) => void;
}

export function SendBar({ onSend }: SendBarProps) {
  const [value, setValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFilePicked = (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "file" | "image",
  ) => {
    const pickedFile = event.target.files?.[0];
    if (!pickedFile) return;

    const label = type === "image" ? "Image" : "File";
    onSend(
      `[${label}] ${pickedFile.name} (${formatFileSize(pickedFile.size)})`,
    );

    // Reset value so choosing the same file again still triggers onChange.
    event.target.value = "";
  };

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(event) => handleFilePicked(event, "file")}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => handleFilePicked(event, "image")}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Send file"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Send image"
        >
          <Camera className="h-5 w-5" />
        </button>

        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Type your medical advice..."
          className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
        />

        <button
          type="button"
          onClick={submit}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-colors hover:bg-lime-400 hover:text-white"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
