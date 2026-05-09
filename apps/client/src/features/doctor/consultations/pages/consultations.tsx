import { PendingRequestCard } from "../components/pending-request-card";
import { ActiveSessionCard } from "../components/active-session-card";
import { ConsultationHistoryCard } from "../components/consultation-history-card";
import { ReviewModal } from "../components/review-modal";
import { useCallback, useEffect, useState } from "react";
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
import type { ChatMessage } from "@/features/chat/components/message";
import { useConsultations } from "../hooks/useConsultations";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import { useViewProfile } from "@/features/shared/hooks/useProfile";
import { useReport } from "@/features/shared/hooks/useReport";
import { useSessionChat } from "../hooks/useSessionChat";
import type { MessageApiResponse } from "../services/session-chat.service";

type TabSwitch = "pending-requests" | "active-sessions" | "history";

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
  patientNote?: string;
  doctorNote?: string;
  status?: string;
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
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(
    null,
  );
  const [processingAction, setProcessingAction] =
    useState<RequestAction | null>(null);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [endChatModalOpen, setEndChatModalOpen] = useState(false);
  const [selectedEndSession, setSelectedEndSession] = useState<{
    sessionId: string;
    patientName: string;
  } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReportSession, setSelectedReportSession] =
    useState<ReportTarget | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReviewSession, setSelectedReviewSession] = useState<{
    sessionId: string;
    patientName: string;
    patientAvatarUrl?: string;
    patientRating?: number;
    patientReview?: string;
    patientNote?: string;
    doctorNote?: string;
    status?: string;
    endedAt?: Date;
  } | null>(null);
  const [isChatOpen, setChatOpen] = useState(false);
  const [selectedChatSession, setSelectedChatSession] =
    useState<ChatTarget | null>(null);
  const me = useAuthStore();
  const profileUserId = selectedChatSession?.patientId || selectedUserId;
  const shouldFetchProfile = isProfileModalOpen || isChatOpen;
  const { data: profileData } = useViewProfile(
    profileUserId,
    shouldFetchProfile,
  );
  const { isLoading: reportLoading, submitReport } = useReport();

  const {
    data: consultations,
    isLoading,
    error,
    approve,
    reject,
    complete,
  } = useConsultations();

  const {
    messages,
    isLoading: messageLoading,
    isSending,
    error: chatError,
    refresh,
    sendMessage,
  } = useSessionChat(selectedChatSession?.sessionId);

  const currentDoctorData = {
    id: me.user?.id,
    name: me.user?.name,
  };
  const isPageLoading = isLoading || reportLoading;

  const mapMessage = useCallback((message: MessageApiResponse): ChatMessage => {
    const metadata = message as { id?: string; _id?: string };
    const messageId =
      metadata.id ||
      metadata._id ||
      `${message.doctorSessionId}-${message.sentAt}`;

    return {
      id: messageId,
      sender: message.senderType as ChatMessage["sender"],
      content: message.content,
      sentAt: message.sentAt,
      time: new Date(message.sentAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      attachments: message.attachments?.map((attachment, index) => {
        const isImage = attachment.mimeType?.startsWith("image/");
        return {
          id: `${messageId}-${index}`,
          type: isImage ? "image" : "file",
          name: attachment.fileName,
          mimeType: attachment.mimeType || "application/octet-stream",
          size: attachment.fileSize ?? 0,
          url: attachment.fileUrl,
          thumbnailUrl: isImage ? attachment.fileUrl : undefined,
        };
      }),
    };
  }, []);

  useEffect(() => {
    if (!chatError) return;
    showToast.error(chatError);
  }, [chatError]);

  const pendingRequests = (consultations || [])
    .filter((c) => c.status === "pending")
    .map((c) => ({
      id: c.id,
      patientName: c.patientId.fullName,
      patientUrl: c.patientId.avatarUrl,
      createdAt: new Date(c.createdAt),
      patientNote: c.patientNotes || "",
      status: c.status,
    }));

  const activeSessions = (consultations || [])
    .filter((c) => c.status === "active")
    .map((c) => ({
      sessionId: c.id,
      patientId: c.patientId._id,
      patientName: c.patientId.fullName,
      patientUrl: c.patientId.avatarUrl,
      patientIsOnline: false,
      lastSent: c.startedAt ? new Date(c.startedAt) : new Date(c.createdAt),
      patientNote: c.patientNotes,
      status: c.status,
    }));

  const historyItems = (consultations || [])
    .filter((c) => c.status === "completed" || c.status === "rejected")
    .map((c) => ({
      sessionId: c.id,
      patientId: c.patientId._id,
      patientName: c.patientId.fullName,
      patientAvatarUrl: c.patientId.avatarUrl,
      patientRating: c.review?.rating,
      patientReview: c.review?.comment,
      sessionStatus: c.status as "completed" | "rejected",
      endedAt: c.endedAt ? new Date(c.endedAt) : undefined,
      patientNote: c.patientNotes,
      doctorNote: c.doctorNotes,
      status: c.status,
    }));

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

  const handleEndChat = async ({
    sessionId,
    notes,
  }: {
    sessionId: string;
    notes: string;
  }) => {
    try {
      await complete(sessionId, notes);
      showToast.success(`Consultation ended and notes saved.`);
      handleCloseChatWindow();
    } catch {
      showToast.error("Failed to end consultation. Please try again.");
    }
  };

  const handleChatSend = async (payload: SendMessagePayload) => {
    if (!selectedChatSession) return;
    if (isSending || messageLoading) return;

    const text = payload.content?.trim() || "";
    const attachments = payload.attachments ?? [];
    const files = attachments
      .map((attachment) => attachment.file)
      .filter((file): file is File => Boolean(file));
    const attachmentCount = files.length;
    if (!text && attachmentCount === 0) return;

    const normalizedContent =
      text ||
      `[Attachment] ${attachmentCount} file${attachmentCount > 1 ? "s" : ""}`;

    try {
      const result = await sendMessage({
        content: normalizedContent,
        attachments: files,
      });
      if (!result) {
        showToast.error("Failed to send message.");
      }
    } catch {
      showToast.error("Failed to send message.");
    }
  };

  const handleLoadMessages = useCallback(
    async (sessionId: string, page: number) => {
      if (!sessionId) return { messages: [], totalPages: 1 };
      const data = await refresh(page);
      if (!data) return { messages: [], totalPages: 1 };
      return {
        messages: data.messages.map(mapMessage),
        totalPages: data.pagination.pages,
      };
    },
    [mapMessage, refresh],
  );

  const handleCloseProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedUserId(null);
  };

  //   Handle accept & decline here
  const handleRequestAction = async (
    action: RequestAction,
    requestId: string,
  ) => {
    if (processingRequestId) return;

    const targetRequest = pendingRequests.find(
      (request) => request.id === requestId,
    );
    if (!targetRequest) return;

    setProcessingRequestId(requestId);
    setProcessingAction(action);
    try {
      if (action === "accept") {
        await approve(requestId);
      } else {
        await reject(requestId);
      }

      showToast.success(
        action === "accept"
          ? `Accepted request from ${targetRequest.patientName}.`
          : `Declined request from ${targetRequest.patientName}.`,
      );
    } catch {
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
    console.log("patient", patientId);
    setSelectedUserId(patientId);
    setProfileModalOpen(true);
  };

  const handleEndConsultation = (sessionId: string) => {
    const session = activeSessions.find((s) => s.sessionId === sessionId);
    if (session) {
      setSelectedEndSession({
        sessionId: session.sessionId,
        patientName: session.patientName,
      });
      setEndChatModalOpen(true);
    }
  };

  const handleReportPatient = (sessionId: string) => {
    const session = activeSessions.find((s) => s.sessionId === sessionId);
    if (!session) return;

    setSelectedReportSession({
      sessionId: session.sessionId,
      patientId: session.patientId,
      patientName: session.patientName,
    });
    setReportModalOpen(true);
  };

  const handleReportFromHistory = (sessionId: string) => {
    const session = historyItems.find((item) => item.sessionId === sessionId);
    if (!session) return;

    setSelectedReportSession({
      sessionId: session.sessionId,
      patientId: session.patientId,
      patientName: session.patientName,
    });
    setReportModalOpen(true);
  };

  const handleSubmitReport = async (payload: {
    target: ReportActor;
    reporter: ReportActor;
    reportType: ReportType;
    reason: string;
  }) => {
    const reportedUserId =
      selectedReportSession?.patientId || payload.target.id;

    if (!reportedUserId) {
      showToast.error("Unable to determine who to report.");
      throw new Error("Unable to determine who to report.");
    }

    const response = await submitReport({
      reportedUserId,
      reportType: payload.reportType,
      reason: payload.reason,
    });

    if (!response) {
      showToast.error("Failed to submit report. Please try again.");
      throw new Error("Failed to submit report.");
    }

    handleCloseChatWindow();
    showToast.success("Report submitted successfully.");
  };

  const handleOpenReview = (sessionId: string) => {
    const session = historyItems.find((item) => item.sessionId === sessionId);
    if (!session) return;

    setSelectedReviewSession({
      sessionId: session.sessionId,
      patientName: session.patientName,
      patientAvatarUrl: session.patientAvatarUrl,
      patientRating: session.patientRating,
      patientReview: session.patientReview,
      patientNote: session.patientNote,
      doctorNote: session.doctorNote,
      endedAt: session.endedAt,
      status: session.status,
    });
    setReviewModalOpen(true);
  };

  const handleOpenChat = (sessionId: string) => {
    const activeSession = activeSessions.find(
      (session) => session.sessionId === sessionId,
    );

    if (activeSession) {
      setSelectedChatSession({
        sessionId: activeSession.sessionId,
        patientId: activeSession.patientId,
        patientName: activeSession.patientName,
        patientUrl: activeSession.patientUrl,
        patientIsOnline: activeSession.patientIsOnline,
        patientNote: activeSession.patientNote,
        status: activeSession.status,
      });
      setChatOpen(true);
      return;
    }

    const historySession = historyItems.find(
      (session) => session.sessionId === sessionId,
    );

    if (historySession) {
      setSelectedChatSession({
        sessionId: historySession.sessionId,
        patientId: historySession.patientId,
        patientName: historySession.patientName,
        patientUrl: historySession.patientAvatarUrl,
        patientIsOnline: false,
        patientNote: historySession.patientNote,
        doctorNote: historySession.doctorNote,
        status: historySession.status,
      });
      setChatOpen(true);
      return;
    }

    showToast.error("Could not open this chat session.");
  };

  const handleChatEndConsultation = () => {
    if (!selectedChatSession) return;

    const activeSession = activeSessions.find(
      (session) => session.sessionId === selectedChatSession.sessionId,
    );

    if (!activeSession) {
      showToast.error("This consultation is no longer active.");
      return;
    }

    handleEndConsultation(selectedChatSession.sessionId);
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

  const filteredRequests = pendingRequests
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

  const filteredHistory = historyItems
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
      {isPageLoading && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-white/75 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-lime-500" />
            <p className="text-sm font-medium text-slate-700">
              {reportLoading
                ? "Submitting report..."
                : "Loading consultations..."}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-slate-900">
            Patient Consultations
          </h1>
        </div>

        {/* Loading & Error States */}
        {isLoading && !reportLoading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-12">
            <div className="text-center">
              <div className="mb-3 inline-flex h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-lime-500"></div>
              <p className="text-slate-600">Loading consultations...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Error: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
            >
              Reload page
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <div className="rounded-2xl border border-slate-200 bg-slate-100">
            <div className="flex items-center gap-8 border-b border-slate-200 bg-white px-6 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("pending-requests")}
                className={`${getTabClass(activeTab === "pending-requests")} cursor-pointer`}
              >
                Pending Requests
                <span className=" inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[11px] font-semibold text-slate-900">
                  {pendingRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("active-sessions")}
                className={`${getTabClass(activeTab === "active-sessions")} cursor-pointer`}
              >
                Active Sessions
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-400 px-1 text-[11px] font-semibold text-slate-900">
                  {activeSessions.length}
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
                        patientAvatarUrl={item.patientUrl}
                        patientBirthDay={new Date()} // TODO: get from patient profile
                        patientGender="" // TODO: get from patient profile
                        patientNote={item.patientNote}
                        createdAt={item.createdAt}
                        onAccept={() => handleRequestAction("accept", item.id)}
                        onDecline={() =>
                          handleRequestAction("decline", item.id)
                        }
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
                      onChange={(e) =>
                        setActiveSessionSearchTerm(e.target.value)
                      }
                      type="text"
                      placeholder="Search by patient name..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-lime-500"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-1">
                  {activeSessions
                    .filter((session) => {
                      const keyword = activeSessionSearchTerm
                        .trim()
                        .toLowerCase();
                      if (!keyword) return true;
                      return session.patientName
                        .toLowerCase()
                        .includes(keyword);
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
                        onViewProfile={() =>
                          handleViewProfile(session.patientId)
                        }
                        onEndConsultation={() =>
                          handleEndConsultation(session.sessionId)
                        }
                        onReport={() => handleReportPatient(session.sessionId)}
                      />
                    ))}
                </div>

                {activeSessions.filter((session) => {
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
                  <div className="grid min-w-225 grid-cols-[2fr_3fr_2fr_1.2fr_1.2fr_0.8fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
                        onViewProfile={() =>
                          handleViewProfile(session.patientId)
                        }
                        onOpenReview={() => handleOpenReview(session.sessionId)}
                        onReport={() =>
                          handleReportFromHistory(session.sessionId)
                        }
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
        )}
      </div>
      <ProfileModal
        id={selectedUserId || ""}
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
        profileSeed={profileData ? profileData : undefined}
        reportViewer={{
          id: currentDoctorData.id,
          name: currentDoctorData.name,
          role: "doctor",
        }}
        onSubmitReport={handleSubmitReport}
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
        sessionId={selectedChatSession?.sessionId || ""}
        isOpen={isChatOpen}
        sessionStatus={selectedChatSession?.status}
        patientId={selectedChatSession?.patientId}
        patientName={selectedChatSession?.patientName || ""}
        patientUrl={selectedChatSession?.patientUrl}
        patientIsOnline={selectedChatSession?.patientIsOnline || false}
        patientBirthday={profileData?.date_of_birth}
        patientGender={profileData?.gender}
        patientNote={selectedChatSession?.patientNote}
        doctorNote={selectedChatSession?.doctorNote}
        doctorName={me.user?.name || ""}
        doctorUrl={me.user?.avatar || ""}
        initialMessages={messages.map(mapMessage)}
        onClose={handleCloseChatWindow}
        onViewProfile={handleChatViewProfile}
        onReport={handleChatReport}
        onEndConsultation={handleChatEndConsultation}
        onLoadMessages={handleLoadMessages}
        onSend={handleChatSend}
        chatPaneClassName="max-w-[calc(100%-850px)] min-w-[320px]"
        healthProfileClassName="w-[850px] min-w-[850px]"
      />
    </div>
  );
}
