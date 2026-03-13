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
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout userRole="admin" />}>
          <Route index element={<Page title="Overview" />} />
          <Route path="users" element={<Page title="User Management" />} />
          <Route
            path="doc-verification"
            element={<Page title="Doc Verification" />}
          />
          <Route
            path="ai-knowledge-base"
            element={<Page title="AI Knowledge Base" />}
          />
          <Route
            path="violation-reports"
            element={<Page title="Violation Reports" />}
          />
          <Route path="profile" element={<Page title="Profile" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
