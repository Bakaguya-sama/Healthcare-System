import { api } from "@/lib/api";

type PresenceResponse = {
  statusCode: number;
  data: {
    onlineUserIds: string[];
  };
};

export async function getOnlineUsers(userIds: string[]) {
  if (userIds.length === 0) {
    return [] as string[];
  }

  const response = await api.post<PresenceResponse>("/presence/status", {
    userIds,
  });

  return response.data?.data?.onlineUserIds ?? [];
}
