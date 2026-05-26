import axios from "axios";
import {
  getReviewBySession,
  submitReview,
  updateReview,
  type Review,
  type ReviewRecord,
  type ReviewUpdatePayload,
} from "../services/review.service";
import { useCallback, useState } from "react";

export function useReview() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<unknown>(null);

  const getErrorMessage = useCallback(
    (reviewError: unknown, fallback: string) => {
      if (axios.isAxiosError(reviewError)) {
        const message = (
          reviewError.response?.data as {
            message?: string | string[];
          }
        )?.message;

        if (Array.isArray(message)) {
          return message.join(", ");
        }

        if (message) {
          return message;
        }

        return reviewError.message;
      }

      if (reviewError instanceof Error) {
        return reviewError.message;
      }

      return fallback;
    },
    [],
  );

  const fetchReviewBySession = useCallback(
    async (sessionId: string): Promise<ReviewRecord | null> => {
      if (!sessionId) {
        setError("Invalid session");
        return null;
      }

      setIsFetching(true);
      setError(null);

      try {
        const data = await getReviewBySession(sessionId);
        return data ?? null;
      } catch (reviewError) {
        if (
          axios.isAxiosError(reviewError) &&
          reviewError.response?.status === 404
        ) {
          return null;
        }

        const message = getErrorMessage(
          reviewError,
          "Failed to load review. Please try again.",
        );
        setError(message);
        throw reviewError;
      } finally {
        setIsFetching(false);
      }
    },
    [getErrorMessage],
  );

  const submitDoctorReview = useCallback(
    async (payload: Review) => {
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

      setIsSubmitting(true);
      setError(null);

      try {
        const data = await submitReview(payload);
        setResponse(data);
        return data;
      } catch (reviewError) {
        const message = getErrorMessage(
          reviewError,
          "Failed to submit review. Please try again.",
        );
        setError(message);
        throw reviewError;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getErrorMessage],
  );

  const updateDoctorReview = useCallback(
    async (reviewId: string, payload: ReviewUpdatePayload) => {
      if (!reviewId) {
        setError("Invalid review");
        return null;
      }

      if (!payload.rating) {
        setError("Rating required");
        return null;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const data = await updateReview(reviewId, payload);
        setResponse(data);
        return data;
      } catch (reviewError) {
        const message = getErrorMessage(
          reviewError,
          "Failed to update review. Please try again.",
        );
        setError(message);
        throw reviewError;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getErrorMessage],
  );

  return {
    response,
    isLoading: isSubmitting,
    isSubmitting,
    isFetching,
    error,
    submitDoctorReview,
    updateDoctorReview,
    fetchReviewBySession,
  };
}
