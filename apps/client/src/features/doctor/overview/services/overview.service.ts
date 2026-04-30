import { api } from "@/lib/api";
import { format, startOfDay, startOfMonth, subDays } from "date-fns";

type CreatedAtRecord = {
  _id?: string;
  createdAt?: string;
};

type UpdatedAtRecord = {
  _id?: string;
  updatedAt?: string;
};

type UserListResponse = CreatedAtRecord[];

type Patient = {
  id: string;
  avtUrl?: string;
  fullName: string;
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

function buildDailyCounts(items: UpdatedAtRecord[], dayKeys: string[]) {
  const dailyCounter = new Map<string, number>(
    dayKeys.map((dayKey) => [dayKey, 0]),
  );

  for (const item of items) {
    if (!item.updatedAt) {
      continue;
    }

    const dayKey = format(new Date(item.updatedAt), "yyyy-MM-dd");
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
  const startOfLast7Days = startOfDay(subDays(today, 6));

  const dayKeys = getDayKeysLast7Days();

  const [doctorProfileResponse, sessionResponse, reviewResponse] =
    await Promise.all([
      api.get<DoctorProfileApiResponse>(`/users/me`),
      api.get<PaginatedApiResponse<CreatedAtRecord>>("/sessions", {
        params: {
          startDate: startOfCurrentMonth.toISOString(),
          endDate: today.toISOString(),
          sortBy: -1,
          limit: 100,
        },
      }),
      api.get<PaginatedApiResponse<RawReviewFromApi>>(
        `/reviews/doctor/${userId}`,
        {
          params: {
            startDate: startOfLast7Days.toISOString(),
            endDate: today.toISOString(),
            sortBy: -1,
            limit: 100,
          },
        },
      ),
    ]);

  const avgRating = doctorProfileResponse.data.averageRating ?? 0;
  const totalSessionsThisMonth = sessionResponse.data.pagination.total;
  const totalReviews = reviewResponse.data.pagination.total;
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
    sessionResponse.data.data,
    dayKeys,
  );

  console.log("sessionThisMonth", sessionResponse.data.data);
  console.log("sessionThisMonth2", sessionNumberByDayInLastWeek);

  return {
    avgRating,
    totalSessionsThisMonth,
    totalReviews,
    reviews: formattedReviews,
    sessionNumberByDayInLastWeek,
  };
}
