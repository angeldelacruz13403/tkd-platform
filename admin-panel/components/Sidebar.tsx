"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Award,
  Swords,
  Dumbbell,
  Trophy,
  BrainCircuit,
  Video,
  BarChart3,
  FileSpreadsheet,
  Activity,
  Zap,
  Heart,
  CreditCard,
  School,
  Sparkles,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
  roles?: UserRole[]; // If specified, only visible to these roles
}

export function Sidebar() {
  const pathname = usePathname();
  const { role, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: NavItem[] = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    {
      name: "Gestión de Usuarios",
      href: "/users",
      icon: Users,
      badge: "6 Activos",
      badgeColor: "bg-slate-800 text-slate-300",
      roles: ["ADMIN"],
    },
    {
      name: "Entrenadores",
      href: "/coaches",
      icon: Award,
      roles: ["ADMIN", "COACH", "CLUB"],
    },
    {
      name: "Coach Táctico IA",
      href: "/coach-tactics",
      icon: BrainCircuit,
      badge: "PRO",
      badgeColor: "bg-amber-950 text-amber-400 border border-amber-800/60",
      roles: ["ADMIN", "COACH", "CLUB"],
    },
    {
      name: "Gestión del Club",
      href: "/club-management",
      icon: ClipboardCheck,
      badge: "DOJANG",
      badgeColor: "bg-cyan-950 text-cyan-400 border border-cyan-800/60",
      roles: ["ADMIN", "COACH", "CLUB"],
    },
    { name: "Alumnos", href: "/students", icon: Users },
    {
      name: "Clases compartidas",
      href: "/classes",
      icon: School,
      roles: ["ADMIN", "COACH", "CLUB", "ATHLETE"],
    },
    {
      name: "Vídeos compartidos",
      href: "/videos",
      icon: Video,
      roles: ["ADMIN", "COACH", "CLUB", "ATHLETE"],
    },
    {
      name: "Logros y gamificación",
      href: "/gamification",
      icon: Sparkles,
      roles: ["ADMIN", "COACH", "CLUB", "ATHLETE"],
    },
    { name: "Competidores", href: "/competitors", icon: Swords },
    {
      name: "Clubes & Dojangs",
      href: "/clubs",
      icon: Users,
      roles: ["ADMIN", "CLUB"],
    },
    {
      name: "Entrenamientos & Historial",
      href: "/trainings",
      icon: Dumbbell,
      badge: "TRIMP",
      badgeColor: "bg-slate-800 text-slate-300",
    },
    {
      name: "Telemetría Escuadrón (PPM)",
      href: "/telemetry",
      icon: Heart,
      badge: "EN VIVO",
      badgeColor: "bg-rose-950 text-rose-400 border border-rose-800/60 animate-pulse",
      roles: ["ADMIN", "COACH", "CLUB"],
    },
    {
      name: "Competiciones & Brackets",
      href: "/competitions",
      icon: Trophy,
    },
    {
      name: "Marcador en vivo",
      href: "/live-scoreboard",
      icon: Activity,
      badge: "LIVE",
      badgeColor: "bg-rose-950 text-rose-400 border border-rose-800/60",
    },
    {
      name: "Gestión de IA & Reentrenamiento",
      href: "/ai-studio",
      icon: BrainCircuit,
      badge: "v2.4",
      badgeColor: "bg-emerald-950 text-emerald-400 border border-emerald-800/60",
      roles: ["ADMIN", "COACH"],
    },
    {
      name: "Contenidos & Vídeos WT",
      href: "/content",
      icon: Video,
    },
    {
      name: "Estadísticas & Informes",
      href: "/analytics",
      icon: BarChart3,
    },
    {
      name: "Exportación de Informes",
      href: "/reports",
      icon: FileSpreadsheet,
      roles: ["ADMIN", "COACH", "CLUB"],
    },
    {
      name: "Plan y facturación",
      href: "/billing",
      icon: CreditCard,
      roles: ["ADMIN", "CLUB"],
    },
  ];

  // Filter items if role-restricted
  const visibleItems = navItems.filter(
    (item) =>
      !item.roles ||
      item.roles.includes(role) ||
      (role === "COACH" && user?.isClubDirector === true && item.roles.includes("CLUB"))
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/95 text-slate-100 shadow-xl md:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>
      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          aria-label="Cerrar menú"
        />
      )}
    <aside
      className={`${
        collapsed ? "w-20" : "w-72"
      } fixed inset-y-0 left-0 z-50 flex h-screen flex-col bg-[#080c14] border-r border-slate-800/70 transition-transform duration-300 select-none md:sticky md:top-0 md:z-30 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/70 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group overflow-hidden">
          <div className="w-10 h-10 min-w-[40px] rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-rose-500 flex items-center justify-center p-0.5 shadow-chong-glow group-hover:scale-105 transition-all">
            <div className="w-full h-full bg-[#06090f] rounded-[10px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-sky-400 fill-sky-400/20" />
            </div>
          </div>
          {!collapsed && (
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider text-white font-display">TKD HUB</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Ecosistema Olímpico WT</p>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors hidden md:block"
          title={collapsed ? "Expandir barra" : "Colapsar barra"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
          aria-label="Cerrar menú"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {!collapsed && (
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Módulos ({role})
          </div>
        )}
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.name : undefined}
              className={`flex items-center ${
                collapsed ? "justify-center px-2 py-3" : "justify-between px-3 py-2.5"
              } rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? "bg-gradient-to-r from-sky-600/25 to-sky-900/10 text-sky-300 border border-sky-500/30 shadow-chong-glow"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? "text-sky-400" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                />
                {!collapsed && <span className="truncate">{item.name}</span>}
              </div>
              {!collapsed && item.badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Infrastructure & Vercel Readiness Badge */}
      <div className="p-3 border-t border-slate-800/70 bg-[#06090f]/70 space-y-2">
        {!collapsed ? (
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Hosting:</span>
              <span className="text-white font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Vercel Ready
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Rol Activo:</span>
              <span className="text-sky-400 font-mono text-[10px] uppercase">{role}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Motor IA:</span>
              <span className="text-emerald-400 font-mono text-[10px]">v2.4 Live</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Vercel Ready & Active Role">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
