import { Header } from "@/features/auth/components/authen_header";
import {
  DoctorSignUp,
  type DoctorSignUpValues,
} from "@/features/auth/components/doctor-sign-up";
import {
  PatientSignUp,
  type PatientSignUpValues,
} from "@/features/auth/components/patient-sign-up";
import { useMemo, useState } from "react";
import { Cross } from "lucide-react";
import { showToast } from "@repo/ui/components/ui/toasts";
import authenImage from "@/features/auth/images/authen_image.png";
import { useNavigate, useSearchParams } from "react-router-dom";

type SignUpRole = "patient" | "doctor";

const SIGN_UP_API_URL =
  import.meta.env.VITE_SIGNUP_API_URL ?? "/api/v1/auth/register";

interface SignUpApiResponse {
  message?: string;
}

async function registerRequest(
  role: SignUpRole,
  payload: Record<string, unknown>,
): Promise<SignUpApiResponse> {
  const res = await fetch(SIGN_UP_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, ...payload }),
  });

  let json: SignUpApiResponse | null = null;

  try {
    json = (await res.json()) as SignUpApiResponse;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new Error(json?.message ?? "Sign up failed. Please try again.");
  }

  return json ?? {};
}

export function SignUp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();

  const role: SignUpRole = useMemo(() => {
    return searchParams.get("role") === "doctor" ? "doctor" : "patient";
  }, [searchParams]);

  function setRole(nextRole: SignUpRole) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("role", nextRole);
    setSearchParams(nextParams, { replace: true });
    setServerError(undefined);
  }

  async function handlePatientSubmit(values: PatientSignUpValues) {
    setServerError(undefined);
    setIsSubmitting(true);

    try {
      await registerRequest("patient", {
        email: values.email,
        phoneNumber: values.phone,
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      showToast.success("Create patient account successfully.");
      navigate("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed.";
      setServerError(message);
      showToast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDoctorSubmit(values: DoctorSignUpValues) {
    setServerError(undefined);
    setIsSubmitting(true);

    try {
      await registerRequest("doctor", {
        email: values.email,
        phoneNumber: values.phone,
        password: values.password,
        confirmPassword: values.confirmPassword,
        specialty: values.specialty,
        yearsOfExperience: Number(values.yearsOfExperience),
        workplace: values.workplace,
        verificationFileNames: values.verificationFiles.map(
          (file) => file.name,
        ),
      });
      showToast.success("Create doctor account successfully.");
      navigate("/login");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign up failed.";
      setServerError(message);
      showToast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 items-start justify-between gap-10 px-6 py-8 lg:px-8">
        {role === "doctor" ? (
          <DoctorSignUp
            onSubmit={handleDoctorSubmit}
            onSwitchRole={() => setRole("patient")}
            isLoading={isSubmitting}
            error={serverError}
          />
        ) : (
          <PatientSignUp
            onSubmit={handlePatientSubmit}
            onSwitchRole={() => setRole("doctor")}
            isLoading={isSubmitting}
            error={serverError}
          />
        )}

        <div className="hidden lg:flex flex-1 flex-col items-center gap-6 pt-10">
          <img
            src={authenImage}
            alt="Healthcare illustration"
            className="w-[360px] object-contain"
          />
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <Cross className="h-7 w-7 text-brand fill-brand" />
              <span className="text-3xl font-bold text-[#313A34]">
                Healthcare
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your intelligent telecare AI solutions. ✨
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
