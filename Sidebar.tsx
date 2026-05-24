import { LayoutDashboard, Music, Settings, Crown, LogOut } from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Music, label: 'My Library', active: false },
  { icon: Settings, label: 'Settings', active: false },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-20 flex flex-col items-center py-8 bg-zinc-950/40 backdrop-blur-2xl border-r border-zinc-800/50 z-50 transition-all duration-300 hover:w-64 group">
      {/* Brand Icon */}
      <div className="mb-12 h-10 w-10 bg-gradient-to-br from-emerald-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-white/10">
        <Music className="text-white w-5 h-5" />
      </div>
      
      <nav className="flex flex-col gap-6 flex-1">
        {navItems.map((item) => (
          <button key={item.label} className={`flex items-center gap-4 transition-all p-3 rounded-xl ${item.active ? 'text-emerald-400 bg-emerald-500/10 shadow-[inset_0_0_12px_rgba(16,185,129,0.1)]' : 'text-zinc-500 hover:text-white hover:bg-zinc-800/50'}`}>
            <item.icon size={22} strokeWidth={1.5} />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold text-xs uppercase tracking-widest whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-4 mt-auto">
        <button className="text-zinc-500 hover:text-amber-400 transition-colors p-3 rounded-xl hover:bg-amber-400/5">
          <div className="flex items-center gap-4">
            <Crown size={22} strokeWidth={1.5} />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold uppercase tracking-tighter">Pro</span>
          </div>
        </button>
        <button className="text-zinc-600 hover:text-red-400 transition-colors p-3">
          <LogOut size={22} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
}
