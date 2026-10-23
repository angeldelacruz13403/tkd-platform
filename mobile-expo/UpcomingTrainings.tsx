import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchApi } from "./api";

type Block = {
  id: string;
  title: string;
  durationMinutes: number;
};

type BlockMetric = Block & {
  elapsedSeconds: number;
  avgBpm: number;
  maxBpm: number;
  sampleCount: number;
  completed: boolean;
};

type Workout = {
  id: string;
  athleteId: string;
  title: string;
  athleteName?: string;
  date: string;
  durationMinutes: number;
  type: string;
  status: string;
  aiFeedback?: string;
  blocks?: Block[];
  blockMetrics?: BlockMetric[];
};

export type LiveBlockTelemetry = {
  sessionId: string;
  startedAt: string;
  trainingMode: string;
  currentBlock: BlockMetric & { index: number };
  blocks: BlockMetric[];
};

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const emptyMetrics = (blocks: Block[]): BlockMetric[] =>
  blocks.map((block) => ({ ...block, elapsedSeconds: 0, avgBpm: 0, maxBpm: 0, sampleCount: 0, completed: false }));

function findCurrentBlock(blocks: Block[], elapsedSeconds: number) {
  let offset = 0;
  for (let index = 0; index < blocks.length; index += 1) {
    const duration = blocks[index].durationMinutes * 60;
    if (elapsedSeconds < offset + duration || index === blocks.length - 1) {
      return { index, elapsed: Math.max(0, Math.min(duration, elapsedSeconds - offset)) };
    }
    offset += duration;
  }
  return { index: 0, elapsed: 0 };
}

