import { Star } from "lucide-react";

interface RatingStarsProps {
  rating: number | string;
  reviewCount?: number;
  maxStars?: number;
  className?: string;
}

function toNumber(value: number | string) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function RatingStars({
  rating,
  reviewCount,
  maxStars = 5,
  className = "",
}: RatingStarsProps) {
  const max = Math.max(1, maxStars);
  const normalizedRating = Math.min(Math.max(toNumber(rating), 0), max);
  const fullStars = Math.floor(normalizedRating);
  const partialStar = normalizedRating - fullStars;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="inline-flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: max }).map((_, index) => {
          const isFull = index < fullStars;
          const isPartial = index === fullStars && partialStar > 0;

          if (isFull) {
            return (
              <Star
                key={index}
                className="h-4 w-4 fill-amber-400 text-amber-400"
              />
            );
          }

          if (isPartial) {
            return (
              <span key={index} className="relative inline-flex h-4 w-4">
                <Star className="absolute h-4 w-4 text-slate-300" />
                <span
                  className="absolute inset-y-0 left-0 overflow-hidden"
                  style={{ width: `${partialStar * 100}%` }}
                >
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                </span>
              </span>
            );
          }

          return <Star key={index} className="h-4 w-4 text-slate-300" />;
        })}
      </div>

      <span className="text-sm font-semibold text-slate-700">
        {normalizedRating.toFixed(1)}
      </span>

      {typeof reviewCount === "number" && (
        <span className="text-sm text-slate-400">({reviewCount} reviews)</span>
      )}
    </div>
  );
}
