"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import {
  ActionCard,
  type ActionCardItem,
} from "@repo/ui/components/ui/action-card";
import { Bot, Eye, Flag, MoreVertical, UserStar, X } from "lucide-react";
import { Message, type ChatMessage } from "../components/message";
import { SendBar } from "../components/send-bar";
import { HealthProfile } from "./health-profile";

type SessionStatus = "pending" | "rejected" | "completed" | "active";

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
  doctorName?: string;
  doctorUrl?: string;
  doctorIsOnline?: boolean;
  aiName?: string;
  initialMessages?: ChatMessage[];
  sessionStatus?: SessionStatus;
  onLoadMessages?: (sessionId: string) => Promise<ChatMessage[]>;
  onClose: () => void;
  onViewProfile?: () => void;
  onReport?: () => void;
  onReview?: () => void;
  onEndConsultation?: () => void;
  onSend?: (content: string) => void;
  usePortal?: boolean;
  chatPaneClassName?: string;
  healthProfileClassName?: string;
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    sender: "patient",
    content:
      "Good morning, Doctor. I've been having this persistent headache on the left side for about 3 days now. It gets worse when I'm in bright light.",
    time: "09:08 AM",
  },
  {
    id: "msg-2",
    sender: "patient",
    content:
      "I also have mild nausea, especially in the mornings. I haven't taken any medication yet because I wanted to consult first.",
    time: "09:09 AM",
  },
  {
    id: "msg-3",
    sender: "doctor",
    content:
      "Good morning, Sarah. Thank you for reaching out before self-medicating. Let's look into this together.",
    time: "09:11 AM",
  },
  {
    id: "msg-4",
    sender: "doctor",
    content:
      "The symptoms you describe - unilateral headache worsened by light along with nausea - are classic indicators of a migraine episode. How would you rate the pain on a scale of 1 to 10?",
    time: "09:12 AM",
  },
  {
    id: "msg-5",
    sender: "patient",
    content:
      "I'd say around a 6 or 7. It's really affecting my ability to work. I've had migraines before but this one feels stronger.",
    time: "09:14 AM",
  },
  {
    id: "msg-6",
    sender: "doctor",
    content:
      "I understand, that sounds quite disruptive. Given your history of migraines and the current intensity, I'm going to recommend a short course of Sumatriptan. Are you currently taking any other medications?",
    time: "09:16 AM",
  },
  {
    id: "msg-7",
    sender: "patient",
    content:
      "Just a daily antihistamine for seasonal allergies. Nothing else at the moment.",
    time: "09:17 AM",
  },
  {
    id: "msg-8",
    sender: "doctor",
    content:
      "Good. Antihistamines don't interact with Sumatriptan so that's safe. I'll also recommend resting in a dark, quiet room and staying well hydrated. Avoid screens as much as possible for the next 24 hours.",
    time: "09:18 AM",
  },
];

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
  usePortal = true,
  chatPaneClassName,
  healthProfileClassName,
}: ChatWindowProps) {
  const [showActions, setShowActions] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages ?? DEFAULT_MESSAGES,
  );
  const [isMounted, setIsMounted] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const isRequestStatus =
    sessionStatus === "pending" || sessionStatus === "rejected";
  const canViewProfileSelect = !isAiChat;
  const canEndConsultation =
    !isAiChat && viewerRole === "doctor" && !isRequestStatus;
  const canViewHealthProfile =
    !isAiChat && viewerRole === "doctor" && sessionStatus === "active";
  const canLeaveReview =
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

  /* eslint-disable */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setMessages(initialMessages ?? DEFAULT_MESSAGES);
  }, [initialMessages, sessionId]);

  useEffect(() => {
    if (!isOpen || !sessionId || !onLoadMessages) return;

    let isCancelled = false;
    setIsLoadingMessages(true);

    onLoadMessages(sessionId)
      .then((loadedMessages) => {
        if (isCancelled) return;
        setMessages(loadedMessages);
      })
      .catch(() => {
        if (isCancelled) return;
        // TODO: Show a dedicated error state when backend integration is done.
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoadingMessages(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, onLoadMessages, sessionId]);
  /* eslint-enable */

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
    [canLeaveReview, canViewProfileSelect, onReport, onReview, onViewProfile],
  );

  const handleSend = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const nextMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: viewerRole,
      content: trimmed,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, nextMessage]);
    onSend?.(trimmed);
  };

  if (!isOpen || !isMounted) return null;

  const chatContent = (
    <section
      className="flex h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className={cn("flex min-w-0 flex-1 flex-col", chatPaneClassName)}>
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

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {isRequestStatus ? (
          statusPanel
        ) : (
          <div className="flex-1 overflow-y-auto bg-white px-5 py-5">
            <div className="mx-auto mb-6 flex max-w-215 items-center gap-3">
              {/* <div className="h-px flex-1 bg-slate-200" />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400">
            Today
          </span>
          <div className="h-px flex-1 bg-slate-200" /> */}
            </div>

            <div className="mx-auto flex w-full flex-col gap-3">
              {isLoadingMessages && (
                <p className="text-sm text-slate-400">Loading messages...</p>
              )}
              {messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  viewerRole={viewerRole}
                  patientName={patientName}
                  patientUrl={patientUrl}
                  patientIsOnline={patientIsOnline}
                  doctorName={doctorName}
                  doctorUrl={doctorUrl}
                  doctorIsOnline={doctorIsOnline}
                  aiName={aiName}
                />
              ))}
            </div>
          </div>
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
          patientId={patientId || sessionId}
          patientName={patientName}
          className={healthProfileClassName}
          birthday={patientBirthday}
          gender={patientGender}
        />
      )}
    </section>
  );

  if (!usePortal) {
    return chatContent;
  }

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
