import { Layout } from "@repo/ui/layouts/layout";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LogIn } from "./pages/auth/login";
import { ForgetPassword } from "./pages/auth/forget-password";
import { ConfirmOTP } from "./pages/auth/confirm-otp";
import { ChangePassword } from "./pages/auth/change-password";
import { ToastContainer } from "react-toastify";
import { ErrorPage } from "@repo/ui/pages/page-not-found";
import { Overview } from "./pages/overview/overview";
import { UserManagement } from "./pages/user-management/user-management";
import { DocumentVerification } from "./pages/doc-verification/doc-verification";
import { ViolationReport } from "./pages/violation-report/violation-report";
import { AIManagement } from "./pages/ai_management/ai_management";
import { Profile } from "@repo/ui/pages/profile";

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
      <ToastContainer />
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
