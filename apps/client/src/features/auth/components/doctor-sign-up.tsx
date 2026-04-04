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

export const doctorSpecialty = [
  { id: "general_practitioner", name: "General Practitioner" },
  { id: "internal_medicine", name: "Internal Medicine" },
  { id: "cardiology", name: "Cardiology" },
  { id: "dermatology", name: "Dermatology" },
  { id: "neurology", name: "Neurology" },
  { id: "orthopedics", name: "Orthopedics" },
  { id: "pediatrics", name: "Pediatrics" },
  { id: "obstetrics_gynecology", name: "Obstetrics & Gynecology" },
  { id: "ophthalmology", name: "Ophthalmology" },
  { id: "ent", name: "Ear, Nose, and Throat (ENT)" },
  { id: "psychiatry", name: "Psychiatry" },
  { id: "radiology", name: "Radiology" },
  { id: "anesthesiology", name: "Anesthesiology" },
  { id: "emergency_medicine", name: "Emergency Medicine" },
  { id: "family_medicine", name: "Family Medicine" },
  { id: "endocrinology", name: "Endocrinology" },
  { id: "gastroenterology", name: "Gastroenterology" },
  { id: "hematology", name: "Hematology" },
  { id: "nephrology", name: "Nephrology" },
  { id: "oncology", name: "Oncology" },
  { id: "pulmonology", name: "Pulmonology" },
  { id: "urology", name: "Urology" },
  { id: "rheumatology", name: "Rheumatology" },
  { id: "infectious_disease", name: "Infectious Disease" },
  { id: "plastic_surgery", name: "Plastic Surgery" },
  { id: "general_surgery", name: "General Surgery" },
  { id: "neurosurgery", name: "Neurosurgery" },
  { id: "cardiothoracic_surgery", name: "Cardiothoracic Surgery" },
  { id: "rehabilitation", name: "Physical Medicine & Rehabilitation" },
  { id: "sports_medicine", name: "Sports Medicine" },
  { id: "allergy_immunology", name: "Allergy & Immunology" },
  { id: "geriatrics", name: "Geriatrics" },
  { id: "preventive_medicine", name: "Preventive Medicine" },
];
const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE_MB = 10;
const PREFILL_API_URL =
  import.meta.env.VITE_DOCTOR_PREFILL_API_URL ??
  "/api/v1/auth/doctor/re-register-prefill";

type DoctorVerificationStatus = "rejected" | "pending" | "approved";

type ExistingVerificationDocument = {
  id: string;
  publicId: string | null;
  originalFilename: string;
  resourceType: "image" | "raw" | "video";
  format: string | null;
  bytes: number | null;
  secureUrl: string;
  uploadedAt: string | null;
};

type DoctorReRegisterSeed = {
  email: string;
  verificationStatus: DoctorVerificationStatus;
  rejectReason: string | null;
  phone: string;
  specialty: string;
  yearsOfExperience: string;
  workplace: string;
  existingDocuments: ExistingVerificationDocument[];
};

type DoctorReRegisterPrefillApiResponse = {
  email?: string;
  phone?: string;
  phoneNumber?: string;
  specialty?: string;
  workplace?: string;
  yearsOfExperience?: string | number | null;
  experienceYears?: string | number | null;
  verificationStatus?: DoctorVerificationStatus;
  verification_status?: DoctorVerificationStatus;
  rejectReason?: string | null;
  reason?: string | null;
  existingDocuments?: ExistingVerificationDocument[];
  verificationDocuments?: string[];
  verification_documents?: string[];
};

