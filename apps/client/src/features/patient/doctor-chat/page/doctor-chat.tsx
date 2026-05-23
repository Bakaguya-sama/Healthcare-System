import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SessionCard } from "../components/session-card";
import { ChatWindow } from "@/features/chat/window/chat-window";
import type { ChatMessage } from "@/features/chat/components/message";
import type { SendMessagePayload } from "@/features/chat/components/send-bar";
import { ProfileModal } from "@repo/ui/components/complex-modal/ProfileModal";
import {
  ReportModal,
  type ReportActor,
  type ReportType,
} from "@repo/ui/components/complex-modal/ReportModal";
import {
  DoctorReviewModal,
  type ReviewFormPayload,
} from "../components/doctor-review-modal";
import { DoctorNoteModal } from "../components/doctor-note-modal";
import { useConsultations } from "../hooks/useConsultations";
import { type MessageApiResponse } from "../services/doctor-chat.service";
import { useSessionChat } from "../hooks/useDoctorChat";
import { showToast } from "@repo/ui/components/ui/toasts";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import { usePresenceStatus } from "@/features/shared/hooks/usePresenceStatus";
import { useReport } from "@/features/shared/hooks/useReport";
import { useViewProfile } from "@/features/shared/hooks/useProfile";
import { useReview } from "../hooks/useReview";

type FilterKey = "all" | "pending" | "completed";

