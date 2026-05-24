"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { ThemeProvider } from "../context/ThemeContext";

const AuthContextProvider = dynamic(
  () => import("../context/AuthContext").then((mod) => mod.AuthContextProvider),
  { ssr: false }
);

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthContextProvider>{children}</AuthContextProvider>
    </ThemeProvider>
  );
}
