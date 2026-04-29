import { useCallback, useState } from "react";
import axios from "axios"; // Import axios
import {
  submitSignUpPatient,
  submitSignUpDoctor,
  type SignUpPatient,
  type SignUpDoctor,
  type ApiSignUpResponse,
} from "../services/signup.service";

export function useSignUpPatient() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiSignUpResponse | null>(null);

  const signUpPatient = useCallback(async (payload: SignUpPatient) => {
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

    if (!payload.fullName || !payload.fullName.trim()) {
      const errorMsg = "Please enter your fullname";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const res = await submitSignUpPatient(payload);

      setData(res);
      return res;
    } catch (signUpError) {
      // Extract specific error message from Axios error response
      const message = axios.isAxiosError(signUpError)
        ? (signUpError.response?.data as { message?: string | string[] })
            ?.message
          ? Array.isArray(
              (signUpError.response?.data as { message?: string | string[] })
                ?.message,
            )
            ? (
                (signUpError.response?.data as { message?: string | string[] })
                  ?.message as string[]
              ).join(", ")
            : ((signUpError.response?.data as { message?: string | string[] })
                ?.message as string)
          : signUpError.message // Fallback to generic Axios message if no specific message in data
        : signUpError instanceof Error
          ? signUpError.message // For non-Axios errors
          : "Sign up failed. Please try again.";
      setError(message);
      throw signUpError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    signUpPatient,
    data,
    isLoading,
    error,
  };
}

export function useSignUpDoctor() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiSignUpResponse | null>(null);

  const signUpDoctor = useCallback(async (payload: SignUpDoctor) => {
    setLoading(true);
    setError(null);

    if (!payload.email || !payload.email.trim()) {
      const errorMsg = "Please enter your email.";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!payload.password) {
      const errorMsg = "Please enter your password.";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!payload.fullName || !payload.fullName.trim()) {
      const errorMsg = "Please enter your fullname.";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!payload.specialty || !payload.specialty.trim()) {
      const errorMsg = "Please choose your specialty.";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!payload.workplace || !payload.workplace.trim()) {
      const errorMsg = "Please enter your workplace.";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    if (!payload.experienceYears) {
      const errorMsg = "Please enter your experience years.";
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const res = await submitSignUpDoctor(payload);

      setData(res);
      return res;
    } catch (signUpError) {
      // Extract specific error message from Axios error response
      const message = axios.isAxiosError(signUpError)
        ? (signUpError.response?.data as { message?: string | string[] })
            ?.message
          ? Array.isArray(
              (signUpError.response?.data as { message?: string | string[] })
                ?.message,
            )
            ? (
                (signUpError.response?.data as { message?: string | string[] })
                  ?.message as string[]
              ).join(", ")
            : ((signUpError.response?.data as { message?: string | string[] })
                ?.message as string)
          : signUpError.message // Fallback to generic Axios message if no specific message in data
        : signUpError instanceof Error
          ? signUpError.message // For non-Axios errors
          : "Sign up failed. Please try again.";
      setError(message);
      throw signUpError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    signUpDoctor,
    data,
    isLoading,
    error,
  };
}
