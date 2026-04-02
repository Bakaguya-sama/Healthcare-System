import { Sidebar, type UserRole } from "./sidebar";
import { TopHeader } from "./top-header";
import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";

type LayoutProps = {
  userRole: UserRole;
};

export function Layout({ userRole }: LayoutProps) {
  const { pathname, search } = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname, search]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userRole={userRole} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader />
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
