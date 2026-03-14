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

interface ForgetPasswordProps {
  onSubmit: (email: string) => void | Promise<void>;
  isLoading?: boolean;
  error?: string;
}

interface ForgetPasswordErrors {
  email?: string;
}

export function ForgetPassword({
  onSubmit,
  isLoading = false,
  error,
}: ForgetPasswordProps) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState({ email: false });
  const [localErrors, setLocalErrors] = useState<ForgetPasswordErrors>({});

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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const nextErrors = validate({ email });
    setLocalErrors(nextErrors);
    setTouched({ email: true });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    onSubmit(email.trim());
  }

  const emailError = touched.email ? localErrors.email : undefined;
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

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
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
                    disabled={isLoading}
                    className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                  />
                </FieldControl>
                <FieldError>{emailError}</FieldError>
              </Field>

              <Field>
                <Button
                  type="submit"
                  className="h-12 w-full rounded-2xl text-base"
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Verify email"}
                </Button>
              </Field>
            </FieldGroup>
          </FieldSet>
        </form>
      </div>
    </div>
  );
}
