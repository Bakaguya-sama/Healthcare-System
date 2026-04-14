import { useCallback, useState } from "react";
import {
  getCurrentAdmin,
  type CurrentAdmin,
} from "../services/get-current-admin.service";

export function useGetCurrentAdmin() {
  const [data, setData] = useState<CurrentAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentAdmin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentAdmin = await getCurrentAdmin();
      setData(currentAdmin);
      return currentAdmin;
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load admin profile.";
      setError(message);
      throw fetchError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    data,
    isLoading,
    error,
    fetchCurrentAdmin,
  };
}
