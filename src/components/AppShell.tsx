"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    // w-screen forces the container layout to claim the entire width of the desktop screen
    <div className="relative min-h-screen w-screen bg-slate-50 dark:bg-[#0a0a0c] flex overflow-x-hidden m-0 p-0 transition-colors duration-500">
      
      {/* Persistent Sidebar Component */}
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      
      {/* 
        min-w-0 prevents flex layout from squishing child nodes or causing page overflow blowout.
        ml-16 and ml-64 match the layout footprint of the left menu bar.
      */}
      <main 
        className={`flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        {/* Inner page content container - expands edge to edge */}
        <div className="flex-1 w-full p-8">
          {children}
        </div>
      </main>
    </div>
  );
}