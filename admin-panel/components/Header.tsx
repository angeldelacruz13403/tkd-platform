"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ChevronDown,
  Sparkles,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onTriggerRetrain?: () => void;
}

export function Header({
  title = "Panel de Control",
  subtitle = "Visión general del rendimiento y gestión federativa",
  onTriggerRetrain,
}: HeaderProps) {
  const router = useRouter();
  const { role: currentRole, user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="min-h-20 bg-[#080c14]/90 backdrop-blur-md border-b border-slate-800/70 pl-16 pr-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
      {/* Title & Section context */}
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
          {title}
          <span className="inline-flex items-center gap-1 text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Sync en vivo
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[18rem] sm:max-w-none">{subtitle}</p>
      </div>

      {/* Right Action Bar */}
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4 max-w-full">
        {/* Retrain AI Quick Action */}
        <button
          onClick={onTriggerRetrain}
          className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-chong-glow transition-all active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-200 animate-spin" style={{ animationDuration: "6s" }} />
          Reentrenar IA
        </button>

        {/* User Avatar & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 border-l border-slate-800 group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-sky-950 border border-sky-500/40 flex items-center justify-center group-hover:bg-sky-900 transition-colors">
              <UserIcon className="w-4 h-4 text-sky-300" />
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-medium text-white truncate max-w-[140px]">
                {user?.name || "Usuario"}
              </div>
              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                {user?.email || "Sin sesión"}
              </div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 border-b border-slate-800 mb-1">
                <p className="text-xs font-semibold text-white">{user?.name || "Usuario"}</p>
                <p className="text-[11px] text-slate-400">{user?.email || "Sin email"}</p>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono border border-sky-500/30 bg-sky-500/10 text-sky-300">
                  {currentRole}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
