import { useCallback } from "react";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import { submitLogout } from "../services/logout.service";

export function useLogout() {
  const clearAuthState = useAuthStore((state) => state.logout);

  const logout = useCallback(async () => {
    try {
      await submitLogout();
    } finally {
      clearAuthState();
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  }, [clearAuthState]);

  return { logout };
}
