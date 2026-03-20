import { Bell, CheckCheck, Search } from "lucide-react";
import { useState } from "react";
import {
  NotificationDetailCard,
  type NotificationType,
  notificationTypeMap,
} from "@repo/ui/components/noti-detail-card";

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  detail: string;
  time: string;
  createdAt: string;
  read: boolean;
  type: NotificationType;
  primaryActionLabel?: string;
};

export function TopHeader() {
  const [notificationOpen, setNotificationOpen] = useState(false);

  const [showAllNoti, setShowAllNoti] = useState(false);

  const handleShowAllNoti = () => {
    setShowAllNoti((show) => !show);
  };

  const handleToggleNotificationDropdown = () => {
    setNotificationOpen((prev) => {
      const next = !prev;
      if (!next) {
        setShowAllNoti(false);
      }
      return next;
    });
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 1,
      title: "Tài liệu mới cần xác minh",
      message: "Có 3 hồ sơ vừa được gửi lên hệ thống.",
      detail:
        "Dr. Marcus Lee has submitted a verification request to join the platform as a licensed medical professional. His submitted credentials include a Medical Degree from Johns Hopkins University and a current Practice License from the State Medical Board.\n\nPlease review the documents carefully before approving or rejecting this application. Approval will grant Dr. Lee full access to the platform and patient consultations.",
      time: "2 phút trước",
      createdAt: "2026-03-05T10:28:00",
      read: false,
      type: "warning",
      primaryActionLabel: "Review Doctor Profile",
    },
    {
      id: 2,
      title: "Báo cáo vi phạm mới",
      message: "Một báo cáo mới từ người dùng đã được tạo.",
      detail:
        "A new violation report has been submitted by a patient against a consultation session. Please review the report details and attached evidence to determine appropriate moderation actions.",
      time: "10 phút trước",
      createdAt: "2026-03-05T10:20:00",
      read: false,
      type: "critical",
      primaryActionLabel: "Review Report",
    },
    {
      id: 3,
      title: "Cập nhật Knowledge Base",
      message: "Nội dung AI vừa được cập nhật bởi Admin.",
      detail:
        "The AI medical knowledge base has been updated with new treatment guidelines and medication safety rules. Please verify that critical assistant flows remain compliant.",
      time: "1 giờ trước",
      createdAt: "2026-03-05T09:30:00",
      read: true,
      type: "info",
      primaryActionLabel: "View Update",
    },
    {
      id: 4,
      title: "Tài liệu mới cần xác minh",
      message: "Có 3 hồ sơ vừa được gửi lên hệ thống.",
      detail:
        "Dr. Marcus Lee has submitted a verification request to join the platform as a licensed medical professional. His submitted credentials include a Medical Degree from Johns Hopkins University and a current Practice License from the State Medical Board.\n\nPlease review the documents carefully before approving or rejecting this application. Approval will grant Dr. Lee full access to the platform and patient consultations.",
      time: "2 phút trước",
      createdAt: "2026-03-05T10:28:00",
      read: false,
      type: "warning",
      primaryActionLabel: "Review Doctor Profile",
    },
    {
      id: 5,
      title: "Báo cáo vi phạm mới",
      message: "Một báo cáo mới từ người dùng đã được tạo.",
      detail:
        "A new violation report has been submitted by a patient against a consultation session. Please review the report details and attached evidence to determine appropriate moderation actions.",
      time: "10 phút trước",
      createdAt: "2026-03-05T10:20:00",
      read: false,
      type: "critical",
      primaryActionLabel: "Review Report",
    },
    {
      id: 6,
      title: "Cập nhật Knowledge Base",
      message: "Nội dung AI vừa được cập nhật bởi Admin.",
      detail:
        "The AI medical knowledge base has been updated with new treatment guidelines and medication safety rules. Please verify that critical assistant flows remain compliant.",
      time: "1 giờ trước",
      createdAt: "2026-03-05T09:30:00",
      read: true,
      type: "info",
      primaryActionLabel: "View Update",
    },
    {
      id: 7,
      title: "Tài liệu mới cần xác minh",
      message: "Có 3 hồ sơ vừa được gửi lên hệ thống.",
      detail:
        "Dr. Marcus Lee has submitted a verification request to join the platform as a licensed medical professional. His submitted credentials include a Medical Degree from Johns Hopkins University and a current Practice License from the State Medical Board.\n\nPlease review the documents carefully before approving or rejecting this application. Approval will grant Dr. Lee full access to the platform and patient consultations.",
      time: "2 phút trước",
      createdAt: "2026-03-05T10:28:00",
      read: false,
      type: "warning",
      primaryActionLabel: "Review Doctor Profile",
    },
    {
      id: 8,
      title: "Báo cáo vi phạm mới",
      message: "Một báo cáo mới từ người dùng đã được tạo.",
      detail:
        "A new violation report has been submitted by a patient against a consultation session. Please review the report details and attached evidence to determine appropriate moderation actions.",
      time: "10 phút trước",
      createdAt: "2026-03-05T10:20:00",
      read: false,
      type: "critical",
      primaryActionLabel: "Review Report",
    },
    {
      id: 9,
      title: "Cập nhật Knowledge Base",
      message: "Nội dung AI vừa được cập nhật bởi Admin.",
      detail:
        "The AI medical knowledge base has been updated with new treatment guidelines and medication safety rules. Please verify that critical assistant flows remain compliant.",
      time: "1 giờ trước",
      createdAt: "2026-03-05T09:30:00",
      read: true,
      type: "info",
      primaryActionLabel: "View Update",
    },
  ]);
  const [selectedNotificationId, setSelectedNotificationId] = useState<
    number | null
  >(null);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  const selectedNotification = notifications.find(
    (item) => item.id === selectedNotificationId,
  );

  const handleOpenNotificationDetail = (id: number) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    setSelectedNotificationId(id);
    setNotificationOpen(false);
    setShowAllNoti(false);
  };

  return (
    <header className="h-16 bg-white shadow-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h3 className="text-xlg font-semibold text-gray-800">
          {/* {roleNames[role as keyof typeof roleNames]} */}
        </h3>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#84cc16] w-64"
          />
        </div>

        {/* Notification */}
        <div className="relative">
          <button
            type="button"
            onClick={handleToggleNotificationDropdown}
            className="relative flex items-center justify-center text-[#6B7280] hover:bg-gray-50 p-2 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[11px] leading-5 text-center font-semibold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notificationOpen && (
            <div className="absolute right-0 top-12 w-80 rounded-xl border border-gray-200 bg-white shadow-xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">
                  Notifications
                </p>
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1 text-sm text-[#3B7BF8] hover:opacity-80"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark as read
                </button>
              </div>

              <ul
                className={`py-1 ${showAllNoti ? "max-h-[36rem] overflow-y-auto" : ""}`}
              >
                {(showAllNoti ? notifications : notifications.slice(0, 5)).map(
                  (item) => {
                    const currentType = notificationTypeMap[item.type];
                    const ItemIcon = currentType.icon;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleOpenNotificationDetail(item.id)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${item.read ? "bg-white" : "bg-[#F9FAFB]"}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative mt-0.5">
                              <div
                                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${currentType.iconBg}`}
                              >
                                <ItemIcon
                                  className={`h-4.5 w-4.5 ${currentType.iconColor}`}
                                />
                              </div>
                              {!item.read && (
                                <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-brand" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {item.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {item.message}
                              </p>
                              <p className="text-[11px] text-gray-400 mt-1">
                                {item.time}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  },
                )}
              </ul>

              <div className="border-t">
                <button
                  type="button"
                  onClick={handleShowAllNoti}
                  className="w-full py-3 text-sm text-center text-[#3B7BF8] font-medium hover:bg-gray-50 transition-colors rounded-b-xl"
                >
                  {showAllNoti ? "Show less" : "View all notifications"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedNotification && (
        <NotificationDetailCard
          id={selectedNotification.id}
          title={selectedNotification.title}
          message={selectedNotification.detail}
          isRead={selectedNotification.read}
          createdAt={selectedNotification.createdAt}
          type={selectedNotification.type}
          isOpen={true}
          onClose={() => setSelectedNotificationId(null)}
          onDismiss={() => {
            setNotifications((prev) =>
              prev.filter((item) => item.id !== selectedNotification.id),
            );
            setSelectedNotificationId(null);
          }}
          onPrimaryAction={() => {
            setSelectedNotificationId(null);
          }}
          primaryActionLabel={selectedNotification.primaryActionLabel}
        />
      )}
    </header>
  );
}
