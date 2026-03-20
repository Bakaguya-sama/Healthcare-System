import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  AlertTriangle,
  Bot,
  Building,
  Calendar,
  CheckCircle2,
  Contact,
  Flag,
  Mail,
  MapPin,
  Phone,
  Radical,
  ShieldAlert,
  ShieldCheck,
  ShieldUser,
  Star,
  Stethoscope,
  TriangleAlert,
  User,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

type UserRole = "admin" | "patient" | "doctor";
type AccountStatus = "active" | "banned";

type InformationProperty = {
  fieldKey: keyof typeof FIELD_META;
  value: string;
};

type ProfileReport = {
  id: string;
  reason: string;
  date: string;
  resolved: boolean;
};

type DoctorReview = {
  id: string;
  reviewer_name: string;
  reviewer_avatar_initials?: string;
  rating: number; // 1-5
  comment: string;
  created_at: string;
};

type DoctorReviewMetrics = {
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<number, number>; // { 5: 4, 4: 1, 3: 0, 2: 0, 1: 0 }
};

type DoctorRoleSpecific = {
  specialty?: string;
  workplace?: string;
  experience_years?: number;
  verified_at?: string;
  verification_status?: "pending" | "approved" | "rejected";
};

type ProfileData = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  gender: string;
  account_status: AccountStatus;
  created_at: string;
  address_display: string;
  role: UserRole;
  avatar_url?: string;
  reports?: ProfileReport[];
  role_specific?: DoctorRoleSpecific;
};

type ProfileModalProps = {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
};

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const ROLE_META: Record<
  UserRole,
  { label: string; icon: ReactNode; badgeClassName: string }
