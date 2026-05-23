import { useEffect, useMemo, useState, useCallback } from "react";
import { presenceSocket } from "@/lib/api";
import { getOnlineUsers } from "@/features/shared/services/presence-service";

type PresenceChangePayload = {
  userId: string;
  status: "online" | "offline";
};

export function usePresenceStatus(
  userIds: string[],
  enabled = true,
): {
  onlineIds: Set<string>;
  refresh: () => Promise<void>;
} {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());

  const idsKey = (userIds || []).filter(Boolean).join(",");
  const normalizedUserIds = useMemo(
    () => (idsKey ? idsKey.split(",") : []),
    [idsKey],
  );

  useEffect(() => {
    let cancelled = false;

    if (!enabled || normalizedUserIds.length === 0) {
      setOnlineIds((prev) => (prev.size === 0 ? prev : new Set()));
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      try {
        const online = await getOnlineUsers(normalizedUserIds);
        if (!cancelled) setOnlineIds(new Set(online));
      } catch (err) {
        if (!cancelled) setOnlineIds(new Set());
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [normalizedUserIds, enabled]);

  const normalizedSet = useMemo(
    () => new Set(normalizedUserIds),
    [normalizedUserIds],
  );

  useEffect(() => {
    if (!enabled) return;

    const handleStatusChange = (payload: PresenceChangePayload) => {
      if (!payload?.userId) return;
      if (!normalizedSet.has(payload.userId)) return;

      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (payload.status === "online") next.add(payload.userId);
        else next.delete(payload.userId);
        return next;
      });
    };

    presenceSocket.on("userStatusChanged", handleStatusChange);
    return () => {
      presenceSocket.off("userStatusChanged", handleStatusChange);
    };
  }, [enabled, normalizedSet]);

  const refresh = useCallback(async () => {
    if (normalizedUserIds.length === 0) return;
    const online = await getOnlineUsers(normalizedUserIds);
    setOnlineIds(new Set(online));
  }, [normalizedUserIds]);

  return {
    onlineIds,
    refresh,
  };
}
