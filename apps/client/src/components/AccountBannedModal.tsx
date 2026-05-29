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

      clearAuthState();
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      disconnectAllSockets();
      navigate("/login", { replace: true });
    };

    window.addEventListener("auth:account-banned", handleAccountBanned);

    return () => {
      window.removeEventListener("auth:account-banned", handleAccountBanned);
    };
  }, [clearAuthState, navigate]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-red-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-6 py-5 text-white sm:px-7">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-100">
                Security Notice
              </p>
              <h3 className="mt-1 text-2xl font-semibold">
                Your account is banned
              </h3>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-7">
          <div className="rounded-2xl border border-red-100 bg-red-50/70 p-5 text-slate-700">
            <p className="text-base leading-7">{message}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You have been logged out and redirected to the login screen.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:px-7">
          <Button
            size="lg"
            className="h-11 rounded-xl bg-red-600 px-5 text-white hover:bg-red-700"
            onClick={() => setIsOpen(false)}
          >
            <LogOut className="mr-2 h-4 w-4" />
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
