import { AuthenticationHeader } from "@/components/ui/auth-header";
import {
  FieldSet,
  FieldGroup,
  Field,
  FieldLabel,
  FieldControl,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";

interface ConfirmOTPProps {
  onSubmit: (otp: string) => void | Promise<void>;
  isLoading?: boolean;
  error?: string;
}

interface ConfirmOTPErrors {
  otp?: string;
}

export function ConfirmOTP({
  onSubmit,
  isLoading = false,
  error,
}: ConfirmOTPProps) {
  const [otp, setOTP] = useState("");
  const [touched, setTouched] = useState({ otp: false });
  const [localErrors, setLocalErrors] = useState<ConfirmOTPErrors>({});

  function validate(values: { otp: string }): ConfirmOTPErrors {
    const nextErrors: ConfirmOTPErrors = {};
    if (!values.otp.trim()) {
      nextErrors.otp = "Please enter the OTP.";
    } else if (!/^\d{4,8}$/.test(values.otp.trim())) {
      nextErrors.otp = "OTP must be 4–8 digits.";
    }
    return nextErrors;
  }

  function handleBlur() {
    setTouched({ otp: true });
    setLocalErrors(validate({ otp }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const nextErrors = validate({ otp });
    setLocalErrors(nextErrors);
    setTouched({ otp: true });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onSubmit(otp.trim());
  }

  const otpError = touched.otp ? localErrors.otp : undefined;
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

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
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
                    disabled={isLoading}
                    className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  />
                </FieldControl>
                <FieldError>{otpError}</FieldError>
              </Field>

              <Field>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl text-base"
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Verify OTP"}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>
      </div>
    </div>
  );
}
