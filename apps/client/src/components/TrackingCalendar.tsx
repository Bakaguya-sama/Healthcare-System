import { Calendar } from "@repo/ui/components/ui/calendar";
import { ChevronLeft, ChevronRight } from "lucide-react";

type TrackingCalendarProps = {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  today: Date;
  recordedDateKeys: Set<string>;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function TrackingCalendar({
  selectedDate,
  onSelectDate,
  today,
  recordedDateKeys,
}: TrackingCalendarProps) {
  const todayStart = getStartOfDay(today);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => {
          if (date) {
            onSelectDate(getStartOfDay(date));
          }
        }}
        disabled={(date) =>
          getStartOfDay(date).getTime() > todayStart.getTime()
        }
        modifiers={{
          hasRecord: (date) => recordedDateKeys.has(toDateKey(date)),
        }}
        modifiersClassNames={{
          hasRecord:
            "[&>button]:after:absolute [&>button]:after:bottom-0 [&>button]:after:left-1/2 [&>button]:after:h-1.5 [&>button]:after:w-1.5 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-blue-500",
        }}
        className="mx-auto"
        classNames={{
          root: "w-fit",
          month: "w-fit",
          month_caption:
            "flex h-9 w-full items-center justify-center px-10 text-sm font-semibold text-slate-800",
          nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between",
          button_previous:
            "h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
          button_next:
            "h-8 w-8 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
          weekdays: "mb-1 mt-1 flex",
          weekday:
            "flex-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400",
          day: "h-9 w-9 p-0",
          day_button:
            "relative h-7 w-7 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100",
          today:
            "[&>button]:ring-1 [&>button]:ring-lime-300 [&>button]:ring-offset-1",
          outside: "[&>button]:text-slate-300",
          disabled:
            "[&>button]:text-slate-300 [&>button]:bg-transparent [&>button]:cursor-not-allowed [&>button]:opacity-60",
        }}
        components={{
          Chevron: ({ orientation, ...props }) =>
            orientation === "left" ? (
              <ChevronLeft className="h-4 w-4" {...props} />
            ) : (
              <ChevronRight className="h-4 w-4" {...props} />
            ),
        }}
      />

      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-lime-400" />
          Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          Has records
        </span>
      </div>
    </div>
  );
}
