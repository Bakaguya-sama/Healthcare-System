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

function Page({ title }: { title: string }) {
  return (
    <main className="flex-1 overflow-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
    </main>
  );
}

function App() {
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

          <Route element={<Layout userRole="admin" />}>
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
