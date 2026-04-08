import { useState, useCallback } from "react";
import {
  changeReportStatus as changeReportStatusApi,
  type ApiChangeReportStatus,
} from "../services/report-management-service";

export function useChangeReportStatus() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<unknown | null>(null);

  const submitChangeReportStatus = useCallback(
    async (payload: ApiChangeReportStatus) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await changeReportStatusApi(payload);
        setResponse(res);
        return res;
      } catch (reportError) {
        setError(
          reportError instanceof Error
            ? reportError.message
            : "Failed to change status of report",
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    response,
    isLoading,
    error,
    changeReportStatus: submitChangeReportStatus,
  };
}
