import * as React from "react";
import { cn } from "../lib/utils";

interface LoginFormProps {
  /** Xử lý submit — nhận email và password */
  onSubmit: (values: {
    email: string;
    password: string;
  }) => void | Promise<void>;
  /** Đang loading (disable nút, hiện spinner) */
  isLoading?: boolean;
  /** Thông báo lỗi từ server */
  error?: string;
  /** Label cho nút submit */
  submitLabel?: string;
  /** Link quên mật khẩu */
  forgotPasswordHref?: string;
}

export function LoginForm({
  onSubmit,
  isLoading = false,
  error,
  submitLabel = "Đăng nhập",
  forgotPasswordHref,
}: LoginFormProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ email, password });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
            "disabled:opacity-50",
          )}
          placeholder="you@example.com"
          disabled={isLoading}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            Mật khẩu
          </label>
          {forgotPasswordHref && (
            <a
              href={forgotPasswordHref}
              className="text-xs text-primary hover:text-primary-hover"
            >
              Quên mật khẩu?
            </a>
          )}
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={cn(
            "w-full rounded-lg border border-border bg-surface-card px-3 py-2 text-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
            "disabled:opacity-50",
          )}
          placeholder="••••••••"
          disabled={isLoading}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={cn(
          "w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black",
          "hover:bg-primary-hover transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isLoading ? "Đang xử lý..." : submitLabel}
      </button>
    </form>
  );
}
