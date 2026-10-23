"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Award, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Athlete, GamificationLevel } from "@/lib/types";

type Achievement = { id: string; title: string; description: string; icon: string };
type Profile = {
  enabled: boolean;
  achievements: Array<{ achievement_id: string; awarded_at: string; note: string; gamification_achievements?: Achievement }>;
  catalog: Achievement[];
  levels: GamificationLevel[];
  level: GamificationLevel | null;
  consent?: { status: string; expiresAt: string; consentExpiresAt?: string | null } | null;
};

function isMinor(dateOfBirth?: string): boolean {
  if (!dateOfBirth) return false;
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())
  ) age--;
  return age < 18;
}

export default function GamificationPage() {
  const { role } = useAuth();
  const canManage = role === "ADMIN" || role === "COACH" || role === "CLUB";
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [guardianName, setGuardianName] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const query = athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : "";
      const response = await fetch(`/api/v1/gamification${query}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo cargar el perfil.");
      setProfile(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el perfil.");
    }
  }, [athleteId]);

  useEffect(() => {
    if (!canManage) return;
    void fetch("/api/v1/athletes").then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudieron consultar los alumnos.");
      setAthletes(result.data || []);
      if (!athleteId && result.data?.[0]) setAthleteId(result.data[0].id);
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los alumnos."));
  }, [canManage, athleteId]);

  useEffect(() => { void load(); }, [load]);

  const action = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/v1/gamification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, athleteId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo completar la acción.");
      if (result.consentUrl) {
        setMessage(`Solicitud creada. Comparte este enlace con el tutor: ${result.consentUrl}`);
      } else {
        setMessage("Cambios guardados.");
        await load();
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const createAchievement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action({
      action: "create-achievement",
      title: form.get("title"),
      description: form.get("description"),
      icon: form.get("icon"),
    });
    event.currentTarget.reset();
  };

  const requestConsent = async (event: FormEvent) => {
    event.preventDefault();
    await action({ action: "request-consent", guardianName, guardianEmail });
  };

  const selectedAthlete = athletes.find((item) => item.id === athleteId);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Sparkles className="h-6 w-6 text-amber-300" /> Logros y gamificación</h1>
        <p className="mt-1 text-sm text-slate-400">Los niveles se calculan automáticamente según los umbrales definidos por administración.</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {message && <p role="status" className="break-all rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-200">{message}</p>}
      {canManage && (
        <label className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          Alumno
          <select value={athleteId} onChange={(event) => setAthleteId(event.target.value)} className="min-w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white">
            {athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.fullName}</option>)}
          </select>
        </label>
      )}
      {profile && (
        <>
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-400">Perfil de {selectedAthlete?.fullName || "atleta"}</p>
              <p className="mt-1 text-2xl font-bold text-white">{profile.level?.name || "Nivel inicial"}</p>
              <p className="text-sm text-slate-400">{profile.achievements.length} logros obtenidos</p>
              {profile.consent && <p className="mt-1 text-xs text-slate-400">
                Consentimiento del tutor: {profile.consent.status}
                {profile.consent.consentExpiresAt
                  ? ` · Vence ${new Date(profile.consent.consentExpiresAt).toLocaleDateString("es-ES")}`
                  : ""}
              </p>}
            </div>
            {canManage && (
              <button disabled={busy || profile.enabled} onClick={() => void action({ action: "set-enabled", enabled: true })}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {profile.enabled ? "Gamificación activada" : "Activar perfil"}
              </button>
            )}
          </section>
          {canManage && isMinor(selectedAthlete?.dateOfBirth) && profile.consent?.status !== "GRANTED" && (
            <form onSubmit={(event) => void requestConsent(event)} className="grid gap-3 rounded-2xl border border-amber-900/70 bg-amber-950/20 p-5 sm:grid-cols-3">
              <h2 className="font-semibold text-amber-100 sm:col-span-3">Consentimiento necesario para menores</h2>
              <input required value={guardianName} onChange={(event) => setGuardianName(event.target.value)} placeholder="Nombre del tutor" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              <input required type="email" value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} placeholder="Email del tutor" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              <button disabled={busy} className="rounded-lg border border-amber-800 px-3 py-2 text-sm text-amber-200 disabled:opacity-50">Crear enlace de consentimiento</button>
              <p className="text-xs text-slate-400 sm:col-span-3">El enlace se debe enviar manualmente al tutor; caduca en 14 días.</p>
            </form>
          )}
          <section className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="flex items-center gap-2 font-semibold text-white"><Award className="h-4 w-4 text-amber-300" /> Catálogo del club</h2>
              {profile.catalog.map((achievement) => (
                <div key={achievement.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950/70 p-3">
                  <div><p className="font-medium text-white">{achievement.title}</p><p className="text-xs text-slate-400">{achievement.description}</p></div>
                  {canManage && profile.enabled && <button disabled={busy} onClick={() => void action({ action: "assign-achievement", achievementId: achievement.id })} className="rounded border border-amber-800 px-2 py-1 text-xs text-amber-200">Asignar</button>}
                </div>
              ))}
              {!profile.catalog.length && <p className="text-sm text-slate-400">No hay logros activos.</p>}
            </div>
            <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="font-semibold text-white">Logros obtenidos</h2>
              {profile.achievements.map((item) => <div key={item.achievement_id} className="rounded-lg bg-slate-950/70 p-3 text-sm text-white">{item.gamification_achievements?.title || "Logro"} <span className="text-xs text-slate-500">· {new Date(item.awarded_at).toLocaleDateString()}</span></div>)}
              {!profile.achievements.length && <p className="text-sm text-slate-400">Todavía no hay logros asignados.</p>}
            </div>
          </section>
          {canManage && (
            <form onSubmit={(event) => void createAchievement(event)} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:grid-cols-2">
              <h2 className="font-semibold text-white sm:col-span-2">Crear logro personalizado del club</h2>
              <input name="title" required maxLength={120} placeholder="Título" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              <input name="icon" maxLength={80} placeholder="Icono (nombre)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
              <textarea name="description" maxLength={2000} placeholder="Descripción" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white sm:col-span-2" />
              <button disabled={busy} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Crear logro</button>
            </form>
          )}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-3 font-semibold text-white">Niveles</h2>
            <div className="flex flex-wrap gap-2">{profile.levels.map((item) => <span key={item.levelNumber} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{item.name} · {item.requiredAchievements} logros</span>)}</div>
          </section>
        </>
      )}
    </div>
  );
}
