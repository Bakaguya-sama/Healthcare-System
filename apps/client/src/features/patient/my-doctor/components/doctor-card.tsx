import { Button } from "@repo/ui/components/ui/button";
import { RatingStars } from "@repo/ui/components/ui/rating-stars";
import { UserAvatar } from "@repo/ui/components/ui/user-avatar";
import { Clock3, MapPin, MessageCircle, UserRound } from "lucide-react";

interface DoctorCardProps {
  id: string;
  fullName: string;
  yearsOfExperience: number;
  isOnline: boolean;
  avatarUrl?: string;
  specialty: string;
  workplace: string;
  averageRating: string;
  totalReview: number;
  onRequest: (id: string) => void;
  onViewProfile: (id: string) => void;
}

export function DoctorCard({
  id,
  fullName,
  yearsOfExperience,
  isOnline,
  avatarUrl,
  specialty,
  workplace,
  averageRating,
  totalReview,
  onRequest,
  onViewProfile,
}: DoctorCardProps) {
  return (
    <article className="w-full max-w-[280px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col items-center bg-emerald-50/50 px-6 pb-5 pt-7 text-center">
        <UserAvatar
          name={fullName}
          url={avatarUrl}
          isOnline={isOnline}
          avtStyle="h-20 w-20 rounded-3xl"
        />

        <h3 className="mt-4 text-xl font-semibold text-slate-800">
          Dr. {fullName}
        </h3>
        <p className="mt-1 text-sm text-slate-400">{specialty}</p>

        <span
          className={`mt-4 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium ${
            isOnline
              ? "border-emerald-200 bg-emerald-100 text-emerald-700"
              : "border-amber-200 bg-amber-100 text-amber-700"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-amber-500"}`}
            aria-hidden="true"
          />
          {isOnline ? "Online now" : "Offline"}
        </span>
      </div>

      <div className="space-y-4 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-3 text-slate-600">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-500">
            <Clock3 className="h-4 w-4" />
          </span>
          <p className="text-sm">
            <span className="font-semibold text-slate-700">
              {yearsOfExperience} Years
            </span>{" "}
            Experience
          </p>
        </div>

        <div className="flex items-center gap-3 text-slate-600">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-500">
            <MapPin className="h-4 w-4" />
          </span>
          <p className="text-sm">{workplace}</p>
        </div>

        <RatingStars rating={averageRating} reviewCount={totalReview} />

        <div className="h-px bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 px-4 py-4">
        <Button
          variant="outline"
          className="h-11 w-full rounded-2xl border-slate-300 px-4 text-slate-600 whitespace-nowrap"
          aria-label={`View profile of doctor ${id}`}
          onClick={() => onViewProfile(id)}
        >
          <UserRound className="mr-2 h-4 w-4 shrink-0" />
          <span className="text-sm leading-none">View Profile</span>
        </Button>

        <Button
          className="h-11 w-full rounded-2xl bg-lime-400 px-4 text-slate-900 whitespace-nowrap hover:bg-lime-500"
          onClick={() => onRequest(id)}
        >
          <MessageCircle className="mr-2 h-4 w-4 shrink-0" />
          <span className="text-sm leading-none">Request</span>
        </Button>
      </div>
    </article>
  );
}
