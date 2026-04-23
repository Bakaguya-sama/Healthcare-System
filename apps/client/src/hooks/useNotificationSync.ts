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

const SOCKET_NOTIFICATION_EVENT = "notification";

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

    // DEBUG: Kiểm tra giá trị của token
    console.log("Attempting to connect notification socket with token:", token);

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

    // QUAN TRỌNG: Kết nối đến đúng namespace /notifications
    const socket: Socket = io(`${SOCKET_BASE_URL}/notifications`, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token, userId },
      withCredentials: true,
    });

    socket.on("connect", () => {
      console.log("✅ Notification socket connected:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.error("Notification socket connection error:", error.message);
    });

    socket.on(
      SOCKET_NOTIFICATION_EVENT,
      (payload: SocketNotificationPayload) => {
        console.log("📬 Received new notification via socket:", payload);
        pushIfNewCritical(payload);
      },
    );

    bootstrapNotifications();

    return () => {
      socket.off(SOCKET_NOTIFICATION_EVENT);
      socket.disconnect();
    };
  }, [userId, setCurrentAlert, hasBeenDisplayed]);
}
