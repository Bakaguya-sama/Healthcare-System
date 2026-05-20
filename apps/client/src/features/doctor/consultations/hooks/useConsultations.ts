"use client";

import { useCallback, useEffect, useState } from "react";
import { connectSessionSocket, sessionSocket } from "@/lib/api";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import {
  getConsultationsEnriched,
  approveConsultation,
  rejectConsultation,
  completeConsultation,
  getConsultationReview,
  type Consultation,
} from "../services/consultations.service";

type SessionChangePayload = {
  action: string;
  sessionId: string;
  patientId: string;
  doctorId: string;
};

const statusByAction: Record<string, Consultation["status"] | null> = {
  created: "pending",
  confirmed: "active",
  rejected: "rejected",
  completed: "completed",
};

export function useConsultations() {
  const accessToken = useAuthStore((state) => state.token);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [data, setData] = useState<Consultation[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsultations = useCallback(async () => {
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
  }, []);

  const applySessionChange = useCallback(
    (payload: SessionChangePayload) => {
      const nextStatus = statusByAction[payload.action];
      if (!nextStatus) return;

      let updated = false;
      const now = new Date().toISOString();

      setData((prev) => {
        if (!prev) return prev;
        const next = prev.map((item) => {
          if (item.id !== payload.sessionId) {
            return item;
          }
          updated = true;
          return {
            ...item,
            status: nextStatus,
            updatedAt: now,
            endedAt:
              nextStatus === "completed" || nextStatus === "rejected"
                ? now
                : item.endedAt,
          };
        });
        return updated ? next : prev;
      });

      if (!updated) {
        void fetchConsultations();
      }
    },
    [fetchConsultations],
  );

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
  }, [fetchConsultations]);

  useEffect(() => {
    if (!currentUserId) return;

    const token = accessToken || localStorage.getItem("accessToken") || "";
    if (!connectSessionSocket(token)) {
      return;
    }

    const handleSessionChanged = (payload: SessionChangePayload) => {
      if (
        payload.doctorId !== currentUserId &&
        payload.patientId !== currentUserId
      ) {
        return;
      }
      applySessionChange(payload);
    };

    sessionSocket.on("session_changed", handleSessionChanged);

    return () => {
      sessionSocket.off("session_changed", handleSessionChanged);
    };
  }, [accessToken, applySessionChange, currentUserId]);

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
