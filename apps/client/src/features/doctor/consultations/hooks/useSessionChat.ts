import {
  getMessage,
  sendMessage,
  type MessageApiResponse,
  type MessageSendApiResponse,
  type MessageApiResponseReceive,
} from "../services/session-chat.service";
import { useState, useCallback, useEffect } from "react";
import { connectSocket, socket } from "@/lib/api";
import { useAuthStore } from "@repo/ui/store/useAuthStore";

export function useSessionChat(sessionId?: string) {
  const accessToken = useAuthStore((state) => state.token);
  const [messages, setMessages] = useState<MessageApiResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);

  const handleNewMessage = useCallback(
    (message: MessageSendApiResponse) => {
      if (!sessionId || message.doctorSessionId !== sessionId) return;
      setMessages((prev) => [...prev, message]);
    },
    [sessionId],
  );

  const loadMessages = useCallback(
    async (page: number = 1): Promise<MessageApiResponseReceive | null> => {
      if (!sessionId) return null;
      setIsLoading(true);
      setError(null);

      try {
        const data = await getMessage(sessionId, page);
        if (!data) return null;
        const safeData = (data.messages ?? []).slice().reverse();
        if (page === 1) {
          setMessages(safeData);
          return {
            messages: safeData,
            pagination: data.pagination,
          };
        }

        let merged: MessageApiResponse[] = [];
        setMessages((prev) => {
          const existingIds = new Set(prev.map((item) => item.sentAt));
          const nextChunk = safeData.filter(
            (item) => !existingIds.has(item.sentAt),
          );
          merged = [...nextChunk, ...prev];
          return merged;
        });

        return {
          messages: merged.length ? merged : safeData,
          pagination: data.pagination,
        };
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load messages",
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId],
  );

  const sendMessageWithAttachments = useCallback(
    async (payload: { content: string; attachments?: File[] }) => {
      if (!sessionId) return null;
      setIsSending(true);
      setError(null);

      try {
        const result = await sendMessage(
          {
            doctorSessionId: sessionId,
            senderType: "doctor",
            content: payload.content,
          },
          payload.attachments ?? [],
        );

        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    if (!sessionId) return;

    const token = accessToken || localStorage.getItem("accessToken") || "";
    if (!connectSocket(token)) {
      setError("Missing access token for chat socket.");
      return;
    }
    void loadMessages(1);

    socket.emit("join_session", sessionId);

    const onJoined = () => setIsJoined(true);
    const onJoinError = () => setIsJoined(false);

    socket.on("joined_session", onJoined);
    socket.on("join_session_error", onJoinError);
    socket.on("new_message", handleNewMessage);

    return () => {
      socket.emit("leave_session", sessionId);
      socket.off("joined_session", onJoined);
      socket.off("join_session_error", onJoinError);
      socket.off("new_message", handleNewMessage);
      setIsJoined(false);
    };
  }, [accessToken, handleNewMessage, loadMessages, sessionId]);

  return {
    messages,
    setMessages,
    isJoined,
    isLoading,
    isSending,
    error,
    refresh: loadMessages,
    sendMessage: sendMessageWithAttachments,
  };
}
