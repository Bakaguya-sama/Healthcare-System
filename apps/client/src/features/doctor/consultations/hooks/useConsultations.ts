"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { connectSessionSocket, sessionSocket } from "@/lib/api";
import { connectNotificationsSocket, notificationsSocket } from "@/lib/api";
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

type ChatNotificationPayload = {
  doctorSessionId?: string;
  sessionId?: string;
  sentAt?: string;
  senderId?: string;
  senderType?: string;
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
        const pendingUpdate = pendingChatUpdatesRef.current.get(consultation.id);
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
          lastMessageId: pendingUpdate.lastMessageId ?? consultation.lastMessageId,
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
      const nextConsultations = applyPendingChatUpdates(consultations);
      console.log(
        "fetchConsultations: received",
        Array.isArray(nextConsultations)
          ? nextConsultations.length
          : nextConsultations,
      );
      setData(nextConsultations);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch consultations",
      );
    } finally {
      setIsLoading(false);
    }
  }, [applyPendingChatUpdates]);

  const syncConsultationsSilently = useCallback(async () => {
    try {
      const consultations = await getConsultationsEnriched();
      setData(applyPendingChatUpdates(consultations));
    } catch {
      // Keep the existing UI state if the background sync fails.
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
        if (!prev) return prev;

        let updated = false;
        const next = prev.map((item) => {
          if (item.id !== sessionId) {
            return item;
          }

          updated = true;
          return {
            ...item,
            lastMessageAt: nextLastMessageAt,
            lastMessageId: payload.lastMessageId ?? item.lastMessageId,
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

  useEffect(() => {
    if (!currentUserId) return;

    const token = accessToken || localStorage.getItem("accessToken") || "";
    if (!connectNotificationsSocket(token)) {
      return;
    }

    console.log(
      "notifications socket connect attempted; connected=",
      notificationsSocket.connected,
      "id=",
      notificationsSocket.id,
    );

    // expose socket and helper for manual debugging in the browser console
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).notificationsSocket = notificationsSocket;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).triggerConsultationsFetch = () => {
        console.log("manual trigger: fetchConsultations");
        void fetchConsultations();
      };
    } catch {
      /* ignore in non-browser env */
    }

    const handleConnect = () =>
      console.log("notifications socket connected", notificationsSocket.id);
    const handleConnectError = (err: unknown) =>
      console.error("notifications socket connect_error", err);
    const handleDisconnect = (reason: unknown) =>
      console.log("notifications socket disconnected", reason);
    const handleServerConnectedEvent = (payload: unknown) =>
      console.log("notifications namespace emitted 'connected' ->", payload);

    notificationsSocket.on("connect", handleConnect);
    notificationsSocket.on("connect_error", handleConnectError);
    notificationsSocket.on("disconnect", handleDisconnect);
    notificationsSocket.on("connected", handleServerConnectedEvent);

    const handleChatNotification = (payload: ChatNotificationPayload) => {
      const sessionId = payload.doctorSessionId ?? payload.sessionId;
      if (!sessionId) return;

      console.log("chat_notification ", sessionId);
      applyChatNotification(payload);
      window.setTimeout(() => {
        void syncConsultationsSilently();
      }, 1200);
    };

    const handleAny = (event: string, ...args: unknown[]) =>
      console.log("notifications onAny ->", event, args);

    notificationsSocket.onAny(handleAny);
    notificationsSocket.on("chat_notification", handleChatNotification);

    return () => {
      notificationsSocket.off("chat_notification", handleChatNotification);
      notificationsSocket.off("connect", handleConnect);
      notificationsSocket.off("connect_error", handleConnectError);
      notificationsSocket.off("disconnect", handleDisconnect);
      notificationsSocket.off("connected", handleServerConnectedEvent);
      notificationsSocket.offAny(handleAny);
    };
  }, [
    accessToken,
    applyChatNotification,
    currentUserId,
    fetchConsultations,
    syncConsultationsSilently,
  ]);

  useEffect(() => {
    if (!currentUserId) return;

    const intervalId = window.setInterval(() => {
      void syncConsultationsSilently();
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [currentUserId, syncConsultationsSilently]);

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
