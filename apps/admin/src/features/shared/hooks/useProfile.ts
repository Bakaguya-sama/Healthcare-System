import {
  getProfile,
  type UserInformation,
} from "@/features/shared/services/profile-service";
import { useCallback, useEffect, useState } from "react";

export function useViewProfile(userId?: string | null, isEnabled = true) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UserInformation | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId || !isEnabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const profile = await getProfile({ id: userId });
      setData(profile.userInformation);
    } catch (profileError) {
      setError(
        profileError instanceof Error
          ? profileError.message
          : "Failed to load profile",
      );
    } finally {
      setIsLoading(false);
    }
  }, [isEnabled, userId]);

  useEffect(() => {
    if (!userId || !isEnabled) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    void loadProfile();
  }, [isEnabled, loadProfile, userId]);

  return {
    data,
    isLoading,
    error,
    refresh: loadProfile,
  };
}
