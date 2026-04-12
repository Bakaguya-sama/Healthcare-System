import { useCallback, useState } from "react";
import axios from "axios";
import {
  submitForgotPassword,
  type ForgotPasswordPayload,
  type ForgotPasswordResponse,
} from "../services/forgot-password.service";

export function useForgotPassword() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ForgotPasswordResponse | null>(null);

  const sendOtp = useCallback(async (payload: ForgotPasswordPayload) => {
    setLoading(true);
    setError(null);

    if (!payload.email.trim()) {
      const errorMsg = "Please enter your email";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const res = await submitForgotPassword(payload);
      setData(res);
      return res;
    } catch (forgotPasswordError) {
      const message = axios.isAxiosError(forgotPasswordError)
        ? ((forgotPasswordError.response?.data as { message?: string })
            ?.message ??
          (forgotPasswordError.response?.status === 404
            ? "Email not found"
            : "Failed to send email"))
        : forgotPasswordError instanceof Error
          ? forgotPasswordError.message
          : "Failed to send email";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    sendOtp,
    data,
    isLoading,
    error,
  };
}
