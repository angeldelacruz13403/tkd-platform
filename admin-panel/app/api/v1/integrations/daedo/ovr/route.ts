import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildOvrJsonApiMatch, isValidApiKey, setDaedoLiveState } from "@/lib/daedo";
import { getSupabaseClient } from "@/lib/supabase";
import { recordMatchFinished } from "@/lib/bracket-advancement";
import {
  getTkStrikeEventAbbreviation,
  getTkStrikeEventDivision,
  getTkStrikeEventGender,
  getTkStrikeSensorThresholds,
  getTkStrikeWeightCategoryLabel,
} from "@/lib/tournament-categories";

export const runtime = "nodejs";

function resolveWeightCategory(metadata: Record<string, any>, weightDivision: string): string {
  const savedLabel = String(metadata.weightCategory || "");
  if (savedLabel && !getTkStrikeWeightCategoryLabel(savedLabel)) return savedLabel;
  return getTkStrikeWeightCategoryLabel(weightDivision) || savedLabel || weightDivision;
}

function mapCompetitionForOvr(row: any) {
  const metadata = row.match_metadata && typeof row.match_metadata === "object" ? row.match_metadata : {};
  if (metadata.isBye || metadata.isPlaceholder || String(row.system_type || "").includes(":BYE") || String(row.system_type || "").includes(":PENDING")) return null;

  const corner = metadata.corner === "HONG" || String(row.system_type || "").endsWith(":HONG") ? "HONG" : "CHONG";
  const chongName = row.chong_name || (corner === "CHONG" ? metadata.athleteName : metadata.opponentName) || "";
  const hongName = row.hong_athlete_name || (corner === "CHONG" ? metadata.opponentName : metadata.athleteName) || "";
  const athleteName = corner === "CHONG" ? chongName : hongName;
  const opponentName = corner === "CHONG" ? hongName : chongName;
  const chongAthleteId = row.chong_athlete_id || (corner === "CHONG" ? metadata.athleteId : metadata.opponentAthleteId) || "";
  const hongAthleteId = row.hong_athlete_id || (corner === "CHONG" ? metadata.opponentAthleteId : metadata.athleteId) || "";
  const weightDivision = String(metadata.weightDivision || row.category || "SENIOR_M_68");
  const sensorThresholds = getTkStrikeSensorThresholds(weightDivision);

  return {
    id: row.id,
    matchNumber: String(row.match_number || row.id),
    tournamentName: row.competition_name || "Campeonato TKD",
    category: weightDivision,
    weightDivision,
    weightCategory: resolveWeightCategory(metadata, weightDivision),
    phase: row.phase || "R64",
    tatamiNumber: Number(metadata.tatamiNumber) || 1,
    athleteId: corner === "CHONG" ? chongAthleteId : hongAthleteId,
    opponentAthleteId: corner === "CHONG" ? hongAthleteId : chongAthleteId,
    athleteName,
    opponentName,
    corner,
    chongWtId: metadata.chongWtId || chongAthleteId || `pending-${row.id}-home`,
    hongWtId: metadata.hongWtId || hongAthleteId || `pending-${row.id}-away`,
    eventAbbreviation: getTkStrikeEventAbbreviation(weightDivision) || metadata.eventAbbreviation || weightDivision,
    eventGender: getTkStrikeEventGender(weightDivision),
    division: getTkStrikeEventDivision(weightDivision),
    rounds: Number(metadata.rounds) || 3,
    roundTime: metadata.roundTime || "02:00",
    restTime: metadata.restTime || "01:00",
    injuryTime: metadata.injuryTime || "01:00",
    maxDifference: Number(metadata.maxDifference) || 12,
    maxPenalties: Number(metadata.maxPenalties) || 5,
    bodyThreshold: Number(metadata.bodyThreshold) || sensorThresholds.body,
    headThreshold: Number(metadata.headThreshold) || sensorThresholds.head,
    chong: { name: chongName, country: metadata.chongCountry || "ESP", licenseNumber: chongAthleteId || `pending-${row.id}-home` },
    hong: { name: hongName, country: metadata.hongCountry || "ESP", licenseNumber: hongAthleteId || `pending-${row.id}-away` },
  };
}

