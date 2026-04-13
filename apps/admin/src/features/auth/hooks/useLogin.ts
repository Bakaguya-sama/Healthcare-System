import { useState, useCallback } from "react";
import {
  submitLogin,
  type Login,
  type ApiLoginResponse,
} from "../services/login.service";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import type { User } from "@repo/ui/types/auth";

export function useLogin() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiLoginResponse | null>(null);

  const setUser = useAuthStore((state) => state.setUser);

  const login = useCallback(
    async (payload: Login) => {
      setLoading(true);
      setError(null);

      if (!payload.email || !payload.email.trim()) {
        const errorMsg = "Please enter your email";
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      if (!payload.password) {
        const errorMsg = "Please enter your password";
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      try {
        const res = await submitLogin(payload);

        if (res.user.role !== "admin") {
          const message = "Cannot log in as another role.";
          setError(message);
          throw new Error(message);
        }

        const normalizedUser: User = {
          id: res.user.id,
          email: res.user.email,
          name: res.user.fullName,
          role: "admin",
          avatar: res.user.avatarUrl,
        };

        setUser(normalizedUser, res.accessToken, res.refreshToken);
        setData(res);
        return res;
      } catch (loginError) {
        const message =
          loginError instanceof Error
            ? loginError.message
            : "Login failed. Please try again.";
        setError(message);
        throw loginError;
      } finally {
        setLoading(false);
      }
    },
    [setUser],
  );

  return {
    login,
    data,
    isLoading,
    error,
  };
}
