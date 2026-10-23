import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeAthlete, isAuthorizationResponse } from "@/lib/ai-access";
import { AICorrectiveWorkSuggestion, AIIntensityZone, CorrectiveWorkStatus } from "@/lib/ai-types";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";

const WORK_STATUSES = new Set<CorrectiveWorkStatus>([
  "PROPOSED",
  "APPROVED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
]);
const INTENSITY_ZONES = new Set<AIIntensityZone>(["Z1", "Z2", "Z3", "Z4", "Z5"]);

function databaseUnavailable() {
  return NextResponse.json(
    { success: false, error: "La gestión de trabajos requiere Supabase y SUPABASE_SERVICE_ROLE_KEY." },
    { status: 503 }
  );
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isSuggestion(value: unknown): value is AICorrectiveWorkSuggestion {
  if (!value || typeof value !== "object") return false;
  const suggestion = value as Record<string, unknown>;
  return (
    typeof suggestion.title === "string" &&
    typeof suggestion.objective === "string" &&
    typeof suggestion.rationale === "string" &&
    Array.isArray(suggestion.exercises) &&
    Array.isArray(suggestion.sourceObservationIndexes) &&
    suggestion.exercises.every((exercise) => {
      if (!exercise || typeof exercise !== "object") return false;
      const item = exercise as Record<string, unknown>;
      return (
        typeof item.name === "string" &&
        typeof item.instructions === "string" &&
        Array.isArray(item.coachingCues) &&
        (item.intensityZone === undefined || INTENSITY_ZONES.has(item.intensityZone as AIIntensityZone))
      );
    })
  );
}

function athleteSafeRecord(record: Record<string, unknown>) {
  const { coach_notes: _coachNotes, ...safeRecord } = record;
  return safeRecord;
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
    .from("ai_corrective_work")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  if (access.session.role === "ATHLETE") {
    query = query.in("status", ["ASSIGNED", "IN_PROGRESS", "COMPLETED"]);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[AI corrective work] List failed:", error);
    return NextResponse.json({ success: false, error: "No se pudieron cargar los trabajos." }, { status: 503 });
  }
  return NextResponse.json({
    success: true,
    data: access.session.role === "ATHLETE"
      ? (data || []).map((record) => athleteSafeRecord(record as Record<string, unknown>))
      : data || [],
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  if (!athleteId) {
    return NextResponse.json({ success: false, error: "Debes indicar athleteId." }, { status: 400 });
  }
  const access = await authorizeAthlete(request, athleteId, ["ADMIN", "COACH"]);
  if (isAuthorizationResponse(access)) return access.response;
  const client = getSupabaseClient();
  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) return databaseUnavailable();

  let suggestion: AICorrectiveWorkSuggestion;
  let videoAnalysisId: string | null = null;
  let sourceEvidence: unknown[] = [];
  if (typeof body.videoAnalysisId === "string" && body.videoAnalysisId.trim()) {
    videoAnalysisId = body.videoAnalysisId.trim();
    const suggestionIndex = body.suggestionIndex;
    if (!Number.isInteger(suggestionIndex) || Number(suggestionIndex) < 0) {
      return NextResponse.json({ success: false, error: "Indica un índice de sugerencia válido." }, { status: 400 });
    }
    const { data: analysis, error } = await client
      .from("ai_video_analyses")
      .select("id,status,result")
      .eq("id", videoAnalysisId)
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (error) {
      console.error("[AI corrective work] Analysis lookup failed:", error);
      return NextResponse.json({ success: false, error: "No se pudo verificar el análisis de vídeo." }, { status: 503 });
    }
    if (!analysis || !["NEEDS_REVIEW", "APPROVED"].includes(analysis.status)) {
      return NextResponse.json({ success: false, error: "No se encontró un análisis revisable para este atleta." }, { status: 404 });
    }
    const result = analysis.result as {
      suggestedCorrectiveWorks?: unknown[];
      observations?: Array<{ evidence?: unknown[] }>;
    };
    const candidate = result?.suggestedCorrectiveWorks?.[Number(suggestionIndex)];
    if (!isSuggestion(candidate)) {
      return NextResponse.json({ success: false, error: "La propuesta de corrección no tiene un formato válido." }, { status: 422 });
    }
    suggestion = candidate;
    sourceEvidence = candidate.sourceObservationIndexes.flatMap((index) => {
      if (!Number.isInteger(index) || index < 0) return [];
      return result.observations?.[index]?.evidence || [];
    });
  } else {
    const exercises = body.exercises;
    const manualSuggestion = {
      title: body.title,
      objective: body.objective,
      rationale: body.rationale || "",
      exercises,
      sourceObservationIndexes: [],
    };
    if (!isSuggestion(manualSuggestion)) {
      return NextResponse.json(
        { success: false, error: "Indica título, objetivo y una lista válida de ejercicios." },
        { status: 400 }
      );
    }
    suggestion = manualSuggestion;
  }

  const trainingPlanId = typeof body.trainingPlanId === "string" ? body.trainingPlanId.trim() : "";
  if (trainingPlanId) {
    const { data: plan, error } = await client
      .from("ai_training_plans")
      .select("id,status")
      .eq("id", trainingPlanId)
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (error) {
      console.error("[AI corrective work] Plan lookup failed:", error);
      return NextResponse.json({ success: false, error: "No se pudo verificar el plan semanal." }, { status: 503 });
    }
    if (!plan || plan.status === "ARCHIVED") {
      return NextResponse.json({ success: false, error: "El plan semanal no existe o está archivado." }, { status: 404 });
    }
  }
  const plannedSessionDate = body.plannedSessionDate;
  const dueDate = body.dueDate;
  if (
    (plannedSessionDate !== undefined && !isDate(plannedSessionDate)) ||
    (dueDate !== undefined && !isDate(dueDate))
  ) {
    return NextResponse.json({ success: false, error: "Las fechas deben usar el formato AAAA-MM-DD." }, { status: 400 });
  }
  if (trainingPlanId && !plannedSessionDate) {
    return NextResponse.json({ success: false, error: "Indica plannedSessionDate para asociar el trabajo al plan." }, { status: 400 });
  }

  const { data, error } = await client
    .from("ai_corrective_work")
    .insert({
      id: `corr-${randomUUID()}`.slice(0, 50),
      athlete_id: athleteId,
      video_analysis_id: videoAnalysisId,
      training_plan_id: trainingPlanId || null,
      planned_session_date: plannedSessionDate || null,
      created_by: access.session.id,
      status: "PROPOSED",
      optional: body.optional === true,
      title: suggestion.title.slice(0, 255),
      objective: suggestion.objective,
      rationale: suggestion.rationale,
      exercises: suggestion.exercises,
      source_evidence: sourceEvidence,
      due_date: dueDate || null,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[AI corrective work] Create failed:", error);
    return NextResponse.json({ success: false, error: "No se pudo guardar el trabajo correctivo." }, { status: 503 });
  }
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "El cuerpo debe ser JSON válido." }, { status: 400 });
  }
  const athleteId = typeof body.athleteId === "string" ? body.athleteId.trim() : "";
  const workId = typeof body.workId === "string" ? body.workId.trim() : "";
  if (!athleteId || !workId) {
    return NextResponse.json({ success: false, error: "Indica athleteId y workId." }, { status: 400 });
  }
  const access = await authorizeAthlete(
    request,
    athleteId,
    ["ADMIN", "COACH", "ATHLETE"]
  );
  if (isAuthorizationResponse(access)) return access.response;
  const client = getSupabaseClient();
  if (!client || !process.env.SUPABASE_SERVICE_ROLE_KEY) return databaseUnavailable();

  const { data: current, error: lookupError } = await client
    .from("ai_corrective_work")
    .select("*")
    .eq("id", workId)
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (lookupError) {
    console.error("[AI corrective work] Lookup failed:", lookupError);
    return NextResponse.json({ success: false, error: "No se pudo verificar el trabajo." }, { status: 503 });
  }
  if (!current) return NextResponse.json({ success: false, error: "No se encontró el trabajo." }, { status: 404 });

  const isAthlete = access.session.role === "ATHLETE";
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (isAthlete) {
    if (!["ASSIGNED", "IN_PROGRESS"].includes(current.status)) {
      return NextResponse.json({ success: false, error: "El trabajo aún no está asignado o ya se ha cerrado." }, { status: 409 });
    }
    if (body.status !== undefined) {
      if (!["IN_PROGRESS", "COMPLETED"].includes(String(body.status))) {
        return NextResponse.json({ success: false, error: "El atleta solo puede iniciar o completar el trabajo." }, { status: 403 });
      }
      if (body.status === "COMPLETED" && !["ASSIGNED", "IN_PROGRESS"].includes(current.status)) {
        return NextResponse.json({ success: false, error: "No se puede completar este trabajo en su estado actual." }, { status: 409 });
      }
      updates.status = body.status;
      if (body.status === "COMPLETED") updates.completed_at = new Date().toISOString();
    }
    if (body.feedback !== undefined) {
      if (typeof body.feedback !== "string" || body.feedback.length > 2000) {
        return NextResponse.json({ success: false, error: "El feedback no puede superar 2000 caracteres." }, { status: 400 });
      }
      updates.athlete_feedback = body.feedback;
    }
  } else {
    if (body.status !== undefined) {
      const nextStatus = body.status as CorrectiveWorkStatus;
      if (!WORK_STATUSES.has(nextStatus)) {
        return NextResponse.json({ success: false, error: "Estado de trabajo no válido." }, { status: 400 });
      }
      const transitions: Record<CorrectiveWorkStatus, CorrectiveWorkStatus[]> = {
        PROPOSED: ["APPROVED", "REJECTED"],
        APPROVED: ["ASSIGNED", "REJECTED"],
        ASSIGNED: ["REJECTED"],
        IN_PROGRESS: ["REJECTED"],
        COMPLETED: [],
        REJECTED: [],
      };
      if (!transitions[current.status as CorrectiveWorkStatus]?.includes(nextStatus)) {
        return NextResponse.json({ success: false, error: `Transición no permitida: ${current.status} → ${nextStatus}.` }, { status: 409 });
      }
      updates.status = nextStatus;
    }
    if (body.coachNotes !== undefined) {
      if (typeof body.coachNotes !== "string" || body.coachNotes.length > 4000) {
        return NextResponse.json({ success: false, error: "Las notas del entrenador no pueden superar 4000 caracteres." }, { status: 400 });
      }
      updates.coach_notes = body.coachNotes;
    }
    if (body.optional !== undefined) {
      if (typeof body.optional !== "boolean") {
        return NextResponse.json({ success: false, error: "optional debe ser booleano." }, { status: 400 });
      }
      updates.optional = body.optional;
    }

    if (updates.status === "ASSIGNED") {
      const trainingPlanId = typeof body.trainingPlanId === "string" ? body.trainingPlanId.trim() : "";
      const plannedSessionDate = body.plannedSessionDate;
      const dueDate = body.dueDate;
      if (
        (plannedSessionDate !== undefined && !isDate(plannedSessionDate)) ||
        (dueDate !== undefined && !isDate(dueDate))
      ) {
        return NextResponse.json({ success: false, error: "Las fechas deben usar el formato AAAA-MM-DD." }, { status: 400 });
      }
      if (trainingPlanId && !isDate(plannedSessionDate)) {
        return NextResponse.json({ success: false, error: "Indica plannedSessionDate para asociarlo a un plan." }, { status: 400 });
      }

      if (trainingPlanId) {
        const { data: plan, error: planError } = await client
          .from("ai_training_plans")
          .select("id,plan,status")
          .eq("id", trainingPlanId)
          .eq("athlete_id", athleteId)
          .maybeSingle();
        if (planError) {
          console.error("[AI corrective work] Plan lookup failed:", planError);
          return NextResponse.json({ success: false, error: "No se pudo verificar el plan semanal." }, { status: 503 });
        }
        if (!plan || plan.status === "ARCHIVED") {
          return NextResponse.json({ success: false, error: "El plan semanal no existe o está archivado." }, { status: 404 });
        }
        const planContent = plan.plan as {
          sessions?: Array<Record<string, unknown>>;
        };
        const targetSession = planContent.sessions?.find((session) => session.date === plannedSessionDate);
        if (!targetSession || !Array.isArray(targetSession.exercises)) {
          return NextResponse.json({ success: false, error: "La fecha elegida no corresponde a una sesión del plan." }, { status: 400 });
        }
        const exercises = current.exercises as Array<Record<string, unknown>>;
        const linkedExercises = exercises.map((exercise) => ({
          name: typeof exercise.name === "string" ? exercise.name : current.title,
          objective: current.objective,
          instructions: typeof exercise.instructions === "string" ? exercise.instructions : current.rationale,
          ...(typeof exercise.sets === "number" ? { sets: exercise.sets } : {}),
          ...(typeof exercise.repetitions === "number" ? { repetitions: exercise.repetitions } : {}),
          ...(typeof exercise.durationSeconds === "number" ? { durationMinutes: Math.ceil(exercise.durationSeconds / 60) } : {}),
          ...(typeof exercise.restSeconds === "number" ? { restSeconds: exercise.restSeconds } : {}),
          intensityZone: INTENSITY_ZONES.has(exercise.intensityZone as AIIntensityZone)
            ? exercise.intensityZone
            : "Z2",
          coachingCues: Array.isArray(exercise.coachingCues) ? exercise.coachingCues : [],
          correctiveWorkIds: [workId],
        }));
        const existingExercises = targetSession.exercises as Array<Record<string, unknown>>;
        const updatedSessions = planContent.sessions?.map((session) =>
          session.date === plannedSessionDate
            ? {
                ...session,
                exercises: [
                  ...existingExercises.filter((exercise) =>
                    !Array.isArray(exercise.correctiveWorkIds) ||
                    !exercise.correctiveWorkIds.includes(workId)
                  ),
                  ...linkedExercises,
                ],
              }
            : session
        );
        const { error: planUpdateError } = await client
          .from("ai_training_plans")
          .update({ plan: { ...planContent, sessions: updatedSessions }, updated_at: new Date().toISOString() })
          .eq("id", trainingPlanId)
          .eq("athlete_id", athleteId);
        if (planUpdateError) {
          console.error("[AI corrective work] Plan link failed:", planUpdateError);
          return NextResponse.json({ success: false, error: "No se pudo añadir la corrección a la sesión." }, { status: 503 });
        }
        updates.training_plan_id = trainingPlanId;
        updates.planned_session_date = plannedSessionDate;
      }
      updates.due_date = dueDate || plannedSessionDate || current.due_date;
    }
  }

  const { data, error } = await client
    .from("ai_corrective_work")
    .update(updates)
    .eq("id", workId)
    .eq("athlete_id", athleteId)
    .select("*")
    .single();
  if (error) {
    console.error("[AI corrective work] Update failed:", error);
    return NextResponse.json({ success: false, error: "No se pudo actualizar el trabajo." }, { status: 503 });
  }
  return NextResponse.json({
    success: true,
    data: isAthlete ? athleteSafeRecord(data as Record<string, unknown>) : data,
  });
}
