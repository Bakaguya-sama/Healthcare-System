import { useCallback, useState } from "react";
import {
  submitConfirmOtp,
  type ConfirmOtpPayload,
  type ConfirmOtpResponse,
} from "../services/confirm-otp.service";
import axios from "axios";

export function useConfirmOtp() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConfirmOtpResponse | null>(null);

  const confirmOtp = useCallback(async (payload: ConfirmOtpPayload) => {
    setLoading(true);
    setError(null);

    if (!payload.email.trim()) {
      const errorMsg = "Please enter your email";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!payload.otpCode.trim()) {
      const errorMsg = "Please enter OTP";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const res = await submitConfirmOtp(payload);
      setData(res);
      return res;
    } catch (confirmOtpError) {
      const message = axios.isAxiosError(confirmOtpError)
        ? (confirmOtpError.response?.data as { message?: string | string[] })
            ?.message
          ? Array.isArray(
              (
                confirmOtpError.response?.data as {
                  message?: string | string[];
                }
              )?.message,
            )
            ? (
                (
                  confirmOtpError.response?.data as {
                    message?: string | string[];
                  }
                )?.message as string[]
              ).join(", ")
            : ((
                confirmOtpError.response?.data as {
                  message?: string | string[];
                }
              )?.message as string)
          : confirmOtpError.message // Fallback to generic Axios message if no specific message in data
        : confirmOtpError instanceof Error
          ? confirmOtpError.message // For non-Axios errors
          : "Failed to confirm OTP. Please try again.";
      setError(message);
      throw confirmOtpError;
      throw confirmOtpError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    confirmOtp,
    data,
    isLoading,
    error,
  };
}
