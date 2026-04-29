import { api } from "@/lib/api";

export type ChangePasswordPayload = {
  email: string;
  otpCode: string;
  newPassword: string;
};

export type ChangePasswordResponse = {
  message: string;
};

export async function submitChangePassword(
  payload: ChangePasswordPayload,
): Promise<ChangePasswordResponse> {
  const response = await api.post<ChangePasswordResponse>(
    "/auth/change-password",
    {
      email: payload.email,
      otpCode: payload.otpCode,
      newPassword: payload.newPassword,
    },
  );

  return response.data;
}
