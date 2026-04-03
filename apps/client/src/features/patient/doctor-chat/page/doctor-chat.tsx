import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SessionCard } from "../components/session-card";
import { ChatWindow } from "@/features/chat/window/chat-window";
import type { ChatMessage } from "@/features/chat/components/message";
import { ProfileModal } from "@repo/ui/components/complex-modal/ProfileModal";
import {
  ReportModal,
  type ReportActor,
  type ReportType,
} from "@repo/ui/components/complex-modal/ReportModal";
import {
  DoctorReviewModal,
  type DoctorReviewPayload,
} from "../components/doctor-review-modal";
import { DoctorNoteModal } from "../components/doctor-note-modal";

type SessionStatus = "pending" | "rejected" | "completed" | "active";

type DoctorSession = {
  id: string;
  doctorId: string;
  status: SessionStatus;
  updatedAt: Date;
  doctorName: string;
  doctorNote?: string;
  doctorIsActive: boolean;
  doctorSpecialty: string;
  doctorAvatarUrl?: string;
};

const MOCK_SESSIONS: DoctorSession[] = [
  {
    id: "doctor-session-1",
    doctorId: "doctor-001",
    status: "pending",
    updatedAt: new Date(),
    doctorName: "Dr. Marcus Lee",
    doctorIsActive: true,
    doctorSpecialty: "Cardiologist",
  },
  {
    id: "doctor-session-2",
    doctorId: "doctor-002",
    status: "completed",
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    doctorName: "Dr. Sarah Chen",
    doctorIsActive: false,
    doctorSpecialty: "Dermatologist",
  },
  {
    id: "doctor-session-3",
    doctorId: "doctor-003",
    status: "active",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    doctorName: "Dr. James Wilson",
    doctorIsActive: true,
    doctorSpecialty: "General Practitioner",
  },
  {
    id: "doctor-session-4",
    doctorId: "doctor-004",
    status: "rejected",
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    doctorName: "Dr. Emily Carter",
    doctorIsActive: false,
    doctorSpecialty: "Neurologist",
  },
];

type FilterKey = "all" | "pending" | "completed";

export function DoctorChat() {
  const [sessions] = useState(MOCK_SESSIONS);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    MOCK_SESSIONS[0]?.id ?? null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterKey>("all");
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [isDoctorNoteModalOpen, setDoctorNoteModalOpen] = useState(false);

  // TODO: Replace with global auth state (current logged-in patient data).
  const currentViewer: ReportActor = {
    id: "patient-demo-001",
    name: "Current Patient",
    role: "patient",
  };

  const selectedSession = sessions.find(
    (session) => session.id === selectedSessionId,
  );

  const filteredSessions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return sessions
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
  }, [searchQuery, sessions, statusFilter]);

  const counts = useMemo(
    () => ({
      all: sessions.length,
      pending: sessions.filter((session) => session.status === "pending")
        .length,
      completed: sessions.filter(
        (session) =>
          session.status === "completed" || session.status === "rejected",
      ).length,
    }),
    [sessions],
  );

  const handleLoadMessages = async (
    sessionId: string,
  ): Promise<ChatMessage[]> => {
    // TODO: call API by sessionId and return mapped ChatMessage[]
    console.log("Load doctor session messages:", sessionId);
    return [];
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

  const handleSubmitReport = (payload: {
    sessionId: string;
    target: ReportActor;
    reporter: ReportActor;
    reportType: ReportType;
    reason: string;
  }) => {
    const normalizedPayload = {
      ...payload,
      reason: payload.reason.trim(),
    };

    // TODO: call report API with payload
    console.log("Submit doctor chat report:", normalizedPayload);
    setReportModalOpen(false);
  };

  const handleOpenReviewModal = () => {
    if (!selectedSession || selectedSession.status !== "completed") return;
    setReviewModalOpen(true);
  };

  const handleSubmitReview = (payload: DoctorReviewPayload) => {
    if (!selectedSession) return;

    const normalizedPayload = {
      rate: payload.rate,
      comment: payload.comment.trim(),
      doctorId: payload.doctorId,
      patientId: payload.patientId,
      sessionId: payload.sessionId,
    };

    // TODO: call review API with normalizedPayload
    console.log("Submit doctor review:", normalizedPayload);
    setReviewModalOpen(false);
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
            {filteredSessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No sessions match your current filter.
              </div>
            ) : (
              filteredSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  id={session.id}
                  status={session.status}
                  isSelected={selectedSessionId === session.id}
                  updatedAt={session.updatedAt}
                  doctorName={session.doctorName}
                  doctorIsActive={session.doctorIsActive}
                  doctorSpecialty={session.doctorSpecialty}
                  doctorAvatarUrl={session.doctorAvatarUrl}
                  onClick={() => setSelectedSessionId(session.id)}
                />
              ))
            )}
          </div>
        </aside>

        {selectedSession && (
          <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_50px_rgba(15,23,42,0.12)] ring-1 ring-white/80">
            <ChatWindow
              key={selectedSession.id}
              sessionId={selectedSession.id}
              patientId="current-patient"
              isOpen={true}
              viewerRole="patient"
              sessionStatus={selectedSession.status}
              patientName={selectedSession.doctorName}
              patientIsOnline={selectedSession.doctorIsActive}
              onLoadMessages={handleLoadMessages}
              onViewProfile={handleOpenProfileModal}
              onReport={handleOpenReportModal}
              onReview={handleOpenReviewModal}
              onClose={() => setSelectedSessionId(null)}
              onViewDoctorNote={() => setDoctorNoteModalOpen(true)}
              usePortal={false}
            />
          </div>
        )}
      </div>

      <ProfileModal
        id={selectedSession?.doctorId || ""}
        isOpen={isProfileModalOpen}
        onClose={handleCloseProfileModal}
        profileSeed={
          selectedSession
            ? {
                id: selectedSession.doctorId,
                full_name: selectedSession.doctorName,
                role: "doctor",
                avatar_url: selectedSession.doctorAvatarUrl,
              }
            : undefined
        }
        reportViewer={currentViewer}
      />

      {selectedSession && (
        <>
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={handleCloseReportModal}
            onConfirm={handleSubmitReport}
            sessionId={selectedSession.id}
            target={{
              id: selectedSession.doctorId,
              name: selectedSession.doctorName,
              role: "doctor",
            }}
            reporter={currentViewer}
          />
          <DoctorReviewModal
            isOpen={isReviewModalOpen}
            doctorId={selectedSession.doctorId}
            patientId={currentViewer.id}
            sessionId={selectedSession.id}
            doctorName={selectedSession.doctorName}
            doctorAvatarUrl={selectedSession.doctorAvatarUrl}
            doctorIsOnline={selectedSession.doctorIsActive}
            onClose={handleCloseReviewModal}
            onSubmit={handleSubmitReview}
          />
          <DoctorNoteModal
            doctorName={selectedSession.doctorName}
            doctorAvatarUrl={selectedSession.doctorAvatarUrl}
            doctorIsOnline={selectedSession.doctorIsActive}
            doctorNote={selectedSession.doctorNote}
            isOpen={isDoctorNoteModalOpen}
            onClose={handleCloseDoctorNoteModal}
          />
        </>
      )}
    </section>
  );
}
