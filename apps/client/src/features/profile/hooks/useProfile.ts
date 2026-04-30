import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import {
  getMyProfile,
  type ProfileDataReceiver,
  updateMyProfile,
} from "../services/profile.service";

export function useProfile() {
  const [data, setData] = useState<ProfileDataReceiver | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateCurrentUser = useAuthStore((state) => state.updateCurrentUser);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getMyProfile();
      setData(response);
      return response;
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load profile";
      setError(message);
      throw loadError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const save = useCallback(
    async (payload: ProfileDataReceiver) => {
      setIsSaving(true);
      setError(null);

      try {
        console.log(payload);
        await updateMyProfile(payload);
        const latest = await getMyProfile();
        setData(latest);
        updateCurrentUser({
          name: latest.fullName,
          avatar: latest.avatarUrl,
          email: latest.email,
        });
        return latest;
      } catch (saveError) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "Failed to save profile";
        setError(message);
        throw saveError;
      } finally {
        setIsSaving(false);
      }
    },
    [updateCurrentUser],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data,
    isLoading,
    isSaving,
    error,
    refresh,
    save,
  };
}
