import { api } from "@/lib/api";

export interface UserManagement {
  totalUser: number;
  activeDoctors: number;
  pendingVerifications: number;
  bannedUsers: number;
  userList: UserManagementUser[];
}

type UserRole = "patient" | "doctor" | "admin";
type UserStatus = "active" | "banned";
type AdminAssignedRole = "super_admin" | "user_admin" | "ai_admin";

export type UserManagementUser = {
  id: string;
  fullName: string;
  avatarUrl?: string;
  email: string;
  location: string;
  joined: string;
  role: UserRole;
  status: UserStatus;
  specialty?: string;
  assigned_role?: AdminAssignedRole;
};

type ApiAddress = {
  city?: string;
  country?: string;
};

type ApiUser = {
  _id?: string;
  id?: string;
  fullName?: string;
  avatarUrl?: string;
  email?: string;
  role?: UserRole;
  accountStatus?: UserStatus;
  createdAt?: string;
  address?: ApiAddress;
};

type ApiDoctorRecord = {
  userId?: ApiUser | string;
  specialty?: string;
};

type ApiAdminRecord = {
  _id?: string;
  id?: string;
  userId?: ApiUser | string;
  adminRole?: AdminAssignedRole;
};

export type ApiBanUser = {
  id: string;
  reason?: string;
};

export type ApiUnbanUser = {
  id: string;
};

function resolveId(record: { _id?: string; id?: string }) {
  return record._id ?? record.id ?? "";
}

function resolveLocation(address?: ApiAddress) {
  if (!address) {
    return "-";
  }

  const locationParts = [address.city, address.country].filter(Boolean);
  return locationParts.length > 0 ? locationParts.join(", ") : "-";
}

function resolveJoinedDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mapApiUserToUiUser(user: ApiUser): UserManagementUser | null {
  const id = resolveId(user);
  if (!id || !user.fullName || !user.email || !user.role) {
    return null;
  }

  return {
    id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    email: user.email,
    location: resolveLocation(user.address),
    joined: resolveJoinedDate(user.createdAt),
    role: user.role,
    status: user.accountStatus ?? "active",
  };
}

export async function banUser(payload: ApiBanUser) {
  const res = await api.post(`/admin/users/${payload.id}/lock`, {
    reason: payload.reason ?? "Banned by admin",
  });
  return res.data;
}

export async function unbanUser(payload: ApiUnbanUser) {
  const res = await api.post(`/admin/users/${payload.id}/unlock`);
  return res.data;
}

export async function getUserManagement(): Promise<UserManagement> {
  const [
    totalUserResponse,
    activeDoctorsResponse,
    pendingVerificationsResponse,
    adminProfilesResponse,
  ] = await Promise.all([
    api.get<ApiUser[]>("/users"),
    api.get<ApiUser[]>("/users/doctors"),
    api.get<ApiDoctorRecord[]>("/admin/doctors/pending"),
    api.get<{ data?: { admins?: ApiAdminRecord[] } }>("/admins"),
  ]);

  const mergedUsers = new Map<string, UserManagementUser>();

  for (const apiUser of totalUserResponse.data) {
    const mapped = mapApiUserToUiUser(apiUser);
    if (!mapped) {
      continue;
    }

    mergedUsers.set(mapped.id, mapped);
  }

  for (const pendingDoctor of pendingVerificationsResponse.data) {
    const pendingUser =
      typeof pendingDoctor.userId === "string"
        ? ({ _id: pendingDoctor.userId, role: "doctor" as UserRole } as ApiUser)
        : pendingDoctor.userId;

    if (!pendingUser) {
      continue;
    }

    const mappedPendingUser = mapApiUserToUiUser({
      ...pendingUser,
      role: pendingUser.role ?? "doctor",
    });

    if (!mappedPendingUser) {
      continue;
    }

    const existing = mergedUsers.get(mappedPendingUser.id);
    mergedUsers.set(mappedPendingUser.id, {
      ...(existing ?? mappedPendingUser),
      specialty: pendingDoctor.specialty ?? existing?.specialty,
    });
  }

  const adminProfiles = adminProfilesResponse.data.data?.admins ?? [];

  for (const adminProfile of adminProfiles) {
    const adminUser =
      typeof adminProfile.userId === "string"
        ? ({ _id: adminProfile.userId, role: "admin" as UserRole } as ApiUser)
        : adminProfile.userId;

    if (!adminUser) {
      continue;
    }

    const mappedAdminUser = mapApiUserToUiUser({
      ...adminUser,
      role: adminUser.role ?? "admin",
    });

    if (!mappedAdminUser) {
      continue;
    }

    mergedUsers.set(mappedAdminUser.id, {
      ...(mergedUsers.get(mappedAdminUser.id) ?? mappedAdminUser),
      role: "admin",
      assigned_role: adminProfile.adminRole ?? mappedAdminUser.assigned_role,
    });
  }

  const userList = Array.from(mergedUsers.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );

  const bannedUsers = userList.filter(
    (user) => user.status === "banned",
  ).length;

  return {
    totalUser: userList.length,
    activeDoctors: activeDoctorsResponse.data.length,
    pendingVerifications: pendingVerificationsResponse.data.length,
    bannedUsers,
    userList,
  };
}
