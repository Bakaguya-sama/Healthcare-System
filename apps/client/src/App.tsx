import { Layout } from "@repo/ui/layouts/layout";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

function Page({ title }: { title: string }) {
  return (
    <main className="flex-1 overflow-auto p-6">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
    </main>
  );
}

function App() {
  const role = "doctor";
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout userRole="doctor" />}>
          {role === "doctor" ? (
            <>
              <Route index element={<Page title="Overview" />} />
              <Route
                path="consultations"
                element={<Page title="Consultations" />}
              />
              <Route path="profile" element={<Page title="Profile" />} />
            </>
          ) : (
            <>
              <Route index element={<Page title="Overview" />} />
              <Route path="my_doctors" element={<Page title="My doctors" />} />
              <Route
                path="ai_assistant"
                element={<Page title="AI assistant" />}
              />
              <Route path="Messages" element={<Page title="Messages" />} />
              <Route path="profile" element={<Page title="Profile" />} />
            </>
          )}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
