import { PendingRequestCard } from "../components/pending-request-card";
import { ActiveSessionCard } from "../components/active-session-card";
import { ConsultationHistoryCard } from "../components/consultation-history-card";
import { ReviewModal } from "../components/review-modal";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { showToast } from "@repo/ui/components/ui/toasts";
import { ProfileModal } from "@repo/ui/components/complex-modal/ProfileModal";
import { EndConsultationModal } from "@repo/ui/components/complex-modal/EndConsultationModal";
import {
  ReportModal,
  type ReportActor,
  type ReportType,
} from "@repo/ui/components/complex-modal/ReportModal";
import { ChatWindow } from "@/features/chat/window/chat-window";
import type { SendMessagePayload } from "@/features/chat/components/send-bar";
import { chatService } from "@/features/chat/services/chat.service";

type TabSwitch = "pending-requests" | "active-sessions" | "history";

const initialPendingRequests = [
  {
    id: "req-1",
    patientName: "Sarah Mitchell",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80",
    patientBirthDay: new Date("1997-05-12"),
    patientGender: "Female",
    patientNote: "",
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    isOnline: false,
  },
  {
    id: "req-2",
    patientName: "James O'Brien",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",
    patientBirthDay: new Date("1980-11-03"),
    patientGender: "Male",
    patientNote:
      "Feeling chest tightness and shortness of breath mainly during physical activity. I have a history of hypertension and have been a smoker for 12 years.",
    createdAt: new Date(Date.now() - 12 * 60 * 1000),
    isOnline: false,
  },
  {
    id: "req-3",
    patientName: "Mei Tanaka",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=160&q=80",
    patientBirthDay: new Date("1958-09-18"),
    patientGender: "Female",
    patientNote:
      "Recurring dizziness and fatigue, especially bad in the mornings. Currently on blood pressure medication and would like to discuss my symptoms.",
    createdAt: new Date(Date.now() - 18 * 60 * 1000),
    isOnline: false,
  },
  {
    id: "req-4",
    patientName: "David Park",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80",
    patientBirthDay: new Date("1993-02-08"),
    patientGender: "Male",
    patientNote:
      "Severe lower back pain after a gym workout 2 days ago. I have a sharp pain radiating to my left leg and I am unable to stand fully upright.",
    createdAt: new Date(Date.now() - 23 * 60 * 1000),
    isOnline: false,
  },
  {
    id: "req-5",
    patientName: "Fatima Al-Hassan",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80",
    patientBirthDay: new Date("1987-07-27"),
    patientGender: "Female",
    patientNote:
      "A skin rash started on my arms 4 days ago and has been gradually spreading. It is itchy and warm to the touch with no recent changes to diet or detergents.",
    createdAt: new Date(Date.now() - 31 * 60 * 1000),
    isOnline: false,
  },
  {
    id: "req-6",
    patientName: "Ethan Brooks",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80",
    patientBirthDay: new Date("2008-04-14"),
    patientGender: "Male",
    patientNote:
      "High fever of 39.2C and very sore throat for the past 2 days. Having difficulty swallowing. Guardian will be available throughout the consultation.",
    createdAt: new Date(Date.now() - 47 * 60 * 1000),
    isOnline: false,
  },
];

const initialActiveSessionCount = 2;

const initialActiveSessions = [
  {
    id: "session-1",
    sessionId: "sess-001",
    patientId: "pat-001",
    patientName: "Robert Wilson",
    patientUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80",
    patientIsOnline: true,
    lastSent: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: "session-2",
    sessionId: "sess-002",
    patientId: "pat-002",
    patientName: "Jennifer Lopez",
    patientUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80",
    patientIsOnline: true,
    lastSent: new Date(Date.now() - 8 * 60 * 1000),
  },
];

