"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectSessionSocket,
  connectNotificationsSocket,
  sessionSocket,
  notificationsSocket,
} from "@/lib/api";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import {
  getConsultationsEnriched,
  getConsultationReview,
  type Consultation,
} from "../services/consultations.service";

type SessionChangePayload = {
  action: string;
  sessionId: string;
  patientId: string;
  doctorId: string;
};

type ChatNotificationPayload = {
  doctorSessionId?: string;
  sessionId?: string;
  sentAt?: string;
  lastMessageAt?: string;
  lastMessageId?: string;
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
  const pendingChatUpdatesRef = useRef(
    new Map<string, ChatNotificationPayload>(),
  );

  const applyPendingChatUpdates = useCallback(
    (consultations: Consultation[]) => {
      if (pendingChatUpdatesRef.current.size === 0) {
        return consultations;
      }

      const nextConsultations = consultations.map((consultation) => {
        const pendingUpdate = pendingChatUpdatesRef.current.get(
          consultation.id,
        );
        if (!pendingUpdate) {
          return consultation;
        }

        const nextLastMessageAt =
          pendingUpdate.lastMessageAt ??
          pendingUpdate.sentAt ??
          consultation.lastMessageAt ??
          new Date().toISOString();

        pendingChatUpdatesRef.current.delete(consultation.id);

        return {
          ...consultation,
          lastMessageAt: nextLastMessageAt,
          updatedAt: nextLastMessageAt,
        };
      });

      return nextConsultations;
    },
    [],
  );

  const fetchConsultations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const consultations = await getConsultationsEnriched();
      setData(applyPendingChatUpdates(consultations));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch consultations",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyPendingChatUpdates]);

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

  const applyChatNotification = useCallback(
    (payload: ChatNotificationPayload) => {
      const sessionId = payload.doctorSessionId ?? payload.sessionId;
      if (!sessionId) return;

      const nextLastMessageAt =
        payload.lastMessageAt ?? payload.sentAt ?? new Date().toISOString();

      setData((prev) => {
        if (!prev) {
          pendingChatUpdatesRef.current.set(sessionId, payload);
          return prev;
        }

        let updated = false;
        const next = prev.map((item) => {
          if (item.id !== sessionId) {
            return item;
          }

          updated = true;
          return {
            ...item,
            lastMessageAt: nextLastMessageAt,
            updatedAt: nextLastMessageAt,
          };
        });

        if (!updated) {
          pendingChatUpdatesRef.current.set(sessionId, payload);
        }

        return updated ? next : prev;
      });
    },
    [],
  );

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

  useEffect(() => {
    if (!currentUserId) return;

    const token = accessToken || localStorage.getItem("accessToken") || "";
    if (!connectNotificationsSocket(token)) {
      return;
    }

    const handleChatNotification = (payload: ChatNotificationPayload) => {
      const sessionId = payload.doctorSessionId ?? payload.sessionId;
      if (!sessionId) return;

      applyChatNotification(payload);
    };

    notificationsSocket.on("chat_notification", handleChatNotification);

    return () => {
      notificationsSocket.off("chat_notification", handleChatNotification);
    };
  }, [accessToken, applyChatNotification, currentUserId]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchConsultations,
    getConsultationReviewBySession,
  };
}