const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function UpcomingTrainings({
  athleteId,
  currentBpm,
  isConnected,
  visible,
  onRunningChange,
  onBlockTelemetryChange,
}: {
  athleteId: string;
  currentBpm: number;
  isConnected: boolean;
  visible: boolean;
  onRunningChange: (running: boolean) => void;
  onBlockTelemetryChange: (telemetry: LiveBlockTelemetry | null) => void;
}) {
  const [sessions, setSessions] = useState<Workout[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [metrics, setMetrics] = useState<BlockMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [startingId, setStartingId] = useState("");
  const [error, setError] = useState("");
  const finishingRef = useRef(false);
  const activeRef = useRef<Workout | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const metricsRef = useRef<BlockMetric[]>([]);
  const liveInputRef = useRef({ currentBpm, isConnected });

  liveInputRef.current = { currentBpm, isConnected };
  activeRef.current = activeWorkout;
  startedAtRef.current = startedAt;
  metricsRef.current = metrics;

  const blocks = useMemo(() => {
    if (!activeWorkout) return [];
    return activeWorkout.blocks?.length
      ? activeWorkout.blocks
      : [{ id: `block-${activeWorkout.id}`, title: activeWorkout.title, durationMinutes: Math.max(1, activeWorkout.durationMinutes || 1) }];
  }, [activeWorkout]);

  const totalSeconds = blocks.reduce((sum, block) => sum + block.durationMinutes * 60, 0);
  const current = blocks.length ? findCurrentBlock(blocks, elapsedSeconds) : { index: 0, elapsed: 0 };

  const refresh = async () => {
    if (!athleteId || athleteId === "unassigned") return;
    setLoading(true);
    setError("");
    try {
      const [trainingResponse, liveResponse] = await Promise.all([
        fetchApi("trainings"),
        fetchApi("telemetry/live"),
      ]);
      const today = localDateKey(new Date());
      const athleteSessions = (trainingResponse.data || []).filter((session: Workout) =>
        session.athleteId === athleteId &&
        (session.status === "SCHEDULED" || session.status === "IN_PROGRESS") &&
        (session.status === "IN_PROGRESS" || String(session.date).slice(0, 10) >= today)
      ) as Workout[];
      setSessions(athleteSessions);
      const inProgress = athleteSessions.find((session) => session.status === "IN_PROGRESS");
      if (inProgress && !activeRef.current) {
        const liveRow = (liveResponse.data || []).find((row: any) => row.athleteId === athleteId);
        const saved = liveRow?.blockTelemetry as LiveBlockTelemetry | undefined;
        const resumedAt = saved?.sessionId === inProgress.id ? new Date(saved.startedAt).getTime() : Date.now();
        const planBlocks = inProgress.blocks?.length
          ? inProgress.blocks
          : [{ id: `block-${inProgress.id}`, title: inProgress.title, durationMinutes: Math.max(1, inProgress.durationMinutes || 1) }];
        const savedMetrics = saved?.sessionId === inProgress.id && Array.isArray(saved.blocks)
          ? saved.blocks
          : inProgress.blockMetrics || emptyMetrics(planBlocks);
        activeRef.current = inProgress;
        setActiveWorkout(inProgress);
        startedAtRef.current = Number.isFinite(resumedAt) ? resumedAt : Date.now();
        setStartedAt(startedAtRef.current);
        metricsRef.current = savedMetrics;
        setMetrics(savedMetrics);
        onRunningChange(true);
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "No se pudieron cargar los próximos entrenos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [athleteId]);

  useEffect(() => {
    const interval = setInterval(() => { void refresh(); }, 30000);
    return () => clearInterval(interval);
  }, [athleteId]);

  useEffect(() => {
    if (!activeWorkout || startedAt === null) return;
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeWorkout?.id, startedAt]);

  useEffect(() => {
    if (!activeWorkout || startedAt === null || !blocks.length) return;
    const sampler = setInterval(() => {
      const { currentBpm: bpm, isConnected: connected } = liveInputRef.current;
      if (!connected || bpm <= 0) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - (startedAtRef.current || Date.now())) / 1000));
      const blockIndex = findCurrentBlock(blocks, elapsed).index;
      setMetrics((previous) => {
        const next = previous.length === blocks.length ? [...previous] : emptyMetrics(blocks);
        const block = next[blockIndex];
        const sampleCount = block.sampleCount + 1;
        const priorTotal = block.avgBpm * block.sampleCount;
        next[blockIndex] = {
          ...block,
          elapsedSeconds: findCurrentBlock(blocks, elapsed).elapsed,
          avgBpm: Math.round((priorTotal + bpm) / sampleCount),
          maxBpm: Math.max(block.maxBpm, bpm),
          sampleCount,
          completed: elapsed >= blocks.slice(0, blockIndex + 1).reduce((sum, item) => sum + item.durationMinutes * 60, 0),
        };
        for (let index = 0; index < blockIndex; index += 1) next[index] = { ...next[index], completed: true };
        metricsRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(sampler);
  }, [activeWorkout?.id, startedAt, blocks]);

  const makeTelemetry = (): LiveBlockTelemetry | null => {
    if (!activeWorkout || startedAt === null || !blocks.length) return null;
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const { index, elapsed: blockElapsed } = findCurrentBlock(blocks, elapsed);
    const currentMetrics = metricsRef.current.length === blocks.length ? metricsRef.current : emptyMetrics(blocks);
    const currentBlock = {
      ...currentMetrics[index],
      elapsedSeconds: blockElapsed,
      completed: elapsed >= totalSeconds,
      index,
    };
    const completedMetrics = currentMetrics.map((metric, metricIndex) => ({
      ...metric,
      elapsedSeconds: metricIndex < index
        ? blocks[metricIndex].durationMinutes * 60
        : metricIndex === index
          ? blockElapsed
          : 0,
      completed: metricIndex < index || (metricIndex === index && elapsed >= totalSeconds),
    }));
    return {
      sessionId: activeWorkout.id,
      startedAt: new Date(startedAt).toISOString(),
      trainingMode: activeWorkout.title,
      currentBlock,
      blocks: completedMetrics,
    };
  };

  useEffect(() => {
    const telemetry = makeTelemetry();
    onBlockTelemetryChange(telemetry);
  }, [activeWorkout, startedAt, elapsedSeconds, metrics]);

  const finish = async () => {
    const workout = activeRef.current;
    if (!workout || finishingRef.current) return;
    finishingRef.current = true;
    const finalMetrics = metricsRef.current;
    const samples = finalMetrics.reduce((sum, block) => sum + block.sampleCount, 0);
    const average = samples
      ? Math.round(finalMetrics.reduce((sum, block) => sum + block.avgBpm * block.sampleCount, 0) / samples)
      : 0;
    const maximum = Math.max(0, ...finalMetrics.map((block) => block.maxBpm));
    const elapsed = Math.max(1, Math.floor((Date.now() - (startedAtRef.current || Date.now())) / 60_000));
    try {
      await fetchApi("trainings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workout.id,
          status: "COMPLETED",
          durationMinutes: elapsed,
          avgHeartRateBpm: average,
          maxHeartRateBpm: maximum,
          blockMetrics: finalMetrics,
        }),
      });
      activeRef.current = null;
      startedAtRef.current = null;
      setActiveWorkout(null);
      setStartedAt(null);
      setElapsedSeconds(0);
      setMetrics([]);
      onBlockTelemetryChange(null);
      onRunningChange(false);
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "No se pudo guardar el resumen por bloques.");
    } finally {
      finishingRef.current = false;
    }
  };

  useEffect(() => {
    if (activeWorkout && startedAt !== null && elapsedSeconds >= totalSeconds && totalSeconds > 0) {
      void finish();
    }
  }, [activeWorkout?.id, elapsedSeconds, totalSeconds]);

  const start = async (workout: Workout) => {
    if (workout.status !== "IN_PROGRESS" && String(workout.date).slice(0, 10) !== localDateKey(new Date())) return;
    setStartingId(workout.id);
    setError("");
    try {
      if (workout.status !== "IN_PROGRESS") {
        await fetchApi("trainings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: workout.id, status: "IN_PROGRESS" }),
        });
      }
      const plannedBlocks = workout.blocks?.length
        ? workout.blocks
        : [{ id: `block-${workout.id}`, title: workout.title, durationMinutes: Math.max(1, workout.durationMinutes || 1) }];
      const nextStartedAt = Date.now();
      activeRef.current = { ...workout, status: "IN_PROGRESS" };
      startedAtRef.current = nextStartedAt;
      metricsRef.current = emptyMetrics(plannedBlocks);
      setActiveWorkout(activeRef.current);
      setStartedAt(nextStartedAt);
      setElapsedSeconds(0);
      setMetrics(metricsRef.current);
      onRunningChange(true);
      setSessions((previous) => previous.map((item) => item.id === workout.id ? { ...item, status: "IN_PROGRESS" } : item));
    } catch (value) {
      setError(value instanceof Error ? value.message : "No se pudo iniciar el entrenamiento.");
    } finally {
      setStartingId("");
    }
  };

  const today = localDateKey(new Date());
  const currentBlock = blocks[current.index];
  const currentMetric = metrics[current.index];
  const currentDurationSeconds = currentBlock ? currentBlock.durationMinutes * 60 : 0;
  const blocksDone = blocks.length ? findCurrentBlock(blocks, elapsedSeconds).index : 0;

  return (
    <View style={{ display: visible ? "flex" : "none", marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ color: "#fbbf24", fontSize: 13, fontWeight: "800" }}>PRÓXIMOS ENTRENOS</Text>
        <TouchableOpacity onPress={() => void refresh()} disabled={loading} accessibilityLabel="Actualizar próximos entrenos">
          {loading ? <ActivityIndicator size="small" color="#38bdf8" /> : <Ionicons name="refresh" size={19} color="#38bdf8" />}
        </TouchableOpacity>
      </View>
      {!!error && <Text style={{ color: "#fda4af", fontSize: 12, marginBottom: 8 }}>{error}</Text>}

      {activeWorkout && currentBlock ? (
        <View style={{ backgroundColor: "#0d1f17", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#22c55e60" }}>
          <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "800" }}>ENTRENAMIENTO EN CURSO · {activeWorkout.title}</Text>
          <Text style={{ color: "#cbd5e1", fontSize: 12, marginTop: 5 }}>
            Bloque {current.index + 1}/{blocks.length}: {currentBlock.title} · {formatTime(Math.max(0, currentDurationSeconds - current.elapsed))}
          </Text>
          <View style={{ height: 6, backgroundColor: "#1e293b", borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
            <View style={{ height: 6, width: `${Math.min(100, currentDurationSeconds ? current.elapsed / currentDurationSeconds * 100 : 0)}%`, backgroundColor: "#22c55e" }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
            <Text style={{ color: isConnected ? "#4ade80" : "#fbbf24", fontSize: 12, fontWeight: "700" }}>
              {isConnected && currentBpm > 0 ? `${currentBpm} BPM actuales` : "Conecta el pulsómetro BLE"}
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 11 }}>
              Media bloque: {currentMetric?.avgBpm || "—"} · Máx: {currentMetric?.maxBpm || "—"}
            </Text>
          </View>
          {blocks.map((block, index) => {
            const metric = metrics[index];
            return (
              <View key={block.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8 }}>
                <Text style={{ color: index === current.index ? "#4ade80" : "#94a3b8", fontSize: 11 }}>
                  {index < current.index ? "✓" : index === current.index ? "▶" : "○"} {block.title}
                </Text>
                <Text style={{ color: "#94a3b8", fontSize: 11 }}>
                  {metric?.sampleCount ? `${metric.avgBpm} / ${metric.maxBpm} BPM` : "Sin datos"}
                </Text>
              </View>
            );
          })}
          <Text style={{ color: "#64748b", fontSize: 10, marginTop: 8 }}>
            Bloques completados: {blocksDone} · PPM por bloque visibles para el entrenador en directo.
          </Text>
        </View>
      ) : (
        <>
          {sessions.map((workout) => {
            const isToday = String(workout.date).slice(0, 10) === today;
            const canStart = isToday || workout.status === "IN_PROGRESS";
            return (
              <View key={workout.id} style={{ backgroundColor: "#111c2e", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: isToday ? "#f59e0b80" : "#1e293b" }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{workout.title}</Text>
                <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>
                  {isToday ? "HOY" : new Date(`${String(workout.date).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES")} · {workout.durationMinutes} min · {workout.blocks?.length || 1} bloques
                </Text>
                {!!workout.aiFeedback && <Text numberOfLines={3} style={{ color: "#cbd5e1", fontSize: 12, marginTop: 6 }}>{workout.aiFeedback}</Text>}
                <TouchableOpacity
                  disabled={!canStart || !!startingId}
                  onPress={() => void start(workout)}
                  style={{ backgroundColor: canStart ? "#22c55e" : "#334155", borderRadius: 10, padding: 10, alignItems: "center", marginTop: 8, flexDirection: "row", justifyContent: "center", gap: 6 }}
                >
                  {startingId === workout.id ? <ActivityIndicator size="small" color="#052e16" /> : <Ionicons name="play" size={16} color={canStart ? "#052e16" : "#94a3b8"} />}
                  <Text style={{ color: canStart ? "#052e16" : "#94a3b8", fontWeight: "800" }}>
                    {workout.status === "IN_PROGRESS" ? "Reanudar" : isToday ? "Iniciar entrenamiento de hoy" : "Programado"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {!sessions.length && !loading && !error && (
            <View style={{ backgroundColor: "#111c2e", borderRadius: 14, padding: 14 }}>
              <Text style={{ color: "#94a3b8", fontSize: 12 }}>No tienes entrenamientos programados próximos.</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}
