import { useCallback, useEffect, useState } from "react";
import { getProfile } from "@/features/shared/services/profile-service";
import {
  createSession,
  getDoctors,
  getSessions,
  type DoctorItem,
} from "../services/my-doctor.service";

type UseMyDoctorOptions = {
  enabled?: boolean;
};

export function useMyDoctor(options: UseMyDoctorOptions = {}) {
  const { enabled = true } = options;
  const [data, setData] = useState<DoctorItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestedDoctorIds, setRequestedDoctorIds] = useState<Set<string>>(
    () => new Set(),
  );

  const fetchDoctors = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const [doctors, sessionsResponse] = await Promise.all([
        getDoctors(),
        getSessions({ limit: 100, page: 1, sortBy: "scheduledAt" }),
      ]);

      if (doctors.length === 0) {
        setData([]);
        return;
      }

      const profileEntries = await Promise.all(
        doctors.map(async (doctor) => {
          try {
            const profile = await getProfile({ id: doctor.id });
            return { id: doctor.id, profile: profile.userInformation };
          } catch (profileError) {
            return { id: doctor.id, profile: null };
          }
        }),
      );

      const profileById = new Map(
        profileEntries.map((entry) => [entry.id, entry.profile]),
      );

      const enriched = doctors.map((doctor) => {
        const profile = profileById.get(doctor.id);
        const roleSpecific = profile?.role_specific;
        const reviewMetrics = profile?.doctor_review_metrics;

        return {
          ...doctor,
          workplace: roleSpecific?.workplace || doctor.workplace,
          yearsOfExperience:
            roleSpecific?.experience_years ?? doctor.yearsOfExperience,
          averageRating: Number(
            reviewMetrics?.average_rating ?? Number(doctor.averageRating),
          ).toFixed(1),
          totalReview: reviewMetrics?.total_reviews ?? doctor.totalReview,
        };
      });

      setData(enriched);

      const nextRequested = new Set<string>();
      for (const session of sessionsResponse.data || []) {
        const doctorId = session?.doctorId;
        const status = session?.status;

        if (status !== "pending" && status !== "active") {
          continue;
        }

        if (typeof doctorId === "string") {
          nextRequested.add(doctorId);
          continue;
        }
        if (doctorId && typeof doctorId === "object") {
          const resolvedId = doctorId._id || doctorId.id;
          if (resolvedId) {
            nextRequested.add(resolvedId);
          }
        }
      }

      setRequestedDoctorIds(nextRequested);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load doctors");
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void fetchDoctors();
  }, [fetchDoctors]);

  const requestSession = useCallback(
    async (doctorId: string, patientNotes?: string) => {
      if (!doctorId) {
        return;
      }

      setIsRequesting(true);
      setError(null);

      try {
        const scheduledAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        await createSession({
          doctorId,
          scheduledAt,
          patientNotes,
        });

        setRequestedDoctorIds((prev) => {
          const next = new Set(prev);
          next.add(doctorId);
          return next;
        });
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to request session",
        );
        throw requestError;
      } finally {
        setIsRequesting(false);
      }
    },
    [],
  );

  return {
    data,
    isLoading,
    isRequesting,
    error,
    requestedDoctorIds,
    refresh: fetchDoctors,
    requestSession,
  };
}
