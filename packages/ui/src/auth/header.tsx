import * as React from "react";
import { Cross } from "lucide-react";

export function Header() {
  return (
    <header className="flex items-center justify-between px-10 h-[10vh] bg-white border-b border-[#EEEFF1]">
      {/* Logo */}
      <a href="/" className="flex items-center gap-2 no-underline">
        <Cross className="h-8 w-8 text-brand fill-brand" />
        <span className="text-2xl font-bold text-[#313A34]">Healthcare</span>
      </a>

      {/* Nav links */}
      <nav className="flex items-center gap-10">
        <a
          href=""
          className="text-gray-500 font-medium hover:text-gray-900 transition-colors no-underline"
        >
          Services
        </a>
        <a
          href=""
          className="text-gray-500 font-medium hover:text-gray-900 transition-colors no-underline"
        >
          About us
        </a>
        <a
          href=""
          className="text-gray-500 font-medium hover:text-gray-900 transition-colors no-underline"
        >
          Contact
        </a>
      </nav>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button className="px-6 py-2 rounded-xl border border-gray-300 font-semibold text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer">
          Log in
        </button>
        <button className="px-6 py-2 rounded-xl bg-brand text-white font-semibold hover:bg-brand-hover transition-colors cursor-pointer">
          Sign up
        </button>
      </div>
    </header>
  );
}
