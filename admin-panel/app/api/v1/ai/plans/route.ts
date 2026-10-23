import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeAthlete, isAuthorizationResponse } from "@/lib/ai-access";
import { AIPlanStatus, AIWeeklyPlan } from "@/lib/ai-types";
import { AIProviderError, parseAIJson, requestAICompletion } from "@/lib/ai-provider";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

const PLAN_PROMPT_VERSION = "weekly-plan-v1";
const INTENSITY_ZONES = new Set(["Z1", "Z2", "Z3", "Z4", "Z5"]);
const PLAN_STATUSES = new Set<AIPlanStatus>([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "ARCHIVED",
]);

function databaseUnavailable() {
  return NextResponse.json(
    { success: false, error: "La persistencia de planes requiere Supabase y SUPABASE_SERVICE_ROLE_KEY." },
    { status: 503 }
  );
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function isWeeklyPlan(value: unknown, weekStart: string): value is AIWeeklyPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  if (
    plan.schemaVersion !== 1 ||
    plan.weekStart !== weekStart ||
    plan.weekEnd !== addDays(weekStart, 6) ||
    typeof plan.objective !== "string" ||
    typeof plan.periodizationPhase !== "string" ||
    !plan.athleteContext ||
    typeof plan.athleteContext !== "object" ||
    !Array.isArray((plan.athleteContext as Record<string, unknown>).limitations) ||
    !Array.isArray(plan.sessions) ||
    plan.sessions.length < 1 ||
    plan.sessions.length > 14 ||
    !Array.isArray(plan.coachNotes)
  ) return false;

  return plan.sessions.every((item) => {
    if (!item || typeof item !== "object") return false;
    const session = item as Record<string, unknown>;
    return (
      isDate(session.date) &&
      session.date >= weekStart &&
      session.date <= addDays(weekStart, 6) &&
      typeof session.title === "string" &&
      typeof session.objective === "string" &&
      typeof session.type === "string" &&
      typeof session.durationMinutes === "number" &&
      session.durationMinutes > 0 &&
      session.durationMinutes <= 240 &&
      typeof session.intensity === "string" &&
      INTENSITY_ZONES.has(session.intensity) &&
      Array.isArray(session.exercises) &&
      Array.isArray(session.recoveryNotes) &&
      typeof session.optional === "boolean" &&
      session.exercises.every((exercise) => {
        if (!exercise || typeof exercise !== "object") return false;
        const entry = exercise as Record<string, unknown>;
        return (
          typeof entry.name === "string" &&
          typeof entry.objective === "string" &&
          typeof entry.instructions === "string" &&
          typeof entry.intensityZone === "string" &&
          INTENSITY_ZONES.has(entry.intensityZone) &&
          Array.isArray(entry.coachingCues) &&
          Array.isArray(entry.correctiveWorkIds) &&
          entry.correctiveWorkIds.every((id) => typeof id === "string")
        );
      })
    );
  });
}

function allowedTransition(current: AIPlanStatus, next: AIPlanStatus): boolean {
  const transitions: Record<AIPlanStatus, AIPlanStatus[]> = {
    DRAFT: ["IN_REVIEW", "ARCHIVED"],
    IN_REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
    APPROVED: ["PUBLISHED", "ARCHIVED"],
    PUBLISHED: ["ARCHIVED"],
    ARCHIVED: [],
  };
  return transitions[current].includes(next);
}

