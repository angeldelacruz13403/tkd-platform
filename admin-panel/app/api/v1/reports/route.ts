import { NextResponse } from "next/server";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "reports");
  if (isAuthorizationResponse(access)) return access.response;
  const { session, clubId } = access;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ success: false, error: "Formato no compatible." }, { status: 400 });
  }
  const client = getSupabaseClient();
  let athleteRows: any[] = [];
  let trainingRows: any[] = [];
  let organization = "TKD Global Hub";

  if (client) {
    let athleteQuery = client.from("athletes").select("id,name,wt_category,belt,club_id,weight,max_bpm,rest_bpm,readiness_score,wins,losses,ko_tko_count,gamjeom_avg,favourite_kick,clubs(name)");
    if (session.role === "ATHLETE") athleteQuery = athleteQuery.eq("user_id", session.id);
    else if (session.role !== "ADMIN") athleteQuery = athleteQuery.eq("club_id", clubId || "__none__");
    const { data, error } = await athleteQuery.order("name");
    if (error) return NextResponse.json({ success: false, error: "No se pudieron cargar los atletas del informe." }, { status: 503 });
    athleteRows = data || [];
    const ids = athleteRows.map((item) => item.id);
    if (ids.length) {
      const { data: sessions, error: sessionError } = await client
        .from("training_sessions")
        .select("date,athlete_id,duration_minutes,avg_bpm,max_bpm,trimp_score,hrr_1_min")
        .in("athlete_id", ids)
        .not("id", "like", "live-%")
        .order("date", { ascending: false })
        .limit(500);
      if (sessionError) return NextResponse.json({ success: false, error: "No se pudieron cargar las sesiones del informe." }, { status: 503 });
      trainingRows = sessions || [];
    }
    if (clubId) {
      const { data: club, error: clubError } = await client.from("clubs").select("name").eq("id", clubId).maybeSingle();
      if (clubError) return NextResponse.json({ success: false, error: "No se pudo resolver el club del informe." }, { status: 503 });
      organization = club?.name || organization;
    } else if (session.role === "ADMIN") {
      organization = "TKD Global Hub · Administración";
    }
  } else {
    const athletes = session.role === "ADMIN"
      ? db.athletes
      : session.role === "ATHLETE"
        ? db.athletes.filter((item) => item.userId === session.id)
        : db.athletes.filter((item) => item.clubId === clubId);
    athleteRows = athletes.map((athlete) => ({
      id: athlete.id,
      name: athlete.fullName,
      wt_category: athlete.category,
      belt: athlete.beltRank,
      club_id: athlete.clubId,
      club_name: athlete.clubName,
      weight: athlete.weightKg,
      max_bpm: athlete.maxHeartRateBpm,
      rest_bpm: athlete.restingHeartRateBpm,
      readiness_score: athlete.readinessScore,
      wins: athlete.stats.matchesWon,
      losses: Math.max(0, athlete.stats.matchesPlayed - athlete.stats.matchesWon),
      ko_tko_count: athlete.stats.koTkoCount,
      gamjeom_avg: athlete.stats.gamJeomAvg,
      favourite_kick: athlete.stats.favouriteTechnique,
    }));
    const ids = new Set(athletes.map((item) => item.id));
    trainingRows = db.trainings.filter((item) => ids.has(item.athleteId)).map((item) => ({
      date: item.date, athlete_id: item.athleteId, duration_minutes: item.durationMinutes,
      avg_bpm: item.avgHeartRateBpm, max_bpm: item.maxHeartRateBpm, trimp_score: item.trimpScore,
      hrr_1_min: item.heartRateRecovery1Min,
    }));
    organization = session.role === "ADMIN" ? "TKD Global Hub · Administración" : athletes[0]?.clubName || "Club";
  }

  const names = new Map(athleteRows.map((item) => [item.id, item.name]));
  const reportData = {
    generatedAt: new Date().toISOString(),
    organization,
    totalAthletes: athleteRows.length,
    athletes: athleteRows.map((athlete) => ({
      fullName: athlete.name,
      category: athlete.wt_category,
      beltRank: athlete.belt,
      club: athlete.clubs?.name || athlete.club_name || organization,
      readinessScore: Number(athlete.readiness_score) || 0,
      maxHR: Number(athlete.max_bpm) || 0,
      restingHR: Number(athlete.rest_bpm) || 0,
      winRate: `${Math.round((Number(athlete.wins || 0) / (Number(athlete.wins || 0) + Number(athlete.losses || 0) || 1)) * 100)}%`,
      favouriteTechnique: athlete.favourite_kick || "",
    })),
    recentSessions: trainingRows.map((item) => ({
      date: item.date,
      athlete: names.get(item.athlete_id) || "Atleta",
      durationMin: Number(item.duration_minutes) || 0,
      avgBpm: Number(item.avg_bpm) || 0,
      maxBpm: Number(item.max_bpm) || 0,
      trimp: Number(item.trimp_score) || 0,
      hrrDrop: Number(item.hrr_1_min) || 0,
    })),
  };

  if (format === "csv") {
    const escape = (value: unknown) => {
      const text = String(value ?? "");
      const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csv = [
      "Nombre,Categoria,Cinturon,Club,Readiness,FC_Max,FC_Reposo,WinRate,TecnicaFavorita",
      ...reportData.athletes.map((athlete) => [
        athlete.fullName, athlete.category, athlete.beltRank, athlete.club,
        athlete.readinessScore, athlete.maxHR, athlete.restingHR, athlete.winRate, athlete.favouriteTechnique,
      ].map(escape).join(",")),
    ].join("\r\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="tkd_informe_${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ success: true, data: reportData });
}
