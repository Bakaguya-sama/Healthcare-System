"use client";

import { useState, useEffect } from "react";
import {
  getConsultationsEnriched,
  getConsultationReview,
  type Consultation,
} from "../services/consultations.service";

export function useConsultations() {
  const [data, setData] = useState<Consultation[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsultations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const consultations = await getConsultationsEnriched();
      setData(consultations);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch consultations",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getConsultationReviewBySession = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const review = await getConsultationReview(sessionId);
      return review;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch consultation review",
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch: fetchConsultations,
    getConsultationReviewBySession,
  };
}
