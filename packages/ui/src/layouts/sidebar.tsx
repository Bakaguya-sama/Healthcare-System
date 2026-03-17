import { NavLink } from "react-router-dom";
import {
  Cross,
  LayoutDashboard,
  Users,
  FileCheck,
  BookOpen,
  ShieldAlert,
  CircleUser,
  LogOut,
  ChevronRight,
  MessageSquare,
  Stethoscope,
  Bot,
} from "lucide-react";
import { cn } from "../lib/utils";

const menuItems = {
  admin: [
    { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/" },
    {
      id: "user_management",
      label: "User Management",
      icon: Users,
      path: "/users",
    },
    {
      id: "doc_verification",
      label: "Doc Verification",
      icon: FileCheck,
      path: "/doc-verification",
    },
    {
      id: "ai_knowledge_base",
      label: "AI Knowledge Base",
      icon: BookOpen,
      path: "/ai-knowledge-base",
    },
    {
      id: "violation_reports",
      label: "Violation Reports",
      icon: ShieldAlert,
      path: "/violation-reports",
    },
    { id: "profile", label: "Profile", icon: CircleUser, path: "/profile" },
  ],
  doctor: [
    { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/" },
    {
      id: "consultations",
      label: "Consultations",
      icon: MessageSquare,
      path: "/consultations",
    },
    { id: "profile", label: "Profile", icon: CircleUser, path: "/profile" },
  ],
  patient: [
    { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/" },
    {
      id: "my_doctors",
      label: "My doctors",
      icon: Stethoscope,
      path: "/my_doctors",
    },
    {
      id: "ai_assistant",
      label: "AI assistant",
      icon: Bot,
      path: "/ai_assistant",
    },
    {
      id: "messages",
      label: "Messages",
      icon: MessageSquare,
      path: "/messages",
    },
    { id: "profile", label: "Profile", icon: CircleUser, path: "/profile" },
  ],
};

export type UserRole = keyof typeof menuItems;

type SidebarProps = {
  userRole: UserRole;
};

export function Sidebar({ userRole }: SidebarProps) {
  const roleItems = menuItems[userRole] ?? [];
  return (
    <aside className="w-64 bg-white shadow-lg flex flex-col h-screen shrink-0">
      {/* Logo */}
      <div className="px-6 py-5">
        <div className="flex items-center gap-3">
          <Cross className="h-9 w-9 text-brand fill-brand shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-tight">
              Healthcare
            </p>
            <p className="text-sm text-center text-[#6B7280] font-semibold">
              {userRole === "admin"
                ? "MediAdmin"
                : userRole === "doctor"
                  ? "Medidoctor"
                  : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-4 py-5 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-2">
          Main Menu
        </p>
        <ul className="space-y-1">
          {roleItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={item.path === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand text-white"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
                    )
                  }
                >
                  {({ isActive }: { isActive: boolean }) => (
                    <>
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight className="w-4 h-4" />}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info */}
      <div className="px-4 py-4 border-t flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
          SA
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            Super Admin
          </p>
          <p className="text-xs text-gray-400 truncate">admin@medi.com</p>
        </div>
        <button className="text-gray-400 hover:text-gray-700 shrink-0">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
