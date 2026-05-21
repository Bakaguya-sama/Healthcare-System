import { api } from "@/lib/api";

export type NotificationType = "critical" | "warning" | "info" | "success";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
};

type ApiNotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
};

type NotificationListResponse = {
  statusCode: number;
  message: string;
  data:
    | ApiNotificationItem[]
    | {
        notifications?: ApiNotificationItem[];
      };
};

type MarkAllReadResponse = {
  statusCode: number;
  message: string;
  data: { modifiedCount: number };
};

function mapNotification(item: ApiNotificationItem): NotificationItem {
  return {
    id: item._id,
    title: item.title,
    message: item.message,
    type: item.type,
    isRead: item.isRead,
    createdAt: item.createdAt,
    readAt: item.readAt,
  };
}

function extractNotifications(
  data: NotificationListResponse,
): ApiNotificationItem[] {
  if (Array.isArray(data.data)) {
    return data.data;
  }

  return data.data.notifications ?? [];
}

export async function getNotifications() {
  const response = await api.get<NotificationListResponse>("/notifications");
  const items = extractNotifications(response.data);

  return items.map(mapNotification);
}

export async function markAllNotificationsAsRead() {
  const response = await api.patch<MarkAllReadResponse>(
    "/notifications/mark-all-as-read",
  );

  return response.data;
}

export async function markNotificationAsRead(notificationId: string) {
  const response = await api.patch<{ data: ApiNotificationItem }>(
    `/notifications/${notificationId}`,
    { read: true },
  );

  return mapNotification(response.data.data);
}

export async function deleteNotification(notificationId: string) {
  const response = await api.delete<{ statusCode: number; message: string }>(
    `/notifications/${notificationId}`,
  );

  return response.data;
}
