import { Header } from "@/features/auth/components/authen_header";
import { DoctorSignUp } from "@/features/auth/components/doctor-sign-up";
import { PatientSignUp } from "@/features/auth/components/patient-sign-up";
import { useMemo, useState } from "react";
import { Cross } from "lucide-react";
import { showToast } from "@repo/ui/components/ui/toasts";
import authenImage from "@/features/auth/images/authen_image.png";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSignUpDoctor, useSignUpPatient } from "../hooks/useSignUp";
import {
  type SignUpDoctor,
  type SignUpPatient,
} from "../services/signup.service";

type SignUpRole = "patient" | "doctor";

export function SignUp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [internalLoading, setInternalLoading] = useState(false);
  const [localServerError, setLocalServerError] = useState<
    string | undefined
  >();

  const {
    signUpPatient,
    isLoading: isPatientSignUpLoadingFromHook,
    error: patientSignUpErrorFromHook,
  } = useSignUpPatient();
  const {
    signUpDoctor,
    isLoading: isDoctorSignUpLoadingFromHook,
    error: doctorSignUpErrorFromHook,
  } = useSignUpDoctor();

  const role: SignUpRole = useMemo(() => {
    return searchParams.get("role") === "doctor" ? "doctor" : "patient";
  }, [searchParams]);

  function setRole(nextRole: SignUpRole) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("role", nextRole);
    setSearchParams(nextParams, { replace: true });
    setLocalServerError(undefined);
  }

  async function handlePatientSubmit(payload: SignUpPatient) {
    setLocalServerError(undefined);
    setInternalLoading(true);

    try {
      const signUpPatientPayload: SignUpPatient = {
        email: payload.email.trim(),
        password: payload.password,
        fullName: payload.fullName.trim(),
        phoneNumber: payload.phoneNumber.trim(),
      };
      await signUpPatient(signUpPatientPayload);
      showToast.success("Create patient account successfully.");
      navigate("/login");
    } catch (err) {
      const message =
        patientSignUpErrorFromHook ||
        (err instanceof Error ? err.message : "Sign up failed.");
      setLocalServerError(message);
      showToast.error(message);
    } finally {
      setInternalLoading(false);
    }
  }

  async function handleDoctorSubmit(payload: SignUpDoctor) {
    setLocalServerError(undefined);
    setInternalLoading(true);

    try {
      const signUpDoctorPayload: SignUpDoctor = {
        email: payload.email.trim(),
        password: payload.password,
        fullName: payload.fullName.trim(),
        phoneNumber: payload.phoneNumber.trim(),
        specialty: payload.specialty,
        workplace: payload.workplace.trim(),
        experienceYears: payload.experienceYears,
        newVerificationDocuments: payload.newVerificationDocuments,
        existingVerificationDocuments: payload.existingVerificationDocuments,
      };
      console.log(signUpDoctorPayload);

      await signUpDoctor(signUpDoctorPayload);
      showToast.success("Create doctor account successfully.");
      navigate("/login");
    } catch (err) {
      const message =
        doctorSignUpErrorFromHook ||
        (err instanceof Error ? err.message : "Sign up failed.");
      setLocalServerError(message);
      showToast.error(message);
    } finally {
      setInternalLoading(false);
    }
  }

  const patientIsSubmitting = isPatientSignUpLoadingFromHook || internalLoading;
  const patientError = patientSignUpErrorFromHook || localServerError;
  const doctorIsSubmitting = isDoctorSignUpLoadingFromHook || internalLoading;
  const doctorError = doctorSignUpErrorFromHook || localServerError;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <div className="mx-auto flex w-full max-w-7xl flex-1 items-start justify-between gap-10 px-6 py-8 lg:px-8">
        {role === "doctor" ? (
          <DoctorSignUp
            onSubmit={handleDoctorSubmit}
            onSwitchRole={() => setRole("patient")}
            isLoading={doctorIsSubmitting}
            error={doctorError}
          />
        ) : (
          <PatientSignUp
            onSubmit={handlePatientSubmit}
            onSwitchRole={() => setRole("doctor")}
            isLoading={patientIsSubmitting}
            error={patientError}
          />
        )}

        <div className="hidden lg:flex flex-1 flex-col items-center gap-6 pt-10">
          <img
            src={authenImage}
            alt="Healthcare illustration"
            className="w-90 object-contain"
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
