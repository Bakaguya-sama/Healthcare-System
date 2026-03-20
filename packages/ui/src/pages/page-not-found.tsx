import { Button } from "@repo/ui/components/button";
import { useNavigate } from "react-router-dom";

export function ErrorPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-5 inline-flex rounded-full bg-[var(--color-brand-light)] px-3 py-1 text-sm font-semibold text-slate-800">
          Error 404
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
            Oops! Page not found.
          </h1>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button
            onClick={() => {
              navigate("/");
            }}
            className="h-11 rounded-xl bg-[var(--color-brand)] text-slate-900 hover:bg-[var(--color-brand-hover)]"
          >
            Return to HomeView
          </Button>
          <Button
            onClick={() => {
              navigate(-1);
            }}
            className="h-11 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
