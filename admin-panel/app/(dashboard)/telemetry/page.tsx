"use client";

import { useEffect, useState, useRef } from "react";
import {
  Heart,
  Activity,
  Radio,
  Flame,
  Battery,
  Clock,
  AlertTriangle,
  RefreshCw,
  Users,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { AthleteLiveTelemetry } from "@/lib/types";

export default function TelemetryDashboardPage() {
  const [telemetryList, setTelemetryList] = useState<AthleteLiveTelemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "live" | "critical">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Buffer histórico por atleta (últimos 30 puntos por ID de atleta)
  const [bpmHistoryMap, setBpmHistoryMap] = useState<Record<string, Array<{ time: number; bpm: number }>>>({});

  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/v1/telemetry/live");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setTelemetryList(json.data);
          setLastUpdated(new Date());
          setLoadError("");

          // Actualizar historial en tiempo real asegurando unicidad de puntos
          const now = Date.now();
          setBpmHistoryMap((prev) => {
            const next = { ...prev };
            json.data.forEach((ath: AthleteLiveTelemetry) => {
              if (ath.currentBpm > 0 && ath.status === "LIVE") {
                const history = next[ath.athleteId] ? [...next[ath.athleteId]] : [];
                const last = history[history.length - 1];
                // Evitar duplicar punto en el mismo segundo
                if (!last || Math.floor(last.time / 1000) !== Math.floor(now / 1000)) {
                  history.push({ time: now, bpm: ath.currentBpm });
                  // Ventana móvil fluida de 24 puntos
                  next[ath.athleteId] = history.slice(-24);
                }
              }
            });
            return next;
          });
        }
      } else {
        const json = await res.json().catch(() => ({}));
        setLoadError(json.error || "No se pudo cargar la telemetría.");
      }
    } catch (err) {
      console.error("Error al obtener telemetría:", err);
      setLoadError("No se pudo conectar con el servidor de telemetría.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchTelemetry, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh]);

  // Métricas globales del escuadrón
  const liveAthletes = telemetryList.filter((a) => a.status === "LIVE" && a.currentBpm > 0);
  const criticalAthletes = liveAthletes.filter((a) => a.zone === "Z4" || a.zone === "Z5");
  const avgSquadBpm =
    liveAthletes.length > 0
      ? Math.round(liveAthletes.reduce((sum, a) => sum + a.currentBpm, 0) / liveAthletes.length)
      : 0;
  const totalTrimpToday = telemetryList.reduce((sum, a) => sum + (a.trimpScore || 0), 0);

  const filteredList = telemetryList.filter((athlete) => {
    if (filter === "live") return athlete.currentBpm > 0;
    if (filter === "critical") return athlete.zone === "Z4" || athlete.zone === "Z5";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado y controles */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
              <Heart className="h-5 w-5 animate-pulse text-rose-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Telemetría Escuadrón (PPM en Vivo)
              </h1>
              <p className="text-xs text-slate-400">
                Monitorización simultánea de pulsaciones por minuto (PPM/BPM) y zonas fisiológicas de los atletas
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              autoRefresh
                ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                : "border-slate-800 bg-slate-900 text-slate-400"
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${autoRefresh ? "animate-pulse text-emerald-400" : ""}`} />
            {autoRefresh ? "En vivo (1s)" : "Pausado"}
          </button>

          <button
            onClick={fetchTelemetry}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            Actualizar
          </button>

        </div>
      </div>

      {/* KPI Cards de resumen simultáneo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Atletas en Vivo</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{liveAthletes.length}</span>
            <span className="text-xs text-slate-500">de {telemetryList.length} registrados</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Transmitiendo por Bluetooth & API</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">PPM Medio Escuadrón</span>
            <Activity className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400">{avgSquadBpm || "—"}</span>
            <span className="text-xs text-slate-400">BPM</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Ritmo medio de combate del grupo
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Alerta Zona Z4-Z5</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400">{criticalAthletes.length}</span>
            <span className="text-xs text-slate-500">atletas</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-300">
            &gt;80% FC Máx (Máxima exigencia láctica)
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Carga TRIMP Total</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{totalTrimpToday}</span>
            <span className="text-xs text-slate-400">pts</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Impulso de entrenamiento acumulado
          </div>
        </div>
      </div>

      {/* Pestañas de filtrado */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "all" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-white"
          }`}
        >
          Todos los atletas ({telemetryList.length})
        </button>
        <button
          onClick={() => setFilter("live")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "live" ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300" : "text-slate-400 hover:text-white"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Con lectura ({telemetryList.filter((athlete) => athlete.currentBpm > 0).length})
        </button>
        <button
          onClick={() => setFilter("critical")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "critical" ? "bg-rose-950/60 border border-rose-500/40 text-rose-300" : "text-slate-400 hover:text-white"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          Alta intensidad Z4-Z5 ({criticalAthletes.length})
        </button>
        {lastUpdated && (
          <span className="ml-auto text-[11px] text-slate-500">
            Última actualización: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Grid de Atletas Simultáneos */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <RefreshCw className="h-6 w-6 animate-spin text-sky-400" />
            <p className="text-sm">Conectando con la telemetría del escuadrón...</p>
          </div>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center">
          <Heart className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="mt-3 text-base font-semibold text-white">Sin telemetría activa</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
            Los atletas pueden transmitir su frecuencia cardíaca abriendo la app móvil con su pulsómetro BLE (COOSPO HW9 o estándar Bluetooth).
          </p>
          {loadError && <p className="mt-3 text-xs text-rose-300">{loadError}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredList.map((athlete) => {
            const isLive = athlete.status === "LIVE" && athlete.currentBpm > 0;
            const hasReading = athlete.currentBpm > 0;
            const pctMax =
              athlete.maxHeartRateBpm > 0 && athlete.currentBpm > 0
                ? Math.min(100, Math.round((athlete.currentBpm / athlete.maxHeartRateBpm) * 100))
                : 0;

            const formatDuration = (sec: number) => {
              const m = Math.floor(sec / 60);
              const s = sec % 60;
              return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
            };

            return (
              <div
                key={athlete.athleteId}
                className={`relative flex flex-col justify-between overflow-hidden rounded-xl border bg-slate-900/80 p-5 transition-all duration-300 ${
                  isLive
                    ? athlete.zone === "Z5"
                      ? "border-rose-500/80 shadow-lg shadow-rose-950/40"
                      : athlete.zone === "Z4"
                      ? "border-orange-500/60 shadow-lg shadow-orange-950/30"
                      : "border-slate-800 hover:border-slate-700"
                    : "border-slate-800/60 opacity-75"
                }`}
              >
                {/* Header Atleta */}
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-sky-400 border border-slate-700">
                        {athlete.athleteName
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-base leading-tight">
                          {athlete.athleteName}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {athlete.category || "Senior WT"} {athlete.beltRank ? `• ${athlete.beltRank}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isLive ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                          LIVE
                        </span>
                      ) : hasReading && athlete.status === "PAUSED" ? (
                        <span className="rounded-full bg-amber-950/70 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          PAUSADO
                        </span>
                      ) : hasReading ? (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                          ÚLTIMA LECTURA
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                          SIN SEÑAL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Display Central de PPM */}
                  <div className="my-5 flex items-center justify-between rounded-xl bg-slate-950/80 p-4 border border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${athlete.zoneColor}22` }}
                      >
                        <Heart
                          className={`h-7 w-7 ${isLive ? "animate-pulse" : ""}`}
                          style={{ color: athlete.zoneColor }}
                        />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className="text-4xl font-extrabold tracking-tight"
                            style={{ color: hasReading ? athlete.zoneColor : "#64748b" }}
                          >
                            {hasReading ? athlete.currentBpm : "---"}
                          </span>
                          <span className="text-xs font-bold text-slate-400">PPM</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {hasReading ? `${pctMax}% de FC Máx · último valor recibido` : "Esperando primera lectura"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className="inline-block rounded-md px-2 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: `${athlete.zoneColor}22`,
                          color: athlete.zoneColor,
                          border: `1px solid ${athlete.zoneColor}44`,
                        }}
                      >
                        {athlete.zone} • {athlete.zoneName}
                      </span>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Máx: {athlete.maxHeartRateBpm} BPM
                      </p>
                    </div>
                  </div>

                  {/* Gráfica de Onda PPM en Tiempo Real (Sparkline SVG Reactivo sin duplicar) */}
                  {(() => {
                    const samples = bpmHistoryMap[athlete.athleteId] || [];
                    const maxB = athlete.maxHeartRateBpm || 200;
                    const minB = athlete.restingHeartRateBpm || 50;
                    const width = 280;
                    const height = 48;

                    let pathData = "";
                    if (samples.length >= 2) {
                      const points = samples.map((pt, idx) => {
                        const x = (idx / (samples.length - 1)) * width;
                        const clamped = Math.max(minB, Math.min(maxB, pt.bpm));
                        const y = height - ((clamped - minB) / (maxB - minB || 1)) * height;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      });
                      pathData = `M ${points.join(" L ")}`;
                    }

                    return (
                      <div className="mb-3 rounded-lg bg-slate-950/60 p-2 border border-slate-800/60">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                            Ritmo Cardíaco en Vivo
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400">
                            {samples.length > 0 ? `${samples.length} seg` : "Esperando flujo..."}
                          </span>
                        </div>
                        <div className="relative h-12 w-full overflow-hidden">
                          {samples.length >= 2 ? (
                            <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
                              <defs>
                                <linearGradient id={`grad-${athlete.athleteId}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={athlete.zoneColor || "#10b981"} stopOpacity="0.3" />
                                  <stop offset="100%" stopColor={athlete.zoneColor || "#10b981"} stopOpacity="0.0" />
                                </linearGradient>
                              </defs>
                              <path
                                d={pathData}
                                fill="none"
                                stroke={athlete.zoneColor || "#10b981"}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-slate-600 font-mono">
                              {isLive ? "Generando trazado en vivo..." : "Pulsómetro en reposo"}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Barra de progreso de FC */}
                  <div className="space-y-1.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pctMax}%`,
                          backgroundColor: isLive ? athlete.zoneColor : "#334155",
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Reposo: {athlete.restingHeartRateBpm || 50} BPM</span>
                      <span>Umbral 85%: {Math.round(athlete.maxHeartRateBpm * 0.85)} BPM</span>
                      <span>Máx: {athlete.maxHeartRateBpm} BPM</span>
                    </div>
                  </div>
                </div>

                {/* Footer Métricas */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatDuration(athlete.sessionDurationSec || 0)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                    <span>TRIMP: <strong className="text-white">{athlete.trimpScore || 0}</strong></span>
                  </div>
                  {athlete.batteryLevel !== null && athlete.batteryLevel !== undefined && (
                    <div className="flex items-center gap-1">
                      <Battery className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{athlete.batteryLevel}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
