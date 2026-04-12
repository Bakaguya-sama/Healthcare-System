import { AuthenticationHeader } from "@repo/ui/components/ui/auth-header";
import {
  FieldSet,
  FieldGroup,
  Field,
  FieldLabel,
  FieldControl,
  FieldError,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { useState } from "react";
import type { FormEvent } from "react";
import { Lock } from "lucide-react";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { showToast } from "@repo/ui/components/ui/toasts";
import { useNavigate } from "react-router-dom";
import { useChangePassword } from "../hooks/useChangePassword";

interface ChangePasswordProps {
  onSubmit?: (values: {
    password: string;
    confirmedPassword: string;
  }) => void | Promise<void>;
  isLoading?: boolean;
  error?: string;
  submitLabel?: string;
}

interface ChangePasswordErrors {
  password?: string;
  confirmedPassword?: string;
}

export function ChangePassword({
  onSubmit,
  isLoading: propIsLoading = false,
  error: propError,
  submitLabel = "Confirm",
}: ChangePasswordProps) {
  const navigate = useNavigate();
  const { changePassword, isLoading, error } = useChangePassword();

  const [password, setPassword] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState("");

  const [touched, setTouched] = useState({
    password: false,
    confirmedPassword: false,
  });
  const [localErrors, setLocalErrors] = useState<ChangePasswordErrors>({});

  function validate(values: {
    password: string;
    confirmedPassword: string;
  }): ChangePasswordErrors {
    const nextErrors: ChangePasswordErrors = {};

    if (!values.password.trim()) {
      nextErrors.password = "Please enter your new password.";
    } else if (values.password.trim().length < 8) {
      nextErrors.password = "New password must have at least 8 characters.";
    }

    if (!values.confirmedPassword.trim()) {
      nextErrors.confirmedPassword = "Please confirm your new password.";
    } else if (values.confirmedPassword.trim() !== values.password.trim()) {
      nextErrors.confirmedPassword = "Your password does not match.";
    }

    return nextErrors;
  }

  function handleBlur(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setLocalErrors(validate({ password, confirmedPassword }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const nextErrors = validate({ password, confirmedPassword });
    setLocalErrors(nextErrors);
    setTouched({ password: true, confirmedPassword: true });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      if (onSubmit) {
        await onSubmit({ password, confirmedPassword });
      } else {
        const email = localStorage.getItem("resetPasswordEmail");
        const otpCode = localStorage.getItem("resetPasswordOtp");

        if (!email || !otpCode) {
          throw new Error(
            "Missing email or OTP. Please restart from Forgot Password.",
          );
        }

        await changePassword({
          email,
          otpCode,
          newPassword: password,
        });
      }

      localStorage.removeItem("resetPasswordEmail");
      localStorage.removeItem("resetPasswordOtp");
      showToast.success("Password reset successfully");
      navigate("/login");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to reset password";
      showToast.error(message);
    }
  }

  const passwordError = touched.password ? localErrors.password : undefined;
  const confirmedPasswordError = touched.confirmedPassword
    ? localErrors.confirmedPassword
    : undefined;

  const submitting = isLoading || propIsLoading;
  const displayError = error || propError;

  return (
    <div className="min-h-screen min-w-screen flex flex-col bg-white">
      <AuthenticationHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <h1 className="text-center text-5xl font-bold text-[#313A34]">
            Change password
          </h1>

          <p className="text-center text-lg text-black font-light ">
            Set a new password for your account.
          </p>

          {displayError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {displayError}
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
                    placeholder="Enter your new password"
                    disabled={submitting}
                    className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  />
                </FieldControl>
                <FieldError>{passwordError}</FieldError>
              </Field>

              <Field className="gap-2">
                <FieldLabel
                  htmlFor="confirmedPassword"
                  className="text-lg font-medium text-[#1E1E1E]"
                >
                  Confirm password
                </FieldLabel>
                <FieldControl invalid={Boolean(confirmedPasswordError)}>
                  <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <Input
                    id="confirmedPassword"
                    type="password"
                    value={confirmedPassword}
                    onChange={(e) => setConfirmedPassword(e.target.value)}
                    onBlur={() => handleBlur("confirmedPassword")}
                    placeholder="Re-enter your new password"
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
