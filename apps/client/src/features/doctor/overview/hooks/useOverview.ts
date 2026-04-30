import { useCallback, useState, useEffect } from "react";
import {
  getOverviewSummary,
  type DoctorOverviewSummary,
} from "../services/overview.service";
import { useAuthStore } from "@repo/ui/store/useAuthStore";

export function useOverviewSummary() {
  const [summary, setSummary] = useState<DoctorOverviewSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = useAuthStore().user?.id;

  const fetchSummary = useCallback(async () => {
    if (!userId) {
      setError("User ID is required to fetch overview summary.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await getOverviewSummary(userId);
      setSummary(data);

      console.log(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch doctor overview stats",
      );
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  return { summary, isLoading, error, refresh: fetchSummary };
}
