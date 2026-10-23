"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, Dumbbell, Flame, Heart, ShieldAlert } from "lucide-react";

type Analytics = {
  summary: {
    totalAthletes: number;
    totalTrainings: number;
    totalClubs: number;
    totalMatches: number;
    avgReadiness: number;
    totalTrimpAccumulated: number;
    totalAnaerobicZ5Minutes: number;
    aiModelAccuracy: number | null;
    currentModelVersion: string | null;
  };
  weeklyLoadTrend: Array<{ day: string; date: string; trimp: number; avgBpm: number }>;
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/analytics")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "No se pudieron cargar las estadísticas.");
        if (active) setAnalytics(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las estadísticas.");
      });
    return () => { active = false; };
  }, []);

  const summary = analytics?.summary;
  const maximumTrimp = Math.max(1, ...(analytics?.weeklyLoadTrend.map((item) => item.trimp) || [1]));
  const metrics = [
    { label: "Alumnos del ámbito", value: summary?.totalAthletes ?? "—", icon: ShieldAlert, color: "text-sky-400" },
    { label: "Sesiones registradas", value: summary?.totalTrainings ?? "—", icon: Dumbbell, color: "text-amber-400" },
    { label: "Disponibilidad media", value: summary ? `${summary.avgReadiness}%` : "—", icon: Heart, color: "text-rose-400" },
    { label: "Combates registrados", value: summary?.totalMatches ?? "—", icon: Activity, color: "text-emerald-400" },
    { label: "Carga acumulada TRIMP", value: summary?.totalTrimpAccumulated ?? "—", icon: Flame, color: "text-orange-400" },
    { label: "Minutos en zona 5", value: summary?.totalAnaerobicZ5Minutes ?? "—", icon: BarChart3, color: "text-violet-400" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><BarChart3 className="h-6 w-6 text-sky-400" /> Estadísticas del club</h1>
        <p className="mt-1 text-sm text-slate-400">Cifras calculadas únicamente con los datos a los que tiene acceso tu cuenta.</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {!summary && !error && <p className="rounded-xl border border-slate-800 p-5 text-sm text-slate-400">Cargando métricas…</p>}
      {summary && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return <article key={metric.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-center justify-between"><span className="text-xs uppercase tracking-wide text-slate-400">{metric.label}</span><Icon className={`h-5 w-5 ${metric.color}`} /></div>
                <p className="mt-3 text-3xl font-bold text-white">{metric.value}</p>
              </article>;
            })}
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div><h2 className="font-semibold text-white">Carga de los últimos siete días</h2><p className="text-xs text-slate-400">Derivada de las sesiones de entrenamiento guardadas.</p></div>
              <p className="text-sm text-slate-300">Modelo IA: {summary.currentModelVersion || "No disponible"}</p>
            </div>
            <div className="grid h-56 grid-cols-7 items-end gap-2 sm:gap-4">
              {analytics?.weeklyLoadTrend.map((item) => (
                <div key={item.date} className="flex h-full flex-col items-center justify-end gap-2">
                  <span className="text-[10px] text-slate-400">{item.trimp}</span>
                  <div className="flex h-40 w-full items-end rounded-md bg-slate-950/70">
                    <div title={`${item.trimp} TRIMP · ${item.avgBpm} BPM promedio`}
                      className="w-full rounded-md bg-gradient-to-t from-sky-700 to-sky-400"
                      style={{ height: `${Math.max(3, item.trimp / maximumTrimp * 100)}%` }} />
                  </div>
                  <span className="text-[10px] capitalize text-slate-400">{item.day}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
