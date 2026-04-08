import { createReport, type ApiCreateReport } from "../services/report-service";
import { useCallback, useState } from "react";

export function useReport() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<unknown>(null);

  const submitReport = useCallback(async (payload: ApiCreateReport) => {
    if (!payload.reportedUserId) {
      setError("Invalid reported user id");
      return null;
    }

    if (!payload.reportType) {
      setError("Report type required");
      return null;
    }

    if (!payload.reason?.trim()) {
      setError("Report reason required");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await createReport(payload);
      setResponse(data);
      return data;
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Failed to submit report",
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
    submitReport,
  };
}
