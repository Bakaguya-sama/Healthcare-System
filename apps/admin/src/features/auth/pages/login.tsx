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
import { FormEvent, useState } from "react";
import { Lock, User } from "lucide-react";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { showToast } from "@repo/ui/components/ui/toasts";
import { useNavigate } from "react-router-dom";
import { useLogin } from "../hooks/useLogin";

interface LoginFormProps {
  /** Xử lý submit — nhận email và password */
  onSubmit?: (values: {
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

interface LoginFormErrors {
  email?: string;
  password?: string;
}

export function LogIn({
  onSubmit,
  isLoading: propIsLoading = false,
  error: propError,
  submitLabel = "Log in",
  forgotPasswordHref,
}: LoginFormProps) {
  const navigate = useNavigate();
  const { login, isLoading, error, data } = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [localErrors, setLocalErrors] = useState<LoginFormErrors>({});

  function validate(values: {
    email: string;
    password: string;
  }): LoginFormErrors {
    const nextErrors: LoginFormErrors = {};

    if (!values.email.trim()) {
      nextErrors.email = "Please enter your email.";
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Invalid email.";
    }

    if (!values.password) {
      nextErrors.password = "Please enter your password.";
    } else if (values.password.length < 6) {
      nextErrors.password = "Your password must have at least 6 characters.";
    }

    return nextErrors;
  }

  function handleBlur(field: "email" | "password") {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setLocalErrors(validate({ email, password }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const nextErrors = validate({ email, password });
    setLocalErrors(nextErrors);
    setTouched({ email: true, password: true });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      if (onSubmit) {
        await onSubmit({ email: email.trim(), password });
      } else {
        const response = await login({ email: email.trim(), password });

        if (response && response.accessToken) {
          // Store tokens in localStorage
          localStorage.setItem("accessToken", response.accessToken);
          localStorage.setItem("refreshToken", response.refreshToken);

          if (rememberMe) {
            localStorage.setItem("rememberedEmail", response.user.email);
          }

          showToast.success(`Welcome, ${response.user.fullName}!`);
          navigate("/");
        }
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Login failed";
      showToast.error(message);
    }
  }

  const emailError = touched.email ? localErrors.email : undefined;
  const passwordError = touched.password ? localErrors.password : undefined;
  const submitting = isLoading || propIsLoading;
  const displayError = error || propError;

  return (
    <>
      <div className="min-h-screen min-w-screen flex flex-col bg-white">
        <AuthenticationHeader />
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
            <h1 className="text-center text-5xl font-bold text-[#313A34]">
              Sign in
            </h1>

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
                    <User className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => handleBlur("email")}
                      placeholder="Enter your email account"
                      disabled={submitting}
                      className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
                    />
                  </FieldControl>
                  <FieldError>{emailError}</FieldError>
                </Field>

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
                      autoComplete="current-password"
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

                <Field
                  orientation="horizontal"
                  className="items-center justify-between pt-1"
                >
                  <label htmlFor="remember" className="flex items-center gap-3">
                    <input
                      id="remember"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-5 w-5 rounded border-input accent-brand"
                      disabled={submitting}
                    />
                    <span className="text-sm text-muted-foreground">
                      Remember me
                    </span>
                  </label>

                  <a
                    href={forgotPasswordHref}
                    onClick={() => {
                      navigate("/forget-password");
                    }}
                    className="text-base font-medium text-brand hover:text-brand-hover cursor-pointer"
                  >
                    Forget your password?
                  </a>
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
    </>
  );
}
