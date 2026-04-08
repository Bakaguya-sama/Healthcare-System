import { useCallback, useEffect, useState } from "react";
import {
  getOverviewSummary,
  type OverviewSummary,
} from "../services/overview.service";

const initialSummary: OverviewSummary = {
  totalUsers: 0,
  activeDoctors: 0,
  aiChatSessions: 0,
  pendingVerifications: 0,
  doctorSessions: 0,
  violationReports: 0,
  monthly: {
    labels: Array.from({ length: 8 }, () => ""),
    totalUsers: Array.from({ length: 8 }, () => 0),
    activeDoctors: Array.from({ length: 8 }, () => 0),
    aiChatSessions: Array.from({ length: 8 }, () => 0),
    pendingVerifications: Array.from({ length: 8 }, () => 0),
  },
  weekly: {
    labels: Array.from({ length: 7 }, () => ""),
    doctorSessions: Array.from({ length: 7 }, () => 0),
    violationReports: Array.from({ length: 7 }, () => 0),
  },
};

export function useOverview() {
  const [summary, setSummary] = useState<OverviewSummary>(initialSummary);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getOverviewSummary();
      setSummary(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load overview data",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return {
    summary,
    isLoading,
    error,
    refresh: loadOverview,
  };
}