function mapPersistedCompetitionForOvr(row: any) {
  const metadata = row.match_metadata && typeof row.match_metadata === "object" ? row.match_metadata : {};
  if (metadata.isBye || metadata.isPlaceholder || String(row.system_type || "").includes(":BYE") || String(row.system_type || "").includes(":PENDING")) return null;

  const corner = metadata.corner === "HONG" || String(row.system_type || "").endsWith(":HONG") ? "HONG" : "CHONG";
  const chongName = row.chong_name || (corner === "CHONG" ? metadata.athleteName : metadata.opponentName) || "";
  const hongName = row.hong_athlete_name || (corner === "CHONG" ? metadata.opponentName : metadata.athleteName) || "";
  const athleteName = corner === "CHONG" ? chongName : hongName;
  const opponentName = corner === "CHONG" ? hongName : chongName;
  const chongAthleteId = row.chong_athlete_id || (corner === "CHONG" ? metadata.athleteId : metadata.opponentAthleteId) || "";
  const hongAthleteId = row.hong_athlete_id || (corner === "CHONG" ? metadata.opponentAthleteId : metadata.athleteId) || "";
  const weightDivision = String(metadata.weightDivision || row.category || "SENIOR_M_68");
  const sensorThresholds = getTkStrikeSensorThresholds(weightDivision);

  return {
    id: row.id,
    matchNumber: String(row.match_number || row.id),
    tournamentName: row.competition_name || "Campeonato TKD",
    category: weightDivision,
    weightDivision,
    weightCategory: resolveWeightCategory(metadata, weightDivision),
    phase: row.phase || "R64",
    tatamiNumber: Number(metadata.tatamiNumber) || 1,
    athleteId: corner === "CHONG" ? chongAthleteId : hongAthleteId,
    opponentAthleteId: corner === "CHONG" ? hongAthleteId : chongAthleteId,
    athleteName,
    opponentName,
    corner,
    chongWtId: metadata.chongWtId || chongAthleteId || `pending-${row.id}-home`,
    hongWtId: metadata.hongWtId || hongAthleteId || `pending-${row.id}-away`,
    eventAbbreviation: getTkStrikeEventAbbreviation(weightDivision) || metadata.eventAbbreviation || weightDivision,
    eventGender: getTkStrikeEventGender(weightDivision),
    division: getTkStrikeEventDivision(weightDivision),
    rounds: Number(metadata.rounds) || 3,
    roundTime: metadata.roundTime || "02:00",
    restTime: metadata.restTime || "01:00",
    injuryTime: metadata.injuryTime || "01:00",
    maxDifference: Number(metadata.maxDifference) || 12,
    maxPenalties: Number(metadata.maxPenalties) || 5,
    bodyThreshold: Number(metadata.bodyThreshold) || sensorThresholds.body,
    headThreshold: Number(metadata.headThreshold) || sensorThresholds.head,
    chong: { name: chongName, country: metadata.chongCountry || "ESP", licenseNumber: chongAthleteId || `pending-${row.id}-home` },
    hong: { name: hongName, country: metadata.hongCountry || "ESP", licenseNumber: hongAthleteId || `pending-${row.id}-away` },
  };
}

/**
 * TkStrike OVR callback & match loading endpoint.
 * Configured in TkStrike External / OVR settings.
 */
export async function GET(request: Request) {
  return handleOvrRequest(request, undefined);
}

export async function POST(request: Request) {
  let body: any = undefined;
  try {
    body = await request.json();
  } catch {
    // Empty body is acceptable
  }
  return handleOvrRequest(request, body);
}

