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
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Mail } from "lucide-react";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { showToast } from "@repo/ui/components/ui/toasts";
import { useNavigate } from "react-router-dom";
import { useForgotPassword } from "../hooks/useForgotPassword";

interface ForgetPasswordProps {
  onSubmit?: (email: string) => void | Promise<void>;
  isLoading?: boolean;
  error?: string;
  submitLabel?: string;
}

interface ForgetPasswordErrors {
  email?: string;
}

export function ForgetPassword({
  onSubmit,
  isLoading: propIsLoading = false,
  error: propError,
  submitLabel = "Verify email",
}: ForgetPasswordProps) {
  const navigate = useNavigate();
  const { sendOtp, isLoading, error } = useForgotPassword();

  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState({ email: false });
  const [localErrors, setLocalErrors] = useState<ForgetPasswordErrors>({});
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => {
        setCooldown(cooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  function validate(values: { email: string }): ForgetPasswordErrors {
    const nextErrors: ForgetPasswordErrors = {};

    if (!values.email.trim()) {
      nextErrors.email = "Please enter your email.";
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Invalid email.";
    }

    return nextErrors;
  }

  function handleBlur() {
    setTouched({ email: true });
    setLocalErrors(validate({ email }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const nextErrors = validate({ email });
    setLocalErrors(nextErrors);
    setTouched({ email: true });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      if (onSubmit) {
        await onSubmit(email.trim());
      } else {
        await sendOtp({ email: email.trim() });
      }

      setCooldown(60);

      localStorage.setItem("resetPasswordEmail", email.trim());
      showToast.success("OTP has been sent to your email");
      navigate("/confirm-otp");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to send OTP";
      showToast.error(message);
    }
  }

  const emailError = touched.email ? localErrors.email : undefined;
  const submitting = isLoading || propIsLoading;
  const displayError = error || propError;

  const isButtonDisabled = submitting || cooldown > 0;
  const buttonLabel = cooldown > 0 ? `Try again in ${cooldown}s` : submitLabel;

  return (
    <div className="min-h-screen min-w-screen flex flex-col bg-white">
      <AuthenticationHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <p className="text-center text-5xl font-bold text-[#313A34] mb-2">
            Enter your email
          </p>

          <p className="text-center text-lg text-black font-light ">
            Enter your email to receive OTP.
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
                  htmlFor="email"
                  className="text-lg font-medium text-[#1E1E1E]"
                >
                  Email
                </FieldLabel>
                <FieldControl invalid={Boolean(emailError)}>
                  <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Re-enter your email account"
                    disabled={submitting}
                    className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  />
                </FieldControl>
                <FieldError>{emailError}</FieldError>
              </Field>

              <Field>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl text-base"
                  disabled={isButtonDisabled}
                >
                  {submitting ? <Spinner className="size-6" /> : buttonLabel}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>
      </div>
    </div>
  );
}
