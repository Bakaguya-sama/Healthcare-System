import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { useHealthAlertStore } from "../store/useHealthAlertStore";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";
const SOCKET_BASE_URL =
  import.meta.env.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api\/v1\/?$/, "");

type ApiNotificationItem = {
  _id: string;
  type: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

interface NotificationResponse {
  statusCode: number;
  message: string;
  data:
    | ApiNotificationItem[]
    | {
        notifications?: ApiNotificationItem[];
      };
}

type SocketNotificationPayload = {
  _id?: string;
  id?: string;
  type?: "critical" | "warning" | "info" | "success";
  title?: string;
  message?: string;
  isRead?: boolean;
  createdAt?: string;
};

const SOCKET_NOTIFICATION_EVENTS = [
  "notification:created",
  "notification:new",
  "new_notification",
];

function extractApiNotifications(
  data: NotificationResponse,
): ApiNotificationItem[] {
  if (Array.isArray(data.data)) {
    return data.data;
  }

  return data.data.notifications ?? [];
}

/**
 * Hook để đồng bộ notifications theo realtime websocket.
 * Vẫn có 1 lần fetch ban đầu để không bỏ sót alert trước thời điểm socket kết nối.
 */
export function useNotificationSync(userId: string | null) {
  const { setCurrentAlert, hasBeenDisplayed } = useHealthAlertStore();

  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const pushIfNewCritical = (alert: SocketNotificationPayload) => {
      const alertId = alert._id ?? alert.id;
      if (!alertId || alert.type !== "critical" || alert.isRead) {
        return;
      }

      if (hasBeenDisplayed(alertId)) {
        return;
      }

      setCurrentAlert({
        id: alertId,
        title: alert.title || "Critical health alert",
        message: alert.message || "A critical alert has been triggered.",
        createdAt: alert.createdAt || new Date().toISOString(),
      });
    };

    const bootstrapNotifications = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data: NotificationResponse = await response.json();
        const notifications = extractApiNotifications(data);

        // Lấy alert critical mới nhất chưa hiển thị khi app vừa mount.
        const criticalAlerts = notifications
          .filter((noti) => noti.type === "critical" && !noti.isRead)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );

        for (const alert of criticalAlerts) {
          pushIfNewCritical(alert);
          break;
        }
      } catch (error) {
        console.error("Error bootstrapping notifications:", error);
      }
    };

    const socket: Socket = io(SOCKET_BASE_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token, userId },
      query: { userId },
      withCredentials: true,
    });

    socket.on("connect_error", (error) => {
      console.error("Notification socket connection error:", error.message);
    });

    for (const eventName of SOCKET_NOTIFICATION_EVENTS) {
      socket.on(eventName, (payload: SocketNotificationPayload) => {
        pushIfNewCritical(payload);
      });
    }

    bootstrapNotifications();

    return () => {
      for (const eventName of SOCKET_NOTIFICATION_EVENTS) {
        socket.off(eventName);
      }
      socket.disconnect();
    };
  }, [userId, setCurrentAlert, hasBeenDisplayed]);
}