const initialConsultationHistory = [
  {
    sessionId: "hist-001",
    patientId: "pat-201",
    patientName: "Aria Johnson",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80",
    patientRating: 5,
    patientReview: "Very clear explanation and treatment plan.",
    sessionStatus: "completed" as const,
    endedAt: new Date(),
  },
  {
    sessionId: "hist-002",
    patientId: "pat-202",
    patientName: "Tom Nguyen",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80",
    patientRating: 4,
    patientReview: "Helpful prescription advice for seasonal allergy.",
    sessionStatus: "completed" as const,
    endedAt: new Date(Date.now() - 35 * 60 * 1000),
  },
  {
    sessionId: "hist-003",
    patientId: "pat-203",
    patientName: "Brenda Cole",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=160&q=80",
    patientRating: 0,
    patientReview: "Session was stopped before completion.",
    sessionStatus: "rejected" as const,
    endedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    sessionId: "hist-004",
    patientId: "pat-204",
    patientName: "Omar Fadel",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80",
    patientRating: 5,
    patientReview: "Fast and practical guidance. Thank you doctor.",
    sessionStatus: "completed" as const,
    endedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    sessionId: "hist-005",
    patientId: "pat-205",
    patientName: "Linda Marsh",
    patientAvatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80",
    patientRating: 0,
    patientReview: "Patient did not complete verification flow.",
    sessionStatus: "rejected" as const,
    endedAt: new Date(Date.now() - 29 * 60 * 60 * 1000),
  },
];

type PendingRequest = (typeof initialPendingRequests)[number];
type ActiveSession = (typeof initialActiveSessions)[number];
type ConsultationHistorySession = (typeof initialConsultationHistory)[number];
type ReportTarget = {
  sessionId: string;
  patientId: string;
  patientName: string;
};

type ChatTarget = {
  sessionId: string;
  patientId: string;
  patientName: string;
  patientUrl?: string;
  patientIsOnline: boolean;
};

type RequestAction = "accept" | "decline";

function getTabClass(active: boolean) {
  return `inline-flex items-center gap-2 border-b-2 px-1 pb-3 pt-2 text-sm font-semibold transition-colors ${
    active
      ? "border-lime-500 text-slate-900"
      : "border-transparent text-slate-500 hover:text-slate-700"
  }`;
}

