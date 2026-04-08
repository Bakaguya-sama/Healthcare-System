import { api } from "@/lib/api";

type AdminAssignedRole = "super_admin" | "user_admin" | "ai_admin";
type AccountStatus = "active" | "banned";

export interface AdminCreate {
  fullName: string;
  email: string;
  password: string;
  assignedRole: AdminAssignedRole;
  accountStatus?: AccountStatus;
}

export interface AdminChangeRole {
  id: string;
  assignedRole: AdminAssignedRole;
}

export async function createAdmin(payload: AdminCreate) {
  const res = await api.post("/admins", {
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
    assignedRole: payload.assignedRole,
    accountStatus: payload.accountStatus ?? "active",
  });
  return res.data;
}

export async function changeAdminRole(payload: AdminChangeRole) {
  const res = await api.patch(`/admins/${payload.id}`, {
    adminRole: payload.assignedRole,
  });
  return res.data;
}