> = {
  admin: {
    label: "Admin",
    icon: <ShieldUser className="h-4 w-4" />,
    badgeClassName: "bg-violet-50 text-violet-600 border-violet-200",
  },
  doctor: {
    label: "Doctor",
    icon: <Stethoscope className="h-4 w-4" />,
    badgeClassName: "bg-blue-50 text-blue-600 border-blue-200",
  },
  patient: {
    label: "Patient",
    icon: <UserRound className="h-4 w-4" />,
    badgeClassName: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
};

const ACCOUNT_STATUS_META: Record<
  AccountStatus,
  {
    label: string;
    icon: ReactNode;
    badgeClassName: string;
  }
> = {
  active: {
    label: "Active",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    badgeClassName: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  banned: {
    label: "Inactive",
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
    badgeClassName: "text-red-600 bg-red-50 border-red-100",
  },
};

const FIELD_META = {
  email: {
    label: "Email",
    icon: Mail,
  },
  phone_number: {
    label: "Phone",
    icon: Phone,
  },
  gender: {
    label: "Gender",
    icon: Contact,
  },
  created_at: {
    label: "Member since",
    icon: Calendar,
  },
  address_display: {
    label: "Address",
    icon: MapPin,
  },
  specialty: {
    label: "Specialty",
    icon: Stethoscope,
  },
  experience_years: {
    label: "Experience",
    icon: Radical,
  },
  workplace: {
    label: "Workplace",
    icon: Building,
  },
  verified_at: {
    label: "Verified at",
    icon: ShieldCheck,
  },
} as const;

const COMMON_INFO_FIELD_KEYS: Array<keyof typeof FIELD_META> = [
  "email",
  "phone_number",
  "gender",
  "created_at",
  "address_display",
];

const DOCTOR_INFO_FIELD_KEYS: Array<keyof typeof FIELD_META> = [
  "specialty",
  "workplace",
  "experience_years",
  "verified_at",
];

const REPORT_REASON_META: Record<
  string,
  {
    label: string;
    icon: LucideIcon;
    iconClassName: string;
  }
> = {
  spam: {
    label: "Spam",
    icon: ShieldAlert,
    iconClassName: "bg-amber-50 text-amber-600",
  },
  harassment: {
    label: "Harassment",
    icon: AlertTriangle,
    iconClassName: "bg-red-50 text-red-600",
  },
  misinformation: {
    label: "Misinformation",
    icon: TriangleAlert,
    iconClassName: "bg-violet-50 text-violet-600",
  },
  inappropriate_content: {
    label: "Inappropriate",
    icon: Flag,
    iconClassName: "bg-pink-50 text-pink-600",
  },
  impersonation: {
    label: "Impersonation",
    icon: User,
    iconClassName: "bg-blue-50 text-blue-600",
  },
  fraud: {
    label: "Fraud",
    icon: TriangleAlert,
    iconClassName: "bg-rose-50 text-rose-600",
  },
  ai_hallucination: {
    label: "AI Hallucination",
    icon: Bot,
    iconClassName: "bg-orange-50 text-orange-600",
  },
};

const FALLBACK_PROFILE: ProfileData = {
  id: "userId",
  full_name: "Emma Thompson",
  email: "emma.t@gmail.com",
  phone_number: "+1 (212) 555-0147",
  gender: "female",
  created_at: "2026-01-12T00:00:00.000Z",
  address_display: "Ward X, District Y, HCM City, Vietnam",
  role: "doctor",
  account_status: "active",
  avatar_url: "",
  role_specific: {
    specialty: "Cardiology",
    workplace: "City Hospital",
    experience_years: 8,
    verified_at: "2025-06-01",
    verification_status: "approved",
  },
};

const FALLBACK_REPORT = [
  {
    id: "report-1",
    reason: "Spam",
    date: "Feb 15, 2026",
    resolved: true,
  },
  {
    id: "report-2",
    reason: "Harassment",
    date: "Jan 20, 2026",
    resolved: true,
  },
];

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

const FALLBACK_DOCTOR_REVIEW_METRICS: DoctorReviewMetrics = {
  average_rating: 4.8,
  total_reviews: 4,
  rating_distribution: { 5: 4, 4: 1, 3: 0, 2: 0, 1: 0 },
};

function InformationListItem({ fieldKey, value }: InformationProperty) {
  const fieldMeta = FIELD_META[fieldKey];
  const Icon = fieldMeta.icon;

  return (
    <li className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 last:border-none">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
          {fieldMeta.label}
        </p>
        <p className="text-base font-semibold text-slate-700">
          {value || "N/A"}
        </p>
      </div>
    </li>
  );
}

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

function getDisplayValue(
  fieldKey: keyof typeof FIELD_META,
  profile: ProfileData,
): string {
  if (fieldKey === "created_at") {
    return formatDate(profile.created_at);
  }

  if (fieldKey === "gender") {
    if (!profile.gender) return "N/A";
    return profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1);
  }

  if (fieldKey === "email") return profile.email || "N/A";
  if (fieldKey === "phone_number") return profile.phone_number || "N/A";
  if (fieldKey === "address_display") return profile.address_display || "N/A";

  const roleSpecific = profile.role_specific;
  if (!roleSpecific) return "N/A";

  if (fieldKey === "specialty") return roleSpecific.specialty || "N/A";
  if (fieldKey === "workplace") return roleSpecific.workplace || "N/A";
  if (fieldKey === "experience_years") {
    return roleSpecific.experience_years != null
      ? `${roleSpecific.experience_years} years`
      : "N/A";
  }
  if (fieldKey === "verified_at") return formatDate(roleSpecific.verified_at);

  return "N/A";
}

function getRatingColor(rating: number): string {
  const colors = {
    5: "text-yellow-400",
    4: "text-yellow-400",
    3: "text-yellow-400",
    2: "text-yellow-400",
    1: "text-yellow-400",
  };
  return colors[rating as keyof typeof colors] || colors[5];
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
    <div className="flex gap-3 border-b border-slate-100 px-4 py-4 last:border-none">
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

export function ProfileModal({ id = "", isOpen, onClose }: ProfileModalProps) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<"overview" | "reviews">(
    "overview",
  );

  //   Call api
  const profileData: ProfileData = {
    ...FALLBACK_PROFILE,
  };
  const reports = FALLBACK_REPORT ?? [];
  const doctorReviews = FALLBACK_DOCTOR_REVIEWS ?? [];
  const doctorReviewMetrics = FALLBACK_DOCTOR_REVIEW_METRICS;
  const userRole = profileData.role;

  const avatarUrl = profileData.avatar_url || "";
  const name = profileData.full_name || id || "";

  const roleMeta = ROLE_META[userRole];
  const accountStatusMeta = ACCOUNT_STATUS_META[profileData.account_status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-[760px] overflow-hidden rounded-3xl border border-slate-200 bg-[#F9FAFB] shadow-2xl">
        <div className="border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-2xl font-semibold text-slate-900">
              User Profile
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {userRole === "doctor" && (
            <div className="flex border-t border-slate-200 px-6">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "overview"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("reviews")}
                className={`px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "reviews"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Reviews
              </button>
            </div>
          )}
        </div>

        <div className="max-h-[calc(92vh-120px)] overflow-y-auto">
          {activeTab === "overview" ? (
            <div className="px-6 py-6 pb-6">
              <div className="mb-8 border-b border-slate-200 pb-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="inline-flex">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile avatar"
                        className="h-24 w-24 rounded-full border-2 border-white object-cover shadow-md"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-3xl font-bold text-white shadow-md">
                        {initialsFromName(name) || "U"}
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-slate-800">
                      {profileData.full_name}
                    </h3>
                    <p className="mb-3 text-base text-slate-500">
                      {profileData.email}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${accountStatusMeta.badgeClassName}`}
                      >
                        <span className="mr-1 inline-flex">
                          {accountStatusMeta.icon}
                        </span>
                        {accountStatusMeta.label}
                      </Badge>

                      <Badge
                        variant="outline"
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${roleMeta.badgeClassName}`}
                      >
                        <span className="mr-1 inline-flex">
                          {roleMeta.icon}
                        </span>
                        {roleMeta.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <section className="mb-4">
                <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Basic Information
                </h4>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <ul>
                    {COMMON_INFO_FIELD_KEYS.map((fieldKey) => (
                      <InformationListItem
                        key={fieldKey}
                        fieldKey={fieldKey}
                        value={getDisplayValue(fieldKey, profileData)}
                      />
                    ))}
                  </ul>
                </div>
              </section>

              {userRole === "doctor" && (
                <section className="mb-4">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <ul>
                      {DOCTOR_INFO_FIELD_KEYS.map((key) => (
                        <InformationListItem
                          key={key}
                          fieldKey={key}
                          value={getDisplayValue(key, profileData)}
                        />
                      ))}
                    </ul>
                  </div>
                </section>
              )}

              {userRole !== "admin" && reports.length > 0 && (
                <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <Badge
                      variant="outline"
                      className="rounded-full border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-500"
                    >
                      <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                      Total Reports: {reports.length}
                    </Badge>
                  </div>

                  <ul>
                    {reports.map((report) => {
                      const reasonMeta = REPORT_REASON_META[report.reason] ?? {
                        icon: ShieldAlert,
                        iconClassName: "bg-slate-100 text-slate-500",
                      };

                      const ReportIcon = reasonMeta.icon;

                      return (
                        <li
                          key={report.id}
                          className="flex items-center justify-between border-b border-slate-100 px-4 py-4 last:border-none"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${reasonMeta.iconClassName}`}
                            >
                              <ReportIcon className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-semibold text-slate-700">
                                {report.reason}
                              </p>
                              <p className="text-sm text-slate-400">
                                {report.date}
                              </p>
                            </div>
                          </div>

                          {report.resolved ? (
                            <Badge
                              variant="outline"
                              className="rounded-full border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600"
                            >
                              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                              Resolved
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-full border-amber-100 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600"
                            >
                              Pending
                            </Badge>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-[#F9FAFB] px-6 pt-4 pb-6">
                <Button
                  variant="outline"
                  className="h-11 flex-1 rounded-xl border-slate-300 text-slate-600"
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 px-6 py-6 pb-6">
              <section className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <div className="text-5xl font-bold text-slate-900">
                      {doctorReviewMetrics.average_rating.toFixed(1)}
                    </div>
                    <p className="text-sm text-slate-500">out of 5.0</p>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                </div>

                <p className="mb-4 text-sm font-semibold text-slate-700">
                  {doctorReviewMetrics.total_reviews} patient reviews
                </p>

                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map((rating) => {
                    const count =
                      doctorReviewMetrics.rating_distribution[rating] || 0;
                    const percentage =
                      doctorReviewMetrics.total_reviews > 0
                        ? Math.round(
                            (count / doctorReviewMetrics.total_reviews) * 100,
                          )
                        : 0;

                    return (
                      <div key={rating} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <span>{rating}</span>
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        </div>
                        <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <p className="w-12 text-right text-xs text-slate-500">
                          {percentage}%
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="space-y-0">
                  {doctorReviews.map((review) => (
                    <ReviewItem key={review.id} review={review} />
                  ))}
                </div>
              </section>

              <div className="flex gap-3 border-t border-slate-200 pt-4">
                <Button
                  variant="outline"
                  className="h-11 flex-1 rounded-xl border-slate-300 text-slate-600"
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
