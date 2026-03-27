import { Check, Clock3 } from "lucide-react";
import { useState } from "react";

interface UserAvatarProps {
  name: string;
  url?: string;
  isOnline?: boolean;
  avtStyle?: string;
}

function getAvatarColor(seed: string) {
  const palette = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-cyan-500",
  ];
  const index = seed.charCodeAt(0) % palette.length;
  return palette[index];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getStatusStyles(isOnline: boolean) {
  switch (isOnline) {
    case true:
      return {
        wrapper: "bg-emerald-500",
      };
    case false:
    default:
      return {
        wrapper: "bg-amber-500",
        icon: <Clock3 className="h-3 w-3 text-white" />,
      };
  }
}

export function UserAvatar({
  name,
  url,
  isOnline = false,
  avtStyle,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const statusStyles = getStatusStyles(isOnline);
  const showImage = Boolean(url) && !imageError;

  return (
    <div className="inline-flex items-center">
      <div className="relative inline-flex">
        {showImage ? (
          <img
            src={url}
            alt={name}
            onError={() => setImageError(true)}
            className={`h-12 w-12 rounded-2xl object-cover ${avtStyle ?? ""}`}
          />
        ) : (
          <div
            className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white ${avtStyle ?? ""} ${getAvatarColor(name)}`}
          >
            {getInitials(name)}
          </div>
        )}

        <span
          className={`absolute -bottom-0.5 -right-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white ${statusStyles.wrapper}`}
          aria-label={isOnline ? "online status" : "away status"}
        >
          {statusStyles.icon}
        </span>
      </div>
    </div>
  );
}
