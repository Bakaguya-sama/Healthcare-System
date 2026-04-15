import { ReactNode, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

export type ActionCardItem = {
  id: string;
  title: string;
  icon: ReactNode;
  iconColor?: string;
  disabled?: boolean;
  onHandle: () => void;
};

interface ActionCardProps {
  actions?: ActionCardItem[];
  className?: string;
  onClickOutside?: () => void;
  anchorRect?: DOMRect | null;
}

export function ActionCard({
  actions = [],
  className = "",
  onClickOutside,
  anchorRect = null,
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

  const style = useMemo<CSSProperties | undefined>(() => {
    if (!anchorRect) {
      return undefined;
    }

    const cardWidth = 176;
    const viewportPadding = 8;
    const left = Math.min(
      Math.max(viewportPadding, anchorRect.right - cardWidth),
      window.innerWidth - cardWidth - viewportPadding,
    );

    return {
      position: "fixed",
      top: anchorRect.bottom + 8,
      left: Math.max(viewportPadding, left),
      zIndex: 9999,
    };
  }, [anchorRect]);

  if (actions.length === 0) {
    return null;
  }

  const card = (
    <div
      ref={cardRef}
      data-actions-root="true"
      style={style}
      className={`right-0 top-8 z-50 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-xl ${className}`}
    >
      <ul>
        {actions.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={item.disabled ? undefined : item.onHandle}
              disabled={item.disabled}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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

  if (anchorRect) {
    return createPortal(card, document.body);
  }

  return card;
}
