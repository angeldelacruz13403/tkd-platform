"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus, School } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Athlete, ClassTrainingSession, ClubClass } from "@/lib/types";

export default function ClassesPage() {
  const { role } = useAuth();
  const canManage = role === "ADMIN" || role === "CLUB" || role === "COACH";
  const [classes, setClasses] = useState<ClubClass[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [sessions, setSessions] = useState<Record<string, ClassTrainingSession[]>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const [classResponse, athleteResponse] = await Promise.all([
        fetch("/api/v1/classes"),
        fetch("/api/v1/athletes"),
      ]);
      const [classResult, athleteResult] = await Promise.all([classResponse.json(), athleteResponse.json()]);
      if (!classResponse.ok || !classResult.success) throw new Error(classResult.error || "No se pudieron cargar las clases.");
      setClasses(classResult.data || []);
      if (athleteResponse.ok && athleteResult.success) setAthletes(athleteResult.data || []);
      const loaded = await Promise.all((classResult.data || []).map(async (item: ClubClass) => {
        const response = await fetch(`/api/v1/classes/${encodeURIComponent(item.id)}/trainings`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "No se pudieron cargar entrenamientos.");
        return [item.id, result.data || []] as const;
      }));
      setSessions(Object.fromEntries(loaded));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las clases.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createClass = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, athleteIds: selectedIds }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo crear la clase.");
      setName("");
      setDescription("");
      setSelectedIds([]);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear la clase.");
    } finally {
      setBusy(false);
    }
  };

  const addTraining = async (event: FormEvent<HTMLFormElement>, classId: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/classes/${encodeURIComponent(classId)}/trainings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          scheduledAt: form.get("scheduledAt"),
          durationMinutes: Number(form.get("durationMinutes")),
          notes: form.get("notes"),
          blocks: [],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo guardar el entrenamiento.");
      event.currentTarget.reset();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el entrenamiento.");
    } finally {
      setBusy(false);
    }
  };

  const updateMembers = async (classId: string, athleteIds: string[]) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/classes/${encodeURIComponent(classId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteIds }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudieron actualizar los alumnos.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron actualizar los alumnos.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><School className="h-6 w-6 text-sky-400" /> Clases y entrenamientos compartidos</h1>
        <p className="mt-1 text-sm text-slate-400">Una sesión programada pertenece a la clase y se comparte con todos sus alumnos.</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {canManage && (
        <form onSubmit={createClass} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:grid-cols-2">
          <h2 className="text-lg font-semibold text-white md:col-span-2">Crear una clase</h2>
          <input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de la clase" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descripción (opcional)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          <div className="max-h-36 overflow-auto rounded-lg border border-slate-700 p-3 md:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Alumnos (se pueden pertenecer a varias clases)</p>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {athletes.map((athlete) => (
                <label key={athlete.id} className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={selectedIds.includes(athlete.id)} onChange={(event) => setSelectedIds((current) =>
                    event.target.checked ? [...current, athlete.id] : current.filter((id) => id !== athlete.id)
                  )} />
                  {athlete.fullName}
                </label>
              ))}
            </div>
          </div>
          <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2"><Plus className="h-4 w-4" /> Crear clase</button>
        </form>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {classes.map((classItem) => (
          <article key={classItem.id} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <div>
              <h2 className="text-lg font-bold text-white">{classItem.name}</h2>
              <p className="text-sm text-slate-400">{classItem.description || "Sin descripción"} · {classItem.athleteIds.length} alumnos</p>
            </div>
            {canManage && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-slate-400">Gestionar matrículas</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {athletes.map((athlete) => (
                    <label key={athlete.id} className="flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={classItem.athleteIds.includes(athlete.id)} onChange={(event) => {
                        const next = event.target.checked
                          ? Array.from(new Set([...classItem.athleteIds, athlete.id]))
                          : classItem.athleteIds.filter((id) => id !== athlete.id);
                        void updateMembers(classItem.id, next);
                      }} />
                      {athlete.fullName}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200"><CalendarDays className="h-4 w-4 text-sky-400" /> Entrenamientos</h3>
              {(sessions[classItem.id] || []).map((session) => (
                <div key={session.id} className="rounded-lg bg-slate-950/70 p-3">
                  <p className="text-sm font-medium text-white">{session.title}</p>
                  <p className="text-xs text-slate-400">{new Date(session.scheduledAt).toLocaleString()} · {session.durationMinutes} min · {session.status}</p>
                  {session.notes && <p className="mt-1 text-xs text-slate-300">{session.notes}</p>}
                </div>
              ))}
              {!sessions[classItem.id]?.length && <p className="text-xs text-slate-500">Todavía no hay entrenamientos.</p>}
            </div>
            {canManage && (
              <form onSubmit={(event) => void addTraining(event, classItem.id)} className="grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-2">
                <input name="title" required maxLength={255} placeholder="Título del entrenamiento" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                <input name="scheduledAt" type="datetime-local" required className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                <input name="durationMinutes" type="number" min="1" max="1440" defaultValue="60" required className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                <input name="notes" placeholder="Notas" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
                <button disabled={busy} className="rounded-lg border border-sky-700 px-3 py-2 text-sm text-sky-200 hover:bg-sky-950/40 disabled:opacity-50 sm:col-span-2">Programar sesión compartida</button>
              </form>
            )}
          </article>
        ))}
      </div>
      {!classes.length && <p className="rounded-xl border border-slate-800 p-6 text-center text-sm text-slate-400">No hay clases disponibles.</p>}
    </div>
  );
}
