import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/api-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { AthleteLiveTelemetry, TrainingBlockTelemetry } from "@/lib/types";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const access = await authorizeFeature(request, "telemetry");
    if (isAuthorizationResponse(access)) return access.response;
    const { session } = access;
    const client = getSupabaseClient();
    let roster: any[] = [];
    let liveRows: any[] = [];
    let activeTrainingRows: any[] = [];

    if (client) {
      let athleteQuery = client.from("athletes").select("id,user_id,name,wt_category,belt,club_id,coach_id,max_bpm,rest_bpm");
      if (session.role === "ATHLETE") athleteQuery = athleteQuery.eq("user_id", session.id);
      else if (session.role === "CLUB") athleteQuery = athleteQuery.eq("club_id", session.clubId || "__none__");
      else if (session.role === "COACH") {
        const { data: coach } = await client.from("coaches").select("id,club_id").eq("user_id", session.id).maybeSingle();
        if (coach?.id && (coach.club_id || session.clubId)) athleteQuery = athleteQuery.or(`coach_id.eq.${coach.id},club_id.eq.${coach.club_id || session.clubId}`);
        else if (coach?.id) athleteQuery = athleteQuery.eq("coach_id", coach.id);
        else athleteQuery = athleteQuery.eq("club_id", session.clubId || coach?.club_id || "__none__");
      }
      const { data: athletes, error: athleteError } = await athleteQuery;
      if (athleteError) return NextResponse.json({ success: false, error: athleteError.message }, { status: 500 });
      roster = athletes || [];
      const ids = roster.map((athlete) => athlete.id);
      if (ids.length) {
        const { data, error } = await client.from("athlete_live_telemetry").select("*").in("athlete_id", ids);
        if (error) {
          console.warn("[TELEMETRY GET] Fallback a sesiones live persistidas:", error.message);
          const { data: liveSessions, error: liveSessionError } = await client
            .from("training_sessions")
            .select("id,athlete_id,coach_id,date,session_type,duration_minutes,avg_bpm,max_bpm,trimp_score,tactical_notes")
            .in("athlete_id", ids)
            .like("id", "live-%");
          if (liveSessionError) return NextResponse.json({ success: false, error: liveSessionError.message }, { status: 500 });
          liveRows = (liveSessions || []).map((row: any) => {
            let metadata: any = {};
            try { metadata = JSON.parse(row.tactical_notes || "{}"); } catch {}
            return {
              athlete_id: row.athlete_id,
              athlete_name: metadata.athleteName,
              category: metadata.category,
              belt_rank: metadata.beltRank,
              club_id: metadata.clubId,
              coach_id: row.coach_id,
              current_bpm: row.avg_bpm,
              max_bpm: row.max_bpm,
              resting_bpm: metadata.restingHeartRateBpm,
              zone: metadata.zone,
              zone_name: metadata.zoneName,
              zone_color: metadata.zoneColor,
              trimp_score: row.trimp_score,
              session_duration_sec: Number(row.duration_minutes || 0) * 60,
              training_mode: metadata.trainingMode || row.session_type,
              is_running: metadata.isTrainingRunning,
              battery_level: metadata.batteryLevel,
              status: metadata.isTrainingRunning ? "LIVE" : "PAUSED",
              updated_at: metadata.updatedAt || row.date,
            };
          });
        } else {
          liveRows = data || [];
        }
        const { data: activeRows, error: activeError } = await client
          .from("active_training_sessions")
          .select("athlete_id,session_id,started_at,training_mode,bpm_series,last_bpm,max_bpm_recorded,updated_at")
          .in("athlete_id", ids);
        if (activeError) {
          return NextResponse.json({ success: false, error: `No se pudieron cargar los bloques activos: ${activeError.message}` }, { status: 503 });
        }
        activeTrainingRows = activeRows || [];
      }
    } else {
      if (session.role === "ADMIN") roster = db.athletes;
      else if (session.role === "ATHLETE") roster = db.athletes.filter((a) => a.userId === session.id);
      else if (session.role === "COACH") roster = db.athletes.filter((a) => a.coachId === session.id || (session.clubId && a.clubId === session.clubId));
      else roster = db.athletes.filter((a) => a.clubId === session.clubId);
      liveRows = Array.from(db.liveTelemetry.values()).filter((item) => roster.some((athlete) => athlete.id === item.athleteId));
      activeTrainingRows = liveRows.filter((item) => item.blockTelemetry).map((item) => ({
        athlete_id: item.athleteId,
        ...item.blockTelemetry,
      }));
    }

    // Only merge records belonging to the already-authorized roster.
    for (const [memId, memRow] of Array.from(db.liveTelemetry.entries())) {
      if (
        roster.some((athlete) => athlete.id === memId) &&
        !liveRows.some((r) => (r.athlete_id || r.athleteId) === memId)
      ) {
        liveRows.push(memRow);
      }
    }

    const byAthleteId = new Map<string, any>(liveRows.map((row) => [row.athlete_id || row.athleteId, row]));
    const activeByAthleteId = new Map<string, any>(activeTrainingRows.map((row) => [row.athlete_id, row]));
    const now = Date.now();

    const telemetryList: AthleteLiveTelemetry[] = roster.map((athlete) => {
      const row = byAthleteId.get(athlete.id);
      const activeTraining = activeByAthleteId.get(athlete.id);
      const updatedAt = row?.updated_at || row?.lastUpdatedAt || new Date(0).toISOString();
      const age = now - new Date(updatedAt).getTime();
      const currentBpm = Number(row?.current_bpm ?? row?.currentBpm ?? 0);
      const reported = row?.status || (currentBpm > 0 ? "LIVE" : "OFFLINE");
      const status = age > 60000 ? "OFFLINE" : age > 15000 ? "PAUSED" : reported;
      return {
        athleteId: athlete.id,
        athleteName: row?.athlete_name || row?.athleteName || athlete.name || athlete.fullName,
        category: row?.category || athlete.wt_category || athlete.category,
        beltRank: row?.belt_rank || athlete.belt,
        clubId: row?.club_id || athlete.club_id || athlete.clubId,
        coachId: row?.coach_id || athlete.coach_id || athlete.coachId,
        currentBpm,
        maxHeartRateBpm: Number(row?.max_bpm || athlete.max_bpm || athlete.maxHeartRateBpm || 200),
        restingHeartRateBpm: Number(row?.resting_bpm || athlete.rest_bpm || athlete.restingHeartRateBpm || 50),
        zone: row?.zone || "Z1",
        zoneName: row?.zone_name || "En espera",
        zoneColor: row?.zone_color || "#64748b",
        trimpScore: Number(row?.trimp_score || 0),
        sessionDurationSec: Number(row?.session_duration_sec || 0),
        trainingMode: row?.training_mode || "standby",
        isTrainingRunning: Boolean(row?.is_running),
        blockTelemetry: activeTraining?.session_id
          ? {
              sessionId: activeTraining.session_id,
              startedAt: activeTraining.started_at,
              trainingMode: activeTraining.training_mode,
              currentBlock: activeTraining.bpm_series?.currentBlock,
              blocks: Array.isArray(activeTraining.bpm_series?.blocks) ? activeTraining.bpm_series.blocks : [],
            }
          : row?.blockTelemetry,
        batteryLevel: row?.battery_level ?? null,
        lastUpdatedAt: updatedAt,
        status,
      };
    });

    return NextResponse.json({
      success: true,
      count: telemetryList.length,
      timestamp: new Date().toISOString(),
      data: telemetryList,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error al obtener telemetría en vivo" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await authorizeFeature(request, "telemetry");
    if (isAuthorizationResponse(access)) return access.response;
    const { session } = access;
    if (session.role !== "ATHLETE" && session.role !== "COACH") return forbidden();
    const body = await request.json();

    if (!body || !body.athleteId) {
      return NextResponse.json(
        { success: false, error: "El campo athleteId es obligatorio" },
        { status: 400 }
      );
    }

    const requestedId = String(body.athleteId).trim();
    const client = getSupabaseClient();
    let athlete: any;

    if (client) {
      // Búsqueda tolerante por ID de atleta o user_id asociado a la PECA/móvil
      const { data } = await client
        .from("athletes")
        .select("id,user_id,name,wt_category,belt,club_id,coach_id,max_bpm,rest_bpm")
        .or(`id.eq.${requestedId},user_id.eq.${requestedId}`)
        .maybeSingle();
      athlete = data;
    } else {
      athlete = db.athletes.find((item) => item.id === requestedId || item.userId === requestedId);
    }

    if (!athlete) {
      return NextResponse.json({ success: false, error: "El atleta no existe." }, { status: 404 });
    }
    if (session.role === "ATHLETE" && (athlete.user_id || athlete.userId) !== session.id) return forbidden();
    if (session.role === "COACH" && (athlete.club_id || athlete.clubId) !== access.clubId) return forbidden();

    const payload: Partial<AthleteLiveTelemetry> & { athleteId: string; currentBpm: number } = {
      athleteId: athlete.id,
      athleteName: athlete.name || athlete.fullName,
      category: athlete.wt_category || athlete.category,
      beltRank: athlete.belt,
      clubId: athlete.club_id || athlete.clubId,
      coachId: athlete.coach_id || athlete.coachId,
      currentBpm: Number(body.currentBpm || body.bpm || 0),
      maxHeartRateBpm: Number(athlete.max_bpm || athlete.maxHeartRateBpm || body.maxBpm || 200),
      restingHeartRateBpm: Number(athlete.rest_bpm || athlete.restingHeartRateBpm || 50),
      zone: body.zone,
      zoneName: body.zoneName,
      zoneColor: body.zoneColor,
      trimpScore: body.trimpScore !== undefined ? Number(body.trimpScore) : undefined,
      sessionDurationSec: body.sessionDurationSec !== undefined ? Number(body.sessionDurationSec) : (body.sessionDuration !== undefined ? Number(body.sessionDuration) : undefined),
      trainingMode: body.trainingMode ? String(body.trainingMode) : undefined,
      isTrainingRunning: body.isTrainingRunning !== undefined ? Boolean(body.isTrainingRunning) : undefined,
      batteryLevel: body.batteryLevel !== undefined ? Number(body.batteryLevel) : undefined,
    };

    if (body.blockTelemetry) {
      const liveBlocks = body.blockTelemetry;
      if (
        session.role !== "ATHLETE" ||
        (athlete.user_id || athlete.userId) !== session.id ||
        typeof liveBlocks.sessionId !== "string" ||
        !Array.isArray(liveBlocks.blocks) ||
        liveBlocks.blocks.length < 1 ||
        liveBlocks.blocks.length > 20 ||
        !liveBlocks.currentBlock ||
        !Number.isInteger(liveBlocks.currentBlock.index) ||
        liveBlocks.currentBlock.index < 0 ||
        liveBlocks.currentBlock.index >= liveBlocks.blocks.length
      ) {
        return NextResponse.json({ success: false, error: "Datos de bloque inválidos o atleta no autorizado." }, { status: 403 });
      }
      const { data: scheduledSession, error: sessionError } = await client
        ?.from("training_sessions")
        .select("id")
        .eq("id", liveBlocks.sessionId)
        .eq("athlete_id", athlete.id)
        .eq("status", "IN_PROGRESS")
        .maybeSingle() || { data: null, error: new Error("Supabase no disponible") };
      if (sessionError) return NextResponse.json({ success: false, error: sessionError.message }, { status: 503 });
      if (!scheduledSession) return NextResponse.json({ success: false, error: "El entrenamiento no está iniciado o no corresponde a este atleta." }, { status: 409 });
      const blocks = liveBlocks.blocks.map((block: any, index: number) => ({
        id: String(block.id || `block-${index + 1}`).slice(0, 80),
        title: String(block.title || `Bloque ${index + 1}`).trim().slice(0, 120),
        durationMinutes: Math.max(1, Math.min(240, Math.floor(Number(block.durationMinutes) || 1))),
        elapsedSeconds: Math.max(0, Math.floor(Number(block.elapsedSeconds) || 0)),
        avgBpm: Math.max(0, Math.floor(Number(block.avgBpm) || 0)),
        maxBpm: Math.max(0, Math.floor(Number(block.maxBpm) || 0)),
        sampleCount: Math.max(0, Math.floor(Number(block.sampleCount) || 0)),
        completed: Boolean(block.completed),
      }));
      const currentBlock = {
        ...blocks[liveBlocks.currentBlock.index],
        index: liveBlocks.currentBlock.index,
        totalBlocks: blocks.length,
      };
      const blockTelemetry = {
        sessionId: liveBlocks.sessionId,
        startedAt: String(liveBlocks.startedAt || new Date().toISOString()),
        currentBlock,
        blocks,
      };
      if (client) {
        const { error } = await client.from("active_training_sessions").upsert({
          athlete_id: athlete.id,
          session_id: liveBlocks.sessionId,
          coach_id: athlete.coach_id || null,
          started_at: blockTelemetry.startedAt,
          training_mode: liveBlocks.trainingMode || "entrenamiento programado",
          bpm_series: { currentBlock, blocks },
          last_bpm: payload.currentBpm,
          max_bpm_recorded: Math.max(payload.currentBpm, ...blocks.map((block: any) => block.maxBpm)),
          updated_at: new Date().toISOString(),
        });
        if (error) return NextResponse.json({ success: false, error: `No se pudo guardar el seguimiento de bloques: ${error.message}` }, { status: 503 });
      } else {
        payload.blockTelemetry = blockTelemetry as TrainingBlockTelemetry;
      }
    }

    let updated;
    try {
      updated = await db.updateLiveTelemetry(payload);
    } catch (error: any) {
      console.error("[LIVE TELEMETRY PERSISTENCE ERROR]", error?.message || error);
      return NextResponse.json({
        success: false,
        error: "El servidor recibió los PPM, pero no pudo guardarlos.",
        detail: error?.message || "Error de persistencia",
      }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      athleteId: updated.athleteId,
      currentBpm: updated.currentBpm,
      data: updated,
      receivedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error al procesar telemetría de pulsaciones" },
      { status: 400 }
    );
  }
}
