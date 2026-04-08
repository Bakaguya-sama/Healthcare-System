import { useCallback, useEffect, useState } from "react";
import {
  getUserManagement,
  type UserManagement,
  banUser,
  type ApiBanUser,
  unbanUser,
  type ApiUnbanUser,
} from "../services/user-management.service";

const initialUsers: UserManagement = {
  totalUser: 0,
  activeDoctors: 0,
  pendingVerifications: 0,
  bannedUsers: 0,
  userList: [],
};

export function useUsers() {
  const [users, setUsers] = useState<UserManagement>(initialUsers);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getUserManagement();
      setUsers(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load user data",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  return {
    users,
    isLoading,
    error,
    refresh: loadUsers,
  };
}

export function useBanUser() {
  const [response, setResponse] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitBanUser = useCallback(async (payload: ApiBanUser) => {
    if (!payload.id) {
      setError("Empty required fields!");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await banUser(payload);
      setResponse(res);
      return res;
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to ban user",
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    submitBanUser,
    response,
    isLoading,
    error,
  };
}

export function useUnbanUser() {
  const [response, setResponse] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitUnbanUser = useCallback(async (payload: ApiUnbanUser) => {
    if (!payload.id) {
      setError("Empty required fields!");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await unbanUser(payload);
      setResponse(res);
      return res;
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to unban user",
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    submitUnbanUser,
    response,
    isLoading,
    error,
  };
}
