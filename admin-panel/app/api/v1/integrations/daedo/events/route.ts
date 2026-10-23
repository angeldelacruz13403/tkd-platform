import { NextResponse } from "next/server";
import { isValidApiKey, DaedoEventEnvelope, DaedoLiveMatch, parseLiveState, setDaedoLiveState } from "@/lib/daedo";
import { getSupabaseClient } from "@/lib/supabase";
import { recordMatchFinished } from "@/lib/bracket-advancement";

export const runtime = "nodejs";

let fallbackLiveState: DaedoLiveMatch | null = null;

/** Receives normalized events from the local UDP bridge. */
export async function POST(request: Request) {
  if (!isValidApiKey(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const event = await request.json() as Partial<DaedoEventEnvelope>;
  if (!event.eventId || !event.eventType || !event.raw?.value) {
    return NextResponse.json({ success: false, error: "eventId, eventType and raw.value are required" }, { status: 400 });
  }

  console.info("[DAEDO UDP EVENT]", JSON.stringify({
    eventId: event.eventId,
    eventType: event.eventType,
    matchId: event.matchId,
    mat: event.mat,
    source: event.source,
    raw: event.raw,
  }));

  const client = getSupabaseClient();
  if (!client) {
    console.error("[DAEDO LIVE PERSIST ERROR] Supabase client is not configured");
    return NextResponse.json({ success: false, error: "El almacenamiento del marcador en vivo no está configurado." }, { status: 503 });
  }
  let stored: any = null;
  const eventMat = event.mat ? String(event.mat) : "1";
  const rowKey = (id: string) => (eventMat === "1" ? id : `${id}@m${eventMat}`);
  const query = client.from("daedo_live_matches").select("*");
  const lookup = event.matchId
    ? await query.eq("match_id", rowKey(String(event.matchId))).maybeSingle()
    : await query.eq("mat", eventMat).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (lookup.error) {
    console.error("[DAEDO LIVE READ ERROR]", lookup.error.message);
    return NextResponse.json({ success: false, error: "No se pudo leer el estado anterior del marcador." }, { status: 503 });
  }
  stored = lookup.data;

  const rawText = String(event.raw?.value || "");
  const isFinished = event.state?.status === "FINISHED" ||
    event.eventType === "MATCH_FINISHED" ||
    rawText.includes("MATCH_FINISHED") ||
    Boolean((event.payload as any)?.matchWinner) ||
    Boolean((event.state as any)?.winner);

  let winnerCorner: "CHONG" | "HONG" | undefined = undefined;
  if (isFinished) {
    const rawWinner = String((event.state as any)?.winner || (event.payload as any)?.matchWinner || "").toUpperCase();
    if (rawWinner === "RED" || rawWinner === "HONG") {
      winnerCorner = "HONG";
    } else if (rawWinner === "BLUE" || rawWinner === "CHONG") {
      winnerCorner = "CHONG";
    } else {
      const cScore = Number(event.state?.chongScore ?? stored?.chong_score ?? 0);
      const hScore = Number(event.state?.hongScore ?? stored?.hong_score ?? 0);
      if (hScore > cScore) winnerCorner = "HONG";
      else if (cScore > hScore) winnerCorner = "CHONG";
      else {
        const cGamJeom = Number(event.state?.chongGamJeom ?? stored?.chong_gamjeom ?? 0);
        const hGamJeom = Number(event.state?.hongGamJeom ?? stored?.hong_gamjeom ?? 0);
        winnerCorner = hGamJeom < cGamJeom ? "HONG" : "CHONG";
      }
    }
  }

  const state = setDaedoLiveState({
    matchId: event.matchId || String(stored?.match_id || "").replace(/@m.*$/, "") || undefined,
    mat: event.mat ? String(event.mat) : undefined,
    tournamentName: event.state?.tournamentName || stored?.tournament_name,
    chongName: event.state?.chongName || stored?.chong_name,
    hongName: event.state?.hongName || stored?.hong_name,
    chongScore: event.state?.chongScore,
    hongScore: event.state?.hongScore,
    chongGamJeom: event.state?.chongGamJeom,
    hongGamJeom: event.state?.hongGamJeom,
    round: event.state?.round,
    secondsLeft: isFinished ? 0 : event.state?.secondsLeft,
    clockRunning: isFinished ? false : event.state?.clockRunning,
    status: isFinished ? "FINISHED" : event.state?.status,
    lastEventType: event.eventType,
    lastEventAt: event.receivedAt || new Date().toISOString(),
    winner: winnerCorner,
    winnerName: winnerCorner === "CHONG" ? (event.state?.chongName || stored?.chong_name || "CHONG") : (event.state?.hongName || stored?.hong_name || "HONG"),
    rawEncoding: event.raw.encoding,
    rawValue: event.raw.value,
  });
  fallbackLiveState = state;
  const { error } = await client.from("daedo_live_matches").upsert({
      match_id: rowKey(String(state.matchId)),
    mat: state.mat,
    tournament_name: state.tournamentName,
    chong_name: state.chongName,
    hong_name: state.hongName,
    chong_score: state.chongScore,
    hong_score: state.hongScore,
    chong_gamjeom: state.chongGamJeom,
    hong_gamjeom: state.hongGamJeom,
    round: state.round,
    seconds_left: state.secondsLeft,
    clock_running: state.clockRunning,
    status: state.status,
    last_event_type: state.lastEventType,
    last_event_at: state.lastEventAt,
    raw_encoding: state.rawEncoding,
    raw_value: state.rawValue,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[DAEDO LIVE PERSIST ERROR]", error.message);
    return NextResponse.json({ success: false, error: "No se pudo guardar el estado del marcador." }, { status: 503 });
  }
  console.info("[DAEDO LIVE PERSISTED]", JSON.stringify({ matchId: state.matchId, eventType: state.lastEventType, status: state.status, winner: state.winner, receivedAt: state.lastEventAt }));

  let advancementResult: any = null;
  if (isFinished) {
    advancementResult = await recordMatchFinished(client, {
      matchId: state.matchId,
      tournamentName: state.tournamentName,
      chongScore: state.chongScore,
      hongScore: state.hongScore,
      chongGamJeom: state.chongGamJeom,
      hongGamJeom: state.hongGamJeom,
      winnerCorner,
      round: state.round,
    });
  }

  return NextResponse.json({
    success: true,
    accepted: true,
    eventId: event.eventId,
    live: state,
    advancedMatches: advancementResult?.advancedMatches || [],
    updatedMatch: advancementResult?.updatedMatch || null,
    advancementError: advancementResult?.error || undefined,
    message: isFinished
      ? advancementResult?.error
        ? `Combate finalizado; no se pudo completar el avance del bracket: ${advancementResult.error}`
        : `Combate finalizado. Ganador por puntos: ${state.winner}. ${advancementResult?.advancedMatches?.length || 0} combate(s) de bracket actualizados.`
      : "Evento recibido y estado vivo actualizado.",
  });
}
