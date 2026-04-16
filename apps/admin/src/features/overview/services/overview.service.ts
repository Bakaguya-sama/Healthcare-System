import { api } from "@/lib/api";
import { format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";

export interface OverviewSummary {
  totalUsers: number;
  activeDoctors: number;
  aiChatSessions: number;
  pendingVerifications: number;
  doctorSessions: number;
  violationReports: number;
  monthly: {
    labels: string[];
    totalUsers: number[];
    activeDoctors: number[];
    aiChatSessions: number[];
  };
  weekly: {
    labels: string[];
    doctorSessions: number[];
    violationReports: number[];
  };
}
export type VerificationStatus = "pending" | "approved" | "rejected";
type User = {
  _id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
};

type ApiDoctor = {
  _id: string;
  userId: User;
  specialty?: string;
  workplace?: string;
  verificationDocuments?: string[];
  experienceYears?: number;
  verificationStatus: VerificationStatus;
  rejectReason?: string;
  createdAt: string;
};

type ApiDoctorApplicationsResponse = {
  data: ApiDoctor[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
};

type CreatedAtRecord = {
  createdAt?: string;
};

type UserListResponse = CreatedAtRecord[];
type PaginatedAiSessionsResponse = {
  data: CreatedAtRecord[];
  total: number;
};

type AdminSessionsResponse = {
  data: CreatedAtRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
};

type ViolationsResponse = {
  data: CreatedAtRecord[];
  total: number;
  page: number;
  limit: number;
};

function getMonthKeysLast8Months() {
  return Array.from({ length: 8 }, (_, index) => {
    const monthsAgo = 7 - index;
    const date = subMonths(new Date(), monthsAgo);
    return format(date, "yyyy-MM");
  });
}

function getDayKeysLast7Days() {
  return Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index;
    const date = subDays(new Date(), daysAgo);
    return format(date, "yyyy-MM-dd");
  });
}

function buildMonthlyCounts(items: CreatedAtRecord[], monthKeys: string[]) {
  const monthlyCounter = new Map<string, number>(
    monthKeys.map((monthKey) => [monthKey, 0]),
  );

  for (const item of items) {
    if (!item.createdAt) {
      continue;
    }

    const monthKey = format(new Date(item.createdAt), "yyyy-MM");
    if (!monthlyCounter.has(monthKey)) {
      continue;
    }

    monthlyCounter.set(monthKey, (monthlyCounter.get(monthKey) ?? 0) + 1);
  }

  return monthKeys.map((monthKey) => monthlyCounter.get(monthKey) ?? 0);
}

function buildDailyCounts(items: CreatedAtRecord[], dayKeys: string[]) {
  const dailyCounter = new Map<string, number>(
    dayKeys.map((dayKey) => [dayKey, 0]),
  );

  for (const item of items) {
    if (!item.createdAt) {
      continue;
    }

    const dayKey = format(new Date(item.createdAt), "yyyy-MM-dd");
    if (!dailyCounter.has(dayKey)) {
      continue;
    }

    dailyCounter.set(dayKey, (dailyCounter.get(dayKey) ?? 0) + 1);
  }

  return dayKeys.map((dayKey) => dailyCounter.get(dayKey) ?? 0);
}

async function fetchAllPendingDoctorApplications(): Promise<ApiDoctor[]> {
  const limit = 100;
  let page = 1;
  let pages = 1;
  const allDoctors: ApiDoctor[] = [];

  while (page <= pages) {
    const response = await api.get<ApiDoctorApplicationsResponse>(
      "/admin/doctors/applications",
      {
        params: {
          status: "pending",
          page,
          limit,
        },
      },
    );

    allDoctors.push(...response.data.data);
    pages = Math.max(1, response.data.pagination.pages || 1);
    page += 1;
  }

  return allDoctors;
}

export async function getOverviewSummary(): Promise<OverviewSummary> {
  const monthKeys = getMonthKeysLast8Months();
  const dayKeys = getDayKeysLast7Days();
  const rangeStart = startOfMonth(subMonths(new Date(), 7)).toISOString();
  const rangeEnd = startOfMonth(subMonths(new Date(), -1)).toISOString();
  const dailyRangeStart = startOfDay(subDays(new Date(), 6)).toISOString();

  const [
    usersResponse,
    doctorsResponse,
    aiChatSessionsResponse,
    pendingDoctors,
    doctorSessionResponse,
    violationReportResponse,
  ] = await Promise.all([
    api.get<UserListResponse>("/users"),
    api.get<UserListResponse>("/users/doctors"),
    api.get<PaginatedAiSessionsResponse>("/ai-sessions", {
      params: {
        page: 1,
        limit: 1000,
        fromDate: rangeStart,
        toDate: rangeEnd,
      },
    }),
    fetchAllPendingDoctorApplications(),
    api.get<AdminSessionsResponse>("/admin/sessions", {
      params: {
        page: 1,
        limit: 1000,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
    }),
    api.get<ViolationsResponse>("/violations", {
      params: {
        page: 1,
        limit: 1000,
      },
    }),
  ]);

  const doctorSessionsLast7Days = doctorSessionResponse.data.data.filter(
    (session) =>
      Boolean(session.createdAt) &&
      new Date(session.createdAt as string) >= new Date(dailyRangeStart),
  );

  const violationsLast7Days = violationReportResponse.data.data.filter(
    (violation) =>
      Boolean(violation.createdAt) &&
      new Date(violation.createdAt as string) >= new Date(dailyRangeStart),
  );

  const monthlyTotalUsers = buildMonthlyCounts(usersResponse.data, monthKeys);
  const monthlyActiveDoctors = buildMonthlyCounts(
    doctorsResponse.data,
    monthKeys,
  );
  const monthlyAiSessions = buildMonthlyCounts(
    aiChatSessionsResponse.data.data,
    monthKeys,
  );

  const weeklyDoctorSessions = buildDailyCounts(
    doctorSessionsLast7Days,
    dayKeys,
  );
  const weeklyViolationReports = buildDailyCounts(violationsLast7Days, dayKeys);

  return {
    totalUsers: usersResponse.data.length,
    activeDoctors: doctorsResponse.data.length,
    aiChatSessions: aiChatSessionsResponse.data.total,
    pendingVerifications: pendingDoctors.length,
    doctorSessions: doctorSessionResponse.data.pagination.total,
    violationReports: violationReportResponse.data.total,
    monthly: {
      labels: monthKeys.map((monthKey) => {
        const [year, month] = monthKey.split("-");
        return format(new Date(Number(year), Number(month) - 1, 1), "MMM");
      }),
      totalUsers: monthlyTotalUsers,
      activeDoctors: monthlyActiveDoctors,
      aiChatSessions: monthlyAiSessions,
    },
    weekly: {
      labels: dayKeys.map((dayKey) => {
        const [year, month, day] = dayKey.split("-");
        return format(
          new Date(Number(year), Number(month) - 1, Number(day)),
          "EEE",
        );
      }),
      doctorSessions: weeklyDoctorSessions,
      violationReports: weeklyViolationReports,
    },
  };
}