export function DoctorChat() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [isDoctorNoteModalOpen, setDoctorNoteModalOpen] = useState(false);

  const { data: consultations, error: consultationError } = useConsultations();

  const doctorIds = (consultations || [])
    .map((c) => c.doctorId._id)
    .filter(Boolean) as string[];
  const { onlineIds: doctorOnlineIds } = usePresenceStatus(doctorIds, true);

  const {
    messages,
    isLoading: messageLoading,
    isSending,
    error: chatError,
    refresh,
    sendMessage,
  } = useSessionChat(selectedSessionId ?? undefined);

  const {
    isLoading: reportLoading,
    submitReport,
    error: reportError,
  } = useReport();

  const {
    isLoading: isSubmittingReview,
    submitDoctorReview: submitReview,
    error: reviewError,
  } = useReview();

  const me = useAuthStore();

  const currentPatientData = {
    id: me.user?.id ?? "",
    name: me.user?.name ?? "",
  };

  const consultationItems = useMemo(
    () =>
      (consultations || []).map((c) => ({
        sessionId: c.id,
        doctorId: c.doctorId._id,
        doctorName: c.doctorId.fullName,
        doctorAvatarUrl: c.doctorId.avatarUrl,
        doctorIsOnline: doctorOnlineIds.has(c.doctorId._id),
        isOnline: doctorOnlineIds.has(c.doctorId._id),
        patientRating: c.review?.rating,
        patientReview: c.review?.comment,
        doctorSpecialty: c.doctorId?.specialty,
        sessionStatus: c.status as "completed" | "rejected",
        endedAt: c.endedAt ? new Date(c.endedAt) : undefined,
        updatedAt: new Date(c.updatedAt || 0),
        patientNote: c.patientNotes,
        doctorNote: c.doctorNotes,
        status: c.status,
      })),
    [consultations, doctorOnlineIds],
  );

  const profileDoctorId = selectedSessionId
    ? consultationItems.find((c) => c.sessionId === selectedSessionId)?.doctorId
    : null;

  const shouldFetchProfile = isProfileModalOpen;
  const { data: profileData } = useViewProfile(
    profileDoctorId || "",
    shouldFetchProfile,
  );

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

  useEffect(() => {
    if (!reportError) return;
    showToast.error(String(reportError));
  }, [reportError]);

  useEffect(() => {
    if (!reviewError) return;
    showToast.error(String(reviewError));
  }, [reviewError]);

  useEffect(() => {
    if (consultationError) {
      showToast.error(`Failed to load consultations: ${consultationError}`);
    }
  }, [consultationError]);

  const selectedSession = consultationItems.find(
    (consultation) => consultation.sessionId === selectedSessionId,
  );

  const filteredConsultations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return consultationItems
      .filter((session) => {
        const statusMatched =
          statusFilter === "all"
            ? true
            : statusFilter === "completed"
              ? session.status === "completed" || session.status === "rejected"
              : session.status === statusFilter;

        const queryMatched =
          normalizedQuery.length === 0 ||
          session.doctorName.toLowerCase().includes(normalizedQuery);

        return statusMatched && queryMatched;
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [searchQuery, consultationItems, statusFilter]);

  const counts = useMemo(
    () => ({
      all: consultationItems.length,
      pending: consultationItems.filter(
        (session) => session.status === "pending",
      ).length,
      completed: consultationItems.filter(
        (session) =>
          session.status === "completed" || session.status === "rejected",
      ).length,
    }),
    [consultationItems],
  );

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

  const handleChatSend = async (payload: SendMessagePayload) => {
    if (!selectedSessionId) return;
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

  const tabs: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.all },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "completed", label: "Ended", count: counts.completed },
  ];

  const handleOpenProfileModal = () => {
    if (!selectedSession) return;
    setProfileModalOpen(true);
  };

  const handleCloseProfileModal = () => {
    setProfileModalOpen(false);
  };

  const handleOpenReportModal = () => {
    if (!selectedSession) return;
    setReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    setReportModalOpen(false);
  };

  const handleSubmitReport = async (payload: {
    target: ReportActor;
    reporter: ReportActor;
    reportType: ReportType;
    reason: string;
  }) => {
    try {
      const reportedUserId = selectedSession?.doctorId || payload.target.id;

      if (!reportedUserId) {
        throw new Error("Unable to determine who to report.");
      }

      await submitReport({
        reportedUserId,
        reportType: payload.reportType,
        reason: payload.reason,
      });

      setReportModalOpen(false);
      showToast.success("Report submitted successfully.");
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : "Failed to submit report.",
      );
      throw error;
    }
  };

  const handleOpenReviewModal = () => {
    if (!selectedSession || selectedSession.sessionStatus !== "completed")
      return;
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async (payload: ReviewFormPayload) => {
    if (!selectedSession) return;
    try {
      await submitReview({
        rating: payload.rate,
        comment: payload.comment.trim(),
        doctorId: selectedSession.doctorId,
        doctorSessionId: selectedSession.sessionId,
      });
      showToast.success("Review submitted successfully.");
      setReviewModalOpen(false);
    } catch (error) {
      showToast.error(
        error instanceof Error
          ? error.message
          : "Failed to submit review. Please try again.",
      );
    }
  };

  const handleCloseReviewModal = () => {
    setReviewModalOpen(false);
  };

  const handleCloseDoctorNoteModal = () => {
    setDoctorNoteModalOpen(false);
  };

  return (
    <section className="relative h-full w-full overflow-hidden bg-slate-100 p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(163,230,53,0.12),transparent_35%)]" />

      <div className="relative flex h-full gap-6">
        <aside className="flex h-full w-90 shrink-0 flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-[0_22px_50px_rgba(15,23,42,0.12)] ring-1 ring-white/80 backdrop-blur-sm">
          <div className="bg-linear-to-b from-brand-light/25 via-white to-white px-4 pt-6">
            <h1 className="text-3xl font-semibold text-slate-900">
              Recent Consultations
            </h1>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search consultations..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-700 outline-none ring-brand/20 transition focus:ring-2"
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 pb-2">
              {tabs.map((tab) => {
                const isActiveTab = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                      isActiveTab
                        ? "bg-brand-light text-brand"
                        : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                        isActiveTab
                          ? "bg-white/80 text-brand"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-white px-3 py-4">
            {filteredConsultations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No sessions match your current filter.
              </div>
            ) : (
              filteredConsultations.map((session) => (
                <SessionCard
                  key={session.sessionId}
                  id={session.sessionId}
                  status={session.status}
                  isSelected={selectedSessionId === session.sessionId}
                  updatedAt={session.updatedAt}
                  doctorName={session.doctorName}
                  doctorIsActive={session.doctorIsOnline}
                  doctorSpecialty={session.doctorSpecialty}
                  doctorAvatarUrl={session.doctorAvatarUrl}
                  onClick={() => setSelectedSessionId(session.sessionId)}
                />
              ))
            )}
          </div>
        </aside>

        {selectedSession && (
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.12)] ring-1 ring-white/80">
            <ChatWindow
              key={selectedSession.sessionId}
              sessionId={selectedSession.sessionId}
              patientId={currentPatientData.id}
              isOpen={true}
              viewerRole="patient"
              sessionStatus={selectedSession.sessionStatus}
              patientName={currentPatientData.name}
              patientIsOnline={true}
              doctorName={selectedSession.doctorName}
              doctorUrl={selectedSession.doctorAvatarUrl}
              doctorIsOnline={selectedSession.isOnline ?? false}
              initialMessages={messages.map(mapMessage)}
              onLoadMessages={handleLoadMessages}
              onViewProfile={handleOpenProfileModal}
              onReport={handleOpenReportModal}
              onReview={handleOpenReviewModal}
              onClose={() => setSelectedSessionId(null)}
              onViewDoctorNote={() => setDoctorNoteModalOpen(true)}
              usePortal={false}
              onSend={handleChatSend}
            />
          </div>
        )}
      </div>

      <ProfileModal
        id={selectedSession?.doctorId || ""}
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
        profileSeed={profileData ? profileData : undefined}
        reportViewer={{
          id: currentPatientData.id,
          name: currentPatientData.name,
          role: "patient",
        }}
        onSubmitReport={handleSubmitReport}
      />

      {selectedSession && (
        <>
          <ReportModal
            isOpen={isReportModalOpen}
            target={{
              id: selectedSession.doctorId,
              name: selectedSession.doctorName,
              role: "doctor",
            }}
            reporter={{
              id: currentPatientData.id,
              name: currentPatientData.name,
              role: "patient",
            }}
            onClose={handleCloseReportModal}
            onConfirm={handleSubmitReport}
            isLoading={reportLoading}
          />
          <DoctorReviewModal
            isOpen={isReviewModalOpen}
            doctorName={selectedSession.doctorName}
            doctorAvatarUrl={selectedSession.doctorAvatarUrl}
            doctorIsOnline={selectedSession.isOnline ?? false}
            isLoading={isSubmittingReview}
            onClose={handleCloseReviewModal}
            onSubmit={handleSubmitReview}
          />
          <DoctorNoteModal
            doctorName={selectedSession.doctorName}
            doctorAvatarUrl={selectedSession.doctorAvatarUrl}
            doctorIsOnline={selectedSession.isOnline ?? false}
            doctorNote={selectedSession.doctorNote}
            isOpen={isDoctorNoteModalOpen}
            onClose={handleCloseDoctorNoteModal}
          />
        </>
      )}
    </section>
  );
}
