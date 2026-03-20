import { OverviewCard } from "@/components/ui/overview-card";
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
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";
import {
  ActionCard,
  type ActionCardItem,
} from "@repo/ui/components/action-card";
import {
  AddAdminModal,
  type AdminAssignedRole,
} from "@/components/ui/add-admin-modal";
import { ProfileModal } from "@repo/ui/components/profile-modal";

type UserRole = "patient" | "doctor" | "admin";
type UserStatus = "active" | "banned";
type UserRecord = {
  id: string;
  name: string;
  email: string;
  location: string;
  joined: string;
  role: UserRole;
  status: UserStatus;
  specialty?: string;
  assigned_role?: AdminAssignedRole;
};

const USER_DATA: UserRecord[] = [
  {
    id: "u-001",
    name: "Emma Thompson",
    email: "emma.t@gmail.com",
    location: "New York, US",
    joined: "Jan 12, 2026",
    role: "patient",
    status: "active",
  },
  {
    id: "u-002",
    name: "James Wilson",
    email: "j.wilson@mail.com",
    location: "London, UK",
    joined: "Feb 3, 2026",
    role: "doctor",
    status: "active",
    specialty: "Cardiology",
  },
  {
    id: "u-003",
    name: "Sofia Martinez",
    email: "sofia.m@outlook.com",
    location: "Madrid, ES",
    joined: "Dec 20, 2025",
    role: "admin",
    status: "banned",
    assigned_role: "super_admin",
  },
  {
    id: "u-004",
    name: "Liam Johnson",
    email: "liam.j@gmail.com",
    location: "Chicago, US",
    joined: "Mar 1, 2026",
    role: "patient",
    status: "active",
  },
  {
    id: "u-005",
    name: "Aisha Patel",
    email: "aisha.p@yahoo.com",
    location: "Mumbai, IN",
    joined: "Feb 18, 2026",
    role: "doctor",
    status: "active",
    specialty: "Cardiology",
  },
  {
    id: "u-006",
    name: "Noah Kim",
    email: "noah.k@mail.com",
    location: "Seoul, KR",
    joined: "Jan 28, 2026",
    role: "patient",
    status: "active",
  },
  {
    id: "u-007",
    name: "Olivia Brown",
    email: "olivia.b@gmail.com",
    location: "Toronto, CA",
    joined: "Feb 10, 2026",
    role: "patient",
    status: "active",
  },
  {
    id: "u-008",
    name: "Ethan Davis",
    email: "ethan.d@work.com",
    location: "Sydney, AU",
    joined: "Nov 5, 2025",
    role: "admin",
    status: "banned",
    assigned_role: "ai_admin",
  },
  {
    id: "u-009",
    name: "Mia Carter",
    email: "mia.c@gmail.com",
    location: "Boston, US",
    joined: "Jan 15, 2026",
    role: "patient",
    status: "active",
  },
  {
    id: "u-010",
    name: "Benjamin Clark",
    email: "ben.c@outlook.com",
    location: "Dublin, IE",
    joined: "Dec 15, 2025",
    role: "doctor",
    status: "active",
    specialty: "Cardiology",
  },
  {
    id: "u-011",
    name: "Charlotte Lee",
    email: "charlotte.l@mail.com",
    location: "Seattle, US",
    joined: "Jan 7, 2026",
    role: "admin",
    status: "active",
    assigned_role: "user_admin",
  },
  {
    id: "u-012",
    name: "Lucas Nguyen",
    email: "lucas.n@gmail.com",
    location: "Ho Chi Minh, VN",
    joined: "Feb 12, 2026",
    role: "doctor",
    status: "active",
    specialty: "Cardiology",
  },
  {
    id: "u-013",
    name: "Ava Garcia",
    email: "ava.g@gmail.com",
    location: "Barcelona, ES",
    joined: "Mar 4, 2026",
    role: "patient",
    status: "active",
  },
  {
    id: "u-014",
    name: "Henry Turner",
    email: "henry.t@mail.com",
    location: "Melbourne, AU",
    joined: "Dec 30, 2025",
    role: "admin",
    status: "banned",
    assigned_role: "super_admin",
  },
  {
    id: "u-015",
    name: "Isabella Moore",
    email: "isabella.m@outlook.com",
    location: "Auckland, NZ",
    joined: "Jan 21, 2026",
    role: "doctor",
    status: "active",
    specialty: "Cardiology",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAvatarColor(seed: string) {
  const palette = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-violet-500",
    "bg-rose-500",
    "bg-cyan-500",
  ];
  const index = seed.charCodeAt(0) % palette.length;
  return palette[index];
}

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

export function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>(USER_DATA);
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("patient");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [openActionUserId, setOpenActionUserId] = useState<string | null>(null);
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false);
  const [newAdminFullName, setNewAdminFullName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] =
    useState<AdminAssignedRole>("user_admin");
  const [addAdminError, setAddAdminError] = useState("");

  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleCloseProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedUserId(null);
  };

  const pageSize = 8;

  useEffect(() => {
    const handleClickOutsideMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-actions-root="true"]')) {
        setOpenActionUserId(null);
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

  const createUserId = () => {
    const maxId = users.reduce((acc, item) => {
      const currentId = Number(item.id.replace("u-", ""));
      if (Number.isNaN(currentId)) {
        return acc;
      }
      return Math.max(acc, currentId);
    }, 0);

    return `u-${String(maxId + 1).padStart(3, "0")}`;
  };

  const formatJoinedDate = () => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  };

  const handleCreateAdmin = () => {
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

    const newAdmin: UserRecord = {
      id: createUserId(),
      name: fullName,
      email,
      location: "-",
      joined: formatJoinedDate(),
      role: "admin",
      status: "active",
      assigned_role: newAdminRole,
    };

    setUsers((prevUsers) => [newAdmin, ...prevUsers]);
    setCurrentPage(1);
    setSelectedRole("admin");
    setOpenActionUserId(null);
    setIsAddAdminModalOpen(false);
    resetAddAdminForm();
  };

  const summaryCards = [
    {
      title: "Total Users",
      icon: <Users size={18} />,
      stats: users.length,
      subText: "all users",
      comparedStats: 6.4,
      iconClassName: "bg-blue-50 text-blue-600",
    },
    {
      title: "Active Doctors",
      icon: <Stethoscope size={18} />,
      stats: users.filter(
        (item) => item.role === "doctor" && item.status === "active",
      ).length,
      subText: "active doctors",
      comparedStats: 4.2,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Pending Application",
      icon: <Clock size={18} />,
      stats: 3,
      subText: "need attention",
      comparedStats: -1.2,
      iconClassName: "bg-amber-50 text-amber-600",
    },
    {
      title: "Banned Users",
      icon: <Ban size={18} />,
      stats: users.filter((item) => item.status === "banned").length,
      subText: "across platform",
      comparedStats: -5,
      iconClassName: "bg-red-50 text-red-500",
    },
  ];

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
    setOpenActionUserId(null);
  };

  const changeRole = (role: UserRole | "all") => {
    setSelectedRole(role);
    setCurrentPage(1);
    setOpenActionUserId(null);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    setOpenActionUserId(null);
  };

  const handleToggleStatus = (userId: string) => {
    setUsers((prevUsers) =>
      prevUsers.map((item) =>
        item.id === userId
          ? { ...item, status: item.status === "active" ? "banned" : "active" }
          : item,
      ),
    );
    setOpenActionUserId(null);
  };

  const handleAssignAdminRole = (userId: string) => {
    setUsers((prevUsers) =>
      prevUsers.map((item) => {
        if (item.id !== userId || item.role !== "admin") {
          return item;
        }

        const currentRole = item.assigned_role ?? "user_admin";
        const currentRoleIndex = ADMIN_ROLE_ORDER.indexOf(currentRole);
        const nextRole =
          ADMIN_ROLE_ORDER[(currentRoleIndex + 1) % ADMIN_ROLE_ORDER.length];

        return {
          ...item,
          assigned_role: nextRole,
        };
      }),
    );

    setOpenActionUserId(null);
  };

  const createActionList = (user: UserRecord): ActionCardItem[] => {
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
      {
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
        onHandle: () => handleToggleStatus(user.id),
      },
    ];

    if (user.role === "admin") {
      actions.splice(1, 0, {
        id: `${user.id}-assign-role`,
        title: `Assign role (${getAdminRoleLabel(user.assigned_role)})`,
        icon: <ArrowLeftRight className="h-4 w-4" />,
        iconColor: "text-indigo-700",
        onHandle: () => handleAssignAdminRole(user.id),
      });
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            User & Doctor Management
          </h1>
          <p className="text-sm text-slate-500">
            Manage all platform users, patients and doctors
          </p>
        </div>
      </div>

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
              <Button onClick={handleOpenAddAdminModal}>Add admin</Button>
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
                      <div
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${getAvatarColor(user.name)}`}
                      >
                        {getInitials(user.name)}
                      </div>
                      <span className="text-sm text-slate-700">
                        {user.name}
                      </span>
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
                        onClick={() =>
                          setOpenActionUserId((prev) =>
                            prev === user.id ? null : user.id,
                          )
                        }
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {openActionUserId === user.id ? (
                        <ActionCard actions={createActionList(user)} />
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

      <ProfileModal
        id={selectedUserId || ""}
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
      />
    </div>
  );
}