export function Consultations() {
  const [activeTab, setActiveTab] = useState<TabSwitch>("pending-requests");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [activeSessionSearchTerm, setActiveSessionSearchTerm] = useState("");
  const [requests, setRequests] = useState<PendingRequest[]>(
    initialPendingRequests,
  );
  const [activeSessions, setActiveSessions] = useState<number>(
    initialActiveSessionCount,
  );
  const [activeSessionsList, setActiveSessionsList] = useState<ActiveSession[]>(
    initialActiveSessions,
  );
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null,
  );
  const [processingAction, setProcessingAction] =
    useState<RequestAction | null>(null);
  const [actionError, setActionError] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [endChatModalOpen, setEndChatModalOpen] = useState(false);
  const [selectedEndSession, setSelectedEndSession] =
    useState<ActiveSession | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReportSession, setSelectedReportSession] =
    useState<ReportTarget | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReviewSession, setSelectedReviewSession] =
    useState<ConsultationHistorySession | null>(null);
  const [isChatOpen, setChatOpen] = useState(false);
  const [selectedChatSession, setSelectedChatSession] =
    useState<ChatTarget | null>(null);

  // TODO: fetch doctor data
  const currentDoctorData = {
    id: "doctor-demo-001",
    name: "Dr. Marcus Lee",
  };

  const handleCloseEndChatModal = () => {
    setEndChatModalOpen(false);
    setSelectedEndSession(null);
  };

  const handleCloseReportModal = () => {
    setReportModalOpen(false);
    setSelectedReportSession(null);
  };

  const handleCloseReviewModal = () => {
    setReviewModalOpen(false);
    setSelectedReviewSession(null);
  };

  const handleCloseChatWindow = () => {
    setChatOpen(false);
    setSelectedChatSession(null);
  };

  const handleEndChat = ({
    sessionId,
    notes,
  }: {
    sessionId: string;
    notes: string;
  }) => {
    const session = activeSessionsList.find(
      (item) => item.sessionId === sessionId,
    );
    if (!session) return;

    setActiveSessionsList((prev) =>
      prev.filter((item) => item.sessionId !== sessionId),
    );
    setActiveSessions((prev) => Math.max(0, prev - 1));

    // Close chat only after the end consultation has been confirmed.
    handleCloseChatWindow();

    if (notes) {
      showToast.success(
        `Consultation with ${session.patientName} ended and notes saved.`,
      );
      return;
    }

    showToast.success(`Consultation with ${session.patientName} ended.`);
  };

  const handleChatSend = async (payload: SendMessagePayload) => {
    if (!selectedChatSession) return;

    const text = payload.content?.trim() || "";
    const attachmentCount = payload.attachments?.length || 0;
    if (!text && attachmentCount === 0) return;

    // TODO(real-data): send attachments metadata in dedicated API fields.
    const normalizedContent =
      text ||
      `[Attachment] ${attachmentCount} file${attachmentCount > 1 ? "s" : ""}`;

    try {
      await chatService.sendMessage({
        sessionId: selectedChatSession.sessionId,
        content: normalizedContent,
      });
    } catch {
      // TODO: Add retry queue and failed-message UI when API is integrated.
      showToast.error("Message could not be sent. Please try again.");
    }
  };

  const handleLoadMessages = async (sessionId: string) => {
    try {
      return await chatService.loadMessages(sessionId);
    } catch {
      // TODO: Replace with dedicated chat error state.
      showToast.error("Could not load messages for this consultation.");
      return [];
    }
  };

  const handleCloseProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedUserId(null);
  };

  const simulateRequestApi = (action: RequestAction, requestId: string) => {
    return new Promise<void>((resolve, reject) => {
      const delay = 700 + Math.floor(Math.random() * 600);
      setTimeout(() => {
        // Simulate occasional network errors so the UI flow can be tested.
        if (Math.random() < 0.12) {
          reject(new Error(`Failed to ${action} request ${requestId}`));
          return;
        }
        resolve();
      }, delay);
    });
  };

  //   Handle accept & decline here
  const handleRequestAction = async (
    action: RequestAction,
    requestId: string,
  ) => {
    if (processingRequestId) return;

    const targetRequest = requests.find((request) => request.id === requestId);
    if (!targetRequest) return;

    setProcessingRequestId(requestId);
    setProcessingAction(action);
    setActionError(false);

    try {
      await simulateRequestApi(action, requestId);

      setRequests((prev) => prev.filter((request) => request.id !== requestId));

      if (action === "accept") {
        setActiveSessions((prev) => prev + 1);
      }

      showToast.success(
        action === "accept"
          ? `Accepted request from ${targetRequest.patientName}.`
          : `Declined request from ${targetRequest.patientName}.`,
      );
    } catch {
      setActionError(true);
      showToast.error(
        `Could not ${action} this request. Please try again in a moment.`,
      );
    } finally {
      setProcessingRequestId(null);
      setProcessingAction(null);
    }
  };

  // Handle active session actions
  const handleViewProfile = (patientId: string) => {
    // TODO: Navigate to patient profile or open modal
    setSelectedUserId(patientId);
    setProfileModalOpen(true);
  };

  const handleEndConsultation = (sessionId: string) => {
    const session = activeSessionsList.find((s) => s.sessionId === sessionId);
    if (session) {
      setSelectedEndSession(session);
      setEndChatModalOpen(true);
    }
  };

  const handleReportPatient = (sessionId: string) => {
    const session = activeSessionsList.find((s) => s.sessionId === sessionId);
    if (!session) return;

    setSelectedReportSession({
      sessionId: session.sessionId,
      patientId: session.patientId,
      patientName: session.patientName,
    });
    setReportModalOpen(true);
  };

  const handleReportFromHistory = (session: ConsultationHistorySession) => {
    setSelectedReportSession({
      sessionId: session.sessionId,
      patientId: session.patientId,
      patientName: session.patientName,
    });
    setReportModalOpen(true);
  };

  const handleOpenReview = (sessionId: string) => {
    const session = initialConsultationHistory.find(
      (item) => item.sessionId === sessionId,
    );
    if (!session) return;

    setSelectedReviewSession(session);
    setReviewModalOpen(true);
  };

  const handleSubmitReport = (_payload: {
    sessionId: string;
    target: ReportActor;
    reporter: ReportActor;
    reportType: ReportType;
    reason: string;
  }) => {
    void _payload;
    // TODO: Call API to submit report with _payload.
    // NOTE: As requested, submitting a report must close ChatWindow immediately
    // and must not open EndConsultationModal. Doctor notes flow will be handled later.
    handleCloseChatWindow();
    showToast.success(`Report submitted successfully.`);
  };

  const handleOpenChat = (sessionId: string) => {
    const activeSession = activeSessionsList.find(
      (session) => session.sessionId === sessionId,
    );

    if (activeSession) {
      setSelectedChatSession({
        sessionId: activeSession.sessionId,
        patientId: activeSession.patientId,
        patientName: activeSession.patientName,
        patientUrl: activeSession.patientUrl,
        patientIsOnline: activeSession.patientIsOnline,
      });
      setChatOpen(true);
      return;
    }

    const historySession = initialConsultationHistory.find(
      (session) => session.sessionId === sessionId,
    );

    if (historySession) {
      setSelectedChatSession({
        sessionId: historySession.sessionId,
        patientId: historySession.patientId,
        patientName: historySession.patientName,
        patientUrl: historySession.patientAvatarUrl,
        patientIsOnline: false,
      });
      setChatOpen(true);
      return;
    }

    showToast.error("Could not open this chat session.");
  };

  const handleChatViewProfile = () => {
    if (!selectedChatSession) return;
    handleViewProfile(selectedChatSession.patientId);
  };

  const handleChatReport = () => {
    if (!selectedChatSession) return;
    setSelectedReportSession({
      sessionId: selectedChatSession.sessionId,
      patientId: selectedChatSession.patientId,
      patientName: selectedChatSession.patientName,
    });
    setReportModalOpen(true);
  };

  const handleChatEndConsultation = () => {
    if (!selectedChatSession) return;

    const activeSession = activeSessionsList.find(
      (session) => session.sessionId === selectedChatSession.sessionId,
    );

    if (!activeSession) {
      showToast.error("This consultation is no longer active.");
      return;
    }

    handleEndConsultation(selectedChatSession.sessionId);
  };

  const filteredRequests = requests
    .filter((item) => {
      const keyword = searchTerm.trim().toLowerCase();
      if (!keyword) return true;
      return (
        item.patientName.toLowerCase().includes(keyword) ||
        item.patientNote.toLowerCase().includes(keyword)
      );
    })
    .sort((a, b) => {
      const newestFirst = b.createdAt.getTime() - a.createdAt.getTime();
      return sortBy === "newest" ? newestFirst : -newestFirst;
    });

  const filteredHistory = initialConsultationHistory
    .filter((session) => {
      const keyword = searchTerm.trim().toLowerCase();
      if (!keyword) return true;
      return (
        session.patientName.toLowerCase().includes(keyword) ||
        (session.patientReview || "").toLowerCase().includes(keyword)
      );
    })
    .sort((a, b) => {
      const aTime = a.endedAt?.getTime() ?? 0;
      const bTime = b.endedAt?.getTime() ?? 0;
      return sortBy === "newest" ? bTime - aTime : aTime - bTime;
    });

  return (
    <div className="w-full p-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-slate-900">
            Patient Consultations
          </h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-100">
          <div className="flex items-center gap-8 border-b border-slate-200 bg-white px-6 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab("pending-requests")}
              className={`${getTabClass(activeTab === "pending-requests")} cursor-pointer`}
            >
              Pending Requests
              <span className=" inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[11px] font-semibold text-slate-900">
                {requests.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("active-sessions")}
              className={`${getTabClass(activeTab === "active-sessions")} cursor-pointer`}
            >
              Active Sessions
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[11px] font-semibold text-slate-900">
                {activeSessions}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`${getTabClass(activeTab === "history")} cursor-pointer`}
            >
              History
            </button>
          </div>

          {activeTab === "pending-requests" && (
            <>
              <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <label className="relative block w-full md:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    type="text"
                    placeholder="Search by name or symptom..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
                  />
                </label>

                <label className="inline-flex items-center gap-2 self-end text-xs text-slate-400 md:self-auto">
                  Sort by:
                  <span className="relative inline-flex">
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as "newest" | "oldest")
                      }
                      className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-sm font-medium text-slate-700 outline-none"
                    >
                      <option value="newest">Latest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((item) => (
                    <PendingRequestCard
                      key={item.id}
                      id={item.id}
                      patientName={item.patientName}
                      patientAvatarUrl={item.patientAvatarUrl}
                      patientBirthDay={item.patientBirthDay}
                      patientGender={item.patientGender}
                      patientNote={item.patientNote}
                      createdAt={item.createdAt}
                      onAccept={() => handleRequestAction("accept", item.id)}
                      onDecline={() => handleRequestAction("decline", item.id)}
                      isAccepting={
                        processingRequestId === item.id &&
                        processingAction === "accept"
                      }
                      isDeclining={
                        processingRequestId === item.id &&
                        processingAction === "decline"
                      }
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-slate-500">
                    No results match your search.
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "active-sessions" && (
            <>
              <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <label className="relative block w-full md:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={activeSessionSearchTerm}
                    onChange={(e) => setActiveSessionSearchTerm(e.target.value)}
                    type="text"
                    placeholder="Search by patient name..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-1">
                {activeSessionsList
                  .filter((session) => {
                    const keyword = activeSessionSearchTerm
                      .trim()
                      .toLowerCase();
                    if (!keyword) return true;
                    return session.patientName.toLowerCase().includes(keyword);
                  })
                  .map((session) => (
                    <ActiveSessionCard
                      key={session.sessionId}
                      sessionId={session.sessionId}
                      patientId={session.patientId}
                      patientName={session.patientName}
                      patientUrl={session.patientUrl}
                      patientIsOnline={session.patientIsOnline}
                      lastSent={session.lastSent}
                      onOpenchat={() => handleOpenChat(session.sessionId)}
                      onViewProfile={() => handleViewProfile(session.patientId)}
                      onEndConsultation={() =>
                        handleEndConsultation(session.sessionId)
                      }
                      onReport={() => handleReportPatient(session.sessionId)}
                    />
                  ))}
              </div>

              {activeSessionsList.filter((session) => {
                const keyword = activeSessionSearchTerm.trim().toLowerCase();
                if (!keyword) return true;
                return session.patientName.toLowerCase().includes(keyword);
              }).length === 0 && (
                <div className="col-span-full text-center py-8 text-slate-500">
                  No active sessions found.
                </div>
              )}
            </>
          )}

          {activeTab === "history" && (
            <>
              <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <label className="relative block w-full md:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    type="text"
                    placeholder="Search patient or review..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
                  />
                </label>

                <label className="inline-flex items-center gap-2 self-end text-xs text-slate-400 md:self-auto">
                  Sort by:
                  <span className="relative inline-flex">
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as "newest" | "oldest")
                      }
                      className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-4 pr-10 text-sm font-medium text-slate-700 outline-none"
                    >
                      <option value="newest">Latest</option>
                      <option value="oldest">Oldest</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </span>
                </label>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <div className="grid min-w-[900px] grid-cols-[2fr_3fr_2fr_1.2fr_1.2fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Patient</span>
                  <span>Date & Time</span>
                  <span>Status</span>
                  <span>Rating</span>
                  <span>Review</span>
                  <span className="text-right">Action</span>
                </div>

                {filteredHistory.length > 0 ? (
                  filteredHistory.map((session) => (
                    <ConsultationHistoryCard
                      key={session.sessionId}
                      sessionId={session.sessionId}
                      patientId={session.patientId}
                      patientName={session.patientName}
                      patientAvatarUrl={session.patientAvatarUrl}
                      patientRating={session.patientRating}
                      patientReview={session.patientReview}
                      sessionStatus={session.sessionStatus}
                      endedAt={session.endedAt}
                      onOpenchat={() => handleOpenChat(session.sessionId)}
                      onViewProfile={() => handleViewProfile(session.patientId)}
                      onOpenReview={() => handleOpenReview(session.sessionId)}
                      onReport={() => handleReportFromHistory(session)}
                    />
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    No consultation history matches your search.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <ProfileModal
        id={selectedUserId || ""}
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
        profileSeed={
          selectedUserId
            ? {
                id: selectedUserId,
                full_name:
                  selectedChatSession?.patientName ||
                  selectedReportSession?.patientName ||
                  selectedReviewSession?.patientName ||
                  "Selected Patient",
                role: "patient",
                avatar_url:
                  selectedChatSession?.patientUrl ||
                  selectedReviewSession?.patientAvatarUrl,
              }
            : undefined
        }
        reportViewer={{
          id: currentDoctorData.id,
          name: currentDoctorData.name,
          role: "doctor",
        }}
      />

      <EndConsultationModal
        isOpen={endChatModalOpen}
        sessionId={selectedEndSession?.sessionId || ""}
        patientName={selectedEndSession?.patientName || ""}
        onClose={handleCloseEndChatModal}
        onConfirm={handleEndChat}
      />

      <ReportModal
        isOpen={reportModalOpen}
        sessionId={selectedReportSession?.sessionId || ""}
        target={{
          id: selectedReportSession?.patientId || "",
          name: selectedReportSession?.patientName || "",
          role: "patient",
        }}
        reporter={{
          id: currentDoctorData.id,
          name: currentDoctorData.name,
          role: "doctor",
        }}
        onClose={handleCloseReportModal}
        onConfirm={handleSubmitReport}
      />

      <ReviewModal
        isOpen={reviewModalOpen}
        sessionId={selectedReviewSession?.sessionId || ""}
        patientName={selectedReviewSession?.patientName || ""}
        patientAvatarUrl={selectedReviewSession?.patientAvatarUrl}
        rating={selectedReviewSession?.patientRating}
        review={selectedReviewSession?.patientReview}
        endedAt={selectedReviewSession?.endedAt}
        onClose={handleCloseReviewModal}
      />

      <ChatWindow
        // sessionStatus={}
        sessionId={selectedChatSession?.sessionId || ""}
        isOpen={isChatOpen}
        patientName={selectedChatSession?.patientName || ""}
        patientUrl={selectedChatSession?.patientUrl}
        patientIsOnline={selectedChatSession?.patientIsOnline || false}
        onLoadMessages={handleLoadMessages}
        onClose={handleCloseChatWindow}
        onViewProfile={handleChatViewProfile}
        onReport={handleChatReport}
        onEndConsultation={handleChatEndConsultation}
        onSend={handleChatSend}
        chatPaneClassName="max-w-[calc(100%-850px)] min-w-[320px]"
        healthProfileClassName="w-[850px] min-w-[850px]"
      />
    </div>
  );
}
