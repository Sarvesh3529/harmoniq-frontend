"use client";

import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <main className="min-h-screen w-screen bg-slate-50 text-slate-900 dark:bg-[#02040a] dark:text-slate-100 selection:bg-indigo-500/30 overflow-x-hidden antialiased flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/10 rounded-2xl p-6 md:p-8 space-y-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
              {user?.email ?? "Signed in"}
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 text-sm font-medium"
          >
            Back
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Theme</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Switch between light and dark.</div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 text-sm font-medium"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "Dark" : "Light"}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02]">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Account</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">End your current session.</div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm("Log out of your session?")) void logout();
              }}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 text-sm font-semibold"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

