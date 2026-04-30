import { useCallback, useState } from "react";
import {
  submitChangePassword,
  type ChangePasswordPayload,
  type ChangePasswordResponse,
} from "../services/change-password.service";
import axios from "axios";

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
      const message = axios.isAxiosError(changePasswordError)
        ? (
            changePasswordError.response?.data as {
              message?: string | string[];
            }
          )?.message
          ? Array.isArray(
              (
                changePasswordError.response?.data as {
                  message?: string | string[];
                }
              )?.message,
            )
            ? (
                (
                  changePasswordError.response?.data as {
                    message?: string | string[];
                  }
                )?.message as string[]
              ).join(", ")
            : ((
                changePasswordError.response?.data as {
                  message?: string | string[];
                }
              )?.message as string)
          : changePasswordError.message // Fallback to generic Axios message if no specific message in data
        : changePasswordError instanceof Error
          ? changePasswordError.message // For non-Axios errors
          : "Change password unsuccessfully. Please try again.";
      setError(message);
      throw changePasswordError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    changePassword,
    isLoading,
    error,
  };
}
