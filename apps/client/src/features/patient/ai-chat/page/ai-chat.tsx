import { Plus, Sparkles } from "lucide-react";
import { HistoryCard } from "../components/history-card";
import { ChatWindow } from "@/features/chat/window/chat-window";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ChatMessage } from "@/features/chat/components/message";
import type { SendMessagePayload } from "@/features/chat/components/send-bar";
import {
  AIReportModal,
  type ReportType,
} from "@repo/ui/components/complex-modal/AIReportModal";
import { useAiChat } from "../hooks/useAiChat";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import { useReport } from "@/features/shared/hooks/useReport";
import { showToast } from "@repo/ui/components/ui/toasts";

export function AiChat() {
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const prefillParam = searchParams.get("prefill");
  const prefillRef = useRef<string | null>(null);
  const prefillStartRef = useRef(false);
  const prefillSentRef = useRef(false);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const {
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
  } = useAiChat();

  const me = useAuthStore();
  const {
    isLoading: reportLoading,
    submitReport,
    error: reportError,
  } = useReport();

  const currentPatient = {
    id: me.user?.id,
    fullName: me.user?.name,
  };

  const reportPatientId = currentPatient.id;
  const reportPatientName = currentPatient.fullName;

  const selectedSession = selectedConversation;

  const sortedSessions = useMemo(
    () =>
      [...conversations].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [conversations],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!reportError) return;
    showToast.error(reportError);
  }, [reportError]);

  useEffect(() => {
    if (!selectedConversationId) return;
    void loadMessages(selectedConversationId, 1);
  }, [loadMessages, selectedConversationId]);

  useEffect(() => {
    if (!prefillParam) return;
    prefillRef.current = prefillParam;
  }, [prefillParam]);

  useEffect(() => {
    const prefill = prefillRef.current;
    if (!prefill || prefillSentRef.current) return;

    if (!selectedConversationId) {
      if (prefillStartRef.current) return;
      prefillStartRef.current = true;
      startNewConversation({
        initialQuestion: "Xin chào bác sĩ Ai, tôi cần tư vấn",
        type: "general_consultation",
      })
        .then((conversation) => {
          if (!conversation) return;
          setSelectedConversationId(conversation.id);
        })
        .finally(() => {
          prefillStartRef.current = false;
        });
      return;
    }

    if (
      !selectedConversation ||
      selectedConversation.id !== selectedConversationId
    ) {
      return;
    }

    setPrefillMessage(prefill);
    prefillSentRef.current = true;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("prefill");
    setSearchParams(nextParams, { replace: true });
  }, [
    prefillParam,
    searchParams,
    selectedConversation,
    selectedConversationId,
    setSearchParams,
    setSelectedConversationId,
    startNewConversation,
  ]);

  const handleCloseReportModal = () => {
    setReportModalOpen(false);
  };

  const handleOpenReportModal = () => {
    // TODO: Decide UX when auth data is missing (redirect login / toast / block action).
    setReportModalOpen(true);
  };

  const handleSubmitReportModal = (payload: {
    sessionId: string;
    patientId: string;
    reportType: ReportType;
    reason: string;
  }) => {
    const reportedUserId = reportPatientId || payload.patientId;
    if (!reportedUserId) {
      showToast.error("Unable to determine who to report.");
      throw new Error("Unable to determine who to report.");
    }

    return submitReport({
      reportedUserId,
      reportType: payload.reportType,
      reason: payload.reason,
    })
      .then(() => {
        setReportModalOpen(false);
        showToast.success("Report submitted successfully.");
      })
      .catch((error) => {
        showToast.error(
          error instanceof Error ? error.message : "Failed to submit report.",
        );
        throw error;
      });
  };

  const handleStartNewConsultation = async () => {
    const conversation = await startNewConversation({
      initialQuestion: "Xin chào bác sĩ Ai, tôi cần tư vấn",
      type: "general_consultation",
    });

    if (!conversation) return;
    setSelectedConversationId(conversation.id);
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedConversationId(sessionId);
  };

  const handleLoadMessages = async (
    sessionId: string,
    page: number,
  ): Promise<{ messages: ChatMessage[]; totalPages: number }> => {
    return loadMessages(sessionId, page);
  };

  const handleChatSend = async (payload: SendMessagePayload) => {
    if (!selectedConversation) return;

    const content = payload.content?.trim() || "";
    const attachments = payload.attachments ?? [];
    const files = attachments
      .map((attachment) => attachment.file)
      .filter((file): file is File => Boolean(file));

    if (!content && files.length === 0) return;

    await sendMessage(selectedConversation.id, {
      message: content || undefined,
      images: files,
      attachments,
    });
  };

  const handleCloseChat = () => {
    setSelectedConversationId(null);
  };

  return (
    <section className="relative h-full w-full overflow-hidden bg-slate-100 p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.14),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(163,230,53,0.14),transparent_38%)]" />

      <div className="flex h-full gap-6">
        {/* Sidebar */}
        <aside className="relative flex h-full w-90 shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-[0_22px_50px_rgba(15,23,42,0.12)] ring-1 ring-white/80 backdrop-blur-sm">
          <div className="border-b border-slate-200 bg-linear-to-b from-ai-light/35 via-white to-white px-4 py-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand/20 bg-brand-light text-brand">
                <Sparkles className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-semibold text-slate-900">
                Chat History
              </h1>
            </div>

            <button
              type="button"
              className="cursor-pointer inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-brand/35 bg-brand-light/30 text-lg font-semibold text-brand transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleStartNewConsultation}
              disabled={isStarting}
            >
              <Plus className="h-4 w-4" />
              {isStarting ? "Starting..." : "New Consultation"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-white px-3 py-5">
            <div className="space-y-2">
              {isLoadingConversations && (
                <p className="text-center text-sm text-slate-400">
                  Loading conversations...
                </p>
              )}
              {conversationsError && (
                <p className="text-center text-sm text-rose-500">
                  {conversationsError}
                </p>
              )}
              {!isLoadingConversations &&
                !conversationsError &&
                sortedSessions.map((session) => (
                  <HistoryCard
                    key={session.id}
                    title={session.topic}
                    createdAt={new Date(session.createdAt)}
                    isCurrent={session.id === selectedConversationId}
                    isSelected={session.id === selectedConversationId}
                    onClick={() => handleSelectSession(session.id)}
                  />
                ))}
            </div>
          </div>

          <footer className="border-t border-slate-200 bg-slate-50/85 px-4 py-4 text-center text-xs text-slate-400">
            Conversations are private and encrypted
          </footer>
        </aside>

        {/* Chat Window */}
        {selectedSession && (
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.12)] ring-1 ring-white/80">
            <ChatWindow
              isAiChat={true}
              key={selectedSession.id}
              sessionId={selectedSession.id}
              isOpen={true}
              viewerRole="patient"
              aiName="AI Assistant"
              patientId={currentPatient.id}
              patientName={currentPatient.fullName || ""}
              initialMessages={messages}
              onLoadMessages={handleLoadMessages}
              onReport={handleOpenReportModal}
              onClose={handleCloseChat}
              usePortal={false}
              onSend={handleChatSend}
              patientIsOnline={true}
              prefillMessage={prefillMessage ?? undefined}
            />
            {(messagesError || sendError || startError) && (
              <div className="absolute bottom-4 right-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-600">
                {messagesError || sendError || startError}
              </div>
            )}
            {(isLoadingMessages || isSending) && (
              <div className="absolute bottom-4 left-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
                {isSending ? "Sending..." : "Loading messages..."}
              </div>
            )}
          </div>
        )}
      </div>
      {selectedSession && (
        <AIReportModal
          isOpen={isReportModalOpen}
          onClose={handleCloseReportModal}
          onConfirm={handleSubmitReportModal}
          sessionId={selectedSession.id}
          patientId={reportPatientId}
          patientName={reportPatientName}
        />
      )}
    </section>
  );
}
