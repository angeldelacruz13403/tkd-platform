import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { getSupabaseClient } from "@/lib/supabase";
import { Athlete } from "@/lib/types";
import { canAccessClub, forbidden, getSession, unauthorized } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";

function mapAthlete(row: any): Athlete {
  return {
    id: row.id,
    userId: row.user_id || "",
    fullName: row.name,
    dateOfBirth: row.date_of_birth || undefined,
    isCompetitor: Boolean(row.is_competitor),
    category: row.wt_category || "SENIOR_M_68",
    beltRank: row.belt || "Red",
    clubId: row.club_id || "",
    clubName: row.clubs?.name || row.club_name || "",
    coachId: row.coach_id || "",
    coachName: row.coaches?.name || row.coach_name || "",
    weightKg: Number(row.weight) || 0,
    heightCm: Number(row.height) || 0,
    maxHeartRateBpm: Number(row.max_bpm) || 0,
    restingHeartRateBpm: Number(row.rest_bpm) || 0,
    vo2MaxEstimate: Number(row.vo2max) || 0,
    readinessScore: Number(row.readiness_score) || 0,
    injuryStatus: row.injury_status || "FIT",
    stats: {
      matchesPlayed: (Number(row.wins) || 0) + (Number(row.losses) || 0),
      matchesWon: Number(row.wins) || 0,
      koTkoCount: Number(row.ko_tko_count) || 0,
      gamJeomAvg: Number(row.gamjeom_avg) || 0,
      favouriteTechnique: row.favourite_kick || "",
    },
  };
}

function isValidDateOfBirth(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && date <= new Date();
}

function toSupabaseAthlete(body: any, id: string) {
  const category = body.category || "SENIOR_M_68";
  return {
    id,
    user_id: body.userId || null,
    name: body.fullName,
    date_of_birth: body.dateOfBirth || null,
    is_competitor: Boolean(body.isCompetitor ?? body.is_competitor ?? false),
    gender: body.gender || (String(category).includes("_F_") ? "F" : "M"),
    wt_category: category,
    belt: body.beltRank || "Red",
    coach_id: body.coachId || null,
    club_id: body.clubId || null,
    weight: Number(body.weightKg) || 0,
    height: Number(body.heightCm) || 0,
    vo2max: Number(body.vo2MaxEstimate) || 0,
    max_bpm: Number(body.maxHeartRateBpm) || 0,
    rest_bpm: Number(body.restingHeartRateBpm) || 0,
    readiness_score: Number(body.readinessScore) || 0,
    favourite_kick: body.favouriteTechnique || "",
    wins: Number(body.stats?.matchesWon) || 0,
    losses: Math.max(0, (Number(body.stats?.matchesPlayed) || 0) - (Number(body.stats?.matchesWon) || 0)),
  };
}

