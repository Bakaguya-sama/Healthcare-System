import { api } from "@/lib/api";

export type MessagePagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export interface MessageApiResponseReceive {
  messages: MessageApiResponse[];
  pagination: MessagePagination;
}

interface MessageSend {
  doctorSessionId: string;
  senderType: string;
  content: string;
}

export interface MessageSendApiResponse {
  doctorSessionId: string;
  senderId: string;
  senderType: string;
  content: string;
  attachments: AttachmentsApiResponse[];
  sentAt: string;
}

type AttachmentsApiResponse = {
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
};

export type MessageApiResponse = {
  doctorSessionId: string;
  senderId: string;
  senderType: string;
  content: string;
  attachments: AttachmentsApiResponse[];
  sentAt: string;
};

export async function sendMessage(
  payload: MessageSend,
  attachments: File[],
): Promise<MessageSendApiResponse | null> {
  const formData = new FormData();
  if (attachments && attachments.length > 0) {
    for (const attachment of attachments) {
      formData.append("attachments", attachment);
    }
  }
  formData.append("doctorSessionId", payload.doctorSessionId);
  formData.append("content", payload.content);
  formData.append("senderType", payload.senderType);

  const res = await api.post("/chat/send", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data.data;
}

export async function getMessage(
  sessionId: string,
  page: number,
): Promise<MessageApiResponseReceive | null> {
  const res = await api.get(`/chat/session/${sessionId}`, {
    params: {
      limit: 10,
      page,
    },
  });

  return {
    messages: res.data.data,
    pagination: res.data.pagination,
  };
}
