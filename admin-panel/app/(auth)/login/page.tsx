"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/v1/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, username: identifier, password }),
      });
      const data = await res.json();

      if (data.success) {
        document.cookie = `tkd_token=${data.token}; path=/; max-age=604800; SameSite=Lax`;
        localStorage.setItem("tkd_token", data.token);
        localStorage.setItem("tkd_user", JSON.stringify(data.user));
        router.push("/");
      } else {
        setError(data.error || "Credenciales no válidas. Verifica tu usuario y contraseña.");
      }
    } catch (err) {
      setError("Error de conexión con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#06090f] relative overflow-hidden px-4">
      {/* Background Animated Glow Effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-sky-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: "1s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Login Card */}
      <div className="glass-panel w-full max-w-md rounded-3xl border border-slate-800 p-8 shadow-2xl relative z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-rose-500 flex items-center justify-center p-0.5 shadow-chong-glow mb-4">
            <div className="w-full h-full bg-[#06090f] rounded-[14px] flex items-center justify-center">
              <Zap className="w-8 h-8 text-sky-400 fill-sky-400/20" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white font-display tracking-tight">
            TKD GLOBAL HUB
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Panel de Control del Administrador & Maestro
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              PRO
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
              World Taekwondo
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Vercel & Supabase
            </span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Usuario / email / DNI
            </label>
            <input
              type="text"
              required
              autoCapitalize="none"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all"
              placeholder="usuario@dominio.com o nombre de usuario"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Contraseña Provisional
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all pr-12 font-mono"
                placeholder="Tu contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-sky-400 mb-1">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              Acceso con credenciales reales del panel
            </div>
            <p className="text-slate-400 mt-1">
              Usa el usuario y la contraseña que exista en la API de la plataforma.
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm shadow-chong-glow transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando credenciales...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Acceder al Panel de Control
              </>
            )}
          </button>
        </form>

        {/* Acceso Público al Simulador sin cuenta */}
        <div className="mt-5 pt-5 border-t border-slate-800 text-center">
          <a
            href="/role-simulator"
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/40 text-purple-300 font-semibold text-xs transition-all shadow-lg shadow-purple-950/30"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>🎮 Probar Simulador de Roles & Planes (Acceso Demo sin login)</span>
          </a>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center">
          <p className="text-[10px] text-slate-600">
            Ecosistema Olímpico de Taekwondo • Preparado para Vercel • IA Reentrenamiento Continuo
          </p>
        </div>
      </div>
    </div>
  );
}