type PrefillNotice = {
  tone: "info" | "success" | "error";
  message: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function preprocessReRegisterSeed(
  payload: DoctorReRegisterPrefillApiResponse,
): DoctorReRegisterSeed {
  const verificationStatus =
    payload.verificationStatus ?? payload.verification_status ?? "pending";
  const yearsOfExperienceRaw =
    payload.yearsOfExperience ?? payload.experienceYears ?? "";
  const existingDocumentsFromMetadata = payload.existingDocuments ?? [];
  const existingDocumentLinks =
    payload.verificationDocuments ?? payload.verification_documents ?? [];

  const existingDocuments =
    existingDocumentsFromMetadata.length > 0
      ? existingDocumentsFromMetadata
      : existingDocumentLinks.map((documentUrl, index) => {
          const strippedQuery = documentUrl.split("?")[0];
          const fallbackName = `document-${index + 1}`;
          const originalFilename =
            decodeURIComponent(
              strippedQuery.split("/").pop() || fallbackName,
            ) || fallbackName;
          const format = originalFilename.includes(".")
            ? originalFilename.split(".").pop()?.toLowerCase() || null
            : null;

          return {
            id: `existing-${index + 1}`,
            publicId: null,
            originalFilename,
            resourceType:
              format &&
              ["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(format)
                ? "image"
                : "raw",
            format,
            bytes: null,
            secureUrl: documentUrl,
            uploadedAt: null,
          } satisfies ExistingVerificationDocument;
        });

  return {
    email: normalizeEmail(payload.email ?? ""),
    verificationStatus,
    rejectReason: payload.rejectReason ?? payload.reason ?? null,
    phone: (payload.phone ?? payload.phoneNumber ?? "").trim(),
    specialty: (payload.specialty ?? "").trim(),
    yearsOfExperience: String(yearsOfExperienceRaw ?? "").trim(),
    workplace: (payload.workplace ?? "").trim(),
    existingDocuments,
  };
}

function isImageDocument(document: ExistingVerificationDocument): boolean {
  return document.resourceType === "image";
}

function isPdfDocument(document: ExistingVerificationDocument): boolean {
  return document.format?.toLowerCase() === "pdf";
}

export interface DoctorSignUpValues {
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  specialty: string;
  yearsOfExperience: string;
  workplace: string;
  verificationFiles: File[];
  newFiles: File[];
  keepDocumentIds: string[];
  removeDocumentIds: string[];
  existingDocuments: ExistingVerificationDocument[];
  verificationStatus: DoctorVerificationStatus | null;
  rejectReason: string | null;
  isReRegister: boolean;
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
  const [existingDocuments, setExistingDocuments] = useState<
    ExistingVerificationDocument[]
  >([]);
  const [removedDocumentIds, setRemovedDocumentIds] = useState<string[]>([]);
  const [replacementFilesByDocumentId, setReplacementFilesByDocumentId] =
    useState<Record<string, File>>({});
  const [verificationStatus, setVerificationStatus] =
    useState<DoctorVerificationStatus | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [isReRegisterMode, setIsReRegisterMode] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState<PrefillNotice | null>(
    null,
  );
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

  const replacementFiles = Object.values(replacementFilesByDocumentId);
  const newFiles = [...verificationFiles, ...replacementFiles];

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

    const hasExistingDocumentToKeep = values.keepDocumentIds.length > 0;
    const hasNewFiles = values.newFiles.length > 0;

    if (!hasExistingDocumentToKeep && !hasNewFiles) {
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
      verificationFiles: newFiles,
      newFiles,
      keepDocumentIds: existingDocuments
        .filter((doc) => !removedDocumentIds.includes(doc.id))
        .map((doc) => doc.id),
      removeDocumentIds: removedDocumentIds,
      existingDocuments,
      verificationStatus,
      rejectReason,
      isReRegister: isReRegisterMode,
    };
  }

  function handleBlur(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setLocalErrors(validate(collectValues()));
  }

  async function fetchDoctorVerificationSeedByEmail(
    emailValue: string,
  ): Promise<DoctorReRegisterSeed | null> {
    const query = encodeURIComponent(emailValue);
    const response = await fetch(`${PREFILL_API_URL}?email=${query}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      let message = "Failed to load previous registration data.";
      try {
        const json = (await response.json()) as { message?: string };
        if (json.message) {
          message = json.message;
        }
      } catch {
        // Keep fallback message.
      }
      throw new Error(message);
    }

    const payload =
      (await response.json()) as DoctorReRegisterPrefillApiResponse;
    return preprocessReRegisterSeed(payload);
  }

  async function handlePrefillFromPreviousRegistration() {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      setTouched((prev) => ({ ...prev, email: true }));
      setLocalErrors((prev) => ({
        ...prev,
        email: "Please enter your email first.",
      }));
      setPrefillNotice({
        tone: "error",
        message: "Enter your email before loading previous application data.",
      });
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setTouched((prev) => ({ ...prev, email: true }));
      setLocalErrors((prev) => ({ ...prev, email: "Invalid email." }));
      setPrefillNotice({
        tone: "error",
        message: "Invalid email format.",
      });
      return;
    }

    setPrefillLoading(true);
    setPrefillNotice(null);
    setFileError(null);

    try {
      const seedResponse =
        await fetchDoctorVerificationSeedByEmail(normalizedEmail);

      if (!seedResponse) {
        setPrefillNotice({
          tone: "info",
          message: "No previous registration data found for this email.",
        });
        return;
      }

      const seed = seedResponse;
      setEmail(seed.email);
      setVerificationStatus(seed.verificationStatus);
      setRejectReason(seed.rejectReason);

      if (seed.verificationStatus !== "rejected") {
        setIsReRegisterMode(false);
        setExistingDocuments([]);
        setRemovedDocumentIds([]);
        setReplacementFilesByDocumentId({});
        setPrefillNotice({
          tone: "info",
          message:
            seed.verificationStatus === "pending"
              ? "This account is under review. Re-registration is not available yet."
              : "This account is already approved.",
        });
        return;
      }

      setIsReRegisterMode(true);

      setPhone(seed.phone);
      setSpecialty(seed.specialty);
      setYearsOfExperience(seed.yearsOfExperience);
      setWorkplace(seed.workplace);
      setExistingDocuments(seed.existingDocuments);
      setRemovedDocumentIds([]);
      setReplacementFilesByDocumentId({});

      setVerificationFiles([]);

      setPrefillNotice({
        tone: "success",
        message:
          "Loaded previous data and existing documents. You can keep, replace, or remove old files before resubmitting.",
      });
      setTouched((prev) => ({
        ...prev,
        phone: true,
        specialty: true,
        yearsOfExperience: true,
        workplace: true,
      }));
      setLocalErrors((prev) => ({
        ...prev,
        email: undefined,
        phone: undefined,
        specialty: undefined,
        yearsOfExperience: undefined,
        workplace: undefined,
        verificationFiles: undefined,
      }));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load previous registration data.";
      setPrefillNotice({ tone: "error", message });
    } finally {
      setPrefillLoading(false);
    }
  }

  function validateIncomingFiles(incoming: File[]) {
    const invalidType = incoming.find(
      (file) => !ACCEPTED_FILE_TYPES.includes(file.type),
    );

    if (invalidType) {
      return "Only PDF, JPG, PNG files are allowed.";
    }

    const oversize = incoming.find(
      (file) => file.size > MAX_FILE_SIZE_MB * 1024 * 1024,
    );

    if (oversize) {
      return `Each file must be <= ${MAX_FILE_SIZE_MB} MB.`;
    }

    return null;
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

    const errorMessage = validateIncomingFiles(incoming);
    if (errorMessage) {
      setFileError(errorMessage);
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

  function handleReplaceExistingDocument(
    documentId: string,
    file: File | null,
  ) {
    if (!file) {
      return;
    }

    const errorMessage = validateIncomingFiles([file]);
    if (errorMessage) {
      setFileError(errorMessage);
      return;
    }

    setFileError(null);
    setReplacementFilesByDocumentId((prev) => ({
      ...prev,
      [documentId]: file,
    }));
    setRemovedDocumentIds((prev) =>
      prev.includes(documentId) ? prev : [...prev, documentId],
    );
    setTouched((prev) => ({ ...prev, verificationFiles: true }));
    setLocalErrors((prev) => ({ ...prev, verificationFiles: undefined }));
  }

  function handleToggleRemoveExistingDocument(documentId: string) {
    setRemovedDocumentIds((prev) => {
      if (prev.includes(documentId)) {
        return prev.filter((id) => id !== documentId);
      }
      return [...prev, documentId];
    });
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (prefillNotice) {
                    setPrefillNotice(null);
                  }
                }}
                onBlur={() => handleBlur("email")}
                placeholder="Enter your email account"
                disabled={submitting}
                className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </FieldControl>
            <FieldError>{emailError}</FieldError>
            <div className="mt-1 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrefillFromPreviousRegistration}
                disabled={submitting || prefillLoading}
                className="h-8 rounded-lg border-[#d6e3d8] px-3 text-xs text-[#4f8d64]"
              >
                {prefillLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="size-4" />
                    Checking...
                  </span>
                ) : (
                  "Load previous registration data"
                )}
              </Button>
              <p className="text-xs text-[#7b8192]">
                For doctors with previous rejected verification.
              </p>
            </div>
            {prefillNotice && (
              <p
                className={`text-sm font-medium ${
                  prefillNotice.tone === "error"
                    ? "text-[#d64545]"
                    : prefillNotice.tone === "success"
                      ? "text-[#2f8f4e]"
                      : "text-[#5d6b81]"
                }`}
              >
                {prefillNotice.message}
              </p>
            )}
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
                className="w-full ml-2 appearance-none bg-transparent text-base text-[#394147] outline-none"
              >
                <option value="">Select your specialty</option>
                {doctorSpecialty.map((spe) => (
                  <option value={spe.name}>{spe.name}</option>
                ))}
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

          {isReRegisterMode && rejectReason && (
            <div className="rounded-xl border border-[#f2d6d6] bg-[#fff5f5] px-4 py-3">
              <p className="text-sm font-bold text-[#a23f3f]">
                Previous reject reason
              </p>
              <p className="mt-1 text-sm text-[#7a4a4a]">{rejectReason}</p>
            </div>
          )}

          {isReRegisterMode && existingDocuments.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[#d7deec] bg-[#f6f9ff]">
              <div className="border-b border-[#d7deec] bg-[#edf2ff] px-4 py-3">
                <p className="text-sm font-bold text-[#2f3a5a]">
                  Existing documents
                </p>
                <p className="text-xs text-[#6b7592]">
                  Keep valid files, replace outdated files, or remove invalid
                  ones.
                </p>
              </div>

              <div className="space-y-2 px-4 py-4">
                {existingDocuments.map((document) => {
                  const isRemoved = removedDocumentIds.includes(document.id);
                  const replacementFile =
                    replacementFilesByDocumentId[document.id];
                  const previewLabel = isImageDocument(document)
                    ? "Image"
                    : isPdfDocument(document)
                      ? "PDF"
                      : "File";

                  return (
                    <div
                      key={document.id}
                      className={`rounded-xl border px-3 py-2 ${
                        isRemoved
                          ? "border-[#ead1d1] bg-[#fff6f6]"
                          : "border-[#d6deef] bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="rounded-full bg-[#eff2f6] p-1.5 text-[#6b768a]">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-[#374151]">
                              {document.originalFilename}
                            </p>
                            <p className="text-[11px] text-[#7b859a]">
                              {previewLabel}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-[#e5ecff] px-2 py-0.5 text-[11px] font-semibold text-[#4660a3]">
                            Existing
                          </span>
                          {replacementFile && (
                            <span className="rounded-full bg-[#ddf4e6] px-2 py-0.5 text-[11px] font-semibold text-[#3f8d5d]">
                              Replaced
                            </span>
                          )}
                          {isRemoved && (
                            <span className="rounded-full bg-[#f9dfdf] px-2 py-0.5 text-[11px] font-semibold text-[#b94d4d]">
                              Removed
                            </span>
                          )}
                        </div>
                      </div>

                      {(isImageDocument(document) ||
                        isPdfDocument(document)) && (
                        <a
                          href={document.secureUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-[#4a6cc2] hover:underline"
                        >
                          Preview {previewLabel}
                        </a>
                      )}

                      <div className="mt-2 flex items-center gap-2">
                        <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#c9d7f6] px-3 py-1.5 text-xs font-semibold text-[#4762a8] hover:bg-[#edf2ff]">
                          Replace
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(event) =>
                              handleReplaceExistingDocument(
                                document.id,
                                event.target.files?.[0] ?? null,
                              )
                            }
                          />
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-3 text-xs text-[#9f4c4c] hover:bg-[#fff0f0] hover:text-[#903f3f]"
                          onClick={() =>
                            handleToggleRemoveExistingDocument(document.id)
                          }
                        >
                          {isRemoved ? "Undo remove" : "Remove"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                    {isReRegisterMode
                      ? "Upload new files if you replaced or added documents"
                      : "Required to activate your account"}
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
