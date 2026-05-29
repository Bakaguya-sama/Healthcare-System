import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import {
  notificationsSocket,
  presenceSocket,
  sessionSocket,
  socket,
} from "@/lib/api";

type AccountBannedEventDetail = {
  message?: string;
};

function disconnectAllSockets() {
  socket.disconnect();
  sessionSocket.disconnect();
  notificationsSocket.disconnect();
  presenceSocket.disconnect();
}

export function AccountBannedModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("Your account is banned");
  const navigate = useNavigate();
  const clearAuthState = useAuthStore((state) => state.logout);

  useEffect(() => {
    const handleAccountBanned = (event: Event) => {
      const customEvent = event as CustomEvent<AccountBannedEventDetail>;
      setMessage(customEvent.detail?.message ?? "Your account is banned");
      setIsOpen(true);
    };

    window.addEventListener("auth:account-banned", handleAccountBanned);

    return () => {
      window.removeEventListener("auth:account-banned", handleAccountBanned);
    };
  }, [clearAuthState, navigate]);

  const handleLogout = () => {
    setIsOpen(false);
    clearAuthState();
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    disconnectAllSockets();
    navigate("/login", { replace: true });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-6 py-5 text-white sm:px-7">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-8 w-8 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-bold">Account Banned</h2>
              <p className="mt-1 text-sm font-medium">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 px-6 py-6 sm:px-7">
          <Button
            variant="destructive"
            className="w-full flex items-center gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" /> Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
