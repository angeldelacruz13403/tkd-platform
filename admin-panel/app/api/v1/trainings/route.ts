import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TrainingBlock, TrainingBlockMetric, TrainingSession } from "@/lib/types";
import { TaekwondoAIEngine } from "@/lib/ai-engine";
import { getSession, forbidden } from "@/lib/api-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";

function readLegacyTrainingMetadata(value: unknown): Record<string, any> | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed?.__tkdTrainingMetadata === true ? parsed : null;
  } catch {
    return null;
  }
}

function mapTrainingRow(row: any, athleteName = "Atleta"): TrainingSession {
  const legacy = readLegacyTrainingMetadata(row.tactical_notes);
  let legacyBpmSeries: any[] | undefined;
  if (typeof legacy?.bpm_series === "string") {
    try { legacyBpmSeries = JSON.parse(legacy.bpm_series); } catch {}
  }
  return {
    id: row.id,
    title: row.title || legacy?.title || "Sesión de entrenamiento",
    athleteId: row.athlete_id || "",
    athleteName,
    coachId: row.coach_id || "",
    date: row.date,
    durationMinutes: Number(row.duration_minutes) || 0,
    type: row.session_type === "SPARRING_DAEDO" ? "SPARRING_TACTICAL"
      : row.session_type === "TECHNICAL_POOMSAE" ? "POOMSAE_TECHNICAL"
      : row.session_type === "RECOVERY_AEROBIC" ? "HIGH_INTENSITY_INTERVALS"
      : row.session_type || "SPARRING_TACTICAL",
    rpeScore: Number(row.rpe_score ?? legacy?.rpe_score) || 0,
    avgHeartRateBpm: Number(row.avg_bpm) || 0,
    maxHeartRateBpm: Number(row.max_bpm) || 0,
    heartRateRecovery1Min: Number(row.hrr_1_min ?? legacy?.hrr_1_min) || 0,
    trimpScore: Number(row.trimp_score) || 0,
    heartRateZones: {
      zone1RecoveryMin: Number(row.zone1_minutes) || 0,
      zone2AerobicMin: Number(row.zone2_minutes) || 0,
      zone3TempoMin: Number(row.zone3_minutes) || 0,
      zone4ThresholdMin: Number(row.zone4_minutes) || 0,
      zone5AnaerobicMin: Number(row.zone5_minutes) || 0,
    },
    aiFeedback: legacy ? legacy.tactical_notes || "" : row.tactical_notes || "",
    bpmSeries: Array.isArray(row.bpm_series) ? row.bpm_series : legacyBpmSeries,
    blocks: Array.isArray(legacy?.blocks)
      ? legacy.blocks
      : row.status === "SCHEDULED"
        ? [{ id: `block-${row.id}`, title: row.title || "Entrenamiento completo", durationMinutes: Number(row.duration_minutes) || 1 }]
        : undefined,
    blockMetrics: Array.isArray(legacy?.blockMetrics) ? legacy.blockMetrics : undefined,
    status: row.status || legacy?.status || "COMPLETED",
  };
}

function normalizeBlocks(value: unknown): TrainingBlock[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const blocks: TrainingBlock[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const title = typeof item?.title === "string" ? item.title.trim().slice(0, 120) : "";
    const durationMinutes = Number(item?.durationMinutes);
    if (!title || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 240) return null;
    blocks.push({
      id: typeof item?.id === "string" && item.id.trim() ? item.id.trim().slice(0, 80) : `block-${index + 1}`,
      title,
      durationMinutes,
    });
  }
  return blocks;
}

