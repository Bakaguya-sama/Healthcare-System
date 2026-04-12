import { api } from "@/lib/api";

export type ConfirmOtpPayload = {
  email: string;
  otpCode: string;
};

export type ConfirmOtpResponse = {
  message: string;
};

export async function submitConfirmOtp(
  payload: ConfirmOtpPayload,
): Promise<ConfirmOtpResponse> {
  const response = await api.post<ConfirmOtpResponse>("/auth/confirm-otp", {
    email: payload.email,
    otpCode: payload.otpCode,
  });

  return response.data;
}
