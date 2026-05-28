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
import { Profile } from "./features/profile/page/profile";
import { DoctorOverview } from "./features/doctor/overview/pages/doctor-overview";
import { Consultations } from "./features/doctor/consultations/pages/consultations";
import { Overview } from "./features/patient/overview/page/overview";
import { GlobalCriticalAlertHost } from "./components/GlobalCriticalAlertHost";
import {
  useNotifications,
  useNotificationSync,
  unlockNotificationSound,
} from "./hooks/useNotifications";
import { HealthMetric } from "./features/patient/health-metric/page/health-metric";
import { MyDoctors } from "./features/patient/my-doctor/page/my-doctors";
import { AiChat } from "./features/patient/ai-chat/page/ai-chat";
import { DoctorChat } from "./features/patient/doctor-chat/page/doctor-chat";
import { ConfirmationModal } from "@repo/ui/components/complex-modal/ConfirmationModal";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import { useLogout } from "./features/auth/hooks/useLogout";
import { connectPresenceSocket } from "@/lib/api";
import { AboutUs } from "./features/shared/pages/about-us";
import { Services } from "./features/shared/pages/services";
import { Contact } from "./features/shared/pages/contact";

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
  const userId = useAuthStore((state) => state.user?.id || null);
  const { notifications, isLoading, error, markAllAsRead, markAsRead, remove } =
    useNotifications({ enabled: isAuthenticated });
  const { logout } = useLogout();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout
      onLogout={logout}
      notifications={notifications.map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        detail: item.message,
        createdAt: item.createdAt,
        read: item.isRead,
        type: item.type,
      }))}
      notificationsLoading={isLoading}
      notificationsError={error}
      onMarkAllNotificationsRead={markAllAsRead}
      onMarkNotificationRead={markAsRead}
      onDeleteNotification={remove}
      onPrimaryNotificationAction={markAsRead}
    />
  );
}

function App() {
  const role = useAuthStore().user?.role || "patient";
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.token);
  const defaultHomePath =
    role === "doctor" ? "/doctor-overview" : "/patient-overview";

  const userId = useAuthStore().user?.id;
  useNotificationSync(userId ?? null);

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

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const token = accessToken || localStorage.getItem("accessToken") || "";
    if (!isAuthenticated) {
      connectPresenceSocket(undefined);
      return;
    }

    connectPresenceSocket(token);
  }, [accessToken, hasHydrated, isAuthenticated]);

  useEffect(() => {
    const handleFirstInteraction = () => {
      void unlockNotificationSound();
    };

    window.addEventListener("pointerdown", handleFirstInteraction, {
      once: true,
    });
    window.addEventListener("keydown", handleFirstInteraction, {
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
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
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/services" element={<Services />} />
          <Route path="/contact" element={<Contact />} />
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
