import { MessageCircle, Star, Stethoscope, ThumbsUp } from "lucide-react";
import { OverviewCard } from "@repo/ui/components/data-display/overview-card";
import { LineChart } from "@repo/ui/components/ui/line-chart";
import { useState } from "react";

type DoctorReview = {
  id: string;
  reviewer_name: string;
  reviewer_avatar_initials?: string;
  rating: number; // 1-5
  comment: string;
  created_at: string;
};

const FALLBACK_DOCTOR_REVIEWS: DoctorReview[] = [
  {
    id: "review-1",
    reviewer_name: "Emma Thompson",
    reviewer_avatar_initials: "ET",
    rating: 5,
    comment:
      "Dr. Chen is incredibly thorough and takes time to explain everything. Best cardiologist I've visited.",
    created_at: "2026-02-28T00:00:00.000Z",
  },
  {
    id: "review-2",
    reviewer_name: "Emma Thompson",
    reviewer_avatar_initials: "LJ",
    rating: 1,
    comment:
      "Dr. Chen is incredibly thorough and takes time to explain everything. Best cardiologist I've visited.",
    created_at: "2026-02-28T00:00:00.000Z",
  },
  {
    id: "review-3",
    reviewer_name: "Emma Thompson",
    reviewer_avatar_initials: "AP",
    rating: 4,
    comment:
      "Dr. Chen is incredibly thorough and takes time to explain everything. Best cardiologist I've visited.",
    created_at: "2026-02-28T00:00:00.000Z",
  },
  {
    id: "review-4",
    reviewer_name: "Emma Thompson",
    reviewer_avatar_initials: "NK",
    rating: 1,
    comment:
      "Dr. Chen is incredibly thorough and takes time to explain everything. Best cardiologist I've visited.",
    created_at: "2026-02-28T00:00:00.000Z",
  },
  {
    id: "review-5",
    reviewer_name: "Emma Thompson",
    reviewer_avatar_initials: "NK",
    rating: 3,
    comment:
      "Dr. Chen is incredibly thorough and takes time to explain everything. Best cardiologist I've visited.",
    created_at: "2026-02-28T00:00:00.000Z",
  },
];

const overviewStats = [
  {
    title: "Total Consultations",
    icon: <MessageCircle size={18} />,
    stats: 24891,
    subText: "vs last month",
    comparedStats: 12.5,
    iconClassName: "bg-blue-50 text-blue-600",
  },
  {
    title: "Average rating",
    icon: <Star size={18} />,
    stats: 1382,
    subText: "from reviews  ",
    comparedStats: 8.2,
    iconClassName: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Total reviews",
    icon: <ThumbsUp size={18} />,
    stats: 98432,
    subText: "this month",
    comparedStats: 31.4,
    iconClassName: "bg-amber-50 text-amber-600",
  },
  {
    title: "Sessions this week",
    icon: <Stethoscope size={18} />,
    stats: 47,
    subText: "vs last week",
    comparedStats: -5,
    iconClassName: "bg-red-50 text-red-500",
  },
];

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
  const initials = review.reviewer_avatar_initials || "U";
  const avatarColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
  ];
  const colorIndex = review.id.charCodeAt(0) % avatarColors.length;
  const bgColor = avatarColors[colorIndex];

  return (
    <div className="flex gap-3 border-b bg-white border-slate-100 px-4 py-4 last:border-none">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${bgColor}`}
      >
        {initials}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-800">{review.reviewer_name}</p>
          <p className="text-xs text-slate-400">
            {formatDate(review.created_at)}
          </p>
        </div>
        <div className="mb-2 flex items-center gap-0.5">
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
        <p className="text-sm text-slate-600">{review.comment}</p>
      </div>
    </div>
  );
}

export function DoctorOverview() {
  const [showAllReviews, setShowAllReviews] = useState(false);
  const chartHeight = 460;

  const handleShowAllReviews = () => {
    setShowAllReviews((el) => !el);
  };

  const lineChartLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const lineChartDatasets = [
    {
      label: "Consultations",
      data: [120, 100, 90, 80, 89, 65, 67],
      borderColor: "#A3E635",
      backgroundColor: "#A3E635",
      tension: 0.4,
      fill: true,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 3,
    },
  ];

  const doctorReviews = FALLBACK_DOCTOR_REVIEWS ?? [];

  return (
    <div className="w-full p-6">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Overview</h1>
            <p className="text-sm text-slate-500">Tuesday, March 3, 2026</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Last 30 days
          </button>
        </div>

        <ul className="m-0 grid w-full list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-4">
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
                {showAllReviews ? "Show less" : "View all notifications"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
