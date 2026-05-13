"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import {
  ActionCard,
  type ActionCardItem,
} from "@repo/ui/components/ui/action-card";
import {
  Bot,
  Eye,
  Flag,
  MoreVertical,
  NotebookPenIcon,
  UserStar,
  X,
} from "lucide-react";
import { Message, type ChatMessage } from "../components/message";
import { SendBar, type SendMessagePayload } from "../components/send-bar";
import { HealthProfile } from "./health-profile";

type ChatListItem =
  | { type: "date"; key: string; label: string }
  | { type: "message"; key: string; message: ChatMessage };

function formatChatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getChatDateKey(message: ChatMessage): string | null {
  if (!message.sentAt) return null;

  const date = new Date(message.sentAt);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

interface ChatWindowProps {
  isAiChat?: boolean;
  sessionId: string;
  patientId?: string;
  isOpen: boolean;
  viewerRole?: "doctor" | "patient";
  patientName?: string;
  patientUrl?: string;
  patientIsOnline?: boolean;
  patientBirthday?: Date | string;
  patientGender?: string;
  patientNote?: string;
  doctorNote?: string;
  doctorName?: string;
  doctorUrl?: string;
  doctorIsOnline?: boolean;
  aiName?: string;
  initialMessages?: ChatMessage[];
  sessionStatus?: string;
  onLoadMessages?: (
    sessionId: string,
    page: number,
  ) => Promise<{ messages: ChatMessage[]; totalPages: number }>;
  onClose: () => void;
  onViewProfile?: () => void;
  onReport?: () => void;
  onReview?: () => void;
  onEndConsultation?: () => void;
  onSend?: (payload: SendMessagePayload) => void;
  onViewDoctorNote?: () => void;
  usePortal?: boolean;
  chatPaneClassName?: string;
  healthProfileClassName?: string;
}

export function ChatWindow({
  isAiChat = false,
  sessionId,
  patientId,
  onClose,
  isOpen,
  sessionStatus = "active",
  viewerRole = "doctor",
  patientName = "Sarah Mitchell",
  patientUrl,
  patientIsOnline = true,
  patientBirthday,
  patientGender,
  patientNote,
  doctorNote,
  doctorName = "Dr. Marcus Lee",
  doctorUrl,
  doctorIsOnline = true,
  aiName = "MedBot",
  initialMessages,
  onLoadMessages,
  onViewProfile,
  onReport,
  onReview,
  onEndConsultation,
  onSend,
  onViewDoctorNote,
  usePortal = true,
  chatPaneClassName,
  healthProfileClassName,
}: ChatWindowProps) {
  const [showActions, setShowActions] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages ?? [],
  );
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const pendingScrollRestoreRef = useRef(false);
  const previousScrollHeightRef = useRef(0);
  const isFirstMessageRenderRef = useRef(true);
  const forceScrollToBottomRef = useRef(false);
  const [showScrollToBottomButton, setShowScrollToBottomButton] =
    useState(false);
  const canUsePortal = typeof document !== "undefined";

  const isRequestStatus =
    sessionStatus === "pending" || sessionStatus === "rejected";
  const canViewProfileSelect = !isAiChat;
  const canEndConsultation =
    !isAiChat && viewerRole === "doctor" && !isRequestStatus;
  const canViewHealthProfile =
    !isAiChat && viewerRole === "doctor" && sessionStatus !== "rejected";
  const canLeaveReview =
    !isAiChat && viewerRole === "patient" && sessionStatus === "completed";
  const canViewDoctorNote =
    !isAiChat && viewerRole === "patient" && sessionStatus === "completed";

  const statusPanel = (
    <section className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="mx-auto flex max-w-130 flex-col items-center text-center">
          <div
            className={`mb-8 flex h-28 w-28 items-center justify-center rounded-full border ${
              sessionStatus === "pending"
                ? "border-amber-200 bg-amber-50"
                : "border-rose-200 bg-rose-50"
            }`}
          >
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full border ${
                sessionStatus === "pending"
                  ? "border-amber-300 bg-amber-100"
                  : "border-rose-300 bg-rose-100"
              }`}
            >
              <span
                className={`text-3xl ${
                  sessionStatus === "pending"
                    ? "text-amber-600"
                    : "text-rose-500"
                }`}
              >
                {sessionStatus === "pending" ? "⌛" : "!"}
              </span>
            </div>
          </div>

          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
            {sessionStatus === "pending"
              ? "Request Sent Successfully"
              : "Request Rejected"}
          </h3>

          <p className="mt-4 max-w-105 text-base leading-7 text-slate-500">
            {sessionStatus === "pending"
              ? `Waiting for ${doctorName} to review and accept your consultation request. You'll be notified as soon as they respond.`
              : `Your consultation request was rejected. You can try sending a new request or contact another doctor.`}
          </p>
        </div>
      </div>
    </section>
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMessages(initialMessages ?? []);
  }, [initialMessages]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setTotalPages(0);
    shouldAutoScrollRef.current = true;
    isFirstMessageRenderRef.current = true;
    setShowScrollToBottomButton(false);
  }, [sessionId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useLayoutEffect(() => {
    if (!isOpen || !scrollRef.current) return;

    const container = scrollRef.current;

    const isLoadMore = pendingScrollRestoreRef.current;
    const isInitialLoad =
      isFirstMessageRenderRef.current && messages.length > 0;
    const shouldForceScroll = forceScrollToBottomRef.current;

    requestAnimationFrame(() => {
      if (isLoadMore) {
        container.scrollTop =
          container.scrollHeight - previousScrollHeightRef.current;
        pendingScrollRestoreRef.current = false;
        setShowScrollToBottomButton(true);
      } else if (shouldForceScroll) {
        container.scrollTop = container.scrollHeight;
        forceScrollToBottomRef.current = false;
        setShowScrollToBottomButton(false);
      } else if (isInitialLoad) {
        container.scrollTop = container.scrollHeight;
        setShowScrollToBottomButton(false);
        isFirstMessageRenderRef.current = false;
      } else {
        const isCurrentlyAtBottom =
          container.scrollHeight - container.scrollTop <=
          container.clientHeight + 10;
        if (shouldAutoScrollRef.current || isCurrentlyAtBottom) {
          container.scrollTop = container.scrollHeight;
          setShowScrollToBottomButton(false);
        } else {
          setShowScrollToBottomButton(true);
        }
      }
    });
  }, [isOpen, messages]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const bottomOffset =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isAtBottom = bottomOffset <= 10;

    shouldAutoScrollRef.current = isAtBottom;
    setShowScrollToBottomButton(!isAtBottom);

    if (
      onLoadMessages &&
      !isLoadingMessages &&
      hasMore &&
      container.scrollTop <= 0
    ) {
      if (totalPages !== 0 && page >= totalPages) {
        setHasMore(false);
        return;
      }
      previousScrollHeightRef.current = scrollRef.current.scrollHeight;
      pendingScrollRestoreRef.current = true;
      const nextPage = page + 1;
      setIsLoadingMessages(true);
      onLoadMessages(sessionId, nextPage)
        .then((result) => {
          if (!result.messages.length) {
            setHasMore(false);
            return;
          }
          setMessages((prev) => [...result.messages, ...prev]);
          setPage(nextPage);
          setTotalPages(result.totalPages || totalPages);
          setHasMore(nextPage < (result.totalPages || totalPages));
        })
        .finally(() => {
          setIsLoadingMessages(false);
        });
    }
  };

  const actions: ActionCardItem[] = useMemo(
    () => [
      ...(canViewProfileSelect
        ? [
            {
              id: "chat-view-profile",
              title: "View profile",
              icon: <Eye className="h-4 w-4" />,
              onHandle: () => {
                onViewProfile?.();
                setShowActions(false);
              },
            },
          ]
        : []),
      {
        id: "chat-report",
        title: "Report",
        icon: <Flag className="h-4 w-4" />,
        iconColor: "text-red-600",
        onHandle: () => {
          onReport?.();
          setShowActions(false);
        },
      },
      ...(canViewDoctorNote && onViewDoctorNote
        ? [
            {
              id: "doctor-note",
              title: "Doctor note",
              icon: <NotebookPenIcon className="h-4 w-4" />,
              iconColor: "text-brand",
              onHandle: () => {
                onViewDoctorNote?.();
                setShowActions(false);
              },
            },
          ]
        : []),
      ...(canLeaveReview && onReview
        ? [
            {
              id: "chat-review",
              title: "Review",
              icon: <UserStar className="h-4 w-4" />,
              iconColor: "text-yellow-600",
              onHandle: () => {
                onReview();
                setShowActions(false);
              },
            },
          ]
        : []),
    ],
    [
      canLeaveReview,
      canViewProfileSelect,
      canViewDoctorNote,
      onViewDoctorNote,
      onReport,
      onReview,
      onViewProfile,
    ],
  );

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setShowScrollToBottomButton(false);
      shouldAutoScrollRef.current = true;
    }
  };

  const renderedMessages = useMemo<ChatListItem[]>(() => {
    const items: ChatListItem[] = [];
    const seenDateKeys = new Set<string>();

    messages.forEach((message, index) => {
      const dateKey = getChatDateKey(message);
      if (dateKey && !seenDateKeys.has(dateKey)) {
        seenDateKeys.add(dateKey);
        items.push({
          type: "date",
          key: `date-${dateKey}-${index}`,
          label: formatChatDate(message.sentAt ?? message.time),
        });
      }

      items.push({
        type: "message",
        key: `${message.id}-${items.length}`,
        message,
      });
    });

    return items;
  }, [messages]);

  const handleSend = (payload: SendMessagePayload) => {
    const trimmed = payload.content?.trim() || "";
    const hasAttachments = Boolean(payload.attachments?.length);
    if (!trimmed && !hasAttachments) return;

    shouldAutoScrollRef.current = true;
    forceScrollToBottomRef.current = true;
    setShowScrollToBottomButton(false);

    const nextMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: viewerRole,
      content: trimmed || undefined,
      attachments: payload.attachments,
      sentAt: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, nextMessage]);
    onSend?.(payload);
  };

  if (!isOpen) return null;

  const chatContent = (
    <section
      className="relative flex h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {canViewHealthProfile && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      <div
        className={cn(
          "relative flex min-w-0 flex-1 flex-col",
          chatPaneClassName,
        )}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {!isAiChat ? (
              <>
                <UserAvatar
                  name={patientName}
                  url={patientUrl}
                  isOnline={patientIsOnline}
                  avtStyle="h-11 w-11 rounded-full"
                />
                <h2 className="truncate text-2xl font-semibold text-slate-900">
                  {patientName}
                </h2>
              </>
            ) : (
              <>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ai/20 bg-ai-light text-ai">
                  <Bot className="h-5 w-5" />
                </span>
                <h2 className="truncate text-2xl font-semibold text-slate-900">
                  AI Chatbot
                </h2>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {
              <button
                type="button"
                onClick={() => setShowActions((prev) => !prev)}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
              >
                <MoreVertical className="h-5 w-5" />
                {showActions && (
                  <ActionCard
                    actions={actions}
                    onClickOutside={() => setShowActions(false)}
                    className="top-10"
                  />
                )}
              </button>
            }

            {canEndConsultation && (
              <button
                type="button"
                onClick={onEndConsultation}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-base font-semibold text-rose-500 transition-colors hover:bg-rose-50"
              >
                <X className="h-4 w-4" />
                End Consultation
              </button>
            )}

            {!canViewHealthProfile && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {isRequestStatus ? (
          statusPanel
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto bg-white px-5 py-5"
            >
              <div className="mx-auto mb-6 flex max-w-215 items-center gap-3"></div>

              <div className="mx-auto flex w-full flex-col gap-3">
                {isLoadingMessages && (
                  <p className="text-sm text-center text-slate-400">
                    Loading...
                  </p>
                )}
                {renderedMessages.map((item) =>
                  item.type === "date" ? (
                    <div key={item.key} className="flex justify-center py-2">
                      <span className="rounded-full bg-slate-300 px-4 py-1 text-xs font-medium text-white shadow-sm">
                        {item.label}
                      </span>
                    </div>
                  ) : (
                    <Message
                      key={item.key}
                      message={item.message}
                      viewerRole={viewerRole}
                      patientName={patientName}
                      patientUrl={patientUrl}
                      patientIsOnline={patientIsOnline}
                      doctorName={doctorName}
                      doctorUrl={doctorUrl}
                      doctorIsOnline={doctorIsOnline}
                      aiName={aiName}
                    />
                  ),
                )}
              </div>
            </div>

            {showScrollToBottomButton && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-24 left-1/2 z-20 inline-flex w-auto -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg transition-colors hover:bg-slate-50"
              >
                <span className="text-base leading-none">↓</span>
                Latest message
              </button>
            )}
          </>
        )}

        {!isRequestStatus && (
          <SendBar
            isDisabled={sessionStatus === "completed"}
            onSend={handleSend}
          />
        )}
      </div>

      {canViewHealthProfile && (
        <HealthProfile
          patientNote={patientNote}
          doctorNote={doctorNote}
          patientId={patientId || ""}
          patientName={patientName}
          className={healthProfileClassName}
          birthday={patientBirthday}
          gender={patientGender}
          showMetrics={sessionStatus === "active"}
        />
      )}
    </section>
  );

  if (!usePortal) {
    return chatContent;
  }

  if (!canUsePortal) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-100 bg-slate-900/20 p-3 sm:p-6"
      onClick={onClose}
    >
      {chatContent}
    </div>,
    document.body,
  );
}
