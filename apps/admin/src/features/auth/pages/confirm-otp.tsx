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
import { Mail } from "lucide-react";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { showToast } from "@repo/ui/components/ui/toasts";
import { useNavigate } from "react-router-dom";
import { useConfirmOtp } from "../hooks/useConfirmOtp";

interface ConfirmOTPProps {
  onSubmit?: (otp: string) => void | Promise<void>;
  isLoading?: boolean;
  error?: string;
  submitLabel?: string;
}

interface ConfirmOTPErrors {
  otp?: string;
}

export function ConfirmOTP({
  onSubmit,
  isLoading: propIsLoading = false,
  error: propError,
  submitLabel = "Verify OTP",
}: ConfirmOTPProps) {
  const navigate = useNavigate();
  const { confirmOtp, isLoading, error } = useConfirmOtp();

  const [otp, setOTP] = useState("");

  const [touched, setTouched] = useState({
    otp: false,
  });
  const [localErrors, setLocalErrors] = useState<ConfirmOTPErrors>({});

  function validate(values: { otp: string }): ConfirmOTPErrors {
    const nextErrors: ConfirmOTPErrors = {};

    if (!values.otp.trim()) {
      nextErrors.otp = "Please enter the OTP.";
    } else if (!/^\d{4,8}$/.test(values.otp.trim())) {
      nextErrors.otp = "OTP must be 4-8 digits.";
    }

    return nextErrors;
  }

  function handleBlur() {
    setTouched({ otp: true });
    setLocalErrors(validate({ otp }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const nextErrors = validate({ otp });
    setLocalErrors(nextErrors);
    setTouched({ otp: true });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      if (onSubmit) {
        await onSubmit(otp.trim());
      } else {
        const email = localStorage.getItem("resetPasswordEmail");

        if (!email) {
          throw new Error(
            "Missing email. Please restart from Forgot Password.",
          );
        }

        await confirmOtp({
          email,
          otpCode: otp.trim(),
        });

        localStorage.setItem("resetPasswordOtp", otp.trim());
      }

      showToast.success("OTP verified. Please set your new password.");
      navigate("/change-password");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to verify OTP";
      showToast.error(message);
    }
  }

  const otpError = touched.otp ? localErrors.otp : undefined;
  const submitting = isLoading || propIsLoading;
  const displayError = error || propError;

  return (
    <div className="min-h-screen min-w-screen flex flex-col bg-white">
      <AuthenticationHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <p className="text-center text-5xl font-bold text-[#313A34] mb-2">
            Verify OTP
          </p>

          <p className="text-center text-lg text-black font-light ">
            Enter the code from our email sent to you.
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
                  htmlFor="otp"
                  className="text-lg font-medium text-[#1E1E1E]"
                >
                  OTP
                </FieldLabel>
                <FieldControl invalid={Boolean(otpError)}>
                  <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={otp}
                    onChange={(e) => setOTP(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Enter your OTP"
                    disabled={submitting}
                    className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  />
                </FieldControl>
                <FieldError>{otpError}</FieldError>
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
