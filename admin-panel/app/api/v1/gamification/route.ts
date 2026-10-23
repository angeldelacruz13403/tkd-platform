import { NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";
import { GamificationLevel } from "@/lib/types";

function athleteIsMinor(dateOfBirth: string): boolean {
  const birth = new Date(`${dateOfBirth}T00:00:00Z`);
  if (!Number.isFinite(birth.getTime())) return true;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayHasPassed =
    today.getUTCMonth() > birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!birthdayHasPassed) age--;
  return age < 18;
}

async function resolveAthlete(client: NonNullable<ReturnType<typeof getSupabaseClient>>, athleteId: string, clubId: string | null, isAdmin: boolean) {
  let query = client.from("athletes").select("id,user_id,name,club_id,date_of_birth").eq("id", athleteId);
  if (!isAdmin) query = query.eq("club_id", clubId || "__none__");
  return query.maybeSingle();
}

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "gamification");
  if (isAuthorizationResponse(access)) return access.response;
  const { session, clubId } = access;
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "Gamificación requiere una conexión configurada con Supabase." }, { status: 503 });
  const requestedAthleteId = new URL(request.url).searchParams.get("athleteId");

  let athleteId = requestedAthleteId || "";
  if (session.role === "ATHLETE") {
    const { data: self, error } = await client.from("athletes").select("id").eq("user_id", session.id).maybeSingle();
    if (error) return NextResponse.json({ success: false, error: "No se pudo consultar la ficha del atleta." }, { status: 503 });
    if (!self) return NextResponse.json({ success: false, error: "Ficha de atleta no encontrada." }, { status: 404 });
    athleteId = self.id;
  }
  if (!athleteId) return NextResponse.json({ success: false, error: "Indica un atleta." }, { status: 400 });
  const { data: athlete, error: athleteError } = await resolveAthlete(client, athleteId, clubId, session.role === "ADMIN");
  if (athleteError) return NextResponse.json({ success: false, error: "No se pudo consultar el atleta." }, { status: 503 });
  if (!athlete) return NextResponse.json({ success: false, error: "Atleta no encontrado." }, { status: 404 });

  const [
    { data: enabledRow, error: enabledError },
    { data: catalog, error: catalogError },
    { data: awarded, error: awardedError },
    { data: levels, error: levelsError },
    { data: consent, error: consentError },
  ] = await Promise.all([
    client.from("athlete_gamification").select("enabled").eq("athlete_id", athleteId).maybeSingle(),
    client.from("gamification_achievements").select("id,club_id,title,description,icon,is_active").eq("is_active", true).or(`club_id.is.null,club_id.eq.${athlete.club_id}`),
    client.from("athlete_achievements").select("achievement_id,awarded_by,awarded_at,note,gamification_achievements(id,club_id,title,description,icon,is_active)").eq("athlete_id", athleteId).order("awarded_at", { ascending: false }),
    client.from("gamification_levels").select("level_number,name,required_achievements").order("level_number"),
    client.from("athlete_guardian_consents").select("status,expires_at,consent_expires_at,granted_at").eq("athlete_id", athleteId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (enabledError || catalogError || awardedError || levelsError || consentError) {
    return NextResponse.json({ success: false, error: "No se pudo cargar el perfil de gamificación." }, { status: 503 });
  }
  const consentStillValid = !athlete.date_of_birth || !athleteIsMinor(athlete.date_of_birth) ||
    (consent?.status === "GRANTED" &&
      Boolean(consent.consent_expires_at) &&
      Date.parse(consent.consent_expires_at) > Date.now());
  const enabled = Boolean(enabledRow?.enabled) && consentStillValid;
  const achievements = enabled ? awarded || [] : [];
  const levelList: GamificationLevel[] = (levels || []).map((item) => ({
    levelNumber: item.level_number,
    name: item.name,
    requiredAchievements: item.required_achievements,
  }));
  const level = levelList
    .filter((item) => achievements.length >= item.requiredAchievements)
    .sort((a, b) => b.levelNumber - a.levelNumber)[0] || null;
  return NextResponse.json({
    success: true,
    enabled,
    achievements,
    catalog: catalog || [],
    levels: levelList,
    level,
    consent: consent ? {
      status: consent.status,
      expiresAt: consent.expires_at,
      consentExpiresAt: consent.consent_expires_at,
      grantedAt: consent.granted_at,
    } : null,
  });
}

export async function POST(request: Request) {
  const access = await authorizeFeature(request, "gamification");
  if (isAuthorizationResponse(access)) return access.response;
  const { session, clubId } = access;
  const body = await request.json();
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "Gamificación requiere Supabase configurado." }, { status: 503 });

  if (body.action === "set-levels") {
    if (session.role !== "ADMIN") return forbidden();
    if (!Array.isArray(body.levels) || body.levels.length > 30) {
      return NextResponse.json({ success: false, error: "La configuración debe incluir una lista válida de niveles." }, { status: 400 });
    }
    const levels = body.levels.map((item: any) => ({
      level_number: Number(item.levelNumber),
      name: String(item.name || "").trim(),
      required_achievements: Number(item.requiredAchievements),
    }));
    if (levels.some((item: any) => !Number.isInteger(item.level_number) || item.level_number < 1 ||
      !item.name || item.name.length > 100 || !Number.isInteger(item.required_achievements) || item.required_achievements < 0) ||
      new Set(levels.map((item: any) => item.level_number)).size !== levels.length ||
      new Set(levels.map((item: any) => item.required_achievements)).size !== levels.length) {
      return NextResponse.json({ success: false, error: "Los niveles y sus umbrales deben ser enteros únicos y válidos." }, { status: 400 });
    }
    const { error } = await client.from("gamification_levels").upsert(levels, { onConflict: "level_number" });
    if (error) return NextResponse.json({ success: false, error: "No se pudieron guardar los niveles." }, { status: 503 });
    return NextResponse.json({ success: true });
  }

  if (session.role !== "ADMIN" && session.role !== "COACH" && session.role !== "CLUB") return forbidden();
  const athleteId = typeof body.athleteId === "string" ? body.athleteId : "";
  if (!athleteId && body.action !== "create-achievement") {
    return NextResponse.json({ success: false, error: "Indica un atleta." }, { status: 400 });
  }
  const { data: athlete, error: athleteError } = athleteId
    ? await resolveAthlete(client, athleteId, clubId, session.role === "ADMIN")
    : { data: null, error: null };
  if (athleteError) return NextResponse.json({ success: false, error: "No se pudo validar el atleta." }, { status: 503 });
  if (athleteId && !athlete) return forbidden();

  if (body.action === "create-achievement") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120) return NextResponse.json({ success: false, error: "El título del logro es obligatorio." }, { status: 400 });
    const { data, error } = await client.from("gamification_achievements").insert({
      id: `achievement-${randomUUID()}`,
      club_id: session.role === "ADMIN" ? body.clubId || null : clubId,
      title,
      description: String(body.description || "").slice(0, 2000),
      icon: String(body.icon || "star").slice(0, 80),
      created_by: session.id,
    }).select("id,club_id,title,description,icon,is_active").single();
    if (error) return NextResponse.json({ success: false, error: "No se pudo crear el logro." }, { status: 409 });
    return NextResponse.json({ success: true, data }, { status: 201 });
  }

  if (body.action === "request-consent") {
    const dateOfBirth = athlete?.date_of_birth;
    if (!dateOfBirth) return NextResponse.json({ success: false, error: "Registra primero la fecha de nacimiento del atleta." }, { status: 409 });
    if (!athleteIsMinor(dateOfBirth)) return NextResponse.json({ success: false, error: "No se requiere consentimiento del tutor para este atleta." }, { status: 409 });
    const guardianName = typeof body.guardianName === "string" ? body.guardianName.trim() : "";
    const guardianEmail = typeof body.guardianEmail === "string" ? body.guardianEmail.trim().toLowerCase() : "";
    if (!guardianName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) {
      return NextResponse.json({ success: false, error: "Nombre y email válidos del tutor son obligatorios." }, { status: 400 });
    }
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await client.from("athlete_guardian_consents").insert({
      id: `consent-${randomUUID()}`,
      athlete_id: athleteId,
      club_id: athlete.club_id,
      guardian_name: guardianName,
      guardian_email: guardianEmail,
      token_hash: tokenHash,
      policy_version: process.env.GUARDIAN_CONSENT_POLICY_VERSION || "2026-10-v1",
      requested_by: session.id,
      expires_at: expiresAt,
    });
    if (error) return NextResponse.json({ success: false, error: "No se pudo crear la solicitud de consentimiento." }, { status: 503 });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return NextResponse.json({ success: false, error: "NEXT_PUBLIC_APP_URL no está configurada." }, { status: 503 });
    return NextResponse.json({
      success: true,
      consentUrl: new URL(`/guardian-consent?token=${rawToken}`, appUrl).toString(),
      expiresAt,
      delivery: "manual",
    }, { status: 201 });
  }

  if (body.action === "set-enabled") {
    const enabled = Boolean(body.enabled);
    if (enabled) {
      if (!athlete?.date_of_birth) return NextResponse.json({ success: false, error: "Registra primero la fecha de nacimiento del atleta." }, { status: 409 });
      if (athleteIsMinor(athlete.date_of_birth)) {
        const { data: consent, error } = await client.from("athlete_guardian_consents")
          .select("id")
          .eq("athlete_id", athleteId)
          .eq("status", "GRANTED")
          .gt("consent_expires_at", new Date().toISOString())
          .maybeSingle();
        if (error) return NextResponse.json({ success: false, error: "No se pudo comprobar el consentimiento." }, { status: 503 });
        if (!consent) return NextResponse.json({ success: false, error: "Hace falta el consentimiento vigente del tutor." }, { status: 409 });
      }
    }
    const { error } = await client.from("athlete_gamification").upsert({
      athlete_id: athleteId,
      enabled,
      updated_by: session.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "athlete_id" });
    if (error) return NextResponse.json({ success: false, error: "No se pudo actualizar la gamificación del atleta." }, { status: 503 });
    return NextResponse.json({ success: true, enabled });
  }

  if (body.action === "assign-achievement") {
    if (!athlete) return forbidden();
    const [{ data: enabled, error: enabledError }, { data: consent, error: consentError }] = await Promise.all([
      client.from("athlete_gamification").select("enabled").eq("athlete_id", athleteId).maybeSingle(),
      client.from("athlete_guardian_consents").select("id").eq("athlete_id", athleteId).eq("status", "GRANTED").gt("consent_expires_at", new Date().toISOString()).maybeSingle(),
    ]);
    if (enabledError || consentError) return NextResponse.json({ success: false, error: "No se pudo validar la elegibilidad del atleta." }, { status: 503 });
    if (!enabled?.enabled) return NextResponse.json({ success: false, error: "La gamificación no está activada para el atleta." }, { status: 409 });
    if (athlete.date_of_birth && athleteIsMinor(athlete.date_of_birth) && !consent) {
      return NextResponse.json({ success: false, error: "El consentimiento del tutor no está vigente." }, { status: 409 });
    }
    const { data: achievement, error: achievementError } = await client
      .from("gamification_achievements")
      .select("id,club_id")
      .eq("id", body.achievementId)
      .eq("is_active", true)
      .maybeSingle();
    if (achievementError) return NextResponse.json({ success: false, error: "No se pudo validar el logro." }, { status: 503 });
    if (!achievement || (achievement.club_id && achievement.club_id !== athlete.club_id)) return forbidden();
    const { error } = await client.from("athlete_achievements").insert({
      athlete_id: athleteId,
      achievement_id: achievement.id,
      awarded_by: session.id,
      note: String(body.note || "").slice(0, 2000),
    });
    if (error) return NextResponse.json({ success: false, error: "El logro ya estaba asignado o no se pudo guardar." }, { status: 409 });
    return NextResponse.json({ success: true }, { status: 201 });
  }

  return NextResponse.json({ success: false, error: "Acción no válida." }, { status: 400 });
}
