import { Layout } from "@repo/ui/layouts/layout";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LogIn } from "./features/auth/pages/login";
import { ForgetPassword } from "./features/auth/pages/forget-password";
import { ConfirmOTP } from "./features/auth/pages/confirm-otp";
import { ChangePassword } from "./features/auth/pages/change-password";
import { ToastContainer } from "react-toastify";
import { ErrorPage } from "@repo/ui/pages/page-not-found";
import { Overview } from "./features/overview/pages/overview";
import { UserManagement } from "./features/user-management/pages/user-management";
import { DocumentVerification } from "./features/doc-verification/pages/doc-verification";
import { ViolationReport } from "./features/violation-report/pages/violation-report";
import { AIManagement } from "./features/ai_management/pages/ai_management";
import { Profile } from "./features/profile/page/profile";
import { useAuthStore } from "@repo/ui/store/useAuthStore";
import { useEffect, useState } from "react";
import { useLogout } from "./features/auth/hooks/useLogout";

function ProtectedRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { logout } = useLogout();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout onLogout={logout} />;
}

function App() {
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
        <Routes>
          {/* Authentication */}
          <Route path="/login" element={<LogIn />} />
          <Route path="/forget-password" element={<ForgetPassword />} />
          <Route path="/confirm-otp" element={<ConfirmOTP />} />
          <Route path="/change-password" element={<ChangePassword />} />

          <Route element={<ProtectedRoutes />}>
            <Route index element={<Overview />} />
            <Route path="/user-management" element={<UserManagement />} />
            <Route
              path="/doc-verification"
              element={<DocumentVerification />}
            />
            <Route path="/ai-knowledge-base" element={<AIManagement />} />
            <Route path="/violation-reports" element={<ViolationReport />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/page-not-found" element={<ErrorPage />} />
          <Route path="*" element={<Navigate to="/page-not-found" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
