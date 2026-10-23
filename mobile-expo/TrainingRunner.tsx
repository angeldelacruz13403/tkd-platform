import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fetchApi } from "./api";

type Session = {
  id: string;
  title?: string;
  athleteName?: string;
  date?: string;
  status?: string;
  durationMinutes?: number;
  aiFeedback?: string;
};

const parseExercises = (plan: string) =>
  plan
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^([-*•]|\d+[.)])\s+/.test(line))
    .map((line) => line.replace(/^([-*•]|\d+[.)])\s+/, "").replace(/\*\*/g, ""));

const fmt = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function TrainingRunner({ sessions, onChanged }: { sessions: Session[]; onChanged: () => void }) {
  const pending = useMemo(
    () => sessions.filter((s) => (s.status === "SCHEDULED" || s.status === "IN_PROGRESS")),
    [sessions]
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const active = pending.find((s) => s.id === activeId) || null;
  const exercises = useMemo(() => parseExercises(active?.aiFeedback || ""), [active?.aiFeedback]);
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const doneCount = exercises.filter((_, i) => done[i]).length;

  const update = async (session: Session, body: Record<string, unknown>) => {
    await fetchApi("trainings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: session.id, ...body }),
    });
  };

  const start = async (session: Session) => {
    setBusy(true);
    try {
      await update(session, { status: "IN_PROGRESS" });
      setActiveId(session.id);
      setStartedAt(Date.now());
      setNow(Date.now());
      setDone({});
      onChanged();
    } catch (error) {
      Alert.alert("No se pudo iniciar", error instanceof Error ? error.message : "Error de red");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const minutes = Math.max(1, Math.round(elapsed / 60));
      const summary = `Entrenamiento realizado: ${doneCount}/${exercises.length} ejercicios completados en ${minutes} min.`;
      await update(active, {
        status: "COMPLETED",
        durationMinutes: minutes,
        aiFeedback: `${summary}\n\n${active.aiFeedback || ""}`.slice(0, 4000),
      });
      setActiveId(null);
      setStartedAt(null);
      onChanged();
    } catch (error) {
      Alert.alert("No se pudo finalizar", error instanceof Error ? error.message : "Error de red");
    } finally {
      setBusy(false);
    }
  };

  if (!pending.length) return null;

  if (active && startedAt) {
    return (
      <View style={{ backgroundColor: "#0d1f17", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#22c55e60", marginBottom: 14 }}>
        <Text style={{ color: "#4ade80", fontSize: 11, fontWeight: "700" }}>ENTRENANDO · {active.athleteName || "Atleta"}</Text>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 2 }}>{active.title}</Text>
        <Text style={{ color: "#a6e22e", fontSize: 40, fontWeight: "800", textAlign: "center", marginVertical: 8 }}>{fmt(elapsed)}</Text>
        <Text style={{ color: "#94a3b8", fontSize: 11, textAlign: "center", marginBottom: 8 }}>
          {exercises.length ? `${doneCount}/${exercises.length} ejercicios` : "Sin lista de ejercicios en el plan"}
        </Text>
        <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
          {exercises.map((exercise, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setDone((current) => ({ ...current, [index]: !current[index] }))}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1e293b" }}
            >
              <Ionicons name={done[index] ? "checkbox" : "square-outline"} size={22} color={done[index] ? "#4ade80" : "#64748b"} />
              <Text style={{ flex: 1, color: done[index] ? "#64748b" : "#e2e8f0", fontSize: 13, textDecorationLine: done[index] ? "line-through" : "none" }}>
                {exercise}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          disabled={busy}
          onPress={() =>
            Alert.alert("Finalizar entrenamiento", `${doneCount}/${exercises.length} ejercicios · ${fmt(elapsed)}`, [
              { text: "Seguir", style: "cancel" },
              { text: "Finalizar", onPress: finish },
            ])
          }
          style={{ backgroundColor: "#ef4444", borderRadius: 12, padding: 12, alignItems: "center", marginTop: 12 }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>Finalizar entrenamiento</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: "#fbbf24", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>PROGRAMADOS</Text>
      {pending.map((session) => {
        const isToday = (session.date || "").slice(0, 10) === todayKey();
        return (
          <View key={session.id} style={{ backgroundColor: "#111c2e", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: isToday ? "#f59e0b80" : "#1e293b" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{session.title}</Text>
            <Text style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
              {session.athleteName || "Atleta"} · {(session.date || "").slice(0, 10)}{isToday ? " · HOY" : ""} · {session.status === "IN_PROGRESS" ? "EN CURSO" : "PENDIENTE"}
            </Text>
            <Text numberOfLines={3} style={{ color: "#cbd5e1", fontSize: 12, marginTop: 6 }}>{session.aiFeedback}</Text>
            <TouchableOpacity
              disabled={busy}
              onPress={() => start(session)}
              style={{ backgroundColor: "#22c55e", borderRadius: 10, padding: 10, alignItems: "center", marginTop: 8, flexDirection: "row", justifyContent: "center", gap: 6 }}
            >
              <Ionicons name="play" size={16} color="#052e16" />
              <Text style={{ color: "#052e16", fontWeight: "800" }}>{session.status === "IN_PROGRESS" ? "Reanudar" : "Iniciar entreno"}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
};
