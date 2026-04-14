export interface User {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  adminRole?: AdminRole;
  avatar?: string;
}

export type AppRole = "admin" | "doctor" | "patient";
export type AdminRole = "ai_admin" | "user_admin" | "super_admin";

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  hydrate: () => void;
}
