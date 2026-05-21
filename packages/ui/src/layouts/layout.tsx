import { useAuthStore } from "../store/useAuthStore";
import { Sidebar, type SidebarRole } from "./sidebar";
import { TopHeader } from "./top-header";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

type LayoutProps = {
  onLogout?: () => Promise<void> | void;
  notifications?: Parameters<typeof TopHeader>[0]["notifications"];
  notificationsLoading?: Parameters<typeof TopHeader>[0]["isLoading"];
  notificationsError?: Parameters<typeof TopHeader>[0]["error"];
  onMarkAllNotificationsRead?: Parameters<
    typeof TopHeader
  >[0]["onMarkAllAsRead"];
  onMarkNotificationRead?: Parameters<typeof TopHeader>[0]["onMarkAsRead"];
  onDeleteNotification?: Parameters<typeof TopHeader>[0]["onDelete"];
  onPrimaryNotificationAction?: Parameters<
    typeof TopHeader
  >[0]["onPrimaryAction"];
};

export function Layout({
  onLogout,
  notifications,
  notificationsLoading,
  notificationsError,
  onMarkAllNotificationsRead,
  onMarkNotificationRead,
  onDeleteNotification,
  onPrimaryNotificationAction,
}: LayoutProps) {
  const { pathname, search } = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  const user = useAuthStore((state) => state.user);
  const userRole = (user?.role as SidebarRole) || "admin";
  const adminRole = user?.adminRole;

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname, search]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userRole={userRole} adminRole={adminRole} onLogout={onLogout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader
          notifications={notifications}
          isLoading={notificationsLoading}
          error={notificationsError}
          onMarkAllAsRead={onMarkAllNotificationsRead}
          onMarkAsRead={onMarkNotificationRead}
          onDelete={onDeleteNotification}
          onPrimaryAction={onPrimaryNotificationAction}
        />
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
