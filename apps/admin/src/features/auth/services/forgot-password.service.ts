import { api } from "@/lib/api";

export type ForgotPasswordPayload = {
  email: string;
};

export type ForgotPasswordResponse = {
  message: string;
};

export async function submitForgotPassword(
  payload: ForgotPasswordPayload,
): Promise<ForgotPasswordResponse> {
  const response = await api.post<ForgotPasswordResponse>(
    "/auth/forgot-password",
    {
      email: payload.email,
    },
  );

  return response.data;
}
