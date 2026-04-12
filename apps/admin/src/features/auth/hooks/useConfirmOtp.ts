import { useCallback, useState } from "react";
import {
  submitConfirmOtp,
  type ConfirmOtpPayload,
  type ConfirmOtpResponse,
} from "../services/confirm-otp.service";

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
      const message =
        confirmOtpError instanceof Error
          ? confirmOtpError.message
          : "Failed to confirm OTP";
      setError(message);
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
