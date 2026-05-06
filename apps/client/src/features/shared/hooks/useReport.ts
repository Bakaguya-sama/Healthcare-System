import axios from "axios";
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
    } catch (reportError) {
      const message = axios.isAxiosError(reportError)
        ? (
            reportError.response?.data as {
              message?: string | string[];
            }
          )?.message
          ? Array.isArray(
              (
                reportError.response?.data as {
                  message?: string | string[];
                }
              )?.message,
            )
            ? (
                (
                  reportError.response?.data as {
                    message?: string | string[];
                  }
                )?.message as string[]
              ).join(", ")
            : ((
                reportError.response?.data as {
                  message?: string | string[];
                }
              )?.message as string)
          : reportError.message // Fallback to generic Axios message if no specific message in data
        : reportError instanceof Error
          ? reportError.message // For non-Axios errors
          : "Failed to submit report. Please try again.";
      setError(message);
      throw reportError;
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
