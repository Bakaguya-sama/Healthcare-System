import { useEffect } from "react";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import { connectNotificationsSocket } from "@/lib/api";

export function useNotificationSync(userId: string | null) {
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (userId && token) {
      connectNotificationsSocket(token);
    } else {
      connectNotificationsSocket(undefined); // This will handle disconnection
    }
  }, [userId, token]);
}
