import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";

function weeklyTrend(sessions: Array<{ date: string; trimp: number; avgBpm: number }>) {
  const today = new Date();
  const result = [];
  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    const rows = sessions.filter((item) => item.date.slice(0, 10) === key);
    result.push({
      day: day.toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" }),
      date: key,
      trimp: rows.reduce((total, item) => total + item.trimp, 0),
      avgBpm: rows.length ? Math.round(rows.reduce((total, item) => total + item.avgBpm, 0) / rows.length) : 0,
    });
  }
  return result;
}

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "analytics");
  if (isAuthorizationResponse(access)) return access.response;
  const { session, clubId } = access;
  let athletes: Array<{ id: string; readiness: number }>;
  let trainings: Array<{ date: string; trimp: number; avgBpm: number; zone5: number }>;
  let totalClubs: number;
  let totalMatches: number;
  const client = getSupabaseClient();

  if (client) {
    let athleteQuery = client.from("athletes").select("id,readiness_score");
    if (session.role === "ATHLETE") athleteQuery = athleteQuery.eq("user_id", session.id);
    else if (session.role !== "ADMIN") athleteQuery = athleteQuery.eq("club_id", clubId || "__none__");
    const { data: athleteRows, error: athletesError } = await athleteQuery;
    if (athletesError) return NextResponse.json({ success: false, error: "No se pudo cargar el roster analítico." }, { status: 503 });
    athletes = (athleteRows || []).map((item) => ({ id: item.id, readiness: Number(item.readiness_score) || 0 }));
    const ids = athletes.map((item) => item.id);
    const trainingResult = ids.length
      ? await client.from("training_sessions").select("date,trimp_score,avg_bpm,zone5_minutes").in("athlete_id", ids).not("id", "like", "live-%")
      : { data: [], error: null };
    if (trainingResult.error) return NextResponse.json({ success: false, error: "No se pudo cargar el historial analítico." }, { status: 503 });
    trainings = (trainingResult.data || []).map((item) => ({
      date: item.date,
      trimp: Number(item.trimp_score) || 0,
      avgBpm: Number(item.avg_bpm) || 0,
      zone5: Number(item.zone5_minutes) || 0,
    }));
    const matchResult = ids.length
      ? await client.from("competition_matches").select("id").in("athlete_id", ids)
      : { data: [], error: null };
    if (matchResult.error) return NextResponse.json({ success: false, error: "No se pudieron cargar las competiciones." }, { status: 503 });
    totalMatches = matchResult.data?.length || 0;
    if (session.role === "ADMIN") {
      const { count, error } = await client.from("clubs").select("id", { count: "exact", head: true });
      if (error) return NextResponse.json({ success: false, error: "No se pudo consultar el número de clubes." }, { status: 503 });
      totalClubs = count || 0;
    } else {
      totalClubs = clubId ? 1 : 0;
    }
  } else {
    const roster = session.role === "ADMIN"
      ? db.athletes
      : session.role === "ATHLETE"
        ? db.athletes.filter((item) => item.userId === session.id)
        : db.athletes.filter((item) => item.clubId === clubId);
    const ids = new Set(roster.map((item) => item.id));
    athletes = roster.map((item) => ({ id: item.id, readiness: item.readinessScore }));
    trainings = db.trainings.filter((item) => ids.has(item.athleteId)).map((item) => ({
      date: item.date,
      trimp: item.trimpScore,
      avgBpm: item.avgHeartRateBpm,
      zone5: item.heartRateZones.zone5AnaerobicMin,
    }));
    totalMatches = db.competitions.filter((item) => ids.has(item.athleteId)).length;
    totalClubs = session.role === "ADMIN" ? db.clubs.length : clubId ? 1 : 0;
  }

  const totalReadiness = athletes.reduce((sum, item) => sum + item.readiness, 0);
  const summary = {
    totalAthletes: athletes.length,
    totalTrainings: trainings.length,
    totalClubs,
    totalMatches,
    avgReadiness: athletes.length ? Math.round(totalReadiness / athletes.length) : 0,
    totalTrimpAccumulated: trainings.reduce((sum, item) => sum + item.trimp, 0),
    totalAnaerobicZ5Minutes: trainings.reduce((sum, item) => sum + item.zone5, 0),
    aiModelAccuracy: session.role === "ADMIN" ? db.retrainMetrics.fatiguePredictionAccuracy : null,
    currentModelVersion: session.role === "ADMIN" ? db.retrainMetrics.modelVersion : null,
  };
  return NextResponse.json({ success: true, summary, weeklyLoadTrend: weeklyTrend(trainings) });
}