export async function GET(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  const roleFilter = new URL(request.url).searchParams.get("role");
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "La consulta de atletas requiere una conexión configurada con Supabase." }, { status: 503 });
  let query = client
    .from("athletes")
    .select("*, clubs(name), coaches(name)")
    .order("created_at", { ascending: false });
  if (session.role === "ATHLETE") {
    query = query.eq("user_id", session.id);
  } else if (session.role !== "ADMIN") {
    query = query.eq("club_id", session.clubId || "__none__");
  }
  if (roleFilter === "competitor") query = query.eq("is_competitor", true);
  else if (roleFilter === "non_competitor") query = query.eq("is_competitor", false);
  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, total: data.length, data: data.map(mapAthlete) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.fullName) return NextResponse.json({ success: false, error: "El nombre es obligatorio" }, { status: 400 });
    if (body.dateOfBirth && !isValidDateOfBirth(body.dateOfBirth)) {
      return NextResponse.json({ success: false, error: "La fecha de nacimiento debe ser válida y no futura." }, { status: 400 });
    }
    const session = getSession(request);
    if (!session) return unauthorized();
    if (session.role !== "ADMIN" && session.role !== "COACH" && session.role !== "CLUB") return forbidden();

    // Non-admin users can create records only inside their signed-in club.
    const clubId = body.clubId || (session.role !== "ADMIN" ? session.clubId : undefined);
    if (!clubId) return NextResponse.json({ success: false, error: "El atleta debe pertenecer a un club" }, { status: 400 });
    if (!canAccessClub(session, clubId)) return forbidden();

    const client = getSupabaseClient();
    if (!client) return NextResponse.json({ success: false, error: "El registro de atletas requiere una conexión configurada con Supabase." }, { status: 503 });
    const id = `ath-${Date.now()}`;
    const requestedUsername = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const requestedPassword = typeof body.password === "string" ? body.password : "";
    if (requestedUsername && !/^[a-z0-9._-]{3,32}$/.test(requestedUsername)) {
      return NextResponse.json({ success: false, error: "El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo." }, { status: 400 });
    }
    if (requestedPassword && requestedPassword.length < 8) {
      return NextResponse.json({ success: false, error: "La contraseña personalizada debe tener al menos 8 caracteres." }, { status: 400 });
    }

    // Generar credenciales de acceso automáticas para el atleta si no se especificaron
    const cleanBase = body.fullName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 16) || "atleta";
    const autoUsername = requestedUsername || `${cleanBase}.${randomInt(100, 1000)}`;
    const autoEmail = body.email || `${autoUsername}@tkdglobal.app`;
    const passwordChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const generatedPassword = Array.from({ length: 6 }, () => passwordChars[randomInt(passwordChars.length)]).join("");
    const autoPassword = requestedPassword || `Tkd-${generatedPassword}!`;
    const effectiveUserId = body.userId || `usr-${Date.now()}`;

    // Resolve coach from the selected club
    let coachId = body.coachId || null;
    let coachName = body.coachName || null;
    if (!coachId) {
      const { data: clubRow } = await client.from("clubs").select("coach_id, coaches(name)").eq("id", clubId).maybeSingle();
      if (clubRow?.coach_id) {
        coachId = clubRow.coach_id;
        coachName = (clubRow as any).coaches?.name || null;
      }
    }

    // 1. Crear automáticamente la cuenta de usuario para que el atleta pueda loguearse de inmediato
    if (!body.userId) {
      const { error: userError } = await client.from("users").insert({
        id: effectiveUserId,
        name: body.fullName,
        username: autoUsername,
        email: autoEmail,
        password: hashPassword(autoPassword),
        role: "ATHLETE",
        club_id: clubId,
        status: "ACTIVE",
      });
      if (userError) {
        return NextResponse.json({ success: false, error: `No se pudo crear el acceso del atleta: ${userError.message}` }, { status: 409 });
      }
    } else {
      const { data: linkedUser, error: userLookupError } = await client
        .from("users")
        .select("id,role,club_id")
        .eq("id", effectiveUserId)
        .maybeSingle();
      if (userLookupError || !linkedUser) {
        return NextResponse.json({ success: false, error: "El usuario indicado no existe y no puede vincularse al atleta." }, { status: 400 });
      }
      if (linkedUser.role !== "ATHLETE" || (linkedUser.club_id && linkedUser.club_id !== clubId)) {
        return NextResponse.json({ success: false, error: "Solo se puede vincular una cuenta de atleta del mismo club." }, { status: 400 });
      }
    }

    // 2. Insertar el atleta con el user_id vinculado
    const { data, error } = await client
      .from("athletes")
      .insert(toSupabaseAthlete({ ...body, userId: effectiveUserId, clubId, coachId, coachName }, id))
      .select("*")
      .single();
    if (error) {
      if (!body.userId) await client.from("users").delete().eq("id", effectiveUserId);
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }

    const mapped = mapAthlete(data);
    return NextResponse.json({
      success: true,
      message: "Atleta registrado satisfactoriamente con acceso automático",
      data: mapped,
      autoCredentials: {
        username: autoUsername,
        password: autoPassword,
        email: autoEmail,
      }
    });
  } catch { return NextResponse.json({ success: false, error: "Error al registrar atleta" }, { status: 400 }); }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    if (body.dateOfBirth && !isValidDateOfBirth(body.dateOfBirth)) {
      return NextResponse.json({ success: false, error: "La fecha de nacimiento debe ser válida y no futura." }, { status: 400 });
    }
    const session = getSession(request);
    if (!session) return unauthorized();
    if (session.role !== "ADMIN" && session.role !== "COACH" && session.role !== "CLUB") return forbidden();
    const client = getSupabaseClient();
    if (!client) return NextResponse.json({ success: false, error: "La actualización de atletas requiere una conexión configurada con Supabase." }, { status: 503 });
    const { id, ...updates } = body;
    let query = client.from("athletes").select("*").eq("id", id);
    if (session.role !== "ADMIN") query = query.eq("club_id", session.clubId || "__none__");
    const existing = await query.maybeSingle();
    if (!existing.data) return forbidden();
    if (!canAccessClub(session, updates.clubId || existing.data.club_id)) return forbidden();
    if (session.role !== "ADMIN" && updates.clubId && updates.clubId !== existing.data.club_id) return forbidden();
    // Role changes merge into the existing row so partial updates cannot erase athlete data.
    const existingAthlete = mapAthlete(existing.data);
    const mergedAthlete = {
      ...existingAthlete,
      ...updates,
      isCompetitor: updates.isCompetitor ?? existingAthlete.isCompetitor,
      stats: updates.stats ? { ...existingAthlete.stats, ...updates.stats } : existingAthlete.stats,
    };
    let update = client.from("athletes").update(toSupabaseAthlete(mergedAthlete, id)).eq("id", id);
    if (session.role !== "ADMIN") update = update.eq("club_id", session.clubId || "__none__");
    const { data, error } = await update.select("*").single();
    if (error) return NextResponse.json({ success: false, error: "Atleta no encontrado" }, { status: 404 });
    return NextResponse.json({ success: true, data: mapAthlete(data) });
  } catch { return NextResponse.json({ success: false, error: "Error al actualizar atleta" }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
  const session = getSession(request);
  if (!session) return unauthorized();
  if (session.role !== "ADMIN" && session.role !== "COACH" && session.role !== "CLUB") return forbidden();
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "La eliminación de atletas requiere una conexión configurada con Supabase." }, { status: 503 });
  let query = client.from("athletes").delete().eq("id", id);
  if (session.role !== "ADMIN") query = query.eq("club_id", session.clubId || "__none__");
  const { data, error } = await query.select("*").single();
  if (error) return NextResponse.json({ success: false, error: "Atleta no encontrado" }, { status: 404 });
  return NextResponse.json({ success: true, data: mapAthlete(data) });
}
