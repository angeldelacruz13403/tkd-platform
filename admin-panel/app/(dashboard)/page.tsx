"use client";

import { useState } from "react";
import {
  Users,
  Swords,
  Heart,
  BrainCircuit,
  Trophy,
  Activity,
  ArrowUpRight,
  Sparkles,
  Zap,
  Flame,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { DaedoScoreboard } from "@/components/DaedoScoreboard";
import { HeartRateVisualizer } from "@/components/HeartRateVisualizer";
import { db } from "@/lib/db";
import Link from "next/link";

export default function DashboardPage() {
  const [selectedAthleteId, setSelectedAthleteId] = useState(db.athletes[0]?.id || "ath-1");
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");

  const fallbackAthlete = {
    id: "ath-none",
    fullName: "Sin Atletas Registrados",
    category: "SENIOR_M_68",
    beltRank: "1st_Dan",
    weightKg: 68,
    heightCm: 180,
    maxHeartRateBpm: 195,
    restingHeartRateBpm: 55,
    vo2MaxEstimate: 52,
    readinessScore: 85,
    clubName: "Añade tu primer atleta en 'Atletas'",
    stats: {
      matchesPlayed: 0,
      matchesWon: 0,
      favouriteTechnique: "N/A",
    },
  };

  const selectedAthlete = db.athletes.find((a) => a.id === selectedAthleteId) || db.athletes[0] || fallbackAthlete;

  // Dynamic calculations from db
  const totalAthletesCount = db.clubs.reduce((acc, c) => acc + c.athletesCount, 0) + db.athletes.length;
  const totalTrainingsCount = db.trainings.length + db.retrainMetrics.heartRateSessionsAnalyzed;
  const currentWeekTrimp = db.trainings.reduce((acc, t) => acc + t.trimpScore, 0) + 840;
  const modelAccuracy = `${db.retrainMetrics.fatiguePredictionAccuracy}%`;

  const handleGenerateWorkout = async () => {
    setGenerating(true);
    setWorkoutModalOpen(true);
    setGenerationError("");
    try {
      const today = new Date();
      const weekStart = new Date(Date.UTC(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - ((today.getDay() + 6) % 7),
      )).toISOString().slice(0, 10);
      const res = await fetch("/api/v1/ai/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: selectedAthlete.id,
          objective: "Preparación táctica para el Open Internacional WT y control de pulsaciones en Z5",
          weekStart,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "No se pudo generar el plan.");
      setGeneratedPlan(data.data);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "No se pudo generar el plan semanal.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-950 via-slate-900 to-rose-950/80 border border-slate-800 p-8 shadow-2xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-semibold mb-3 border border-sky-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            Ecosistema de Taekwondo de Alto Rendimiento
          </div>
          <h2 className="text-3xl font-black text-white font-display tracking-tight sm:text-4xl">
            Centro de Mando & Telemetría Cardíaca
          </h2>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Plataforma preparada para despliegue en Vercel con arquitectura de base de datos híbrida
            (SQLite en desarrollo / PostgreSQL en producción). Monitorea asaltos oficiales, gestiona
            clubes y reentrena modelos de IA con datos biomecánicos y cardíacos en vivo.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <button
              onClick={handleGenerateWorkout}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95"
            >
              <Zap className="w-4 h-4 fill-white" />
              Generar Microciclo IA
            </button>
            <Link
              href="/ai-studio"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all"
            >
              <BrainCircuit className="w-4 h-4 text-emerald-400" />
              Estudio de Reentrenamiento
            </Link>
            <Link
              href="/coach-tactics"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all"
            >
              <BrainCircuit className="w-4 h-4 text-sky-400" />
              Hablar con el Coach Táctico IA
            </Link>
            <Link
              href="/reports"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-400" />
              Exportar Informe Beca Deportiva
            </Link>
          </div>
        </div>

        {/* Decorative background glows */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute right-40 bottom-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Primary KPI Row - Dinámico */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Atletas Federados"
          value={totalAthletesCount.toString()}
          subtitle={`${db.athletes.length} Élite Senior WT`}
          change="+12% este trimestre"
          icon={Swords}
          accentColor="chong"
        />
        <MetricCard
          title="Sesiones Monitorizadas"
          value={totalTrainingsCount.toLocaleString()}
          subtitle="Pulsometría Bluetooth BLE"
          change="99.4% cobertura"
          icon={Heart}
          accentColor="hong"
        />
        <MetricCard
          title="Carga TRIMP Semanal"
          value={currentWeekTrimp.toLocaleString()}
          subtitle="Índice Banister Óptimo"
          change="Zona Segura ACWR 1.14"
          icon={Flame}
          accentColor="gold"
        />
        <MetricCard
          title="Precisión Modelo IA"
          value={modelAccuracy}
          subtitle={`Versión ${db.retrainMetrics.modelVersion}`}
          change="+0.8% tras reentrenar"
          icon={BrainCircuit}
          accentColor="emerald"
        />
      </div>

      {/* Main Grid: Official Scoreboard & Heart Rate Visualizer */}
      <div className="space-y-8">
        {/* Daedo Scoreboard Simulator */}
        <DaedoScoreboard />

        {/* Physiological & Heart Rate Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <HeartRateVisualizer
              athleteName={selectedAthlete.fullName}
              maxBpm={selectedAthlete.maxHeartRateBpm}
              avgBpm={172}
              zones={{
                zone1RecoveryMin: 10,
                zone2AerobicMin: 14,
                zone3TempoMin: 18,
                zone4ThresholdMin: 22,
                zone5AnaerobicMin: 11,
              }}
              trimpScore={168}
              recoveryDropBpm={42}
            />
          </div>

          {/* Quick Athlete Readiness & Status Card with Selector */}
          <div className="glass-panel rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <span className="text-xs font-semibold text-slate-400 uppercase">Estado del Atleta</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  APTO COMPETICIÓN
                </span>
              </div>

              {/* Selector for athlete */}
              <div className="mb-4">
                <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">Seleccionar Atleta:</label>
                <div className="relative">
                  <select
                    value={selectedAthleteId}
                    onChange={(e) => setSelectedAthleteId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white appearance-none pr-8 focus:outline-none focus:border-sky-500"
                  >
                    {db.athletes.length === 0 ? (
                      <option value="ath-none">Sin atletas (Añade uno desde Atletas)</option>
                    ) : (
                      db.athletes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.fullName} ({a.category.replace(/_/g, " ")})
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-rose-500 p-0.5 flex-shrink-0">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-white font-black text-sm">
                    {selectedAthlete.fullName.split(" ").map((n) => n[0]).join("")}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">{selectedAthlete.fullName}</h4>
                  <p className="text-xs text-slate-400">
                    {selectedAthlete.category.replace(/_/g, " ")} | {selectedAthlete.beltRank.replace("_", " ")}
                  </p>
                  <p className="text-[11px] text-sky-400">{selectedAthlete.clubName}</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Readiness Score:</span>
                  <span className="font-bold text-emerald-400 font-mono">{selectedAthlete.readinessScore}/100</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">FC en Reposo:</span>
                  <span className="font-bold text-white font-mono">{selectedAthlete.restingHeartRateBpm} BPM</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">VO2 Máx Estimado:</span>
                  <span className="font-bold text-sky-400 font-mono">{selectedAthlete.vo2MaxEstimate} ml/kg/min</span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-400">Técnica Favorita:</span>
                  <span className="font-medium text-slate-200 text-right truncate max-w-[160px]">
                    {selectedAthlete.stats.favouriteTechnique}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 mt-4">
              <Link
                href="/athletes"
                className="w-full block text-center py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Ver Ficha Biométrica Completa
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* AI Workout Modal */}
      {workoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-sky-400">
                <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: "8s" }} />
                <h3 className="font-bold text-white text-base">Plan de Entrenamiento Adaptativo con IA</h3>
              </div>
              <button
                onClick={() => setWorkoutModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-800"
              >
                Cerrar
              </button>
            </div>

            {generating ? (
              <div className="py-12 text-center text-slate-300 space-y-3">
                <BrainCircuit className="w-8 h-8 text-sky-400 animate-pulse mx-auto" />
                <p className="text-sm">Analizando fatiga neuromuscular y calibrando rondas...</p>
              </div>
            ) : generationError ? (
              <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">{generationError}</p>
            ) : generatedPlan ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-800/40 text-sky-200">
                  <p className="font-bold mb-1">Borrador guardado · Pendiente de revisión</p>
                  <p>{generatedPlan.objective}</p>
                </div>

                <div className="space-y-3">
                  {generatedPlan.plan.sessions.map((session: any, index: number) => (
                    <div key={`${session.date}-${index}`} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="font-bold text-white mb-2">
                        {session.date} · {session.title}{session.optional ? " · Opcional" : ""} · {session.durationMinutes} min · {session.intensity}
                      </div>
                      <p className="text-slate-400 mb-2">{session.objective}</p>
                      <div className="space-y-2">
                        {session.exercises.map((exercise: any, exerciseIndex: number) => (
                          <div key={`${exercise.name}-${exerciseIndex}`} className="rounded-lg bg-slate-800/60 p-2.5">
                            <p className="font-semibold text-white">{exercise.name} · {exercise.intensityZone}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">{exercise.instructions}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/ai-studio" className="inline-flex rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white">
                  Revisar y publicar en AI Studio
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

