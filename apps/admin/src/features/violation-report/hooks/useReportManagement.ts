import { useCallback, useState } from "react";
import {
  getReportList,
  type ReportListReceiver,
} from "../services/report-management-service";

export function useReportList() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ReportListReceiver | null>(null);

  const loadReportList = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await getReportList();
      setResponse(res);
      return res;
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : "Failed to load report list",
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    response,
    isLoading,
    error,
    loadReportList,
  };
}
