import { Bell, CheckCheck, Search } from "lucide-react";
import { useState } from "react";

export function TopHeader() {
  const [notificationOpen, setNotificationOpen] = useState(false);

  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Tài liệu mới cần xác minh",
      message: "Có 3 hồ sơ vừa được gửi lên hệ thống.",
      time: "2 phút trước",
      read: false,
    },
    {
      id: 2,
      title: "Báo cáo vi phạm mới",
      message: "Một báo cáo mới từ người dùng đã được tạo.",
      time: "10 phút trước",
      read: false,
    },
    {
      id: 3,
      title: "Cập nhật Knowledge Base",
      message: "Nội dung AI vừa được cập nhật bởi Admin.",
      time: "1 giờ trước",
      read: true,
    },
  ]);

  const unreadCount = notifications.filter((item) => !item.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
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
            onClick={() => setNotificationOpen((prev) => !prev)}
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

              <ul className="max-h-80 overflow-y-auto py-1">
                {notifications.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${item.read ? "bg-white" : "bg-[#F9FAFB]"}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-2 shrink-0 flex justify-center pt-1.5">
                          {!item.read && (
                            <span className="size-2 rounded-full bg-brand" />
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
                ))}
              </ul>

              <div className="border-t">
                <button
                  type="button"
                  className="w-full py-3 text-sm text-center text-[#3B7BF8] font-medium hover:bg-gray-50 transition-colors rounded-b-xl"
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
