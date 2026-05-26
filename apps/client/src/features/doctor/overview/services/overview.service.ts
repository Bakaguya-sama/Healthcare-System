import { api } from "@/lib/api";
import {
  format,
  startOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
  endOfDay,
} from "date-fns";

type CreatedAtRecord = {
  _id?: string;
  createdAt?: string;
};

type UpdatedAtRecord = {
  _id?: string;
  updatedAt?: string;
};

type ScheduledAtRecord = {
  _id?: string;
  scheduledAt?: string;
};

type Patient = {
  id: string;
  avtUrl?: string;
  fullName: string;
};

type DoctorProfileResponse = {
  doctor_review_metrics?: {
    total_reviews?: number;
  };
};

type RawReviewFromApi = {
  _id: string;
  patientId: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
  };
  doctorId: string;
  doctorSessionId: string;
  rating: number;
  comment?: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
};

type ReviewApiResponse = {
  id: string;
  patient: Patient;
  sessionId: string;
  rating: number;
  comment?: string;
  createdAt: string;
};

interface DoctorProfileApiResponse {
  averageRating: number;
}

interface PaginatedApiResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

function getDayKeysLast7Days() {
  return Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index;
    const date = subDays(new Date(), daysAgo);
    return format(date, "yyyy-MM-dd");
  });
}

function buildDailyCounts(items: ScheduledAtRecord[], dayKeys: string[]) {
  const dailyCounter = new Map<string, number>(
    dayKeys.map((dayKey) => [dayKey, 0]),
  );

  for (const item of items) {
    if (!item.scheduledAt) {
      continue;
    }

    const dayKey = format(new Date(item.scheduledAt), "yyyy-MM-dd");
    if (!dailyCounter.has(dayKey)) {
      continue;
    }

    dailyCounter.set(dayKey, (dailyCounter.get(dayKey) ?? 0) + 1);
  }

  return dayKeys.map((dayKey) => dailyCounter.get(dayKey) ?? 0);
}

export interface DoctorOverviewSummary {
  avgRating: number;
  totalSessionsThisMonth: number;
  totalReviews: number;
  reviews: ReviewApiResponse[];
  sessionNumberByDayInLastWeek: number[];
}

export async function getOverviewSummary(
  userId: string,
): Promise<DoctorOverviewSummary> {
  const today = new Date();
  const startOfCurrentMonth = startOfMonth(today);
  const endOfCurrentMonth = endOfMonth(today);
  const startOfLast7Days = startOfDay(subDays(today, 6));
  const endOfToday = endOfDay(today);

  const dayKeys = getDayKeysLast7Days();

  const [
    doctorProfileResponse,
    sessionThisMonthResponse,
    sessionLastWeekResponse,
    reviewCountResponse,
    reviewResponse,
  ] = await Promise.all([
    api.get<DoctorProfileApiResponse>(`/users/me`),
    api.get<PaginatedApiResponse<CreatedAtRecord>>("/sessions", {
      params: {
        startDate: startOfCurrentMonth.toISOString(),
        endDate: endOfCurrentMonth.toISOString(),
        sortBy: "scheduledAt",
        sortOrder: -1,
        limit: 100,
      },
    }),
    api.get<PaginatedApiResponse<CreatedAtRecord>>("/sessions", {
      params: {
        startDate: startOfLast7Days.toISOString(),
        endDate: endOfToday.toISOString(),
        sortBy: "scheduledAt",
        sortOrder: -1,
        limit: 100,
      },
    }),
    api.get<DoctorProfileResponse>(`/users/${userId}/profile`),
    api.get<PaginatedApiResponse<RawReviewFromApi>>(
      `/reviews/doctor/${userId}`,
      {
        params: {
          sortBy: "createdAt",
          sortOrder: -1,
          limit: 10,
        },
      },
    ),
  ]);

  const avgRating = doctorProfileResponse.data.averageRating ?? 0;
  const totalSessionsThisMonth = sessionThisMonthResponse.data.pagination.total;
  const totalReviews =
    reviewCountResponse.data.doctor_review_metrics?.total_reviews ?? 0;
  const rawReviewsFromApi = reviewResponse.data.data;

  const formattedReviews: ReviewApiResponse[] = rawReviewsFromApi.map(
    (item) => {
      return {
        id: item._id,
        patient: {
          id: item.patientId._id,
          fullName: item.patientId.fullName,
          avtUrl: item.patientId.avatarUrl,
        },
        sessionId: item.doctorSessionId,
        rating: item.rating,
        comment: item.comment,
        createdAt: item.createdAt,
      };
    },
  );

  const sessionNumberByDayInLastWeek = buildDailyCounts(
    sessionLastWeekResponse.data.data,
    dayKeys,
  );

  return {
    avgRating,
    totalSessionsThisMonth,
    totalReviews,
    reviews: formattedReviews,
    sessionNumberByDayInLastWeek,
  };
}
