export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "doctor" | "patient";
  adminRole?: AdminRole;
  avatar?: string;
}

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
