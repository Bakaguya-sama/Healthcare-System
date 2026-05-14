import { useCallback, useMemo, useState } from "react";
import type {
  ChatAttachment,
  ChatMessage,
} from "@/features/chat/components/message";
import {
  getConversation,
  getConversations,
  sendAiMessage,
  startConversation,
  type AiConversation,
  type AiConversationMessage,
  type AiConversationMessageRecord,
  type ConversationMessageQuery,
  type ConversationQuery,
  type SendAiMessagePayload,
  type StartConversationPayload,
} from "../services/ai-chat.service";

type LoadMessagesResult = {
  messages: ChatMessage[];
  totalPages: number;
};

function formatMessageTime(value?: string) {
  if (!value)
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mapAttachments(
  attachments?: AiConversationMessage["attachments"],
): ChatAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map((attachment, index) => ({
    id: `${attachment.publicId}-${index}`,
    type: "image",
    name: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    url: attachment.secureUrl,
    thumbnailUrl: attachment.secureUrl,
  }));
}

function mapConversationMessage(
  conversationId: string,
  message: AiConversationMessage,
  index: number,
): ChatMessage {
  return {
    id: `${conversationId}-${index}-${message.timestamp}`,
    sender: message.role === "assistant" ? "ai" : "patient",
    content: message.content,
    sentAt: message.timestamp,
    time: formatMessageTime(message.timestamp),
    attachments: mapAttachments(message.attachments),
  };
}

function mapConversationMessages(conversation: AiConversation): ChatMessage[] {
  return (conversation.messages || []).map((message, index) =>
    mapConversationMessage(conversation.id, message, index),
  );
}

function resolveAiSender(
  message: AiConversationMessageRecord,
): ChatMessage["sender"] {
  const senderType = message.senderType || message.role;
  if (
    senderType === "assistant" ||
    senderType === "ai" ||
    senderType === "doctor"
  ) {
    return "ai";
  }
  return "patient";
}

function mapRecordAttachments(
  attachments?: AiConversationMessageRecord["attachments"],
): ChatAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  return attachments.map((attachment, index) => {
    const isImage = attachment.mimeType?.startsWith("image/");
    return {
      id: `${attachment.fileUrl}-${index}`,
      type: isImage ? "image" : "file",
      name: attachment.fileName,
      mimeType: attachment.mimeType || "application/octet-stream",
      size: attachment.fileSize ?? 0,
      url: attachment.fileUrl,
      thumbnailUrl: isImage ? attachment.fileUrl : undefined,
    };
  });
}

function mapConversationRecords(
  conversationId: string,
  records: AiConversationMessageRecord[],
): ChatMessage[] {
  return records.map((record, index) => {
    const sentAt =
      record.sentAt || record.timestamp || new Date().toISOString();
    return {
      id: record._id || `${conversationId}-record-${index}-${sentAt}`,
      sender: resolveAiSender(record),
      content: record.content,
      sentAt,
      time: formatMessageTime(sentAt),
      attachments: mapRecordAttachments(record.attachments),
    };
  });
}

function mergeMessages(
  older: ChatMessage[],
  current: ChatMessage[],
): ChatMessage[] {
  const existingIds = new Set(current.map((item) => item.id));
  const nextChunk = older.filter((item) => !existingIds.has(item.id));
  return [...nextChunk, ...current];
}

export function useAiChat() {
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [conversationsError, setConversationsError] = useState<string | null>(
    null,
  );
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === selectedConversationId,
      ) || null,
    [conversations, selectedConversationId],
  );

  const loadConversations = useCallback(async (query?: ConversationQuery) => {
    setIsLoadingConversations(true);
    setConversationsError(null);
    try {
      const response = await getConversations({
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: -1,
        ...query,
      });
      setConversations(response.data);
      setSelectedConversationId(
        (current) => current ?? response.data[0]?.id ?? null,
      );
    } catch (error) {
      setConversationsError(
        error instanceof Error
          ? error.message
          : "Failed to load AI conversations",
      );
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (
      conversationId: string,
      page: number = 1,
    ): Promise<LoadMessagesResult> => {
      setIsLoadingMessages(true);
      setMessagesError(null);
      try {
        const query: ConversationMessageQuery = {
          page,
          limit: 10,
          sortBy: "sentAt",
          sortOrder: -1,
        };
        const response = await getConversation(conversationId, query);
        const records = response.messages.length
          ? response.messages
          : response.conversation.messages;
        const mapped = response.messages.length
          ? mapConversationRecords(conversationId, records).slice().reverse()
          : mapConversationMessages(response.conversation);
        if (page === 1) {
          setMessages(mapped);
          return {
            messages: mapped,
            totalPages: response.pagination.pages || 1,
          };
        }

        let merged: ChatMessage[] = [];
        setMessages((prev) => {
          merged = mergeMessages(mapped, prev);
          return merged;
        });

        return {
          messages: merged.length ? merged : mapped,
          totalPages: response.pagination.pages || 1,
        };
      } catch (error) {
        setMessagesError(
          error instanceof Error
            ? error.message
            : "Failed to load conversation messages",
        );
        return { messages: [], totalPages: 1 };
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [],
  );

  const startNewConversation = useCallback(
    async (payload: StartConversationPayload) => {
      setIsStarting(true);
      setStartError(null);
      try {
        const conversation = await startConversation(payload);
        setConversations((prev) => [conversation, ...prev]);
        setSelectedConversationId(conversation.id);
        const mapped = mapConversationMessages(conversation);
        setMessages(mapped);
        return conversation;
      } catch (error) {
        setStartError(
          error instanceof Error
            ? error.message
            : "Failed to start a new conversation",
        );
        return null;
      } finally {
        setIsStarting(false);
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      conversationId: string,
      payload: SendAiMessagePayload & {
        attachments?: ChatAttachment[];
      },
    ) => {
      setIsSending(true);
      setSendError(null);

      const now = new Date();
      const optimisticMessage: ChatMessage = {
        id: `local-${now.getTime()}`,
        sender: "patient",
        content: payload.message?.trim() || undefined,
        sentAt: now.toISOString(),
        time: formatMessageTime(now.toISOString()),
        attachments: payload.attachments,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      try {
        const response = await sendAiMessage(conversationId, payload);
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: "ai",
          content: response.finalAiResponse,
          sentAt: new Date().toISOString(),
          time: formatMessageTime(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setConversations((prev) =>
          prev.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messageCount: response.messageCount,
                  lastMessageAt: new Date().toISOString(),
                }
              : conversation,
          ),
        );
        return response;
      } catch (error) {
        setSendError(
          error instanceof Error ? error.message : "Failed to send message",
        );
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [],
  );

  return {
    conversations,
    selectedConversation,
    selectedConversationId,
    messages,
    isLoadingConversations,
    conversationsError,
    isLoadingMessages,
    messagesError,
    isStarting,
    startError,
    isSending,
    sendError,
    setSelectedConversationId,
    loadConversations,
    loadMessages,
    startNewConversation,
    sendMessage,
  };
}