async function handleOvrRequest(request: Request, body: any) {
  if (!isValidApiKey(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);

  // 1. Health check / Ping de TkStrike
  if (url.pathname.endsWith("/status")) {
    return NextResponse.json({ status: "UP", service: "tkdcore-daedo-ovr" });
  }

  // 2. Acciones enviadas por TkStrike (ej: MATCH_LOADED)
  const isAction = url.pathname.includes("/actions") || body?.data?.type === "match-actions";
  if (isAction) {
    const actionAttr = body?.data?.attributes || body?.attributes || body || {};
    const actionName = actionAttr.action || "MATCH_LOADED";

    console.info(`[TKSTRIKE ACTION RECEIVED] ${actionName}`, JSON.stringify(actionAttr));

    const actionMatchId = String(actionAttr.matchId || actionAttr.match?.id || body?.data?.id || "");
    let selectedMatch: any = db.competitions.find((match: any) =>
      match.id === actionMatchId || String(match.matchNumber) === actionMatchId
    );
    const actionClient = getSupabaseClient();
    if (!selectedMatch && actionClient && actionMatchId) {
      let { data: persistedMatch } = await actionClient.from("competition_matches").select("*").eq("id", actionMatchId).maybeSingle();
      if (!persistedMatch) {
        const result = await actionClient.from("competition_matches").select("*").eq("match_number", actionMatchId).order("date", { ascending: false }).limit(1).maybeSingle();
        persistedMatch = result.data;
      }
      if (persistedMatch) selectedMatch = mapCompetitionForOvr(persistedMatch);
    }
    const selectedCorner = String(actionAttr.corner || selectedMatch?.corner || "CHONG").toUpperCase();
    const athleteName = String(actionAttr.athleteName || selectedMatch?.athleteName || "");
    const opponentName = String(actionAttr.opponentName || selectedMatch?.opponentName || "");
    const selectedChongName = String(actionAttr.chongName || (selectedCorner === "CHONG" ? athleteName : opponentName));
    const selectedHongName = String(actionAttr.hongName || (selectedCorner === "CHONG" ? opponentName : athleteName));

    const patch: any = {
      ...(actionMatchId ? { matchId: actionMatchId } : {}),
      ...(actionAttr.mat || actionAttr.tatamiNumber || selectedMatch?.tatamiNumber
        ? { mat: String(actionAttr.mat || actionAttr.tatamiNumber || selectedMatch.tatamiNumber) }
        : {}),
      ...(actionAttr.tournamentName || selectedMatch?.tournamentName
        ? { tournamentName: String(actionAttr.tournamentName || selectedMatch.tournamentName) }
        : {}),
      ...(selectedChongName ? { chongName: selectedChongName } : {}),
      ...(selectedHongName ? { hongName: selectedHongName } : {}),
      lastEventType: actionName,
      lastEventAt: new Date().toISOString(),
    };

    if (actionName === "MATCH_LOADED") {
      patch.status = "READY";
      patch.round = actionAttr.round || 1;
      patch.secondsLeft = 120;
      patch.clockRunning = false;
      patch.chongScore = 0;
      patch.hongScore = 0;
      patch.chongGamJeom = 0;
      patch.hongGamJeom = 0;
    } else if (actionName === "MATCH_FINISHED") {
      patch.status = "FINISHED";
      patch.secondsLeft = 0;
      patch.clockRunning = false;
      const rawWinner = String(actionAttr.winner || actionAttr.matchWinner || "").toUpperCase();
      patch.winner = rawWinner === "RED" || rawWinner === "HONG" ? "HONG" : rawWinner === "BLUE" || rawWinner === "CHONG" ? "CHONG" : undefined;
    }

    const liveMatch = setDaedoLiveState(patch);

    // Persistir opcionalmente en Supabase
    const client = getSupabaseClient();
    if (!client) {
      console.error("[DAEDO LIVE PERSIST ERROR] Supabase client is not configured");
      return NextResponse.json({ success: false, error: "El almacenamiento del marcador en vivo no está configurado." }, { status: 503 });
    }
    const { error: persistError } = await client.from("daedo_live_matches").upsert({
        match_id: liveMatch.matchId,
        mat: liveMatch.mat,
        tournament_name: liveMatch.tournamentName,
        chong_name: liveMatch.chongName,
        hong_name: liveMatch.hongName,
        chong_score: liveMatch.chongScore,
        hong_score: liveMatch.hongScore,
        chong_gamjeom: liveMatch.chongGamJeom,
        hong_gamjeom: liveMatch.hongGamJeom,
        round: liveMatch.round,
        seconds_left: liveMatch.secondsLeft,
        clock_running: liveMatch.clockRunning,
        status: liveMatch.status,
        last_event_type: liveMatch.lastEventType,
        last_event_at: liveMatch.lastEventAt,
        updated_at: new Date().toISOString(),
      });
    if (persistError) {
      console.error("[DAEDO LIVE PERSIST ERROR]", persistError.message);
      return NextResponse.json({ success: false, error: "No se pudo guardar el estado del marcador." }, { status: 503 });
    }
    console.info("[DAEDO LIVE PERSISTED]", JSON.stringify({ matchId: liveMatch.matchId, eventType: actionName, receivedAt: liveMatch.lastEventAt }));

    if (actionName === "MATCH_FINISHED") {
      void recordMatchFinished(client, {
        matchId: liveMatch.matchId,
        chongScore: liveMatch.chongScore,
        hongScore: liveMatch.hongScore,
        chongGamJeom: liveMatch.chongGamJeom,
        hongGamJeom: liveMatch.hongGamJeom,
        winnerCorner: liveMatch.winner,
        round: liveMatch.round,
      });
    }

    return NextResponse.json(
      {
        data: {
          type: "match-actions",
          id: String(body?.data?.id || Date.now()),
          attributes: {
            action: actionName,
            status: "ACCEPTED",
          },
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 3. Consulta de combates (GET /matches o GET /ovr)
  const rawMat = String(url.searchParams.get("mat") || url.searchParams.get("filter[mat]") || body?.mat || "1");
  const matParts = rawMat.split("/").filter(Boolean);
  const mat = matParts[0] || "1";
  const requestedType = matParts[1];
  const requestedResourceId = matParts[2];
  const relatedMatchId = requestedResourceId?.replace(/^(?:part-(?:blue|red)-|comp-(?:blue|red)-|participant-(?:home|away)-|competitor-(?:home|away)-|ev-|cfg-)/, "");
  const requestedMatchId = url.searchParams.get("matchId") || body?.matchId || (requestedType === "matches" ? requestedResourceId : relatedMatchId);
  let candidates = db.competitions.map((match: any) => match as any);
  const readClient = getSupabaseClient();
  if (readClient) {
    const { data: rows, error } = await readClient.from("competition_matches").select("*").order("date", { ascending: true }).limit(500);
    if (error) {
      return NextResponse.json({ errors: [{ status: "503", detail: `No se pudieron cargar combates para el marcador: ${error.message}` }] }, { status: 503 });
    }
    candidates = (rows || []).map(mapCompetitionForOvr).filter(Boolean) as any[];
  }

  const candidatesOnMat = candidates.filter((match: any) => Number(match.tatamiNumber || match.mat || 1) === (Number(mat) || 1));
  const pending = requestedMatchId
    ? candidatesOnMat.find((match: any) => match.id === requestedMatchId || String(match.matchNumber) === requestedMatchId)
    : candidatesOnMat.sort((a: any, b: any) => Number.parseInt(String(a.matchNumber), 10) - Number.parseInt(String(b.matchNumber), 10))[0];

  if (!pending) {
    return NextResponse.json({
      jsonapi: { version: "1.0" },
      meta: { mat, source: "tkdcore-daedo-ovr", schemaVersion: "1.0" },
      links: { self: request.url },
      data: [],
      included: [],
    }, { headers: { "Content-Type": "application/vnd.api+json", "Cache-Control": "no-store" } });
  }

  const jsonApi = buildOvrJsonApiMatch(mat, pending);

  if (requestedType && requestedType !== "matches") {
    const related = jsonApi.included.find((resource: any) =>
      resource.type === requestedType && (!requestedResourceId || resource.id === requestedResourceId)
    );
    if (!related) {
      return NextResponse.json({ errors: [{ status: "404", detail: `${requestedType}/${requestedResourceId || ""} no encontrado` }] }, { status: 404 });
    }
    return NextResponse.json({
      jsonapi: jsonApi.jsonapi,
      meta: jsonApi.meta,
      links: { self: request.url },
      data: related,
    }, { headers: { "Content-Type": "application/vnd.api+json", "Cache-Control": "no-store" } });
  }

  // Actualizar automáticamente el marcador en vivo al despachar el combate al TkStrike
  const eventData = jsonApi.included.find((i: any) => i.type === "events");
  const compBlue = jsonApi.included.find((i: any) => i.type === "competitors" && i.id.includes("blue"));
  const compRed = jsonApi.included.find((i: any) => i.type === "competitors" && i.id.includes("red"));
  const partBlue = jsonApi.included.find((i: any) => i.type === "participants" && i.id.includes("blue"));
  const partRed = jsonApi.included.find((i: any) => i.type === "participants" && i.id.includes("red"));

  const chongFullName = `${partBlue?.attributes?.givenName || "Carlos"} ${partBlue?.attributes?.familyName || "Garcia"} (${compBlue?.attributes?.country || "ESP"})`;
  const hongFullName = `${partRed?.attributes?.givenName || "Jean"} ${partRed?.attributes?.familyName || "Dupont"} (${compRed?.attributes?.country || "FRA"})`;

  const updatedLive = setDaedoLiveState({
    matchId: jsonApi.data.id,
    mat,
    tournamentName: eventData?.attributes?.name || "Campeonato Oficial TKD",
    chongName: chongFullName,
    hongName: hongFullName,
    chongScore: 0,
    hongScore: 0,
    chongGamJeom: 0,
    hongGamJeom: 0,
    round: 1,
    secondsLeft: 120,
    clockRunning: false,
    status: "READY",
    lastEventType: "MATCH",
    lastEventAt: new Date().toISOString(),
  });

  const client = getSupabaseClient();
  if (client) {
    void client.from("daedo_live_matches").upsert({
      match_id: updatedLive.matchId,
      mat: updatedLive.mat,
      tournament_name: updatedLive.tournamentName,
      chong_name: updatedLive.chongName,
      hong_name: updatedLive.hongName,
      chong_score: 0,
      hong_score: 0,
      chong_gamjeom: 0,
      hong_gamjeom: 0,
      round: 1,
      seconds_left: 120,
      clock_running: false,
      status: "READY",
      last_event_type: "MATCH",
      last_event_at: updatedLive.lastEventAt,
      updated_at: new Date().toISOString(),
    });
  }

  // Crnk en TkStrike espera una lista si pide `findAll`
  const isFindOne = Boolean(requestedMatchId || url.pathname.match(/\/matches\/[^\/]+$/));
  const responsePayload = {
    ...jsonApi,
    data: isFindOne ? jsonApi.data : [jsonApi.data],
  };

  return NextResponse.json(responsePayload, {
    headers: {
      "Content-Type": "application/vnd.api+json",
      "Cache-Control": "no-store",
    },
  });
}
