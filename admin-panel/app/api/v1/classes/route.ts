import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";
import { ClubClass } from "@/lib/types";

function mapClass(row: any): ClubClass {
  return {
    id: row.id,
    clubId: row.club_id,
    coachId: row.coach_id || "",
    name: row.name,
    description: row.description || "",
    isActive: Boolean(row.is_active),
    athleteIds: Array.isArray(row.club_class_athletes)
      ? row.club_class_athletes.map((item: any) => item.athlete_id)
      : [],
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const access = await authorizeFeature(request, "class-management");
  if (isAuthorizationResponse(access)) return access.response;
  const { session, clubId } = access;
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "La gestión de clases requiere una conexión configurada con Supabase." }, { status: 503 });

  let query = client.from("club_classes").select("*,club_class_athletes(athlete_id)").eq("is_active", true);
  if (session.role === "ATHLETE") {
    const { data: athlete, error: athleteError } = await client
      .from("athletes")
      .select("id")
      .eq("user_id", session.id)
      .maybeSingle();
    if (athleteError) return NextResponse.json({ success: false, error: "No se pudo localizar el perfil del atleta." }, { status: 503 });
    if (!athlete) return NextResponse.json({ success: true, data: [] });
    const { data: memberships, error } = await client
      .from("club_class_athletes")
      .select("class_id")
      .eq("athlete_id", athlete.id);
    if (error) return NextResponse.json({ success: false, error: "No se pudieron consultar las clases del atleta." }, { status: 503 });
    const ids = (memberships || []).map((item) => item.class_id);
    if (!ids.length) return NextResponse.json({ success: true, data: [] });
    query = query.in("id", ids);
  } else if (session.role !== "ADMIN") {
    query = query.eq("club_id", clubId || "__none__");
  }
  const { data, error } = await query.order("name");
  if (error) return NextResponse.json({ success: false, error: "No se pudieron cargar las clases." }, { status: 503 });
  return NextResponse.json({ success: true, data: (data || []).map(mapClass) });
}

export async function POST(request: Request) {
  const access = await authorizeFeature(request, "class-management");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  const body = await request.json();
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "La gestión de clases requiere una conexión configurada con Supabase." }, { status: 503 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 160) {
    return NextResponse.json({ success: false, error: "El nombre de la clase es obligatorio y admite hasta 160 caracteres." }, { status: 400 });
  }

  const clubId = access.session.role === "ADMIN" ? body.clubId || access.clubId : access.clubId;
  if (!clubId || (access.session.role !== "ADMIN" && body.clubId && body.clubId !== clubId)) return forbidden();
  const id = `class-${randomUUID()}`;
  const { data, error } = await client
    .from("club_classes")
    .insert({
      id,
      club_id: clubId,
      coach_id: body.coachId || null,
      name,
      description: String(body.description || ""),
    })
    .select("*,club_class_athletes(athlete_id)")
    .single();
  if (error) return NextResponse.json({ success: false, error: "No se pudo crear la clase." }, { status: 409 });

  const athleteIds = Array.isArray(body.athleteIds)
    ? Array.from(new Set<string>(body.athleteIds.map((item: unknown) => String(item))))
    : [];
  if (athleteIds.length) {
    const { data: athletes, error: athleteError } = await client
      .from("athletes")
      .select("id")
      .eq("club_id", clubId)
      .in("id", athleteIds);
    if (athleteError || athletes?.length !== athleteIds.length) {
      await client.from("club_classes").delete().eq("id", id);
      return NextResponse.json({ success: false, error: "Todos los alumnos deben pertenecer al mismo club." }, { status: 400 });
    }
    const { error: membershipError } = await client.from("club_class_athletes").insert(
      athleteIds.map((athleteId) => ({ class_id: id, athlete_id: athleteId }))
    );
    if (membershipError) {
      await client.from("club_classes").delete().eq("id", id);
      return NextResponse.json({ success: false, error: "No se pudieron asignar los alumnos a la clase." }, { status: 409 });
    }
    data.club_class_athletes = athleteIds.map((athlete_id) => ({ athlete_id }));
  }
  return NextResponse.json({ success: true, data: mapClass(data) }, { status: 201 });
}
