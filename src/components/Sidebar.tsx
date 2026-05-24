"use client";

import React from "react";
import { 
  LayoutDashboard, 
  Music, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  FileAudio,
  History,
  Mic2,
  Menu
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  isCollapsed: boolean;
}

const SidebarItem = ({ icon: Icon, label, href, isCollapsed }: SidebarItemProps) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <div className="group relative flex items-center px-3">
      <Link
        href={href}
        className={`flex items-center w-full h-11 px-3 rounded-lg transition-all duration-200 
          ${isActive 
            ? "bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-white" 
            : "text-slate-500 dark:text-[#a0aec0] hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"}`}
      >
        <Icon className={`w-5 h-5 min-w-[20px] transition-colors duration-200 ${isActive ? "text-indigo-400" : ""}`} />
        <span className={`ml-4 font-medium whitespace-nowrap overflow-hidden transition-all duration-300 
          ${isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"}`}>
          {label}
        </span>
      </Link>
      
      {/* Floating Tooltip */}
      {isCollapsed && (
        <div className="absolute left-full ml-4 px-3 py-2 bg-white dark:bg-[#2d2d34] text-slate-900 dark:text-white text-xs font-semibold rounded-md 
          opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-[60] 
          shadow-2xl border border-white/5 translate-x-[-8px] group-hover:translate-x-0">
          {label}
          {/* Arrow */}
          <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-[#2d2d34] rotate-45 border-l border-b border-white/5" />
        </div>
      )}
    </div>
  );
};

export const Sidebar = ({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) => {
  const menuItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/' },
    { icon: FileAudio, label: 'Transcribe', href: '/transcribe' },
    { icon: History, label: 'Library', href: '/library' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col
        bg-white dark:bg-[#1e1e24]/60 dark:backdrop-blur-xl
        border-r border-slate-200 dark:border-white/10
        transition-all duration-300 ease-in-out z-50 ${isCollapsed ? "w-16" : "w-64"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-20 px-4 mb-4 border-b border-slate-200 dark:border-white/10 relative transition-all duration-300">
        <div
          className={`flex items-center transition-all duration-300 ${isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white shrink-0 shadow-lg shadow-indigo-600/20">
            <Mic2 size={18} className="shrink-0" />
          </div>
          <span
            className={`ml-3 font-bold text-slate-900 dark:text-white text-sm tracking-tighter transition-all duration-300 whitespace-nowrap overflow-hidden
            ${isCollapsed ? "opacity-0 w-0 pointer-events-none" : "opacity-100 w-auto"}`}
          >
            AuraTranscribe
          </span>
        </div>

        <button
          onClick={onToggle}
          className={`p-2 rounded-lg text-slate-500 dark:text-[#a0aec0] hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-all duration-300 shrink-0
            ${isCollapsed ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : "relative"}`}
          aria-label="Toggle Sidebar"
        >
          {isCollapsed ? <ChevronRight size={20} className="shrink-0" /> : <ChevronLeft size={20} className="shrink-0" />}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 space-y-1.5 pt-2">
        {menuItems.map((item) => (
          <SidebarItem 
            key={item.href}
            {...item}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>
    </aside>
  );
};