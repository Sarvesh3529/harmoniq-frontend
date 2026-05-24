// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css" ;
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Harmoniq",
  description: "Transform audio track executions into sheet music notation scores, MIDI, and MusicXML instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full m-0 p-0 overflow-x-hidden">
      <body className="min-h-screen w-full bg-slate-50 text-slate-900 dark:bg-[#0a1118] dark:text-slate-100 antialiased m-0 p-0 overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
