"use client";

import { useState, useEffect } from "react";
import { Swords, Play, Pause, RotateCcw, ShieldAlert, Zap, WifiOff, Heart } from "lucide-react";
import { AthleteLiveTelemetry } from "@/lib/types";

export function DaedoScoreboard({ mat }: { mat?: string } = {}) {
  const [liveState, setLiveState] = useState<any>(null);
  const [chongScore, setChongScore] = useState(0);
  const [hongScore, setHongScore] = useState(0);
  const [chongGamJeom, setChongGamJeom] = useState(0);
  const [hongGamJeom, setHongGamJeom] = useState(0);
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [lastAction, setLastAction] = useState<string>("Bandal Chagui directo al peto (+2 Chong)");

  // Telemetría en tiempo real desde la aplicación y sensores físicos
  const [telemetryList, setTelemetryList] = useState<AthleteLiveTelemetry[]>([]);
  const [registeredAthletes, setRegisteredAthletes] = useState<any[]>([]);
  const [chongSelectedId, setChongSelectedId] = useState<string>("");
  const [hongSelectedId, setHongSelectedId] = useState<string>("");

  const isLive = Boolean(liveState && Date.now() - new Date(liveState.lastEventAt).getTime() < 300000);

  // Cargar atletas registrados para vincular competidores si es necesario
  useEffect(() => {
    let active = true;
    fetch("/api/v1/athletes")
      .then((res) => res.json())
      .then((res) => {
        if (active && res.success && Array.isArray(res.data)) {
          setRegisteredAthletes(res.data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const readLiveState = async () => {
      try {
        const response = await fetch(`/api/v1/integrations/daedo/live${mat ? `?mat=${encodeURIComponent(mat)}` : ""}`, { cache: "no-store" });
        const result = await response.json();
        if (!active) return;
        if (!result.success || !result.data) {
          // Keep the last confirmed scoreboard visible through transient empty polls.
          return;
        }
        const next = result.data;
        setLiveState((current: any) => ({
          ...next,
          chongName: next.chongName || current?.chongName || "",
          hongName: next.hongName || current?.hongName || "",
          tournamentName: next.tournamentName || current?.tournamentName || "",
        }));
        setChongScore(Number(next.chongScore) || 0);
        setHongScore(Number(next.hongScore) || 0);
        setChongGamJeom(Number(next.chongGamJeom) || 0);
        setHongGamJeom(Number(next.hongGamJeom) || 0);
        setRound(Number(next.round) || 1);
        setSecondsLeft(Number(next.secondsLeft) || 0);
        setIsRunning(Boolean(next.clockRunning));
      } catch { /* Keep the local fallback visible if the bridge is offline. */ }
    };

    const readTelemetry = async () => {
      try {
        const response = await fetch("/api/v1/telemetry/live", { cache: "no-store" });
        const result = await response.json();
        if (!active) return;
        if (result.success && Array.isArray(result.data)) {
          setTelemetryList(result.data);
        }
      } catch { /* Fallback */ }
    };

    void readLiveState();
    void readTelemetry();
    const interval = window.setInterval(() => {
      void readLiveState();
      void readTelemetry();
    }, 1500);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [mat]);

  const normalize = (str: string) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const resolveTelemetry = (selectedId: string, name: string): AthleteLiveTelemetry | null => {
    if (selectedId) {
      const match = telemetryList.find((t) => t.athleteId === selectedId);
      if (match) return match;
    }
    const norm = normalize(name);
    if (!norm || norm === "chong" || norm === "hong" || norm === "chongazul" || norm === "hongrojo") {
      return null;
    }
    return (
      telemetryList.find((t) => {
        const tNorm = normalize(t.athleteName);
        return tNorm.includes(norm) || norm.includes(tNorm);
      }) || null
    );
  };

  const chongTelemetry = resolveTelemetry(chongSelectedId, liveState?.chongName || "");
  const hongTelemetry = resolveTelemetry(hongSelectedId, liveState?.hongName || "");

  const now = Date.now();
  // El competidor sólo muestra BPM si tiene la aplicación usándose y con el dispositivo conectado (LIVE, BPM > 0, datos frescos en < 30s)
  const isChongConnected = Boolean(
    chongTelemetry &&
    chongTelemetry.currentBpm > 0 &&
    chongTelemetry.status === "LIVE" &&
    now - new Date(chongTelemetry.lastUpdatedAt || 0).getTime() < 30000
  );

  const isHongConnected = Boolean(
    hongTelemetry &&
    hongTelemetry.currentBpm > 0 &&
    hongTelemetry.status === "LIVE" &&
    now - new Date(hongTelemetry.lastUpdatedAt || 0).getTime() < 30000
  );

  const chongBpm = isChongConnected ? chongTelemetry?.currentBpm : null;
  const hongBpm = isHongConnected ? hongTelemetry?.currentBpm : null;

  useEffect(() => {
    let interval: any = null;
    if (!isLive && isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isLive, isRunning, secondsLeft]);

  const addPoints = (corner: "CHONG" | "HONG", points: number, label: string) => {
    if (corner === "CHONG") {
      setChongScore((prev) => prev + points);
      setLastAction(`${label} (+${points} Chong)`);
    } else {
      setHongScore((prev) => prev + points);
      setLastAction(`${label} (+${points} Hong)`);
    }
  };

  const addGamJeom = (corner: "CHONG" | "HONG") => {
    if (corner === "CHONG") {
      setChongGamJeom((prev) => prev + 1);
      setHongScore((prev) => prev + 1); // WT rule: Gam-jeom awards 1 point to opponent
      setLastAction("Gam-Jeom sancionado a Chong (+1 Hong)");
    } else {
      setHongGamJeom((prev) => prev + 1);
      setChongScore((prev) => prev + 1);
      setLastAction("Gam-Jeom sancionado a Hong (+1 Chong)");
    }
  };

  const resetMatch = () => {
    setChongScore(0);
    setHongScore(0);
    setChongGamJeom(0);
    setHongGamJeom(0);
    setSecondsLeft(120);
    setIsRunning(false);
    setRound(1);
    setLastAction("Combate reiniciado");
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? "0" : ""}${rem}`;
  };

  const chongDisplayName = chongTelemetry?.athleteName || (chongSelectedId && registeredAthletes.find((a) => a.id === chongSelectedId)?.fullName) || liveState?.chongName || "CHONG (Azul)";
  const hongDisplayName = hongTelemetry?.athleteName || (hongSelectedId && registeredAthletes.find((a) => a.id === hongSelectedId)?.fullName) || liveState?.hongName || "HONG (Rojo)";

  const isFinished = liveState?.status === "FINISHED";
  const winnerCorner = liveState?.winner || (isFinished ? (chongScore >= hongScore ? "CHONG" : "HONG") : null);
  const winnerName = winnerCorner === "CHONG" ? chongDisplayName : hongDisplayName;

  const finishByPoints = async () => {
    const winner: "CHONG" | "HONG" = chongScore >= hongScore ? "CHONG" : "HONG";
    setIsRunning(false);
    setSecondsLeft(0);
    setLastAction(`Combate finalizado · Vencedor ${winner} por puntos (${chongScore}-${hongScore})`);
    try {
      await fetch("/api/v1/integrations/daedo/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: `web-finish-${Date.now()}`,
          eventType: "MATCH_FINISHED",
          matchId: liveState?.matchId,
          mat: liveState?.mat || "1",
          source: { protocol: "udp" },
          raw: { encoding: "hex", value: "4d415443485f46494e4953484544" },
          state: {
            ...liveState,
            status: "FINISHED",
            secondsLeft: 0,
            clockRunning: false,
            winner,
            chongScore,
            hongScore,
            chongGamJeom,
            hongGamJeom,
          },
        }),
      });
    } catch {}
  };

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 p-6 overflow-hidden relative">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-sky-400" />
          <h3 className="font-bold text-white text-base">Marcador Oficial Daedo / KPNP</h3>
        </div>
        <div className="flex items-center gap-2">
          {isFinished && (
            <span className="px-3 py-1 rounded text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse flex items-center gap-1.5">
              🏆 FINALIZADO · VENCEDOR POR PUNTOS
            </span>
          )}
          <span className="text-xs text-slate-400">Reglamento:</span>
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-950 text-sky-300 border border-sky-800/50">
            {isLive ? "PUENTE EN VIVO" : "SIN PUENTE"}
          </span>
        </div>
      </div>

      {isFinished && (
        <div className="mb-5 rounded-xl border-2 border-amber-500/60 bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 p-4 text-center shadow-lg">
          <div className="text-xs font-black uppercase tracking-widest text-amber-400">🏆 DECISIÓN OFICIAL DEL COMBATE</div>
          <div className="my-1 text-2xl font-black text-white">
            VENCEDOR: <span className={winnerCorner === "CHONG" ? "text-sky-400" : "text-rose-400"}>{winnerName}</span>
          </div>
          <div className="text-xs font-bold text-slate-300">
            Victoria por puntos · {chongScore} a {hongScore} {chongGamJeom > 0 || hongGamJeom > 0 ? `(Gam-Jeom: ${chongGamJeom} - ${hongGamJeom})` : ""}
          </div>
        </div>
      )}

      {/* Main Score Board Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-6">
        {/* CHONG (Blue) */}
        <div className={`bg-gradient-to-b from-sky-900/40 via-sky-950/60 to-slate-900/90 border-2 rounded-2xl p-5 text-center shadow-chong-glow transition-all ${
          isFinished && winnerCorner === "CHONG"
            ? "border-amber-400 ring-4 ring-amber-400/40 scale-[1.02]"
            : "border-sky-500/60"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black tracking-widest text-sky-400 uppercase flex items-center gap-1">
              CHONG (AZUL) {isFinished && winnerCorner === "CHONG" && <span className="text-amber-300 text-sm">🏆</span>}
            </span>
            {isChongConnected && chongBpm ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[11px] font-mono border border-sky-400/40 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {chongBpm} BPM
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 text-slate-500 text-[10px] font-mono border border-slate-700/50"
                title="El competidor no tiene la aplicación abierta o el sensor conectado"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                Sin sensor
              </div>
            )}
          </div>
          <h4 className="text-base font-bold text-white truncate">{chongDisplayName}</h4>
          <div className="mt-1 flex items-center justify-center">
            <select
              value={chongSelectedId}
              onChange={(e) => setChongSelectedId(e.target.value)}
              className="bg-slate-900/90 text-[10px] text-sky-300 border border-sky-800/50 rounded px-2 py-0.5 max-w-[210px] truncate focus:outline-none focus:border-sky-500"
              title="Vincular con competidor del club para telemetría"
            >
              <option value="">{liveState?.chongName ? `Auto: ${liveState.chongName}` : "Vincular competidor..."}</option>
              {registeredAthletes.map((ath) => (
                <option key={ath.id} value={ath.id}>
                  {ath.fullName} ({ath.isCompetitor ? "Competidor" : "Alumno"})
                </option>
              ))}
            </select>
          </div>
          {isFinished && winnerCorner === "CHONG" && (
            <div className="mt-1 inline-block px-2.5 py-0.5 rounded-full bg-amber-500 text-[10px] font-black text-slate-950">
              ¡GANADOR!
            </div>
          )}
          <div className="my-2">
            <span className="text-6xl font-black text-white font-display tracking-tight">{chongScore}</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-center gap-2">
            <span>Gam-jeom:</span>
            <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {chongGamJeom} / 5
            </span>
          </div>

          {/* Quick Points Chong */}
          <div className="grid grid-cols-3 gap-1.5 mt-4">
            <button
              onClick={() => addPoints("CHONG", 1, "Puño")}
              className="px-2 py-1.5 bg-sky-600/30 hover:bg-sky-600/60 text-white rounded text-[11px] font-medium border border-sky-500/40"
            >
              +1 Puño
            </button>
            <button
              onClick={() => addPoints("CHONG", 2, "Peto")}
              className="px-2 py-1.5 bg-sky-600/40 hover:bg-sky-600/70 text-white rounded text-[11px] font-medium border border-sky-500/50"
            >
              +2 Peto
            </button>
            <button
              onClick={() => addPoints("CHONG", 3, "Cabeza")}
              className="px-2 py-1.5 bg-sky-600/50 hover:bg-sky-600/80 text-white rounded text-[11px] font-medium border border-sky-500/60"
            >
              +3 Cabeza
            </button>
            <button
              onClick={() => addPoints("CHONG", 4, "Giro Peto")}
              className="px-2 py-1.5 bg-sky-500/30 hover:bg-sky-500/60 text-sky-200 rounded text-[10px] font-medium border border-sky-400/40"
            >
              +4 Giro Peto
            </button>
            <button
              onClick={() => addPoints("CHONG", 5, "Giro Cabeza")}
              className="px-2 py-1.5 bg-sky-500/40 hover:bg-sky-500/70 text-sky-200 rounded text-[10px] font-medium border border-sky-400/50"
            >
              +5 Giro Cab.
            </button>
            <button
              onClick={() => addGamJeom("CHONG")}
              className="px-2 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded text-[10px] font-medium border border-amber-500/40"
            >
              Gam-Jeom
            </button>
          </div>
        </div>

        {/* Center Round & Timer */}
        <div className="text-center p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col items-center justify-center">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 ${
            isFinished ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-slate-800 text-slate-300"
          }`}>
            {isFinished ? "Combate Finalizado" : `Asalto ${round} de 3`}
          </div>
          <div className={`font-mono text-5xl font-black tracking-wider my-1 ${
            isFinished ? "text-slate-400" : "text-amber-400"
          }`}>
            {formatTime(secondsLeft)}
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            {isFinished ? "Tiempo Oficial Agotado" : "Tiempo Oficial de Asalto"}
          </p>

          <div className="flex items-center gap-2">
            {!isFinished && (
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`p-3 rounded-xl flex items-center justify-center transition-all ${
                  isRunning
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30"
                }`}
                title={isRunning ? "Pausar reloj" : "Iniciar reloj"}
              >
                {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
            )}
            <button
              onClick={resetMatch}
              className="p-3 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-all"
              title="Reiniciar marcador"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>

          {!isFinished && (
            <button
              onClick={finishByPoints}
              type="button"
              className="mt-3 w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider transition-all shadow-md active:scale-95"
            >
              🏆 Dar vencedor por puntos
            </button>
          )}

          <div className="mt-3 text-[11px] text-sky-400 font-mono bg-sky-950/40 px-3 py-1 rounded border border-sky-800/40">
            {lastAction}
          </div>
        </div>

        {/* HONG (Red) */}
        <div className={`bg-gradient-to-b from-rose-900/40 via-rose-950/60 to-slate-900/90 border-2 rounded-2xl p-5 text-center shadow-hong-glow transition-all ${
          isFinished && winnerCorner === "HONG"
            ? "border-amber-400 ring-4 ring-amber-400/40 scale-[1.02]"
            : "border-rose-500/60"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black tracking-widest text-rose-400 uppercase flex items-center gap-1">
              HONG (ROJO) {isFinished && winnerCorner === "HONG" && <span className="text-amber-300 text-sm">🏆</span>}
            </span>
            {isHongConnected && hongBpm ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[11px] font-mono border border-rose-400/40 shadow-sm animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {hongBpm} BPM
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800/80 text-slate-500 text-[10px] font-mono border border-slate-700/50"
                title="El competidor no tiene la aplicación abierta o el sensor conectado"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                Sin sensor
              </div>
            )}
          </div>
          <h4 className="text-base font-bold text-white truncate">{hongDisplayName}</h4>
          <div className="mt-1 flex items-center justify-center">
            <select
              value={hongSelectedId}
              onChange={(e) => setHongSelectedId(e.target.value)}
              className="bg-slate-900/90 text-[10px] text-rose-300 border border-rose-800/50 rounded px-2 py-0.5 max-w-[210px] truncate focus:outline-none focus:border-rose-500"
              title="Vincular con competidor del club para telemetría"
            >
              <option value="">{liveState?.hongName ? `Auto: ${liveState.hongName}` : "Vincular competidor..."}</option>
              {registeredAthletes.map((ath) => (
                <option key={ath.id} value={ath.id}>
                  {ath.fullName} ({ath.isCompetitor ? "Competidor" : "Alumno"})
                </option>
              ))}
            </select>
          </div>
          {isFinished && winnerCorner === "HONG" && (
            <div className="mt-1 inline-block px-2.5 py-0.5 rounded-full bg-amber-500 text-[10px] font-black text-slate-950">
              ¡GANADOR!
            </div>
          )}
          <div className="my-2">
            <span className="text-6xl font-black text-white font-display tracking-tight">{hongScore}</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-center gap-2">
            <span>Gam-jeom:</span>
            <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {hongGamJeom} / 5
            </span>
          </div>

          {/* Quick Points Hong */}
          <div className="grid grid-cols-3 gap-1.5 mt-4">
            <button
              onClick={() => addPoints("HONG", 1, "Puño")}
              className="px-2 py-1.5 bg-rose-600/30 hover:bg-rose-600/60 text-white rounded text-[11px] font-medium border border-rose-500/40"
            >
              +1 Puño
            </button>
            <button
              onClick={() => addPoints("HONG", 2, "Peto")}
              className="px-2 py-1.5 bg-rose-600/40 hover:bg-rose-600/70 text-white rounded text-[11px] font-medium border border-rose-500/50"
            >
              +2 Peto
            </button>
            <button
              onClick={() => addPoints("HONG", 3, "Cabeza")}
              className="px-2 py-1.5 bg-rose-600/50 hover:bg-rose-600/80 text-white rounded text-[11px] font-medium border border-rose-500/60"
            >
              +3 Cabeza
            </button>
            <button
              onClick={() => addPoints("HONG", 4, "Giro Peto")}
              className="px-2 py-1.5 bg-rose-500/30 hover:bg-rose-500/60 text-rose-200 rounded text-[10px] font-medium border border-rose-400/40"
            >
              +4 Giro Peto
            </button>
            <button
              onClick={() => addPoints("HONG", 5, "Giro Cabeza")}
              className="px-2 py-1.5 bg-rose-500/40 hover:bg-rose-500/70 text-rose-200 rounded text-[10px] font-medium border border-rose-400/50"
            >
              +5 Giro Cab.
            </button>
            <button
              onClick={() => addGamJeom("HONG")}
              className="px-2 py-1.5 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded text-[10px] font-medium border border-amber-500/40"
            >
              Gam-Jeom
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
