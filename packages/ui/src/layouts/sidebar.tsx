import { NavLink, useNavigate } from "react-router-dom";
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "../lib/utils";
import { UserAvatar } from "../components/ui/user-avatar";
import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { type AdminRole, type AppRole } from "../types/auth";

const clientMenuItems = {
  doctor: [
    {
      id: "doctor-overview",
      label: "Overview",
      icon: LayoutDashboard,
      path: "/doctor-overview",
    },
    {
      id: "consultations",
      label: "Consultations",
      icon: MessageSquare,
      path: "/consultations",
    },
    { id: "profile", label: "Profile", icon: CircleUser, path: "/profile" },
  ],
  patient: [
    {
      id: "patient-overview",
      label: "Overview",
      icon: LayoutDashboard,
      path: "/patient-overview",
    },
    {
      id: "my-doctors",
      label: "My doctors",
      icon: Stethoscope,
      path: "/my-doctors",
    },
    {
      id: "ai-chat",
      label: "AI chat",
      icon: Bot,
      path: "/ai-chat",
    },
    {
      id: "doctor-chat",
      label: "Doctor chat",
      icon: MessageSquare,
      path: "/doctor-chat",
    },
    { id: "profile", label: "Profile", icon: CircleUser, path: "/profile" },
  ],
};

const adminMenuItems = {
  super_admin: [
    { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/" },
    {
      id: "user_management",
      label: "User Management",
      icon: Users,
      path: "/user-management",
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
  ai_admin: [
    { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/" },
    {
      id: "ai_knowledge_base",
      label: "AI Knowledge Base",
      icon: BookOpen,
      path: "/ai-knowledge-base",
    },
    { id: "profile", label: "Profile", icon: CircleUser, path: "/profile" },
  ],
  user_admin: [
    { id: "overview", label: "Overview", icon: LayoutDashboard, path: "/" },
    {
      id: "user_management",
      label: "User Management",
      icon: Users,
      path: "/user-management",
    },
    {
      id: "doc_verification",
      label: "Doc Verification",
      icon: FileCheck,
      path: "/doc-verification",
    },
    {
      id: "violation_reports",
      label: "Violation Reports",
      icon: ShieldAlert,
      path: "/violation-reports",
    },
    { id: "profile", label: "Profile", icon: CircleUser, path: "/profile" },
  ],
};

export type SidebarRole = AppRole;

type SidebarProps = {
  userRole: SidebarRole;
  adminRole?: AdminRole;
  onLogout?: () => Promise<void> | void;
};

export function Sidebar({
  userRole,
  adminRole = "user_admin",
  onLogout,
}: SidebarProps) {
  const user = useAuthStore((state) => state.user);
  const clearAuthState = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [shrunk, setShrunk] = useState(false);

  const roleItems =
    userRole === "admin"
      ? (adminMenuItems[adminRole ?? "user_admin"] ?? [])
      : clientMenuItems[userRole];

  const onLogOut = async () => {
    try {
      await onLogout?.();
    } finally {
      clearAuthState();
      navigate("/login", { replace: true });
    }
  };

  return (
    <aside
      className={cn(
        "bg-white shadow-lg flex h-screen shrink-0 flex-col transition-all duration-300",
        shrunk ? "w-20" : "w-64",
      )}
    >
      <div className={cn("py-5", shrunk ? "px-4" : "px-6")}>
        <div
          className={cn(
            "flex items-center",
            shrunk ? "justify-center" : "gap-3",
          )}
        >
          <Cross className="h-9 w-9 text-brand fill-brand shrink-0" />
          {!shrunk && (
            <div>
              <p className="text-2xl font-bold text-gray-900 leading-tight">
                Healthcare
              </p>
              <p className="text-sm text-center text-[#6B7280] font-semibold">
                {userRole === "admin"
                  ? adminRole === "super_admin"
                    ? "Super Admin"
                    : adminRole === "ai_admin"
                      ? "AI Admin"
                      : "User Admin"
                  : userRole === "doctor"
                    ? "Medidoctor"
                    : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      <nav
        className={cn("flex-1 overflow-y-auto py-5", shrunk ? "px-2" : "px-4")}
      >
        <div
          className={cn(
            "mb-3 flex items-center",
            shrunk ? "justify-center" : "justify-between px-2",
          )}
        >
          {!shrunk && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Main Menu
            </p>
          )}
          <button
            type="button"
            onClick={() => setShrunk((prev) => !prev)}
            aria-label={shrunk ? "Expand sidebar" : "Collapse sidebar"}
            className="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            {shrunk ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

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
                      "flex items-center rounded-xl text-sm font-medium transition-colors",
                      shrunk
                        ? "justify-center px-2 py-2.5"
                        : "gap-3 px-3 py-2.5",
                      isActive
                        ? "bg-brand text-white"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
                    )
                  }
                  title={shrunk ? item.label : undefined}
                >
                  {({ isActive }: { isActive: boolean }) => (
                    <>
                      <Icon className="w-5 h-5 shrink-0" />
                      {!shrunk && <span className="flex-1">{item.label}</span>}
                      {!shrunk && isActive && (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={cn(
          "border-t py-4",
          shrunk
            ? "px-2 flex flex-col items-center gap-3"
            : "px-4 flex items-center gap-3",
        )}
      >
        <UserAvatar
          name={user?.name || "User"}
          url={user?.avatar}
          isOnline={true}
        />
        {!shrunk && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {user?.name || "Unknown User"}
            </p>
          </div>
        )}
        <button
          onClick={onLogOut}
          className="cursor-pointer text-gray-400 hover:text-gray-700 shrink-0"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
