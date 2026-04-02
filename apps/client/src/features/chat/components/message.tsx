import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { Bot } from "lucide-react";

export type ChatMessage = {
  id: string;
  sender: "doctor" | "patient" | "ai";
  content: string;
  time: string;
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
          <div
            className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
              isMine
                ? "bg-lime-400 text-white"
                : message.sender === "ai"
                  ? "border border-blue-200 bg-blue-50 text-slate-700"
                  : "border border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {message.content}
          </div>
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
