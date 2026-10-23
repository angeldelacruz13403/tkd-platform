/**
 * TKD Global Hub - Cliente de API REST para Vercel & Supabase
 */

export const DEFAULT_VERCEL_API = "https://tkdcore.vercel.app/api/v1";

let activeApiUrl = DEFAULT_VERCEL_API;
let activeToken = "";

export const setApiUrl = (url: string) => {
  if (url && url.trim().length > 0) {
    activeApiUrl = url.trim().replace(/\/$/, "");
  }
};

export const getApiUrl = () => activeApiUrl;

export const setApiToken = (token: string) => { activeToken = token; };

const apiHeaders = (): Record<string, string> => activeToken ? { Authorization: `Bearer ${activeToken}` } : {};

export async function fetchApi(path: string, options: RequestInit = {}) {
  const res = await fetch(`${activeApiUrl}/${path.replace(/^\//, "")}`, {
    ...options,
    headers: { ...apiHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}

export async function loginToApi(identifier: string, password: string) {
  const res = await fetch(`${activeApiUrl}/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: identifier,
      email: identifier,
      password,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Credenciales no válidas.");
  }

  return {
    user: data.user,
    token: data.token,
    profile: data.profile,
  };
}

export async function fetchAthletesFromApi() {
  const res = await fetch(`${activeApiUrl}/athletes`, { headers: apiHeaders() });
  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || "No se pudieron cargar los atletas.");
  }

  return data.data || [];
}

export async function fetchTrainingHistoryFromApi() {
  const data = await fetchApi("trainings");
  return Array.isArray(data.data) ? data.data : [];
}

export async function fetchPublishedAIPlans(athleteId: string) {
  const data = await fetchApi(`ai/plans?athleteId=${encodeURIComponent(athleteId)}`);
  return Array.isArray(data.data) ? data.data : [];
}

export async function fetchAssignedCorrectiveWork(athleteId: string) {
  const data = await fetchApi(`ai/corrective-work?athleteId=${encodeURIComponent(athleteId)}`);
  return Array.isArray(data.data) ? data.data : [];
}

export async function updateAthleteCorrectiveWork(params: {
  athleteId: string;
  workId: string;
  status?: "IN_PROGRESS" | "COMPLETED";
  feedback?: string;
}) {
  return fetchApi("ai/corrective-work", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export async function createAthleteInApi(athlete: {
  fullName: string;
  category?: string;
  beltRank?: string;
  weightKg?: number;
  heightCm?: number;
  clubId?: string;
  injuryStatus?: string;
}) {
  return fetchApi("athletes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(athlete),
  });
}

export async function createTrainingInApi(training: {
  athleteId: string;
  title: string;
  durationMinutes: number;
  avgHeartRateBpm: number;
  maxHeartRateBpm?: number;
  type?: string;
  rpeScore?: number;
  tacticalNotes?: string;
}) {
  return fetchApi("trainings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(training),
  });
}

export async function createCompetitionInApi(competition: {
  tournamentName: string;
  athleteId: string;
  athleteName: string;
  opponentAthleteId: string;
  opponentName: string;
  category?: string;
  phase?: string;
  corner?: "CHONG" | "HONG";
}) {
  return fetchApi("competitions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(competition),
  });
}

export async function createTournamentInApi(tournament: {
  id: string;
  name: string;
  date?: string;
  venue?: string;
  category?: string;
  tatamiNumber: number;
  registeredAthletes: Array<{ id: string; clubId?: string }>;
}) {
  return fetchApi("tournaments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tournament),
  });
}

export async function generateWorkoutPlanFromApi(athleteId: string, objective: string) {
  const today = new Date();
  const weekStart = new Date(Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - ((today.getDay() + 6) % 7),
  )).toISOString().slice(0, 10);
  return fetchApi("ai/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ athleteId, objective, weekStart }),
  });
}

/**
 * Consulta la IA de combate alojada en Vercel
 */
export async function requestAICoachAdvice(params: {
  athleteId: string;
  round?: number;
  currentBpm?: number;
  trimpScore?: number;
  scoreDiff?: number;
  recoveryDropBpm?: number;
  recoveryDurationSeconds?: number;
  distanceKm?: number;
  avgSpeedMps?: number;
  trainingMode?: string;
}): Promise<{
  success: boolean;
  advice: string;
  isOnline: boolean;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${activeApiUrl}/ai/coach`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...apiHeaders(),
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data?.advice) {
        return {
          success: true,
          advice: json.data.advice,
          isOnline: true,
        };
      }
    }
  } catch {
    console.log("Conexión con Vercel no disponible o modo offline. Usando motor local.");
  }

  const bpm = params.currentBpm || 0;
  return {
    success: true,
    advice:
      `No hay datos suficientes para generar una recomendación fiable.\n` +
      `• FC actual: ${bpm} BPM\n` +
      `• TRIMP acumulado: ${params.trimpScore || 0}`,
    isOnline: false,
  };
}

export async function askCopilot(
  prompt: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<{ success: boolean; answer?: string; error?: string }> {
  try {
    const res = await fetch(`${activeApiUrl}/ai/copilot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...apiHeaders(),
      },
      body: JSON.stringify({ prompt, history }),
    });
    const data = await res.json();
    return data;
  } catch {
    return { success: false, error: "No se pudo conectar con el servicio de IA." };
  }
}

export async function syncTrainingToCloud(session: {
  athleteId: string;
  title: string;
  durationMinutes: number;
  avgHeartRateBpm: number;
  maxHeartRateBpm: number;
  type?: string;
  rpeScore?: number;
  heartRateRecovery1Min?: number;
  tacticalNotes?: string;
  bpmSeries?: Array<{ time: number; bpm: number }>;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(`${activeApiUrl}/trainings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...apiHeaders(),
      },
      body: JSON.stringify(session),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || result?.success === false) {
      const error = result?.error || result?.detail || `HTTP ${res.status}`;
      console.log("Aviso sincronización:", res.status, error);
      return { ok: false, status: res.status, error };
    }
    return { ok: true };
  } catch (e) {
    console.log("No se pudo sincronizar la sesión con la nube:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

/**
 * Transmite telemetría cardíaca en vivo (PPM) desde el móvil del atleta al servidor
 */
export async function streamLiveTelemetryToCloud(telemetry: {
  athleteId: string;
  athleteName?: string;
  currentBpm: number;
  maxHeartRateBpm?: number;
  zone?: string;
  zoneName?: string;
  zoneColor?: string;
  trimpScore?: number;
  sessionDurationSec?: number;
  trainingMode?: string;
  isTrainingRunning?: boolean;
  batteryLevel?: number | null;
  clubId?: string;
  coachId?: string;
  blockTelemetry?: {
    sessionId: string;
    startedAt: string;
    trainingMode: string;
    currentBlock: {
      id: string;
      title: string;
      durationMinutes: number;
      elapsedSeconds: number;
      avgBpm: number;
      maxBpm: number;
      sampleCount: number;
      completed: boolean;
      index: number;
    };
    blocks: Array<{
      id: string;
      title: string;
      durationMinutes: number;
      elapsedSeconds: number;
      avgBpm: number;
      maxBpm: number;
      sampleCount: number;
      completed: boolean;
    }>;
  };
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${activeApiUrl}/telemetry/live`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...apiHeaders(),
      },
      body: JSON.stringify(telemetry),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const result = await res.json().catch(() => null);
    if (!res.ok || result?.success === false) {
      return { ok: false, status: res.status, error: result?.error || result?.detail || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error de red" };
  }
}

/**
 * Obtiene la lista simultánea de PPM de todos los atletas para el entrenador
 */
export async function fetchLiveTelemetryFromApi(): Promise<any[]> {
  try {
    const res = await fetch(`${activeApiUrl}/telemetry/live`, {
      headers: apiHeaders(),
    });
    const json = await res.json();
    if (res.ok && json.success && Array.isArray(json.data)) {
      return json.data;
    }
    return [];
  } catch (e) {
    console.log("Error al consultar telemetría simultánea:", e);
    return [];
  }
}
