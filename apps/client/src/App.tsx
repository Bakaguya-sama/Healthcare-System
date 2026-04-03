import { Layout } from "@repo/ui/layouts/layout";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LogIn } from "./features/auth/pages/login";
import { ChangePassword } from "./features/auth/pages/change-password";
import { ForgetPassword } from "./features/auth/pages/forget-password";
import { ConfirmOTP } from "./features/auth/pages/confirm-otp";
import { ToastContainer } from "react-toastify";
import { SignUp } from "./features/auth/pages/sign-up";
import { DoctorOverview } from "./features/doctor/overview/pages/doctor-overview";
import { Consultations } from "./features/doctor/consultations/pages/consultations";
import { Overview } from "./features/patient/overview/page/overview";
import { Profile } from "@repo/ui/pages/profile";
import { GlobalCriticalAlertHost } from "./components/GlobalCriticalAlertHost";
import { useNotificationSync } from "./hooks/useNotificationSync";
import { HealthMetric } from "./features/patient/health-metric/page/health-metric";
import { MyDoctors } from "./features/patient/my-doctor/page/my-doctors";
import { AiChat } from "./features/patient/ai-chat/page/ai-chat";
import { DoctorChat } from "./features/patient/doctor-chat/page/doctor-chat";

function Page({ title }: { title: string }) {
  return (
    <main className="flex-1 overflow-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
    </main>
  );
}

/**
 * Wrapper component để setup notification sync hook
 * Mount ở trong BrowserRouter để có access đến route context
 */
function AppRoutes() {
  const role = "patient";
  const defaultHomePath =
    role === "doctor" ? "/doctor-overview" : "/patient-overview";

  // TODO: Get actual userId from auth context
  const userId = null;
  useNotificationSync(userId);

  return (
    <>
      <GlobalCriticalAlertHost />
      <Routes>
        <Route path="/login" element={<LogIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/forget-password" element={<ForgetPassword />} />
        <Route path="/confirm-otp" element={<ConfirmOTP />} />
        <Route element={<Layout userRole={role} />}>
          <Route index element={<Navigate to={defaultHomePath} replace />} />
          {role === "doctor" ? (
            <>
              <Route path="/doctor-overview" element={<DoctorOverview />} />
              <Route path="/consultations" element={<Consultations />} />
              <Route path="/profile" element={<Profile />} />
            </>
          ) : (
            <>
              <Route path="/patient-overview" element={<Overview />} />
              <Route path="/my-doctors" element={<MyDoctors />} />
              <Route path="/health-metric" element={<HealthMetric />} />
              <Route path="/ai-chat" element={<AiChat />} />
              <Route path="/doctor-chat" element={<DoctorChat />} />
              <Route path="/profile" element={<Profile />} />
            </>
          )}
        </Route>
        <Route path="*" element={<Navigate to={defaultHomePath} replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <>
      <ToastContainer />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </>
  );
}

export default App;
