import axios from "axios";
import { submitReview, type Review } from "../services/review.service";
import { useCallback, useState } from "react";

export function useReview() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<unknown>(null);

  const submitDoctorReview = useCallback(async (payload: Review) => {
    if (!payload.doctorSessionId) {
      setError("Invalid session");
      return null;
    }

    if (!payload.doctorId) {
      setError("Invalid doctor");
      return null;
    }

    if (!payload.rating) {
      setError("Rating required");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await submitReview(payload);
      setResponse(data);
      return data;
    } catch (reviewError) {
      const message = axios.isAxiosError(reviewError)
        ? (
            reviewError.response?.data as {
              message?: string | string[];
            }
          )?.message
          ? Array.isArray(
              (
                reviewError.response?.data as {
                  message?: string | string[];
                }
              )?.message,
            )
            ? (
                (
                  reviewError.response?.data as {
                    message?: string | string[];
                  }
                )?.message as string[]
              ).join(", ")
            : ((
                reviewError.response?.data as {
                  message?: string | string[];
                }
              )?.message as string)
          : reviewError.message // Fallback to generic Axios message if no specific message in data
        : reviewError instanceof Error
          ? reviewError.message // For non-Axios errors
          : "Failed to submit review. Please try again.";
      setError(message);
      throw reviewError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    response,
    isLoading,
    error,
    submitDoctorReview,
  };
}
