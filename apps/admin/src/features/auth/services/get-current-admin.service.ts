import { api } from "@/lib/api";
import type { AdminRole } from "@repo/ui/types/auth";

type ApiCurrentAdminProfile = {
  id: string;
  email: string;
  fullName: string;
  role: "admin";
  avatarUrl?: string;
  adminProfile?: {
    adminRole?: AdminRole;
  } | null;
};

export type CurrentAdmin = {
  id: string;
  email: string;
  fullName: string;
  role: "admin";
  avatarUrl?: string;
  adminRole?: AdminRole;
};

export async function getCurrentAdmin(): Promise<CurrentAdmin> {
  const res = await api.get<ApiCurrentAdminProfile>("/auth/me");
  const currentAdmin = res.data;

  return {
    id: currentAdmin.id,
    email: currentAdmin.email,
    fullName: currentAdmin.fullName,
    role: currentAdmin.role,
    avatarUrl: currentAdmin.avatarUrl,
    adminRole: currentAdmin.adminProfile?.adminRole,
  };
}
