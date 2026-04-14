import { useAuthStore } from "../store/useAuthStore";
import { Sidebar, type SidebarRole } from "./sidebar";
import { TopHeader } from "./top-header";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

type LayoutProps = {
  onLogout?: () => Promise<void> | void;
};

export function Layout({ onLogout }: LayoutProps) {
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
        <TopHeader />
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
