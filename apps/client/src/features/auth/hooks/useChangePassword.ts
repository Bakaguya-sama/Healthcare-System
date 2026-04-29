import { useCallback, useState } from "react";
import {
  submitChangePassword,
  type ChangePasswordPayload,
  type ChangePasswordResponse,
} from "../services/change-password.service";

export function useChangePassword() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ChangePasswordResponse | null>(null);

  const changePassword = useCallback(async (payload: ChangePasswordPayload) => {
    setLoading(true);
    setError(null);

    if (!payload.email.trim()) {
      const errorMsg = "Email is required";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!payload.otpCode.trim()) {
      const errorMsg = "OTP is required";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!payload.newPassword.trim() || payload.newPassword.length < 8) {
      const errorMsg = "New password must be at least 8 characters";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const res = await submitChangePassword(payload);
      setData(res);
      return res;
    } catch (changePasswordError) {
      const message =
        changePasswordError instanceof Error
          ? changePasswordError.message
          : "Failed to change password";
      setError(message);
      throw changePasswordError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    changePassword,
    data,
    isLoading,
    error,
  };
}
