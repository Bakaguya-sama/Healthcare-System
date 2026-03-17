import { Header } from "@/components/ui/authen_header";
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
import { Mail } from "lucide-react";
import { Spinner } from "@repo/ui/components/spinner";
import { showToast } from "@repo/ui/components/toasts";
import { toast } from "react-toastify";

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
  isLoading = false,
  error,
  submitLabel = "Verify email",
}: ForgetPasswordProps) {
  const [email, setEmail] = useState("");
  const [internalLoading, setInternalLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false });
  const [localErrors, setLocalErrors] = useState<ForgetPasswordErrors>({});

  async function handleForgetPassword(values: { email: string }) {
    // Placeholder: thay phần này bằng call API quên mật khẩu khi backend sẵn sàng.
    console.log("[TODO] Forget password payload", values);
  }

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

    const submitHandler =
      onSubmit ??
      ((nextEmail: string) => handleForgetPassword({ email: nextEmail }));

    try {
      setInternalLoading(true);
      await submitHandler(email.trim());
    } finally {
      setInternalLoading(false);
    }
  }

  const emailError = touched.email ? localErrors.email : undefined;
  const submitting = isLoading || internalLoading;
  return (
    <div className="min-h-screen min-w-screen flex flex-col bg-white">
      <Header />
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
