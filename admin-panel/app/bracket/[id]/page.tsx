"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Trophy, AlertCircle, RefreshCw, ArrowLeft, Swords, Radio } from "lucide-react";
import Link from "next/link";
import { BracketViewer } from "@/components/BracketViewer";
import { CompetitionMatch } from "@/lib/types";

export default function PublicBracketPage() {
  const params = useParams<{ id: string }>();
  const tournamentId = params?.id;

  const [tournament, setTournament] = useState<any>(null);
  const [matches, setMatches] = useState<CompetitionMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadData = async (showLoading = false) => {
    if (!tournamentId) return;
    if (showLoading) setLoading(true);
    try {
      // Cargar torneo
      const tourRes = await fetch("/api/v1/tournaments");
      const tourJson = await tourRes.json();
      if (!tourJson.success || !Array.isArray(tourJson.data)) {
        throw new Error(tourJson.error || "No se pudo cargar la información del torneo.");
      }
      const found = tourJson.data.find((t: any) => t.id === tournamentId);
      if (!found) {
        throw new Error("El torneo solicitado no existe o no se encuentra disponible.");
      }
      setTournament(found);

      // Cargar combates del torneo
      const matchRes = await fetch("/api/v1/competitions");
      const matchJson = await matchRes.json();
      if (matchJson.success && Array.isArray(matchJson.data)) {
        setMatches(matchJson.data.filter((m: CompetitionMatch) => m.tournamentId === tournamentId));
      }
      setLastRefreshed(new Date());
      setError("");
    } catch (err: any) {
      setError(err?.message || "Error al cargar el bracket.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(true);
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [tournamentId, autoRefresh]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center animate-pulse">
          <Trophy className="w-6 h-6" />
        </div>
        <p className="text-xs text-slate-400 font-mono">Cargando cuadro oficial de competición...</p>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-white">Cuadro no disponible</h2>
          <p className="text-xs text-slate-400">{error || "No se ha encontrado el torneo solicitado."}</p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#070b14] text-white flex flex-col p-3 sm:p-6 space-y-4">
      {/* Top Navbar */}
      <nav className="flex items-center justify-between py-2 border-b border-slate-800/80 no-print">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-black">
            WT
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Plataforma Oficial de Competición</span>
              <span className="text-[10px] font-mono font-normal text-sky-400 bg-sky-950 px-1.5 py-0.2 rounded border border-sky-800/50">
                EN VIVO
              </span>
            </h1>
            <p className="text-[10px] text-slate-400">Visor de Cuadros y Clasificación</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Activo · {lastRefreshed.toLocaleTimeString()}</span>
          </div>

          <button
            onClick={() => void loadData(false)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Actualizar ahora"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <Link
            href={`/register-tournament/${tournament.id}`}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-300 transition-colors"
          >
            <span>Inscripción</span>
          </Link>
        </div>
      </nav>

      {/* Main Bracket Viewer Component */}
      <BracketViewer
        tournament={tournament}
        matches={matches}
        isPublic={true}
      />
    </main>
  );
}
