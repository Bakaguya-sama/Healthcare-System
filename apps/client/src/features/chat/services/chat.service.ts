import type { ChatMessage } from "../components/message";

export type SendChatPayload = {
  sessionId: string;
  content: string;
};

export const chatService = {
  async loadMessages(sessionId: string): Promise<ChatMessage[]> {
    // TODO: Replace with real API call, e.g. GET /consultations/:sessionId/messages
    // Keep this delay so loading flow can be tested in UI.
    await new Promise((resolve) => setTimeout(resolve, 200));

    // TODO: Remove fallback when backend is ready.
    return [
      {
        id: `${sessionId}-seed-1`,
        sender: "patient",
        content: "Hello doctor, I need follow-up advice on my medication.",
        time: "09:05 AM",
      },
      {
        id: `${sessionId}-seed-2`,
        sender: "doctor",
        content: "Sure, let me review your latest symptoms first.",
        time: "09:07 AM",
      },
    ];
  },

  async sendMessage(payload: SendChatPayload): Promise<void> {
    // TODO: Replace with real API call, e.g. POST /consultations/:sessionId/messages
    // The payload can include content type when you support rich attachments.
    await new Promise((resolve) => setTimeout(resolve, 150));
    void payload;
  },
};
