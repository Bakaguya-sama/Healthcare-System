import { Layout } from "@repo/ui/layouts/layout";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LogIn } from "./features/auth/pages/login";
import { ChangePassword } from "./features/auth/pages/change-password";
import { ForgetPassword } from "./features/auth/pages/forget-password";
import { ConfirmOTP } from "./features/auth/pages/confirm-otp";
import { ToastContainer } from "react-toastify";
import { SignUp } from "./features/auth/pages/sign-up";

function Page({ title }: { title: string }) {
  return (
    <main className="flex-1 overflow-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
    </main>
  );
}

function App() {
  const role = "patient";
  return (
    <>
      <ToastContainer />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LogIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/forget-password" element={<ForgetPassword />} />
          <Route path="/confirm-otp" element={<ConfirmOTP />} />
          <Route element={<Layout userRole={role} />}>
            {role === "doctor" ? (
              <>
                <Route index element={<Page title="Overview" />} />
                <Route
                  path="consultations"
                  element={<Page title="Consultations" />}
                />
                <Route path="/profile" element={<Page title="Profile" />} />
              </>
            ) : (
              <>
                <Route index element={<Page title="Overview" />} />
                <Route
                  path="/my_doctors"
                  element={<Page title="My doctors" />}
                />
                <Route
                  path="/ai_assistant"
                  element={<Page title="AI assistant" />}
                />
                <Route path="/messages" element={<Page title="Messages" />} />
                <Route path="/profile" element={<Page title="Profile" />} />
              </>
            )}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
