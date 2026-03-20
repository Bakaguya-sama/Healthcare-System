import { ReactNode } from "react";

export type ActionCardItem = {
  id: string;
  title: string;
  icon: ReactNode;
  iconColor?: string;
  onHandle: () => void;
};

interface ActionCardProps {
  actions?: ActionCardItem[];
  className?: string;
}

export function ActionCard({ actions = [], className = "" }: ActionCardProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div
      className={`absolute right-0 top-8 z-50 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl ${className}`}
    >
      <ul>
        {actions.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.onHandle}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-gray-50"
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 ${item.iconColor ?? "text-slate-600"}`}
              >
                {item.icon}
              </span>
              <span
                className={`truncate ${item.iconColor ?? "text-slate-700"}`}
              >
                {item.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
