import { useState, useEffect } from "react";
import { Layout } from "@repo/ui/layouts/layout";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
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
import { ConfirmationModal } from "@repo/ui/components/complex-modal/ConfirmationModal";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import { useLogout } from "./features/auth/hooks/useLogout";

function SessionExpiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState(
    "Session expired. Please log in again!",
  );
  const navigate = useNavigate();
  const clearAuthState = useAuthStore((state) => state.logout);

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      setMessage(
        customEvent.detail?.message ?? "Session expired. Please log in again!",
      );
      setIsOpen(true);
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);

    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  const handleConfirm = async () => {
    setIsOpen(false);
    clearAuthState();
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    navigate("/login", { replace: true });
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      onConfirm={handleConfirm}
      title="Session expired"
      message={message}
      confirmText="Log in again"
      cancelText="Close"
      variant="warning"
    />
  );
}

function ProtectedRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { logout } = useLogout();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout onLogout={logout} />;
}

/**
 * Wrapper component để setup notification sync hook
 * Mount ở trong BrowserRouter để có access đến route context
 */
function App() {
  const role = useAuthStore().user?.role || "patient";
  const defaultHomePath =
    role === "doctor" ? "/doctor-overview" : "/patient-overview";

  const userId = useAuthStore().user?.id;
  // useNotificationSync(userId);

  const [hasHydrated, setHasHydrated] = useState(
    useAuthStore.persist.hasHydrated(),
  );

  useEffect(() => {
    const unsubscribeHydrate = useAuthStore.persist.onHydrate(() => {
      setHasHydrated(false);
    });

    const unsubscribeFinishHydration = useAuthStore.persist.onFinishHydration(
      () => {
        setHasHydrated(true);
      },
    );

    return () => {
      unsubscribeHydrate();
      unsubscribeFinishHydration();
    };
  }, []);

  if (!hasHydrated) {
    return null;
  }

  return (
    <>
      <ToastContainer position="top-right" toastStyle={{ zIndex: 9999 }} />
      <BrowserRouter>
        <GlobalCriticalAlertHost />
        <SessionExpiredModal />
        <Routes>
          <Route path="/login" element={<LogIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/forget-password" element={<ForgetPassword />} />
          <Route path="/confirm-otp" element={<ConfirmOTP />} />
          <Route element={<ProtectedRoutes />}>
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
      </BrowserRouter>
    </>
  );
}

export default App;
