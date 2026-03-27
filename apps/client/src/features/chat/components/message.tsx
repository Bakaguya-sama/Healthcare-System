import { UserAvatar } from "@repo/ui/components/ui/user-avatar";

export type ChatMessage = {
  id: string;
  sender: "patient" | "doctor";
  content: string;
  time: string;
};

interface MessageProps {
  message: ChatMessage;
  patientName: string;
  patientUrl?: string;
  doctorName: string;
}

function getDoctorInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Message({
  message,
  patientName,
  patientUrl,
  doctorName,
}: MessageProps) {
  const isDoctor = message.sender === "doctor";

  return (
    <div
      className={`flex w-full ${isDoctor ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex max-w-[78%] gap-2 ${isDoctor ? "flex-row-reverse" : "flex-row"}`}
      >
        {isDoctor ? (
          <div className="mt-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-400 text-[10px] font-semibold text-slate-800">
            {getDoctorInitials(doctorName)}
          </div>
        ) : (
          <div className="mt-auto shrink-0">
            <UserAvatar
              name={patientName}
              url={patientUrl}
              isOnline={false}
              avtStyle="h-8 w-8 rounded-full"
            />
          </div>
        )}

        <div className={`min-w-0 `}>
          <div
            className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
              isDoctor
                ? "bg-lime-400 text-white"
                : "border border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {message.content}
          </div>
          <p
            className={`mt-1 text-xs text-slate-400 ${
              isDoctor ? "pr-1 text-right" : "pl-2"
            }`}
          >
            {message.time}
          </p>
        </div>
      </div>
    </div>
  );
}
