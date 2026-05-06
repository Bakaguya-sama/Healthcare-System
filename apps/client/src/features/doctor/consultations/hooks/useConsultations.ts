"use client";

import { useState, useEffect } from "react";
import {
  getConsultationsEnriched,
  approveConsultation,
  rejectConsultation,
  completeConsultation,
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

  // Approve consultation
  const approve = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await approveConsultation(sessionId);
      await fetchConsultations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve consultation",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const complete = async (sessionId: string, doctorNotes?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await completeConsultation(sessionId, doctorNotes);
      await fetchConsultations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete consultation",
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reject = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await rejectConsultation(sessionId);
      await fetchConsultations();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reject consultation",
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
    approve,
    reject,
    complete,
    getConsultationReviewBySession,
  };
}
