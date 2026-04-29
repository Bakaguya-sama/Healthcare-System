import {
  Field,
  FieldControl,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { FormEvent, useState } from "react";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { Lock, Phone, User } from "lucide-react";

export interface PatientSignUpValues {
  email: string;
  fullName: string; // Added
  phoneNumber: string; // Changed from 'phone'
  password: string;
  confirmPassword: string;
}

interface PatientSignUpErrors {
  email?: string;
  fullName?: string; // Added
  phoneNumber?: string; // Changed from 'phone'
  password?: string;
  confirmPassword?: string;
}

interface PatientSignUpProps {
  onSubmit?: (values: PatientSignUpValues) => void | Promise<void>;
  onSwitchRole?: () => void;
  isLoading?: boolean;
  error?: string;
  submitLabel?: string;
}

export function PatientSignUp({
  onSubmit,
  onSwitchRole,
  isLoading = false,
  error,
  submitLabel = "Create account",
}: PatientSignUpProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState(""); // New state for full name
  const [phoneNumber, setPhoneNumber] = useState(""); // Changed from 'phone'
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [internalLoading, setInternalLoading] = useState(false);
  const [touched, setTouched] = useState({
    email: false,
    fullName: false, // Added
    phoneNumber: false, // Changed from 'phone'
    password: false,
    confirmPassword: false,
  });
  const [localErrors, setLocalErrors] = useState<PatientSignUpErrors>({});

  const submitting = isLoading || internalLoading;

  function validate(values: PatientSignUpValues): PatientSignUpErrors {
    const nextErrors: PatientSignUpErrors = {};

    if (!values.email.trim()) {
      nextErrors.email = "Please enter your email.";
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Invalid email.";
    }

    if (!values.fullName.trim()) {
      nextErrors.fullName = "Please enter your full name.";
    }

    if (!values.phoneNumber.trim()) {
      nextErrors.phoneNumber = "Please enter your phone number.";
    } else if (!/^\d{9,11}$/.test(values.phoneNumber.trim())) {
      nextErrors.phoneNumber = "Phone number must be 9-11 digits.";
    }

    if (!values.password) {
      nextErrors.password = "Please enter your password.";
    } else if (values.password.length < 6) {
      nextErrors.password = "Your password must have at least 6 characters.";
    }

    if (!values.confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password.";
    } else if (values.confirmPassword !== values.password) {
      nextErrors.confirmPassword = "Password do not match!";
    }

    return nextErrors;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const values: PatientSignUpValues = {
      email,
      fullName, // Include fullName
      phoneNumber, // Use phoneNumber
      password,
      confirmPassword,
    };

    const nextErrors = validate(values);
    setLocalErrors(nextErrors);
    setTouched({
      email: true,
      fullName: true, // Mark fullName as touched
      phoneNumber: true, // Mark phoneNumber as touched
      password: true,
      confirmPassword: true,
    });

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (!onSubmit) {
      return;
    }

    try {
      setInternalLoading(true);
      await onSubmit({
        email: email.trim(),
        fullName: fullName.trim(), // Trim fullName
        phoneNumber: phoneNumber.trim(), // Trim phoneNumber
        password,
        confirmPassword,
      });
    } finally {
      setInternalLoading(false);
    }
  }

  function handleBlur(field: keyof Omit<typeof touched, "confirmPassword">) {
    setTouched((prev) => ({ ...prev, [field]: true })); // Mark the field as touched
    setLocalErrors(
      validate({ email, fullName, phoneNumber, password, confirmPassword }),
    );
  }

  const emailError = touched.email ? localErrors.email : undefined;
  const fullNameError = touched.fullName ? localErrors.fullName : undefined; // New error variable
  const phoneNumberError = touched.phoneNumber
    ? localErrors.phoneNumber
    : undefined;
  const passwordError = touched.password ? localErrors.password : undefined;
  const confirmPasswordError = touched.confirmPassword
    ? localErrors.confirmPassword
    : undefined;

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl rounded-sm border border-[#d9d9d9] bg-white px-10 py-8"
    >
      <div className="mb-6 flex flex-row-reverse justify-between gap-4">
        <p className="text-sm font-semibold text-[#6d756f]">
          You&apos;re signing up as <span className="text-brand">Patient</span>
        </p>
      </div>

      <h1 className="text-5xl text-center font-bold text-[#313A34]">Sign up</h1>

      {error && (
        <div className="mb-5 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <FieldSet className="gap-4">
        <FieldGroup>
          <Field className="gap-1.5">
            <FieldLabel htmlFor="email" className="text-base text-[#1E1E1E]">
              Email
            </FieldLabel>
            <FieldControl invalid={Boolean(emailError)}>
              <User className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
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

          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="patient-fullName"
              className="text-base text-[#1E1E1E]"
            >
              Full Name
            </FieldLabel>
            <FieldControl invalid={Boolean(fullNameError)}>
              <User className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="patient-fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => handleBlur("fullName")}
                placeholder="Enter your full name"
                disabled={submitting}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </FieldControl>
            <FieldError>{fullNameError}</FieldError>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="patient-phone"
              className="text-base text-[#1E1E1E]"
            >
              Phone number
            </FieldLabel>
            <FieldControl invalid={Boolean(phoneNumberError)}>
              <Phone className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="patient-phone"
                type="tel"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                onBlur={() => handleBlur("phoneNumber")}
                placeholder="Enter your phone number"
                disabled={submitting}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </FieldControl>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="password"
              className="text-base font-medium text-[#1E1E1E]"
            >
              Password
            </FieldLabel>
            <FieldControl invalid={Boolean(passwordError)}>
              <Lock className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
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

          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="confirm-password"
              className="text-base font-medium text-[#1E1E1E]"
            >
              Password
            </FieldLabel>
            <FieldControl invalid={Boolean(confirmPasswordError)}>
              <Lock className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleBlur("confirmPassword")}
                placeholder="Enter your password"
                disabled={submitting}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </FieldControl>
            {confirmPasswordError ? (
              <div className="rounded-xl border border-[#f3a2a2] bg-[#fff4f4] px-3 py-2 text-sm font-semibold text-[#d64545]">
                ERROR: {confirmPasswordError}
              </div>
            ) : null}
          </Field>

          <p className="text-center text-lg font-semibold text-[#6d756f]">
            Want to be our doctors?{" "}
            <button
              type="button"
              onClick={onSwitchRole}
              className="font-bold text-brand hover:text-brand-hover"
            >
              Click here to submit.
            </button>
          </p>

          <Field className="pt-2">
            <Button
              type="submit"
              className="h-11 w-full rounded-2xl text-base font-semibold"
              disabled={submitting}
            >
              {submitting ? <Spinner className="size-5" /> : submitLabel}
            </Button>
          </Field>

          <p className="text-center text-sm text-[#7b8192]">
            Already have your account?{" "}
            <a
              href="/login"
              className="font-semibold text-brand hover:text-brand-hover"
            >
              Back to Log in
            </a>
          </p>
        </FieldGroup>
      </FieldSet>
    </form>
  );
}
