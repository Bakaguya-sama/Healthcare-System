import { Plus, Sparkles } from "lucide-react";
import { HistoryCard } from "../components/history-card";
import { ChatWindow } from "@/features/chat/window/chat-window";
import { useState } from "react";
import type { ChatMessage } from "@/features/chat/components/message";
import {
  AIReportModal,
  type ReportType,
} from "@repo/ui/components/complex-modal/AIReportModal";

const MOCK_HISTORY = [
  {
    id: "session-current",
    title: "Skin rash analysis",
    createdAt: new Date(),
    isCurrent: true,
  },
  {
    id: "session-2",
    title: "Persistent headache",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isCurrent: false,
  },
  {
    id: "session-3",
    title: "Dietary advice",
    createdAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000),
    isCurrent: false,
  },
  {
    id: "session-4",
    title: "Persistent headache",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isCurrent: false,
  },
  {
    id: "session-5",
    title: "Dietary advice",
    createdAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000),
    isCurrent: false,
  },
  {
    id: "session-6",
    title: "Persistent headache",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isCurrent: false,
  },
  {
    id: "session-7",
    title: "Dietary advice",
    createdAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000),
    isCurrent: false,
  },
  {
    id: "session-8",
    title: "Persistent headache",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    isCurrent: false,
  },
  {
    id: "session-9",
    title: "Dietary advice",
    createdAt: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000),
    isCurrent: false,
  },
];

export function AiChat() {
  const [sessions, setSessions] = useState(MOCK_HISTORY);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    MOCK_HISTORY[0]?.id || null,
  );
  const [isReportModalOpen, setReportModalOpen] = useState(false);

  // TODO: Replace this with global auth state selector (e.g. Redux/Zustand/context).
  const currentPatient = {
    id: "",
    fullName: "",
  };

  const reportPatientId = currentPatient.id;
  const reportPatientName = currentPatient.fullName;

  const selectedSession = sessions.find(
    (session) => session.id === selectedSessionId,
  );

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
    // TODO: call report API with payload
    console.log("Submit AI report:", payload);
    setReportModalOpen(false);
  };

  const handleStartNewConsultation = () => {
    // TODO: replace this local creation with backend API response.
    const newSession = {
      id: `session-${Date.now()}`,
      title: "New consultation",
      createdAt: new Date(),
      isCurrent: true,
    };

    setSessions((prev) => [
      newSession,
      ...prev.map((session) => ({ ...session, isCurrent: false })),
    ]);
    setSelectedSessionId(newSession.id);
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleLoadMessages = async (
    sessionId: string,
  ): Promise<ChatMessage[]> => {
    // TODO: call API by sessionId and return mapped ChatMessage[]
    console.log("Load session messages:", sessionId);
    return [];
  };

  const handleCloseChat = () => {
    setSelectedSessionId(null);
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
              className="cursor-pointer inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-brand/35 bg-brand-light/30 text-lg font-semibold text-brand transition-colors hover:bg-brand-light"
              onClick={handleStartNewConsultation}
            >
              <Plus className="h-4 w-4" />
              New Consultation
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-white px-3 py-5">
            <div className="space-y-2">
              {sessions.map((session) => (
                <HistoryCard
                  key={session.id}
                  title={session.title}
                  createdAt={session.createdAt}
                  isCurrent={session.isCurrent}
                  isSelected={selectedSessionId === session.id}
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
              onLoadMessages={handleLoadMessages}
              onReport={handleOpenReportModal}
              onClose={handleCloseChat}
              usePortal={false}
            />
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
