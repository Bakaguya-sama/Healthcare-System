import {
  FieldSet,
  FieldGroup,
  Field,
  FieldLabel,
  FieldControl,
  FieldError,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Button } from "@repo/ui/components/button";
import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";
import { Spinner } from "@repo/ui/components/spinner";
import { showToast } from "@repo/ui/components/toasts";
import { toast } from "react-toastify";
import { Header } from "@/components/ui/authen_header";

interface ChangePasswordProps {
  /** Xử lý submit — nhận email và password */
  onSubmit?: (values: {
    password: string;
    confirmed_password: string;
  }) => void | Promise<void>;
  /** Đang loading (disable nút, hiện spinner) */
  isLoading?: boolean;
  /** Thông báo lỗi từ server */
  error?: string;
  /** Label cho nút submit */
  submitLabel?: string;
  /** Link quên mật khẩu */
  email?: string;
}

interface ChangePasswordErrors {
  password?: string;
  confirmed_password?: string;
}

export function ChangePassword({
  onSubmit,
  isLoading = false,
  error,
  submitLabel = "Confirm",
  email = "example@gmail.com",
}: ChangePasswordProps) {
  const [password, setPassword] = useState("");
  const [confirmed_password, setConfirmedPassword] = useState("");
  const [internalLoading, setInternalLoading] = useState(false);
  const [touched, setTouched] = useState({
    password: false,
    confirmed_password: false,
  });
  const [localErrors, setLocalErrors] = useState<ChangePasswordErrors>({});

  async function handleChangePassword(values: {
    password: string;
    confirmed_password: string;
  }) {
    // Placeholder: thay phần này bằng call API đổi mật khẩu khi backend sẵn sàng.
    console.log("[TODO] Change password payload", values);
  }

  function validate(values: {
    password: string;
    confirmed_password: string;
  }): ChangePasswordErrors {
    const nextErrors: ChangePasswordErrors = {};

    if (!values.password.trim()) {
      nextErrors.password = "Please enter your password.";
    } else if (values.password.trim().length < 6) {
      nextErrors.password = "Your password must have at least 6 characters.";
    }

    if (!values.confirmed_password.trim()) {
      nextErrors.confirmed_password = "Please confirm your password.";
    } else if (values.confirmed_password.trim() !== values.password.trim()) {
      nextErrors.confirmed_password = "Your password does not match.";
    }

    return nextErrors;
  }

  function handleBlur(field: "password" | "confirmed_password") {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setLocalErrors(validate({ password, confirmed_password }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const nextErrors = validate({ password, confirmed_password });
    setLocalErrors(nextErrors);
    setTouched({ password: true, confirmed_password: true });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const submitHandler = onSubmit ?? handleChangePassword;

    try {
      setInternalLoading(true);
      await submitHandler({ password, confirmed_password });
    } finally {
      setInternalLoading(false);
    }
  }

  const passwordError = touched.password ? localErrors.password : undefined;
  const confirmedPasswordError = touched.confirmed_password
    ? localErrors.confirmed_password
    : undefined;
  const submitting = isLoading || internalLoading;

  return (
    <div className="min-h-screen min-w-screen flex flex-col bg-white">
      <Header />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <h1 className="text-center text-5xl font-bold text-[#313A34]">
            Change password
          </h1>

          <p className="text-center text-lg text-black font-light ">
            Enter your new password for{" "}
            <span className="text-brand font-bold">{email}</span>.
          </p>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <FieldSet className="gap-4 border border-bordercolor px-10 py-20 rounded-sm">
            <FieldGroup>
              <Field className="gap-2">
                <FieldLabel
                  htmlFor="password"
                  className="text-lg font-medium text-[#1E1E1E]"
                >
                  Password
                </FieldLabel>
                <FieldControl invalid={Boolean(passwordError)}>
                  <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => handleBlur("password")}
                    placeholder="Enter your password"
                    disabled={submitting}
                    className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  />
                </FieldControl>
                <FieldError>{passwordError}</FieldError>
              </Field>

              <Field className="gap-2">
                <FieldLabel
                  htmlFor="confirmed_password"
                  className="text-lg font-medium text-[#1E1E1E]"
                >
                  Confirm password
                </FieldLabel>
                <FieldControl invalid={Boolean(confirmedPasswordError)}>
                  <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <Input
                    id="confirmed_password"
                    type="password"
                    value={confirmed_password}
                    onChange={(e) => setConfirmedPassword(e.target.value)}
                    onBlur={() => handleBlur("confirmed_password")}
                    placeholder="Re-enter your password"
                    disabled={submitting}
                    className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  />
                </FieldControl>
                <FieldError>{confirmedPasswordError}</FieldError>
              </Field>

              <Field>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl text-base"
                  disabled={submitting}
                >
                  {submitting ? <Spinner className="size-6" /> : submitLabel}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>
      </div>
    </div>
  );
}
