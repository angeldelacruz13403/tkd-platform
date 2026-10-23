"use client";

import { Heart, Activity, Flame, ShieldCheck, Info } from "lucide-react";
import { HeartRateZoneBreakdown } from "@/lib/types";

interface HeartRateVisualizerProps {
  athleteName: string;
  maxBpm: number;
  avgBpm: number;
  currentBpm?: number;
  zones: HeartRateZoneBreakdown;
  trimpScore: number;
  recoveryDropBpm: number;
}

export function HeartRateVisualizer({
  athleteName,
  maxBpm,
  avgBpm,
  currentBpm = 174,
  zones,
  trimpScore,
  recoveryDropBpm,
}: HeartRateVisualizerProps) {
  const totalMinutes =
    zones.zone1RecoveryMin +
    zones.zone2AerobicMin +
    zones.zone3TempoMin +
    zones.zone4ThresholdMin +
    zones.zone5AnaerobicMin || 1;

  const zoneConfigs = [
    {
      name: "Zona 1 - Recuperación Activa",
      range: `50-60% (${Math.round(maxBpm * 0.5)}-${Math.round(maxBpm * 0.6)} BPM)`,
      minutes: zones.zone1RecoveryMin,
      pct: Math.round((zones.zone1RecoveryMin / totalMinutes) * 100),
      color: "bg-emerald-500",
      textColor: "text-emerald-400",
      description: "Técnica suave y estiramientos",
    },
    {
      name: "Zona 2 - Capacidad Aeróbica",
      range: `60-70% (${Math.round(maxBpm * 0.6)}-${Math.round(maxBpm * 0.7)} BPM)`,
      minutes: zones.zone2AerobicMin,
      pct: Math.round((zones.zone2AerobicMin / totalMinutes) * 100),
      color: "bg-sky-500",
      textColor: "text-sky-400",
      description: "Poomsae y drills de desplazamiento",
    },
    {
      name: "Zona 3 - Resistencia Mixta",
      range: `70-80% (${Math.round(maxBpm * 0.7)}-${Math.round(maxBpm * 0.8)} BPM)`,
      minutes: zones.zone3TempoMin,
      pct: Math.round((zones.zone3TempoMin / totalMinutes) * 100),
      color: "bg-amber-500",
      textColor: "text-amber-400",
      description: "Pateo continuo con escudo (Mitts)",
    },
    {
      name: "Zona 4 - Umbral Anaeróbico",
      range: `80-90% (${Math.round(maxBpm * 0.8)}-${Math.round(maxBpm * 0.9)} BPM)`,
      minutes: zones.zone4ThresholdMin,
      pct: Math.round((zones.zone4ThresholdMin / totalMinutes) * 100),
      color: "bg-orange-500",
      textColor: "text-orange-400",
      description: "Sparring táctico por asaltos de 2 min",
    },
    {
      name: "Zona 5 - Potencia Láctica Máxima",
      range: `>90% (>${Math.round(maxBpm * 0.9)} BPM)`,
      minutes: zones.zone5AnaerobicMin,
      pct: Math.round((zones.zone5AnaerobicMin / totalMinutes) * 100),
      color: "bg-rose-500",
      textColor: "text-rose-400",
      description: "Clímax de combate y asalto final (Golden Point)",
    },
  ];

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 p-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Heart className="w-5 h-5 fill-rose-500/30 animate-heart-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Telemetría Cardíaca & Zonas Fisiológicas</h3>
            <p className="text-xs text-slate-400">Atleta: {athleteName} | FC Máx: {maxBpm} BPM</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Carga TRIMP</div>
            <div className="text-sm font-extrabold text-amber-400 font-mono">{trimpScore} pts</div>
          </div>
          <div className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Recuperación 60s (HRR)</div>
            <div className="text-sm font-extrabold text-emerald-400 font-mono">-{recoveryDropBpm} BPM</div>
          </div>
        </div>
      </div>

      {/* Progress Multi-bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-slate-300 mb-2 font-medium">
          <span>Distribución del Esfuerzo en Sesión ({totalMinutes} min totales)</span>
          <span className="font-mono text-rose-400">{avgBpm} BPM Media</span>
        </div>
        <div className="h-4 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800 p-0.5 gap-0.5">
          {zoneConfigs.map((z, idx) => (
            <div
              key={idx}
              style={{ width: `${z.pct}%` }}
              className={`${z.color} h-full rounded-sm transition-all duration-500 hover:brightness-125`}
              title={`${z.name}: ${z.minutes} min (${z.pct}%)`}
            />
          ))}
        </div>
      </div>

      {/* Individual Zone Breakdown */}
      <div className="space-y-2.5">
        {zoneConfigs.map((z, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs hover:border-slate-700 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full ${z.color} flex-shrink-0 shadow-sm`} />
              <div>
                <span className="font-semibold text-white">{z.name}</span>
                <span className="text-[11px] text-slate-400 ml-2">({z.range})</span>
                <p className="text-[10px] text-slate-500">{z.description}</p>
              </div>
            </div>
            <div className="text-right">
              <span className={`font-mono font-bold ${z.textColor}`}>{z.minutes} min</span>
              <span className="text-slate-500 text-[11px] ml-1.5 font-mono">({z.pct}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
