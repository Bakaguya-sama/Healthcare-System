import { OverviewCard } from "@repo/ui/components/data-display/overview-card";
import {
  ArrowLeftRight,
  Ban,
  Clock,
  Eye,
  Lock,
  LockOpen,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/ui/pagination";
import {
  ActionCard,
  type ActionCardItem,
} from "@repo/ui/components/ui/action-card";
import {
  AddAdminModal,
  type AdminAssignedRole,
} from "@/features/ai_management/components/add-admin-modal";
import { ProfileModal } from "@repo/ui/components/complex-modal/ProfileModal";
import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { useUsers } from "../hooks/useUserManagement";
import type { UserManagementUser } from "../services/user-management.service";
import {
  createAdmin,
  changeAdminRole,
} from "../services/admin-management.service";
import { banUser, unbanUser } from "../services/user-management.service";
import { showToast } from "@repo/ui/components/ui/toasts";
import { useViewProfile } from "@/features/shared/hooks/useProfile";
import { useReport } from "@/features/shared/hooks/useReport";
import type {
  ReportActor,
  ReportType,
} from "@repo/ui/components/complex-modal/ReportModal";
import { useAuthStore } from "@repo/ui/store/useAuthStore";

type UserRole = "patient" | "doctor" | "admin";
type UserStatus = "active" | "banned";
type UserRecord = {
  id: string;
  name: string;
  avatarUrl?: string;
  email: string;
  location: string;
  joined: string;
  role: UserRole;
  status: UserStatus;
  specialty?: string;
  assigned_role?: AdminAssignedRole;
};

const ADMIN_ROLE_ORDER: AdminAssignedRole[] = [
  "super_admin",
  "user_admin",
  "ai_admin",
];

function getAdminRoleLabel(role?: AdminAssignedRole) {
  if (role === "super_admin") {
    return "Super admin";
  }

  if (role === "user_admin") {
    return "User admin";
  }

  return "AI admin";
}

function mapUserToRecord(user: UserManagementUser): UserRecord {
  return {
    id: user.id,
    name: user.fullName,
    avatarUrl: user.avatarUrl,
    email: user.email,
    location: user.location,
    joined: user.joined,
    role: user.role,
    status: user.status,
    specialty: user.specialty,
    assigned_role: user.assigned_role,
  };
}

function mergeUsers(baseUsers: UserRecord[], localUsers: UserRecord[]) {
  const mergedUsers = new Map<string, UserRecord>();

  for (const user of baseUsers) {
    mergedUsers.set(user.id, user);
  }

  for (const user of localUsers) {
    mergedUsers.set(user.id, {
      ...(mergedUsers.get(user.id) ?? {}),
      ...user,
    });
  }

  return Array.from(mergedUsers.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function UserManagement() {
  const { users: usersData, isLoading, error, refresh } = useUsers();
  const { submitReport, error: submitReportError } = useReport();
  const [localUsers, setLocalUsers] = useState<UserRecord[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("patient");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionUserId, setOpenActionUserId] = useState<string | null>(null);
  const [openActionRect, setOpenActionRect] = useState<DOMRect | null>(null);
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [newAdminFullName, setNewAdminFullName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] =
    useState<AdminAssignedRole>("user_admin");
  const [addAdminError, setAddAdminError] = useState("");
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);

  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data: profileData, error: profileError } = useViewProfile(
    selectedUserId,
    isProfileModalOpen,
  );

  const baseUsers = useMemo(
    () => usersData.userList.map(mapUserToRecord),
    [usersData.userList],
  );

  const users = useMemo(
    () => mergeUsers(baseUsers, localUsers),
    [baseUsers, localUsers],
  );

  console.log(users);

  const selectedUser = users.find((user) => user.id === selectedUserId);

  const currentAdmin = useAuthStore((state) => state.user);

  const handleCloseProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedUserId(null);
  };

  const handleToggleActionMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    userId: string,
  ) => {
    const nextIsOpen = openActionUserId !== userId;

    setOpenActionUserId(nextIsOpen ? userId : null);
    setOpenActionRect(
      nextIsOpen ? event.currentTarget.getBoundingClientRect() : null,
    );
  };

  useEffect(() => {
    if (profileError) {
      showToast.error(profileError);
    }
  }, [profileError]);

  useEffect(() => {
    if (submitReportError) {
      showToast.error(submitReportError);
    }
  }, [submitReportError]);

  const handleSubmitProfileReport = async (payload: {
    target: ReportActor;
    reporter: ReportActor;
    reportType: ReportType;
    reason: string;
  }) => {
    const result = await submitReport({
      reportedUserId: payload.target.id,
      reportType: payload.reportType,
      reason: payload.reason,
    });

    if (result) {
      showToast.success("Report submitted successfully");
      await refresh();
    }
  };

  const pageSize = 8;

  useEffect(() => {
    const handleClickOutsideMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-actions-root="true"]')) {
        setOpenActionUserId(null);
        setOpenActionRect(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutsideMenu);
    return () => {
      document.removeEventListener("mousedown", handleClickOutsideMenu);
    };
  }, []);

  const roleCounts = useMemo(
    () => ({
      patient: users.filter((item) => item.role === "patient").length,
      doctor: users.filter((item) => item.role === "doctor").length,
      admin: users.filter((item) => item.role === "admin").length,
    }),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return users.filter((item) => {
      const roleMatched = selectedRole === "all" || item.role === selectedRole;
      const queryMatched =
        normalizedQuery.length === 0 ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.email.toLowerCase().includes(normalizedQuery) ||
        item.location.toLowerCase().includes(normalizedQuery);

      return roleMatched && queryMatched;
    });
  }, [searchQuery, selectedRole, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage]);

  const resetAddAdminForm = () => {
    setNewAdminFullName("");
    setNewAdminEmail("");
    setNewAdminPassword("");
    setNewAdminRole("user_admin");
    setAddAdminError("");
  };

  const handleOpenAddAdminModal = () => {
    setIsAddAdminModalOpen(true);
    setAddAdminError("");
  };

  const handleCloseAddAdminModal = () => {
    setIsAddAdminModalOpen(false);
    resetAddAdminForm();
  };

  const handleCreateAdmin = async () => {
    const fullName = newAdminFullName.trim();
    const email = newAdminEmail.trim().toLowerCase();

    if (!fullName || !email || !newAdminPassword) {
      setAddAdminError("Please fill in all required fields.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAddAdminError("Please enter a valid email address.");
      return;
    }

    if (newAdminPassword.length < 8) {
      setAddAdminError("Temporary password must be at least 8 characters.");
      return;
    }

    const hasDuplicatedEmail = users.some(
      (item) => item.email.toLowerCase() === email,
    );
    if (hasDuplicatedEmail) {
      setAddAdminError("This email is already in use.");
      return;
    }

    try {
      setIsCreatingAdmin(true);
      await createAdmin({
        fullName,
        email,
        password: newAdminPassword,
        assignedRole: newAdminRole,
        accountStatus: "active",
      });

      await refresh();
      setCurrentPage(1);
      setSelectedRole("admin");
      setOpenActionUserId(null);
      setIsAddAdminModalOpen(false);
      resetAddAdminForm();
    } catch (createError) {
      setAddAdminError(
        createError instanceof Error
          ? createError.message
          : "Failed to create admin account.",
      );
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const summaryCards = [
    {
      title: "Total Users",
      icon: <Users size={18} />,
      stats: usersData.totalUser,
      subText: "all users",
      comparedStats: 6.4,
      iconClassName: "bg-blue-50 text-blue-600",
    },
    {
      title: "Active Doctors",
      icon: <Stethoscope size={18} />,
      stats: usersData.activeDoctors,
      subText: "active doctors",
      comparedStats: 4.2,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Pending Application",
      icon: <Clock size={18} />,
      stats: usersData.pendingVerifications,
      subText: "need attention",
      comparedStats: -1.2,
      iconClassName: "bg-amber-50 text-amber-600",
    },
    {
      title: "Banned Users",
      icon: <Ban size={18} />,
      stats: usersData.bannedUsers,
      subText: "across platform",
      comparedStats: -5,
      iconClassName: "bg-red-50 text-red-500",
    },
  ];

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
    setOpenActionUserId(null);
    setOpenActionRect(null);
  };

  const changeRole = (role: UserRole | "all") => {
    setSelectedRole(role);
    setCurrentPage(1);
    setOpenActionUserId(null);
    setOpenActionRect(null);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    setOpenActionUserId(null);
    setOpenActionRect(null);
  };

  const handleToggleStatus = async (userId: string) => {
    console.log("Change status");
    const currentUser = users.find((item) => item.id === userId);

    if (!currentUser) {
      return;
    }

    try {
      if (currentUser.status === "active") {
        await banUser({
          id: userId,
          reason: "Vi phạm quy định hệ thống",
        });
      } else {
        await unbanUser({
          id: userId,
        });
      }

      await refresh();
      setLocalUsers((prevUsers) =>
        prevUsers.map((item) =>
          item.id === userId
            ? {
                ...item,
                status: currentUser.status === "active" ? "banned" : "active",
              }
            : item,
        ),
      );
      setOpenActionUserId(null);
      setOpenActionRect(null);
      showToast.success(
        currentUser.status === "active"
          ? "User banned successfully"
          : "User unbanned successfully",
      );
    } catch (toggleError) {
      showToast.error(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update user status",
      );
    }
  };

  const handleAssignAdminRole = async (
    userId: string,
    nextRole: AdminAssignedRole,
  ) => {
    const currentUser = users.find((item) => item.id === userId);

    if (!currentUser || currentUser.role !== "admin") {
      return;
    }

    try {
      await changeAdminRole({
        id: userId,
        assignedRole: nextRole,
      });

      setLocalUsers((prevUsers) =>
        prevUsers.map((item) =>
          item.id === userId ? { ...item, assigned_role: nextRole } : item,
        ),
      );
      await refresh();
      setCurrentPage(1);
      setOpenActionUserId(null);
      setOpenActionRect(null);
      showToast.success(`Role updated to ${getAdminRoleLabel(nextRole)}`);
    } catch (createError) {
      showToast.error(
        createError instanceof Error
          ? createError.message
          : "Failed to update admin role",
      );
    }

    setOpenActionUserId(null);
  };

  const createActionList = (user: UserRecord): ActionCardItem[] => {
    const isSelf = currentAdmin?.id === user.id;

    const actions: ActionCardItem[] = [
      {
        id: `${user.id}-view-profile`,
        title: "View profile",
        icon: <Eye className="h-4 w-4" />,
        onHandle: () => {
          setSelectedUserId(user.id);
          setProfileModalOpen(true);
        },
      },
    ];

    if (!isSelf) {
      actions.push({
        id: `${user.id}-lock-unlock`,
        title: user.status === "active" ? "Lock user" : "Unlock user",
        icon:
          user.status === "active" ? (
            <Lock className="h-4 w-4" />
          ) : (
            <LockOpen className="h-4 w-4" />
          ),
        iconColor:
          user.status === "active" ? "text-red-700" : "text-emerald-700",
        onHandle: () => void handleToggleStatus(user.id),
      });
    }

    if (!isSelf && user.role === "admin") {
      const currentRole = user.assigned_role ?? "user_admin";
      const roleActions: ActionCardItem[] = ADMIN_ROLE_ORDER.filter(
        (role) => role !== currentRole,
      ).map((role) => ({
        id: `${user.id}-assign-role-${role}`,
        title: `${getAdminRoleLabel(role)}`,
        icon: <ArrowLeftRight className="h-4 w-4" />,
        iconColor: "text-indigo-700",
        onHandle: () => handleAssignAdminRole(user.id, role),
      }));

      actions.splice(1, 0, ...roleActions);
    }

    return actions;
  };

  const roleTabs = [
    {
      key: "patient" as const,
      label: "Patients",
      count: roleCounts.patient,
    },
    {
      key: "doctor" as const,
      label: "Doctors",
      count: roleCounts.doctor,
    },
    {
      key: "admin" as const,
      label: "Admin",
      count: roleCounts.admin,
    },
  ];

  const getAssignedRoleBadge = (role?: AdminAssignedRole) => {
    if (role === "super_admin") {
      return (
        <span className="rounded-xl bg-[#DDD6FE] p-1 font-bold text-[#7C3AED]">
          Super admin
        </span>
      );
    }

    if (role === "user_admin") {
      return (
        <span className="rounded-xl bg-[#DBEAFE] p-1 font-bold text-[#3B7BF8]">
          User admin
        </span>
      );
    }

    return (
      <span className="rounded-xl bg-[#FED7AA] p-1 font-bold text-[#EA580C]">
        AI admin
      </span>
    );
  };

  const tableColSpan =
    selectedRole === "doctor" || selectedRole === "admin" ? 7 : 6;

  return (
    <div className="w-full p-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              User & Doctor Management
            </h1>
            <p className="text-sm text-slate-500">
              Manage all platform users, patients and doctors
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Loading user data...
          </div>
        ) : null}

        <ul className="m-0 grid w-full list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((item) => (
            <OverviewCard key={item.title} {...item} />
          ))}
        </ul>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              {roleTabs.map((item) => (
                <Button
                  key={item.key}
                  type="button"
                  variant={selectedRole === item.key ? "outline" : "ghost"}
                  size="sm"
                  className={`rounded-xl px-3 ${selectedRole === item.key ? "border-slate-300 bg-slate-50" : "text-slate-500"}`}
                  onClick={() => changeRole(item.key)}
                >
                  {item.label}
                  <Badge
                    variant="outline"
                    className="ml-1 h-4 px-1.5 text-[10px] leading-none"
                  >
                    {item.count}
                  </Badge>
                </Button>
              ))}
              <Button
                type="button"
                variant={selectedRole === "all" ? "outline" : "ghost"}
                size="sm"
                className={`rounded-xl px-3 ${selectedRole === "all" ? "border-slate-300 bg-slate-50" : "text-slate-500"}`}
                onClick={() => changeRole("all")}
              >
                All
                <Badge
                  variant="outline"
                  className="ml-1 h-4 px-1.5 text-[10px] leading-none"
                >
                  {users.length}
                </Badge>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search name or email..."
                  className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 outline-none ring-brand/30 transition focus:ring-2"
                />
              </div>
              {selectedRole === "admin" ? (
                <Button
                  onClick={handleOpenAddAdminModal}
                  disabled={isCreatingAdmin}
                >
                  {isCreatingAdmin ? "Creating..." : "Add admin"}
                </Button>
              ) : null}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3 text-xs text-slate-400">
                  USER
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  EMAIL
                </TableHead>
                {selectedRole === "doctor" ? (
                  <TableHead className="px-3 text-xs text-slate-400">
                    SPECIALTY
                  </TableHead>
                ) : null}
                {selectedRole === "admin" ? (
                  <TableHead className="px-3 text-xs text-slate-400">
                    ASSIGNED ROLE
                  </TableHead>
                ) : null}
                <TableHead className="px-3 text-xs text-slate-400">
                  LOCATION
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  JOINED
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  STATUS
                </TableHead>
                <TableHead className="px-3 text-xs text-slate-400">
                  ACTIONS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={user.name} url={user.avatarUrl} />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 text-sm text-slate-500">
                      {user.email}
                    </TableCell>
                    {selectedRole === "doctor" ? (
                      <TableCell className="px-3 text-sm text-slate-500">
                        <span className="bg-[#DBEAFE] p-1 rounded-xl text-[#3B7BF8]">
                          {user.specialty}
                        </span>
                      </TableCell>
                    ) : null}
                    {selectedRole === "admin" ? (
                      <TableCell className="px-3 text-sm text-slate-500">
                        {getAssignedRoleBadge(user.assigned_role)}
                      </TableCell>
                    ) : null}
                    <TableCell className="px-3 text-sm text-slate-500">
                      {user.location}
                    </TableCell>
                    <TableCell className="px-3 text-sm text-slate-500">
                      {user.joined}
                    </TableCell>
                    <TableCell className="px-3">
                      <Badge
                        variant="outline"
                        className={`h-5 rounded-full border px-2 text-[10px] font-medium ${
                          user.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                            : "border-red-200 bg-red-50 text-red-500"
                        }`}
                      >
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        {user.status === "active" ? "Active" : "Banned"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 text-left text-slate-400">
                      <div
                        className="relative inline-block"
                        data-actions-root="true"
                      >
                        <button
                          type="button"
                          className="h-6 w-6 cursor-pointer rounded-md p-1 transition-colors hover:bg-slate-100"
                          onClick={(event) =>
                            handleToggleActionMenu(event, user.id)
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {openActionUserId === user.id ? (
                          <ActionCard
                            onClickOutside={() => setOpenActionUserId(null)}
                            actions={createActionList(user)}
                            anchorRect={openActionRect}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={tableColSpan}
                    className="px-3 py-8 text-center text-sm text-slate-500"
                  >
                    No users found for your current filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-3 py-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing {paginatedUsers.length} of {filteredUsers.length} results
            </p>

            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text=""
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-40" : ""
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      goToPage(currentPage - 1);
                    }}
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }).map((_, index) => {
                  const page = index + 1;
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        isActive={page === currentPage}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(page);
                        }}
                        className="h-7 w-7 rounded-lg text-xs"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text=""
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-40"
                        : ""
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      goToPage(currentPage + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>

        <AddAdminModal
          isOpen={isAddAdminModalOpen}
          fullName={newAdminFullName}
          email={newAdminEmail}
          password={newAdminPassword}
          role={newAdminRole}
          errorMessage={addAdminError}
          onChangeFullName={setNewAdminFullName}
          onChangeEmail={setNewAdminEmail}
          onChangePassword={setNewAdminPassword}
          onChangeRole={setNewAdminRole}
          onClose={handleCloseAddAdminModal}
          onAdd={handleCreateAdmin}
        />

        {/* TODO: handle profile */}
        <ProfileModal
          id={selectedUserId || ""}
          isOpen={isProfileModalOpen}
          onClose={handleCloseProfileModal}
          profileSeed={
            profileData
              ? profileData
              : selectedUser
                ? {
                    id: selectedUser.id,
                    full_name: selectedUser.name,
                    email: selectedUser.email,
                    role: selectedUser.role,
                    account_status: selectedUser.status,
                    address_display: selectedUser.location,
                  }
                : undefined
          }
          reportViewer={{
            id: "admin-current",
            name: "Current Admin",
            role: "admin",
          }}
          onSubmitReport={handleSubmitProfileReport}
        />
      </div>
    </div>
  );
}