function canManageTraining(
  session: NonNullable<ReturnType<typeof getSession>>,
  athlete: any,
  coach?: { id?: string; clubId?: string }
) {
  if (session.role === "ADMIN") return true;
  if (session.role === "ATHLETE") return (athlete.user_id || athlete.userId) === session.id;
  if (session.role === "CLUB") return !!session.clubId && (athlete.club_id || athlete.clubId) === session.clubId;
  if (session.role === "COACH") {
    const coachClubId = coach?.clubId || session.clubId;
    return (!!coach?.id && (athlete.coach_id || athlete.coachId) === coach.id)
      || (!!coachClubId && (athlete.club_id || athlete.clubId) === coachClubId);
  }
  return false;
}

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "telemetry");
  if (isAuthorizationResponse(access)) return access.response;
  const { session } = access;
  const client = getSupabaseClient();
  if (client) {
    let query = client.from("training_sessions").select("*").not("id", "like", "live-%").order("date", { ascending: false }).limit(300);
    if (session.role === "ATHLETE") {
      const { data: athlete } = await client.from("athletes").select("id").eq("user_id", session.id).maybeSingle();
      query = query.eq("athlete_id", athlete?.id || "__none__");
    } else if (session.role === "COACH") {
      const { data: coach } = await client.from("coaches").select("id,club_id").eq("user_id", session.id).maybeSingle();
      const coachClubId = coach?.club_id || session.clubId;
      let athleteQuery = client.from("athletes").select("id");
      if (coach?.id && coachClubId) athleteQuery = athleteQuery.or(`coach_id.eq.${coach.id},club_id.eq.${coachClubId}`);
      else if (coach?.id) athleteQuery = athleteQuery.eq("coach_id", coach.id);
      else athleteQuery = athleteQuery.eq("club_id", coachClubId || "__none__");
      const { data: roster } = await athleteQuery;
      query = query.in("athlete_id", (roster || []).map((athlete: any) => athlete.id));
    } else if (session.role === "CLUB") {
      const { data: athletes } = await client.from("athletes").select("id").eq("club_id", session.clubId || "__none__");
      query = query.in("athlete_id", (athletes || []).map((athlete: any) => athlete.id));
    }
    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    const athleteIds = Array.from(new Set((data || []).map((row: any) => row.athlete_id).filter(Boolean)));
    const { data: athleteRows } = athleteIds.length ? await client.from("athletes").select("id,name").in("id", athleteIds) : { data: [] as any[] };
    const names = new Map((athleteRows || []).map((athlete: any) => [athlete.id, athlete.name]));
    const trainings = (data || []).map((row: any) => mapTrainingRow(row, names.get(row.athlete_id) || "Atleta"));
    return NextResponse.json({ success: true, total: trainings.length, data: trainings });
  }
  const coach = session.role === "COACH" ? db.coaches.find((item) => item.userId === session.id) : undefined;
  const data = session.role === "ADMIN" ? db.trainings : session.role === "ATHLETE"
    ? db.trainings.filter((item) => item.athleteId && db.athletes.some((athlete) => athlete.id === item.athleteId && athlete.userId === session.id))
    : db.trainings.filter((item) => item.coachId === coach?.id || db.athletes.some((athlete) => athlete.id === item.athleteId && (athlete.coachId === coach?.id || athlete.clubId === (coach?.clubId || session.clubId))));
  return NextResponse.json({ success: true, total: data.length, data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const access = await authorizeFeature(request, body.status === "SCHEDULED" ? "class-training" : "telemetry");
    if (isAuthorizationResponse(access)) return access.response;
    const { session } = access;
    const requestedId = String(body.athleteId || "").trim();
    if (!requestedId || requestedId === "unassigned") {
      return NextResponse.json({ success: false, error: "Vincula la sesión con un atleta registrado." }, { status: 400 });
    }

    const durationInput = Number(body.durationMinutes);
    const isScheduled = body.status === "SCHEDULED";
    const avgBpm = Number(body.avgHeartRateBpm) || Number(body.currentBpm) || 0;
    if (!Number.isFinite(durationInput) || durationInput <= 0 || (!isScheduled && avgBpm <= 0)) {
      return NextResponse.json({ success: false, error: "La sesión necesita duración y muestras reales de PPM." }, { status: 400 });
    }
    const blocks = isScheduled ? normalizeBlocks(body.blocks) : undefined;
    if (isScheduled && !blocks) {
      return NextResponse.json({ success: false, error: "Configura entre 1 y 20 bloques, cada uno con título y duración válida." }, { status: 400 });
    }

    const client = getSupabaseClient();
    let athlete: any;
    let coachId = "";

    if (client) {
      if (session.role === "ATHLETE") {
        const { data } = await client.from("athletes").select("*").eq("user_id", session.id).maybeSingle();
        athlete = data?.id === requestedId ? data : null;
      } else {
        const { data } = await client.from("athletes").select("*").eq("id", requestedId).maybeSingle();
        athlete = data;
      }
      if (session.role === "COACH") {
        const { data: coach } = await client.from("coaches").select("id,club_id").eq("user_id", session.id).maybeSingle();
        coachId = coach?.id || "";
        const allowedClubId = coach?.club_id || session.clubId;
        if (athlete && athlete.coach_id !== coachId && (!allowedClubId || athlete.club_id !== allowedClubId)) athlete = null;
      } else if (session.role === "CLUB" && athlete?.club_id !== session.clubId) {
        athlete = null;
      }
    } else {
      if (session.role === "ATHLETE") {
        athlete = db.athletes.find((item) => item.userId === session.id && item.id === requestedId);
      } else {
        athlete = db.athletes.find((item) => item.id === requestedId);
      }
      if (session.role === "COACH") {
        const coach = db.coaches.find((item) => item.userId === session.id);
        coachId = coach?.id || "";
        if (athlete && athlete.coachId !== coachId && (!coach?.clubId || athlete.clubId !== coach.clubId)) athlete = undefined;
      } else if (session.role === "CLUB" && athlete?.clubId !== session.clubId) {
        athlete = undefined;
      }
      coachId = athlete?.coachId || "";
    }

    if (!athlete) {
      return NextResponse.json({ success: false, error: "Atleta no encontrado o no tienes permiso para registrar su sesión." }, { status: 404 });
    }

    const duration = Math.max(1, Math.round(durationInput));
    const maxBpm = Math.max(avgBpm, Number(body.maxHeartRateBpm) || avgBpm);
    const restBpm = Number(athlete.restingHeartRateBpm || athlete.rest_bpm || 0);

    const trimpScore = isScheduled ? 0 : TaekwondoAIEngine.calculateTrimp(duration, avgBpm, restBpm, maxBpm);
    const hrrDrop = Number(body.heartRateRecovery1Min) || 0;
    const hrrEval = TaekwondoAIEngine.evaluateHrr(hrrDrop);

    const status = isScheduled ? "SCHEDULED" : body.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETED";

    const newSession: TrainingSession = {
      id: body.id || `trn-${Date.now()}`,
      title: body.title || "Sesión de Combate & Sparring",
      athleteId: athlete.id,
      athleteName: athlete.fullName || athlete.name,
      coachId: coachId || athlete.coach_id || athlete.coachId || "",
      date: body.date || new Date().toISOString(),
      durationMinutes: duration,
      type: body.type || "SPARRING_TACTICAL",
      rpeScore: Number(body.rpeScore) || 0,
      avgHeartRateBpm: avgBpm,
      maxHeartRateBpm: maxBpm,
      heartRateRecovery1Min: hrrDrop,
      trimpScore,
      heartRateZones: body.heartRateZones || { zone1RecoveryMin: 0, zone2AerobicMin: 0, zone3TempoMin: 0, zone4ThresholdMin: 0, zone5AnaerobicMin: 0 },
      aiFeedback: isScheduled ? String(body.tacticalNotes || "").slice(0, 4000) : body.tacticalNotes || `Evaluación IA: Carga TRIMP ${trimpScore} calculada. Índice de recuperación cardíaca (HRR): ${hrrEval.rating} (${hrrDrop} BPM en 60s).`,
      bpmSeries: Array.isArray(body.bpmSeries) ? body.bpmSeries : undefined,
      blocks: blocks || undefined,
      status,
    };

    await db.persistTraining(newSession);
    db.trainings.unshift(newSession);
    if (client && !isScheduled) {
      const { error } = await client.from("training_sessions").delete().eq("id", `live-${athlete.id}`);
      if (error) console.warn("No se pudo limpiar la fila live al finalizar sesión:", error.message);
    }

    return NextResponse.json({
      success: true,
      data: newSession,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error al registrar entrenamiento" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    const access = await authorizeFeature(request, body.status === "SCHEDULED" ? "class-training" : "telemetry");
    if (isAuthorizationResponse(access)) return access.response;
    const { session } = access;
    const client = getSupabaseClient();
    const index = db.trainings.findIndex((training) => training.id === id);
    let existing = index >= 0 ? db.trainings[index] : undefined;
    if (client) {
      const { data: row, error } = await client.from("training_sessions").select("*").eq("id", id).maybeSingle();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 503 });
      if (row) {
        let athleteName = "Atleta";
        if (row.athlete_id) {
          const { data: athlete } = await client.from("athletes").select("name").eq("id", row.athlete_id).maybeSingle();
          athleteName = athlete?.name || athleteName;
        }
        existing = mapTrainingRow(row, athleteName);
      }
    }
    if (!existing) {
      return NextResponse.json({ success: false, error: "Entrenamiento no encontrado" }, { status: 404 });
    }

    let authorizedAthlete: any;
    let coach: { id?: string; clubId?: string } | undefined;
    if (client) {
      const { data: athlete, error: athleteError } = await client
        .from("athletes")
        .select("id,user_id,club_id,coach_id")
        .eq("id", existing.athleteId)
        .maybeSingle();
      if (athleteError) return NextResponse.json({ success: false, error: athleteError.message }, { status: 503 });
      authorizedAthlete = athlete;
      if (session.role === "COACH") {
        const { data: coachRow, error: coachError } = await client.from("coaches").select("id,club_id").eq("user_id", session.id).maybeSingle();
        if (coachError) return NextResponse.json({ success: false, error: coachError.message }, { status: 503 });
        coach = { id: coachRow?.id, clubId: coachRow?.club_id || session.clubId };
      }
    } else {
      authorizedAthlete = db.athletes.find((athlete) => athlete.id === existing.athleteId);
      const coachRecord = session.role === "COACH" ? db.coaches.find((item) => item.userId === session.id) : undefined;
      coach = { id: coachRecord?.id, clubId: coachRecord?.clubId || session.clubId };
    }
    if (!authorizedAthlete || !canManageTraining(session, authorizedAthlete, coach)) return forbidden();

    if (updates.blocks !== undefined) {
      const blocks = normalizeBlocks(updates.blocks);
      if (!blocks) {
        return NextResponse.json({ success: false, error: "Configura entre 1 y 20 bloques, cada uno con título y duración válida." }, { status: 400 });
      }
      updates.blocks = blocks;
      updates.durationMinutes = blocks.reduce((total, block) => total + block.durationMinutes, 0);
    }

    const duration = updates.durationMinutes !== undefined ? Number(updates.durationMinutes) : existing.durationMinutes;
    const avgBpm = updates.avgHeartRateBpm !== undefined ? Number(updates.avgHeartRateBpm) : existing.avgHeartRateBpm;
    const maxBpm = updates.maxHeartRateBpm !== undefined ? Number(updates.maxHeartRateBpm) : existing.maxHeartRateBpm;
    const athlete = db.athletes.find((a) => a.id === (updates.athleteId || existing.athleteId));
    const restBpm = athlete?.restingHeartRateBpm || 50;
    const hrrDrop = updates.heartRateRecovery1Min !== undefined ? Number(updates.heartRateRecovery1Min) : existing.heartRateRecovery1Min;

    const nextStatus = updates.status || existing.status;
    const stillScheduled = nextStatus === "SCHEDULED";
    const trimpScore = stillScheduled || nextStatus === "IN_PROGRESS" || avgBpm <= 0 ? 0 : TaekwondoAIEngine.calculateTrimp(duration, avgBpm, restBpm, maxBpm);
    const hrrEval = TaekwondoAIEngine.evaluateHrr(hrrDrop);

    const updatedTraining: TrainingSession = {
      ...existing,
      ...updates,
      durationMinutes: duration,
      avgHeartRateBpm: avgBpm,
      maxHeartRateBpm: maxBpm,
      heartRateRecovery1Min: hrrDrop,
      trimpScore,
      aiFeedback: updates.aiFeedback || (stillScheduled || avgBpm <= 0 ? existing.aiFeedback : `Evaluación IA: Carga TRIMP ${trimpScore} calculada. Índice HRR: ${hrrEval.rating} (${hrrDrop} BPM en 60s).`),
      status: nextStatus,
    };

    if (client) {
      try {
        await db.persistTraining(updatedTraining);
      } catch (error: any) {
        return NextResponse.json({ success: false, error: `No se pudo guardar el cambio: ${error?.message || "error de persistencia"}` }, { status: 503 });
      }
      if (nextStatus === "IN_PROGRESS") {
        const blocks = updatedTraining.blocks?.length
          ? updatedTraining.blocks
          : [{ id: `block-${updatedTraining.id}`, title: updatedTraining.title, durationMinutes: Math.max(1, updatedTraining.durationMinutes || 1) }];
        const blockMetrics: TrainingBlockMetric[] = blocks.map((block) => ({
          ...block,
          elapsedSeconds: 0,
          avgBpm: 0,
          maxBpm: 0,
          sampleCount: 0,
          completed: false,
        }));
        const currentBlock = { ...blockMetrics[0], index: 0, totalBlocks: blockMetrics.length };
        const { error } = await client.from("active_training_sessions").upsert({
          athlete_id: updatedTraining.athleteId,
          session_id: id,
          coach_id: authorizedAthlete.coach_id || null,
          started_at: new Date().toISOString(),
          training_mode: updatedTraining.title,
          bpm_series: { currentBlock, blocks: blockMetrics },
          last_bpm: 0,
          max_bpm_recorded: 0,
          updated_at: new Date().toISOString(),
        });
        if (error) return NextResponse.json({ success: false, error: `El entrenamiento se inició, pero no se pudo abrir el seguimiento en vivo: ${error.message}` }, { status: 503 });
      } else if (nextStatus === "COMPLETED") {
        const { error } = await client.from("active_training_sessions").delete().eq("athlete_id", updatedTraining.athleteId).eq("session_id", id);
        if (error) return NextResponse.json({ success: false, error: `El entrenamiento se guardó, pero no se pudo cerrar la sesión en vivo: ${error.message}` }, { status: 503 });
      }
    }
    if (index >= 0) db.trainings[index] = updatedTraining;
    else db.trainings.unshift(updatedTraining);

    return NextResponse.json({
      success: true,
      message: "Entrenamiento actualizado correctamente",
      data: updatedTraining,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error al actualizar entrenamiento" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await authorizeFeature(request, "telemetry");
    if (isAuthorizationResponse(access)) return access.response;
    const { session } = access;
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    const client = getSupabaseClient();
    const index = db.trainings.findIndex((training) => training.id === id);
    let deleted = index >= 0 ? db.trainings[index] : undefined;
    if (client) {
      const { data: row, error: lookupError } = await client.from("training_sessions").select("*").eq("id", id).maybeSingle();
      if (lookupError) return NextResponse.json({ success: false, error: lookupError.message }, { status: 503 });
      if (!row) return NextResponse.json({ success: false, error: "Entrenamiento no encontrado" }, { status: 404 });
      const { data: athlete, error: athleteError } = await client
        .from("athletes")
        .select("id,user_id,club_id,coach_id")
        .eq("id", row.athlete_id)
        .maybeSingle();
      if (athleteError) return NextResponse.json({ success: false, error: athleteError.message }, { status: 503 });
      let coach: { id?: string; clubId?: string } | undefined;
      if (session.role === "COACH") {
        const { data: coachRow, error: coachError } = await client.from("coaches").select("id,club_id").eq("user_id", session.id).maybeSingle();
        if (coachError) return NextResponse.json({ success: false, error: coachError.message }, { status: 503 });
        coach = { id: coachRow?.id, clubId: coachRow?.club_id || session.clubId };
      }
      if (!athlete || !canManageTraining(session, athlete, coach)) return forbidden();
      const { data, error } = await client.from("training_sessions").delete().eq("id", id).select("id").maybeSingle();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 503 });
      if (!data) return NextResponse.json({ success: false, error: "Entrenamiento no encontrado" }, { status: 404 });
      deleted = { ...deleted, id } as TrainingSession;
    } else {
      if (!deleted) return NextResponse.json({ success: false, error: "Entrenamiento no encontrado" }, { status: 404 });
      const athlete = db.athletes.find((item) => item.id === deleted?.athleteId);
      const coach = session.role === "COACH" ? db.coaches.find((item) => item.userId === session.id) : undefined;
      if (!athlete || !canManageTraining(session, athlete, coach)) return forbidden();
    }
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Entrenamiento no encontrado" }, { status: 404 });
    }

    if (index >= 0) db.trainings.splice(index, 1);
    return NextResponse.json({
      success: true,
      message: "Entrenamiento eliminado correctamente",
      data: deleted,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error al eliminar entrenamiento" }, { status: 400 });
  }
}
