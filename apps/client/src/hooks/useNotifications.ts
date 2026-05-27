import { useCallback, useEffect, useState } from "react";
import notificationSoundURL from "../../assets/sounds/notification_sound.wav";
import { useHealthAlertStore } from "../store/useHealthAlertStore";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import { connectNotificationsSocket, notificationsSocket } from "@/lib/api";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
  type NotificationType,
} from "../services/notifications.service";

type SocketNotificationPayload = {
  userId?: string;
  action?: "send" | "mark_read" | "mark_all_read" | "deleted";
  notification?: {
    id?: string;
    title?: string;
    message?: string;
    isRead?: boolean;
    createdAt?: string;
    type?: NotificationType;
  };
};

const SOCKET_NOTIFICATION_EVENT = "notifications";

let notificationAudio: HTMLAudioElement | null = null;
let isAudioUnlocked = false;

function ensureNotificationAudio() {
  if (!notificationAudio) {
    notificationAudio = new Audio(notificationSoundURL);
    notificationAudio.preload = "auto";
    notificationAudio.volume = 0.6;
  }

  return notificationAudio;
}

export async function unlockNotificationSound() {
  if (typeof window === "undefined" || isAudioUnlocked) {
    return;
  }

  try {
    const audio = ensureNotificationAudio();
    const previousVolume = audio.volume;
    audio.volume = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = previousVolume;
    isAudioUnlocked = true;
    console.log("✅ Notification sound unlocked by user interaction.");
  } catch (error) {
    isAudioUnlocked = false;
    console.warn("Notification sound unlock failed", error);
  }
}

function playNotificationSound() {
  if (typeof window === "undefined" || !isAudioUnlocked) {
    console.warn(
      "🔊 Notification sound skipped: Audio has not been unlocked by user interaction yet.",
    );
    return;
  }

  try {
    const audio = ensureNotificationAudio();
    audio.currentTime = 0;
    void audio.play();
  } catch (error) {
    console.warn("Notification sound unavailable", error);
  }
}

/**
 * Hook để đồng bộ notifications theo realtime websocket.
 * Vẫn có 1 lần fetch ban đầu để không bỏ sót alert trước thời điểm socket kết nối.
 */
export function useNotificationSync(userId: string | null) {
  const { setCurrentAlert, hasBeenDisplayed } = useHealthAlertStore();

  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem("accessToken");
    if (!token) return;

    if (!connectNotificationsSocket(token)) {
      return;
    }

    // DEBUG: Kiểm tra giá trị của token
    console.log("Attempting to connect notification socket with token:", token);

    const pushIfNewCritical = (alert: {
      id?: string;
      type?: NotificationType;
      isRead?: boolean;
      title?: string;
      message?: string;
      createdAt?: string;
    }) => {
      const alertId = alert.id;
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
        const notifications = await getNotifications();

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

    const handleNotificationSync = (payload: SocketNotificationPayload) => {
      const notification = payload.notification;
      if (!notification) return;

      console.log("📬 Received new notification via socket:", payload);
      pushIfNewCritical(notification);
    };

    notificationsSocket.on(SOCKET_NOTIFICATION_EVENT, handleNotificationSync);

    bootstrapNotifications();

    return () => {
      notificationsSocket.off(
        SOCKET_NOTIFICATION_EVENT,
        handleNotificationSync,
      );
    };
  }, [userId, setCurrentAlert, hasBeenDisplayed]);
}

type UseNotificationsOptions = {
  enabled?: boolean;
};

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true } = options;
  const accessToken = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const items = await getNotifications();
      const sorted = items.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setNotifications(sorted);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notifications",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!enabled || !currentUserId) return;

    const token = accessToken || localStorage.getItem("accessToken") || "";
    if (!token) return;

    if (!connectNotificationsSocket(token)) {
      return;
    }

    const handleNotificationEvent = (payload: SocketNotificationPayload) => {
      const action = payload.action;
      const notification = payload.notification;

      if (!action) return;

      if (action === "mark_all_read") {
        setNotifications((prev) =>
          prev.map((item) => ({ ...item, isRead: true })),
        );
        return;
      }

      if (!notification?.id) {
        void fetchNotifications();
        return;
      }

      if (action === "send") {
        const nextItem: NotificationItem = {
          id: notification.id,
          title: notification.title || "Notification",
          message: notification.message || "",
          type: notification.type || "info",
          isRead: Boolean(notification.isRead),
          createdAt: notification.createdAt || new Date().toISOString(),
        };

        setNotifications((prev) => {
          const exists = prev.some((item) => item.id === nextItem.id);
          if (exists) {
            return prev;
          }
          playNotificationSound();
          return [nextItem, ...prev];
        });
        return;
      }

      if (action === "mark_read") {
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notification.id
              ? { ...item, isRead: Boolean(notification.isRead) }
              : item,
          ),
        );
        return;
      }

      if (action === "deleted") {
        setNotifications((prev) =>
          prev.filter((item) => item.id !== notification.id),
        );
      }
    };

    notificationsSocket.on(SOCKET_NOTIFICATION_EVENT, handleNotificationEvent);

    return () => {
      notificationsSocket.off(
        SOCKET_NOTIFICATION_EVENT,
        handleNotificationEvent,
      );
    };
  }, [accessToken, currentUserId, enabled, fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    setError(null);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark all as read",
      );
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    setError(null);
    try {
      const updated = await markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, isRead: updated.isRead } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark notification",
      );
    }
  }, []);

  const remove = useCallback(async (notificationId: string) => {
    setError(null);
    try {
      await deleteNotification(notificationId);
      setNotifications((prev) =>
        prev.filter((item) => item.id !== notificationId),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete notification",
      );
    }
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh: fetchNotifications,
    markAllAsRead,
    markAsRead,
    remove,
  };
}
