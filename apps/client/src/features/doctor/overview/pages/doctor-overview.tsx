import { MessageCircle, Star, ThumbsUp } from "lucide-react";
import { OverviewCard } from "@repo/ui/components/data-display/overview-card";
import { LineChart } from "@repo/ui/components/ui/line-chart";
import { useState, useMemo, useEffect } from "react";
import { format, subDays } from "date-fns";
import { useOverviewSummary } from "../hooks/useOverview";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { showToast } from "@repo/ui/components/ui/toasts";

type Patient = {
  id: string;
  avtUrl?: string;
  fullName: string;
};

type DoctorReview = {
  id: string;
  patient: Patient;
  sessionId: string;
  rating: number;
  comment?: string;
  createdAt: string;
};

function formatDate(input?: string) {
  if (!input) return "N/A";

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function ReviewItem({ review }: { review: DoctorReview }) {
  return (
    <div className="flex gap-3 border-b bg-white border-zinc-950 px-4 py-4 last:border-none">
      <UserAvatar
        name={review.patient.fullName}
        url={review.patient.avtUrl}
        avtStyle="h-10 w-10 rounded-full"
      />

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">
            {review.patient.fullName}
          </p>
          <p className="text-xs text-slate-400">
            {formatDate(review.createdAt)}
          </p>
        </div>
        {/* Rating stars */}
        <div className="mb-1 flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < review.rating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-slate-300"
              }`}
            />
          ))}
        </div>
        {/* Comment */}
        <p className="text-sm text-slate-600">{review.comment}</p>
      </div>
    </div>
  );
}

export function DoctorOverview() {
  const [showAllReviews, setShowAllReviews] = useState(false);
  const chartHeight = 460;

  const { summary, isLoading, error } = useOverviewSummary();

  useEffect(() => {
    if (error) {
      showToast.error(error);
    }
  }, [error]);

  const lineChartLabels = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      return format(date, "dd/MM");
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <Spinner size="lg" />
      </div>
    );
  }

  const overviewStats = [
    {
      title: "Total sessions",
      icon: <MessageCircle size={18} />,
      stats: summary?.totalSessionsThisMonth || 0,
      subText: "vs last month",
      comparedStats: 12.5,
      iconClassName: "bg-blue-50 text-blue-600",
    },
    {
      title: "Average rating",
      icon: <Star size={18} />,
      stats: summary?.avgRating || 0,
      subText: "from reviews  ",
      comparedStats: 8.2,
      iconClassName: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Total reviews",
      icon: <ThumbsUp size={18} />,
      stats: summary?.totalReviews || 0,
      subText: "this month",
      comparedStats: 31.4,
      iconClassName: "bg-amber-50 text-amber-600",
    },
  ];

  const handleShowAllReviews = () => {
    setShowAllReviews((el) => !el);
  };

  const lineChartDatasets = [
    {
      label: "Consultations",
      data: summary?.sessionNumberByDayInLastWeek || [],
      borderColor: "#A3E635",
      backgroundColor: "#A3E635",
      tension: 0.4,
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
    },
  ];

  const doctorReviews = summary?.reviews ?? [];

  const date = new Date();
  const today = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="w-full p-6 animate-in fade-in">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Overview</h1>
            <p className="text-sm text-slate-500">{today}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Last 30 days
          </button>
        </div>

        <ul className="m-0 grid w-full list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
          {overviewStats.map((item) => (
            <OverviewCard key={item.title} {...item} />
          ))}
        </ul>

        <div className="mt-5 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
          <LineChart
            title="Consultation Activity"
            subtitle="Daily consultation volume for the past week"
            labels={lineChartLabels}
            datasets={lineChartDatasets}
            className="xl:col-span-2"
            height={chartHeight}
          />

          <div
            className="xl:col-span-1 flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white"
            style={{ height: chartHeight }}
          >
            <div className="p-2">
              <p className="ml-3 mt-3 font-bold ">Recent feedback</p>
            </div>
            <section
              className={`min-h-0 flex-1 rounded-2xl border-slate-200 bg-white ${showAllReviews ? "overflow-y-scroll" : "overflow-hidden"}`}
            >
              <div className="space-y-0">
                {(showAllReviews
                  ? doctorReviews
                  : doctorReviews.slice(0, 3)
                ).map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </div>
            </section>
            <div className="border-t">
              <button
                type="button"
                onClick={handleShowAllReviews}
                className="w-full py-3 text-sm text-center text-[#3B7BF8] font-medium hover:bg-gray-50 transition-colors rounded-b-xl"
              >
                {showAllReviews ? "Show less" : "View all reviews"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
