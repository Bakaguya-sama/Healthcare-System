import { Sidebar, type UserRole } from "./sidebar";
import { TopHeader } from "./top-header";
import { Outlet } from "react-router-dom";

type LayoutProps = {
  userRole: UserRole;
};

export function Layout({ userRole }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userRole={userRole} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopHeader />
        <Outlet />
      </div>
    </div>
  );
}