export async function GET(request: Request) {
  const athleteId = new URL(request.url).searchParams.get("athleteId")?.trim();
  if (!athleteId) {
    return NextResponse.json({ success: false, error: "Debes indicar athleteId." }, { status: 400 });
  }
  const access = await authorizeAthlete(request, athleteId, ["ADMIN", "COACH", "ATHLETE"]);
  if (isAuthorizationResponse(access)) return access.response;

  const client = getSupabaseClient();
  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) return databaseUnavailable();
  let query = client
    .from("ai_training_plans")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("week_start", { ascending: false });
  if (access.session.role === "ATHLETE") query = query.eq("status", "PUBLISHED");
  const { data, error } = await query;
  if (error) {
    console.error("[AI training plans] List failed:", error);
    return NextResponse.json({ success: false, error: "No se pudieron cargar los planes." }, { status: 503 });
  }
  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const weekStart = body.weekStart;
  const objective = typeof body.objective === "string" ? body.objective.trim() : "";
  if (!athleteId || !isDate(weekStart) || !objective || objective.length > 1000) {
    return NextResponse.json(
      { success: false, error: "Indica atleta, fecha de inicio válida y objetivo (máximo 1000 caracteres)." },
      { status: 400 }
    );
  }
  const access = await authorizeAthlete(request, athleteId, ["ADMIN", "COACH"]);
  if (isAuthorizationResponse(access)) return access.response;

  const client = getSupabaseClient();
  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) return databaseUnavailable();
  const [{ data: sessions, error: sessionsError }, { data: matchesA, error: matchesAError }, { data: matchesB, error: matchesBError }] =
    await Promise.all([
      client
        .from("training_sessions")
        .select("date,session_type,duration_minutes,avg_bpm,max_bpm,trimp_score,hrr_1_min,rpe_score,zone1_minutes,zone2_minutes,zone3_minutes,zone4_minutes,zone5_minutes,tactical_notes,status")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(20),
      client
        .from("competition_matches")
        .select("date,competition_name,category,winner,chong_score,hong_score,chong_gamjeom,hong_gamjeom,stamina_drop_round3")
        .eq("chong_athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(10),
      client
        .from("competition_matches")
        .select("date,competition_name,category,winner,chong_score,hong_score,chong_gamjeom,hong_gamjeom,stamina_drop_round3")
        .eq("hong_athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(10),
    ]);
  if (sessionsError || matchesAError || matchesBError) {
    console.error("[AI training plans] Context query failed:", sessionsError || matchesAError || matchesBError);
    return NextResponse.json({ success: false, error: "No se pudo recuperar el historial deportivo." }, { status: 503 });
  }

  const athlete = access.athlete;
  const context = {
    athlete: {
      name: athlete.name,
      category: athlete.wt_category,
      isCompetitor: athlete.is_competitor,
      weightKg: athlete.weight,
      heightCm: athlete.height,
      readinessScore: athlete.readiness_score,
      injuryStatus: athlete.injury_status,
      preferredTechnique: athlete.favourite_kick,
    },
    recentTrainingSessions: sessions || [],
    recentCompetitionMatches: [...(matchesA || []), ...(matchesB || [])]
      .sort((left, right) => String(right.date).localeCompare(String(left.date)))
      .slice(0, 10),
    requestedWeek: { weekStart, weekEnd: addDays(weekStart, 6) },
    objective,
    periodizationPhase: typeof body.periodizationPhase === "string"
      ? body.periodizationPhase.slice(0, 50)
      : "GENERAL",
  };

  try {
    const completion = await requestAICompletion(
      "Eres preparador de Taekwondo WT. Diseña un plan semanal individualizado y seguro. Usa solo el contexto aportado. Respeta lesiones, disponibilidad y carga reciente; no diagnostiques ni sustituyas al entrenador. Devuelve exclusivamente JSON válido.",
      `Genera un objeto con schemaVersion=1, weekStart, weekEnd, objective, periodizationPhase, athleteContext {readinessScore?, injuryStatus?, competitionDate?, limitations:[]}, sessions y coachNotes. Cada sesión incluye date, title, objective, type, durationMinutes (máximo 240), intensity (Z1-Z5), exercises, recoveryNotes y optional. Cada ejercicio incluye name, objective, instructions, sets?, repetitions?, durationMinutes?, restSeconds?, intensityZone, coachingCues y correctiveWorkIds (array vacío). Genera sesiones solo entre ${weekStart} y ${addDays(weekStart, 6)}. Ajusta el volumen al contexto y anota las incertidumbres en coachNotes. Contexto: ${JSON.stringify(context)}`,
      [],
      45000
    );
    const plan = parseAIJson<unknown>(completion.text);
    if (!isWeeklyPlan(plan, weekStart)) {
      throw new AIProviderError("El modelo devolvió un plan semanal con estructura o fechas no válidas.", 502);
    }
    const planId = `plan-${randomUUID()}`.slice(0, 50);
    const coachId = typeof athlete.coach_id === "string" ? athlete.coach_id : null;
    const { data, error } = await client
      .from("ai_training_plans")
      .insert({
        id: planId,
        athlete_id: athleteId,
        coach_id: coachId,
        created_by: access.session.id,
        week_start: weekStart,
        status: "DRAFT",
        objective,
        periodization_phase: context.periodizationPhase,
        context_snapshot: context,
        plan,
        provider: completion.provider,
        model: completion.model,
        prompt_version: PLAN_PROMPT_VERSION,
      })
      .select("*")
      .single();
    if (error) {
      console.error("[AI training plans] Persist failed:", error);
      return NextResponse.json({ success: false, error: "No se pudo guardar el plan generado." }, { status: 503 });
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error("[AI training plans] Generation failed:", error);
    const status = error instanceof AIProviderError ? error.status : 502;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "No se pudo generar el plan." },
      { status }
    );
  }
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const nextStatus = body.status;
  if (!athleteId || !planId || typeof nextStatus !== "string" || !PLAN_STATUSES.has(nextStatus as AIPlanStatus)) {
    return NextResponse.json({ success: false, error: "Indica athleteId, planId y un estado válido." }, { status: 400 });
  }
  const access = await authorizeAthlete(request, athleteId, ["ADMIN", "COACH"]);
  if (isAuthorizationResponse(access)) return access.response;
  const client = getSupabaseClient();
  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) return databaseUnavailable();

  const { data: current, error: currentError } = await client
    .from("ai_training_plans")
    .select("id,status")
    .eq("id", planId)
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (currentError) {
    console.error("[AI training plans] Status lookup failed:", currentError);
    return NextResponse.json({ success: false, error: "No se pudo verificar el plan." }, { status: 503 });
  }
  if (!current) return NextResponse.json({ success: false, error: "No se encontró el plan." }, { status: 404 });
  if (!allowedTransition(current.status as AIPlanStatus, nextStatus as AIPlanStatus)) {
    return NextResponse.json({ success: false, error: `Transición no permitida: ${current.status} → ${nextStatus}.` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, string> = { status: nextStatus, updated_at: now };
  if (nextStatus === "APPROVED") updates.approved_at = now;
  if (nextStatus === "PUBLISHED") updates.published_at = now;
  const { data, error } = await client
    .from("ai_training_plans")
    .update(updates)
    .eq("id", planId)
    .eq("athlete_id", athleteId)
    .select("*")
    .single();
  if (error) {
    console.error("[AI training plans] Status update failed:", error);
    return NextResponse.json({ success: false, error: "No se pudo actualizar el estado del plan." }, { status: 503 });
  }
  return NextResponse.json({ success: true, data });
}
