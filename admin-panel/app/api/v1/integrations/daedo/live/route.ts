import { NextResponse } from "next/server";
import { DaedoLiveMatch, getDaedoLiveState } from "@/lib/daedo";
import { getSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const matFilter = new URL(request.url).searchParams.get("mat")?.trim() || "";
  // Supabase is shared across serverless instances; process memory is only a local fallback.
  const client = getSupabaseClient();
  if (client) {
    const configuredUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    let supabaseHost = "invalid";
    try { supabaseHost = new URL(configuredUrl).host; } catch {}
    const { data, error } = await client
      .from("daedo_live_matches")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[DAEDO LIVE READ ERROR]", JSON.stringify({ supabaseHost, code: error.code, message: error.message }));
      return NextResponse.json({ success: false, error: "No se pudo leer el estado persistido del marcador." }, { status: 503 });
    }
    const rows = matFilter ? (data || []).filter((row: any) => String(row.mat || "1") === matFilter) : (data || []);
    const latest = rows.reduce((current: any, row: any) =>
      !current || Date.parse(row.updated_at || row.last_event_at || "") > Date.parse(current.updated_at || current.last_event_at || "") ? row : current,
    null as any);
    console.info("[DAEDO LIVE READ]", JSON.stringify({ supabaseHost, rowCount: data?.length || 0, matchId: latest?.match_id || null, updatedAt: latest?.updated_at || null }));
    if (latest) {
      const isFinished = latest.status === "FINISHED";
      const chongScore = Number(latest.chong_score) || 0;
      const hongScore = Number(latest.hong_score) || 0;
      const chongGamJeom = Number(latest.chong_gamjeom) || 0;
      const hongGamJeom = Number(latest.hong_gamjeom) || 0;
      const winner = latest.winner || (isFinished
        ? chongScore > hongScore ? "CHONG"
          : hongScore > chongScore ? "HONG"
          : chongGamJeom < hongGamJeom ? "CHONG"
          : hongGamJeom < chongGamJeom ? "HONG"
          : "CHONG"
        : undefined);
      const winnerName = latest.winner_name || (isFinished ? (winner === "CHONG" ? latest.chong_name : latest.hong_name) : undefined);
      return NextResponse.json({ success: true, data: {
        matchId: String(latest.match_id).replace(/@m.*$/, ""), mat: latest.mat, tournamentName: latest.tournament_name,
        chongName: latest.chong_name, hongName: latest.hong_name, chongScore: latest.chong_score,
        hongScore: latest.hong_score, chongGamJeom: latest.chong_gamjeom, hongGamJeom: latest.hong_gamjeom,
        round: latest.round, secondsLeft: latest.seconds_left, clockRunning: latest.clock_running,
        status: latest.status, lastEventType: latest.last_event_type, lastEventAt: latest.last_event_at,
        winner, winnerName,
        rawEncoding: latest.raw_encoding, rawValue: latest.raw_value,
      } as DaedoLiveMatch });
    }
    return NextResponse.json({ success: true, data: null });
  }

  return NextResponse.json({ success: true, data: (() => { return getDaedoLiveState(matFilter || undefined); })() });
}