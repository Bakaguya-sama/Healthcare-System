import { api } from "@/lib/api";

export type ConversationType =
  | "health_inquiry"
  | "symptom_analysis"
  | "health_education"
  | "test_result_explanation"
  | "medication_info"
  | "general_consultation";

export type ConversationStatus = "draft" | "active" | "completed" | "archived";

export type MessageRole = "user" | "assistant";

export type AiMessageAttachment = {
  publicId: string;
  secureUrl: string;
  fileType: "image";
  mimeType: string;
  originalName: string;
  size: number;
};

export type AiConversationMessage = {
  role: MessageRole;
  content: string;
  timestamp: string;
  attachments?: AiMessageAttachment[];
};

export type AiConversationMessageRecord = {
  _id?: string;
  senderType?: "patient" | "doctor" | "assistant" | "ai";
  role?: MessageRole;
  content: string;
  sentAt?: string;
  timestamp?: string;
  attachments?: Array<{
    fileUrl: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
  }>;
};

type FollowUpAction = {
  type: "schedule_appointment" | "consult_doctor" | "visit_clinic" | "none";
  description: string;
  priority: "low" | "medium" | "high";
};

export type AiConversation = {
  id: string;
  userId: string;
  type: ConversationType;
  messages: AiConversationMessage[];
  topic: string;
  summary?: string;
  followUpAction?: FollowUpAction;
  totalTokensUsed: number;
  messageCount: number;
  lastMessageAt: string;
  isArchived: boolean;
  archivedAt?: string;
  isFavorite: boolean;
  rating?: number;
  ratingComment?: string;
  status: ConversationStatus;
  completedAt?: string;
  tags: string[];
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
};

type AiConversationApiResponse = Omit<AiConversation, "id"> & {
  _id: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type ConversationQuery = {
  page?: number;
  limit?: number;
  type?: ConversationType;
  status?: ConversationStatus;
  isFavorite?: boolean;
  isArchived?: boolean;
  sortBy?: string;
  sortOrder?: number;
  startDate?: string;
  endDate?: string;
  searchQuery?: string;
  tags?: string[];
};

export type ConversationMessageQuery = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: number;
};

export type StartConversationPayload = {
  initialQuestion: string;
  type?: ConversationType;
  tags?: string[];
};

export type SendAiMessagePayload = {
  message?: string;
  conversationType?: ConversationType;
  images?: File[];
};

export type SendAiMessageResponse = {
  conversationId: string;
  userMessage: string;
  attachments: Array<{ publicId: string; secureUrl: string }>;
  finalAiResponse: string;
  messageCount: number;
  groundedByRag: boolean;
  citations: Array<Record<string, unknown>>;
  confidence: number;
};

function mapConversation(item: AiConversationApiResponse): AiConversation {
  return {
    id: item._id,
    userId: item.userId,
    type: item.type,
    messages: item.messages,
    topic: item.topic,
    summary: item.summary,
    followUpAction: item.followUpAction,
    totalTokensUsed: item.totalTokensUsed,
    messageCount: item.messageCount,
    lastMessageAt: item.lastMessageAt,
    isArchived: item.isArchived,
    archivedAt: item.archivedAt,
    isFavorite: item.isFavorite,
    rating: item.rating,
    ratingComment: item.ratingComment,
    status: item.status,
    completedAt: item.completedAt,
    tags: item.tags,
    internalNotes: item.internalNotes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function startConversation(
  payload: StartConversationPayload,
): Promise<AiConversation> {
  const res = await api.post<{ data: AiConversationApiResponse }>(
    "/ai-assistant/conversations/start",
    payload,
  );

  return mapConversation(res.data.data);
}

export async function getConversations(query?: ConversationQuery): Promise<{
  data: AiConversation[];
  pagination: Pagination;
}> {
  const res = await api.get<{
    data: AiConversationApiResponse[];
    pagination: Pagination;
  }>("/ai-assistant/conversations", {
    params: query,
  });

  return {
    data: res.data.data.map(mapConversation),
    pagination: res.data.pagination,
  };
}

export async function getConversation(
  conversationId: string,
  query?: ConversationMessageQuery,
): Promise<{
  conversation: AiConversation;
  messages: AiConversationMessageRecord[];
  pagination: Pagination;
}> {
  const res = await api.get<{
    data: AiConversationApiResponse;
    messages?: AiConversationMessageRecord[];
    pagination?: Pagination;
  }>(`/ai-assistant/conversations/${conversationId}`, {
    params: query,
  });

  return {
    conversation: mapConversation(res.data.data),
    messages: res.data.messages ?? [],
    pagination: res.data.pagination ?? {
      page: 1,
      limit: 10,
      total: 0,
      pages: 1,
    },
  };
}

export async function sendAiMessage(
  conversationId: string,
  payload: SendAiMessagePayload,
): Promise<SendAiMessageResponse> {
  const formData = new FormData();
  if (payload.message) {
    formData.append("message", payload.message);
  }
  if (payload.conversationType) {
    formData.append("conversationType", payload.conversationType);
  }
  if (payload.images && payload.images.length > 0) {
    for (const image of payload.images) {
      formData.append("images", image);
    }
  }

  const res = await api.post<{ data: SendAiMessageResponse }>(
    `/ai-assistant/conversations/${conversationId}/message`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  return res.data.data;
}

export async function toggleConversationFavorite(
  conversationId: string,
): Promise<{ isFavorite: boolean }> {
  const res = await api.post<{ data: { isFavorite: boolean } }>(
    `/ai-assistant/conversations/${conversationId}/favorite`,
  );
  return res.data.data;
}

export async function archiveConversation(
  conversationId: string,
  isArchived: boolean,
): Promise<{ isArchived: boolean }> {
  const res = await api.post<{ data: { isArchived: boolean } }>(
    `/ai-assistant/conversations/${conversationId}/archive`,
    { isArchived },
  );
  return res.data.data;
}

export async function rateConversation(
  conversationId: string,
  payload: { rating: number; comment?: string },
): Promise<{ rating: number; comment?: string }> {
  const res = await api.post<{ data: { rating: number; comment?: string } }>(
    `/ai-assistant/conversations/${conversationId}/rate`,
    payload,
  );
  return res.data.data;
}

export async function updateConversation(
  conversationId: string,
  payload: {
    topic?: string;
    internalNotes?: string;
    tags?: string[];
    status?: ConversationStatus;
  },
): Promise<AiConversation> {
  const res = await api.patch<{ data: AiConversationApiResponse }>(
    `/ai-assistant/conversations/${conversationId}`,
    payload,
  );

  return mapConversation(res.data.data);
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  await api.delete(`/ai-assistant/conversations/${conversationId}`);
}

export async function getConversationStats(conversationId: string) {
  const res = await api.get<{ data: Record<string, unknown> }>(
    `/ai-assistant/conversations/${conversationId}/stats`,
  );
  return res.data.data;
}

export async function getConversationSummary() {
  const res = await api.get<{ data: Record<string, unknown> }>(
    "/ai-assistant/summary",
  );
  return res.data.data;
}

export async function searchConversations(query: {
  q: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: number;
}) {
  const res = await api.get<{
    data: AiConversationApiResponse[];
    pagination: Pagination;
  }>("/ai-assistant/search", {
    params: query,
  });

  return {
    data: res.data.data.map(mapConversation),
    pagination: res.data.pagination,
  };
}
