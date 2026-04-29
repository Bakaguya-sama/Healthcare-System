import { useCallback, useState } from "react";
import axios from "axios";
import {
  fetchDoctorPrefillData,
  type DoctorReRegisterPrefillApiResponse,
} from "../services/signup.service";

export function useDoctorPrefillData() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DoctorReRegisterPrefillApiResponse | null>(
    null,
  );

  const getDoctorPrefillData = useCallback(async (email: string) => {
    setLoading(true);
    setError(null);
    setData(null); // Clear previous data

    try {
      const res = await fetchDoctorPrefillData(email);
      setData(res);
      return res;
    } catch (fetchError) {
      const message = axios.isAxiosError(fetchError)
        ? (fetchError.response?.data as { message?: string | string[] })
            ?.message
          ? Array.isArray(
              (fetchError.response?.data as { message?: string | string[] })
                ?.message,
            )
            ? (
                (fetchError.response?.data as { message?: string | string[] })
                  ?.message as string[]
              ).join(", ")
            : ((fetchError.response?.data as { message?: string | string[] })
                ?.message as string)
          : fetchError.message
        : fetchError instanceof Error
          ? fetchError.message
          : "Failed to load doctor data.";
      setError(message);
      throw fetchError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getDoctorPrefillData, data, isLoading, error };
}
