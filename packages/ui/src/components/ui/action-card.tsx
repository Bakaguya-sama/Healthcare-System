import { ReactNode, useEffect, useRef } from "react";

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
  onClickOutside?: () => void;
}

export function ActionCard({
  actions = [],
  className = "",
  onClickOutside,
}: ActionCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!cardRef.current) return;
      const target = event.target as Node | null;
      if (target && !cardRef.current.contains(target)) {
        onClickOutside?.();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onClickOutside]);

  if (actions.length === 0) {
    return null;
  }

  return (
    <div
      ref={cardRef}
      className={`absolute right-0 top-8 z-50 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl ${className}`}
    >
      <ul>
        {actions.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.onHandle}
              className="flex cursor-pointer w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-gray-50"
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
