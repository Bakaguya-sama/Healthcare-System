import { useState, useCallback } from "react";
import {
  submitLogin,
  type Login,
  type ApiLoginResponse,
} from "../services/login.service";

export function useLogin() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiLoginResponse | null>(null);

  const login = useCallback(async (payload: Login) => {
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
  }, []);

  return {
    login,
    data,
    isLoading,
    error,
  };
}
