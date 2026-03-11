import * as React from "react";
import { cn } from "../lib/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Tiêu đề hiển thị phía trên form */
  title: string;
  /** Mô tả ngắn bên dưới tiêu đề */
  description?: string;
  /** Logo hoặc icon ở đầu trang */
  logo?: React.ReactNode;
}

export function AuthLayout({
  children,
  title,
  description,
  logo,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div
        className={cn(
          "w-full max-w-md bg-surface-card rounded-2xl shadow-card p-8 space-y-6",
        )}
      >
        {logo && <div className="flex justify-center">{logo}</div>}

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
