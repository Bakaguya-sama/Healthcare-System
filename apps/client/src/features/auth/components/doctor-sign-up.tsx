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
import { FormEvent, useRef, useState } from "react";
import { Spinner } from "@repo/ui/components/ui/spinner";
import {
  Building2,
  ChevronDown,
  FileText,
  Hospital,
  Lock,
  Phone,
  ShieldCheck,
  Star,
  UploadCloud,
  User,
  X,
} from "lucide-react";

const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE_MB = 10;

export interface DoctorSignUpValues {
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  specialty: string;
  yearsOfExperience: string;
  workplace: string;
  verificationFiles: File[];
}

interface DoctorSignUpErrors {
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  specialty?: string;
  yearsOfExperience?: string;
  workplace?: string;
  verificationFiles?: string;
}

interface DoctorSignUpProps {
  onSubmit?: (values: DoctorSignUpValues) => void | Promise<void>;
  onSwitchRole?: () => void;
  isLoading?: boolean;
  error?: string;
  submitLabel?: string;
}

export function DoctorSignUp({
  onSubmit,
  onSwitchRole,
  isLoading = false,
  error,
  submitLabel = "Submit",
}: DoctorSignUpProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [verificationFiles, setVerificationFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [touched, setTouched] = useState({
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
    specialty: false,
    yearsOfExperience: false,
    workplace: false,
    verificationFiles: false,
  });
  const [localErrors, setLocalErrors] = useState<DoctorSignUpErrors>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const submitting = isLoading || internalLoading;

  function validate(values: DoctorSignUpValues): DoctorSignUpErrors {
    const nextErrors: DoctorSignUpErrors = {};

    if (!values.email.trim()) {
      nextErrors.email = "Please enter your email.";
    } else if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Invalid email.";
    }

    if (!values.phone.trim()) {
      nextErrors.phone = "Please enter your phone number.";
    } else if (!/^\d{9,11}$/.test(values.phone.trim())) {
      nextErrors.phone = "Phone number must be 9-11 digits.";
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

    if (!values.specialty) {
      nextErrors.specialty = "Please select your specialty.";
    }

    if (!values.yearsOfExperience.trim()) {
      nextErrors.yearsOfExperience = "Please enter years of experience.";
    } else if (!/^\d+$/.test(values.yearsOfExperience.trim())) {
      nextErrors.yearsOfExperience = "Years of experience must be a number.";
    }

    if (!values.workplace.trim()) {
      nextErrors.workplace = "Please enter your workplace / hospital.";
    }

    if (values.verificationFiles.length === 0) {
      nextErrors.verificationFiles = "Please upload verification documents.";
    }

    return nextErrors;
  }

  function collectValues(): DoctorSignUpValues {
    return {
      email,
      phone,
      password,
      confirmPassword,
      specialty,
      yearsOfExperience,
      workplace,
      verificationFiles,
    };
  }

  function handleBlur(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setLocalErrors(validate(collectValues()));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const values = collectValues();
    const nextErrors = validate(values);
    setLocalErrors(nextErrors);
    setTouched({
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
      specialty: true,
      yearsOfExperience: true,
      workplace: true,
      verificationFiles: true,
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
        ...values,
        email: values.email.trim(),
        phone: values.phone.trim(),
        yearsOfExperience: values.yearsOfExperience.trim(),
        workplace: values.workplace.trim(),
      });
    } finally {
      setInternalLoading(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) {
      return;
    }

    const incoming = Array.from(files);

    const invalidType = incoming.find(
      (file) => !ACCEPTED_FILE_TYPES.includes(file.type),
    );

    if (invalidType) {
      setFileError("Only PDF, JPG, PNG files are allowed.");
      return;
    }

    const oversize = incoming.find(
      (file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024,
    );

    if (oversize) {
      setFileError(`Each file must be <= ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

    setFileError(null);
    setVerificationFiles((prev) => {
      const merged = [...prev, ...incoming];
      return merged.slice(0, 5);
    });
    setTouched((prev) => ({ ...prev, verificationFiles: true }));
    setLocalErrors((prev) => ({ ...prev, verificationFiles: undefined }));
  }

  function removeFile(index: number) {
    setVerificationFiles((prev) =>
      prev.filter((_, fileIndex) => fileIndex !== index),
    );
  }

  const emailError = touched.email ? localErrors.email : undefined;
  const phoneError = touched.phone ? localErrors.phone : undefined;
  const passwordError = touched.password ? localErrors.password : undefined;
  const confirmPasswordError = touched.confirmPassword
    ? localErrors.confirmPassword
    : undefined;
  const specialtyError = touched.specialty ? localErrors.specialty : undefined;
  const yearsError = touched.yearsOfExperience
    ? localErrors.yearsOfExperience
    : undefined;
  const workplaceError = touched.workplace ? localErrors.workplace : undefined;
  const verificationError = touched.verificationFiles
    ? localErrors.verificationFiles
    : undefined;

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl rounded-sm border border-[#d9d9d9] bg-white px-10 py-8"
    >
      <div className="mb-6 flex flex-row-reverse justify-between gap-4">
        <p className="text-sm font-semibold text-[#6d756f]">
          You&apos;re signing up as <span className="text-brand">Doctor</span>
        </p>
      </div>

      <h1 className="text-5xl text-center font-bold text-[#313A34]">Sign up</h1>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <FieldSet className="gap-4">
        <FieldGroup className="gap-4">
          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="doctor-email"
              className="text-base text-[#1E1E1E]"
            >
              Email
            </FieldLabel>
            <FieldControl invalid={Boolean(emailError)}>
              <User className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="doctor-email"
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
              htmlFor="doctor-phone"
              className="text-base text-[#1E1E1E]"
            >
              Phone number
            </FieldLabel>
            <FieldControl invalid={Boolean(phoneError)}>
              <Phone className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="doctor-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => handleBlur("phone")}
                placeholder="Enter your phone number"
                disabled={submitting}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </FieldControl>
            <FieldError>{phoneError}</FieldError>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="doctor-password"
              className="text-base font-medium text-[#1E1E1E]"
            >
              Password
            </FieldLabel>
            <FieldControl invalid={Boolean(passwordError)}>
              <Lock className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="doctor-password"
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
              htmlFor="doctor-confirm-password"
              className="text-base font-medium text-[#1E1E1E]"
            >
              Password
            </FieldLabel>
            <FieldControl invalid={Boolean(confirmPasswordError)}>
              <Lock className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="doctor-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleBlur("confirmPassword")}
                placeholder="Re-enter your password"
                disabled={submitting}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </FieldControl>
            <FieldError>{confirmPasswordError}</FieldError>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="specialty"
              className="text-base text-[#1E1E1E]"
            >
              Specialty
            </FieldLabel>
            <FieldControl invalid={Boolean(specialtyError)} className="pr-2">
              <Building2 className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <select
                id="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                onBlur={() => handleBlur("specialty")}
                disabled={submitting}
                className="w-full appearance-none bg-transparent text-sm text-[#394147] outline-none"
              >
                <option value="">Select your specialty</option>
                <option value="Cardiology">Cardiology</option>
                <option value="Dermatology">Dermatology</option>
                <option value="Neurology">Neurology</option>
                <option value="Pediatrics">Pediatrics</option>
                <option value="General Medicine">General Medicine</option>
              </select>
              <ChevronDown className="h-5 w-5 shrink-0 text-[#9aa1af]" />
            </FieldControl>
            <FieldError>{specialtyError}</FieldError>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="years" className="text-base text-[#1E1E1E]">
              Years of Experience
            </FieldLabel>
            <FieldControl invalid={Boolean(yearsError)}>
              <Star className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="years"
                type="text"
                value={yearsOfExperience}
                onChange={(e) => setYearsOfExperience(e.target.value)}
                onBlur={() => handleBlur("yearsOfExperience")}
                placeholder="e.g. 8"
                disabled={submitting}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </FieldControl>
            <FieldError>{yearsError}</FieldError>
          </Field>

          <Field className="gap-1.5">
            <FieldLabel
              htmlFor="workplace"
              className="text-base text-[#1E1E1E]"
            >
              Current workplace / Hospital
            </FieldLabel>
            <FieldControl invalid={Boolean(workplaceError)}>
              <Hospital className="h-5 w-5 shrink-0 text-[#b5bcc8]" />
              <Input
                id="workplace"
                type="text"
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value)}
                onBlur={() => handleBlur("workplace")}
                placeholder="e.g. Tu Du Hospital"
                disabled={submitting}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </FieldControl>
            <FieldError>{workplaceError}</FieldError>
          </Field>

          <div className="overflow-hidden rounded-2xl border border-[#d9e5db] bg-[#f6fbf7]">
            <div className="flex items-center justify-between border-b border-[#d9e5db] bg-[#ebf7ef] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-[#dcf5e4] p-1.5 text-[#4ea96c]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#2f3a33]">
                    Professional Verification
                  </p>
                  <p className="text-xs text-[#7d8b80]">
                    Required to activate your account
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#f8efc7] px-2 py-0.5 text-[11px] font-semibold text-[#9c8732]">
                Required
              </span>
            </div>

            <div className="space-y-3 px-4 py-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />

              <div className="rounded-xl border border-dashed border-[#cfd7d3] bg-white px-6 py-8 text-center">
                <div className="mx-auto mb-3 w-fit rounded-full bg-[#eff2f6] p-3 text-[#98a1ad]">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <p className="text-base font-semibold text-[#374151]">
                  Drag &amp; Drop your documents here
                </p>
                <p className="mt-1 text-xs text-[#8a93a3]">
                  Please upload your Medical Degree and Practice License
                </p>
                <p className="mb-3 mt-1 text-xs text-[#8a93a3]">
                  PDF, JPG, PNG, MAX 10 MB per file
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-lg border-[#d6e3d8] px-4 text-xs text-[#5e946f]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                >
                  Browse Files
                </Button>
              </div>

              {fileError ? (
                <p className="text-sm font-semibold text-[#d64545]">
                  {fileError}
                </p>
              ) : null}

              {verificationError ? (
                <p className="text-sm font-semibold text-[#d64545]">
                  {verificationError}
                </p>
              ) : null}

              {verificationFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#94a19a]">
                    UPLOADED FILES
                  </p>
                  {verificationFiles.map((file, index) => {
                    const fileSizeMb = Math.max(file.size / 1024 / 1024, 0.01);
                    return (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between rounded-xl border border-[#cfe6d5] bg-[#eef8f1] px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="rounded-full bg-white p-1.5 text-[#6ba97f]">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#3b4a40]">
                              {file.name}
                            </p>
                            <p className="text-[11px] text-[#95a39a]">
                              {fileSizeMb.toFixed(2)} Mb
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[#ddf4e6] px-2 py-0.5 text-xs font-semibold text-[#4a9f68]">
                            Ready
                          </span>
                          <button
                            type="button"
                            className="text-[#94a39a] hover:text-[#687873]"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <p className="text-center text-lg font-semibold text-[#6d756f]">
            <button
              type="button"
              onClick={onSwitchRole}
              className="font-bold text-brand hover:text-brand-hover"
            >
              Click here
            </button>{" "}
            if you want just to experience our services.
          </p>

          <Field className="pt-1">
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
