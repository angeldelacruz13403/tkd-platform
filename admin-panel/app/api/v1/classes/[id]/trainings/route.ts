import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";
import { ClassTrainingSession } from "@/lib/types";

type Context = { params: { id: string } };

function mapTraining(row: any): ClassTrainingSession {
  return {
    id: row.id,
    classId: row.class_id,
    coachId: row.coach_id || "",
    title: row.title,
    scheduledAt: row.scheduled_at,
    durationMinutes: Number(row.duration_minutes),
    type: row.session_type,
    notes: row.notes || "",
    blocks: Array.isArray(row.blocks) ? row.blocks : [],
    status: row.status,
  };
}

export async function GET(request: Request, { params }: Context) {
  const access = await authorizeFeature(request, "class-training");
  if (isAuthorizationResponse(access)) return access.response;
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "Los entrenamientos de clase requieren una conexión configurada con Supabase." }, { status: 503 });

  const { data: clubClass, error: classError } = await client
    .from("club_classes")
    .select("id,club_id")
    .eq("id", params.id)
    .maybeSingle();
  if (classError) return NextResponse.json({ success: false, error: "No se pudo validar la clase." }, { status: 503 });
  if (!clubClass) return NextResponse.json({ success: false, error: "Clase no encontrada." }, { status: 404 });
  if (access.session.role === "ATHLETE") {
    const { data: athlete, error: athleteError } = await client
      .from("athletes")
      .select("id")
      .eq("user_id", access.session.id)
      .maybeSingle();
    if (athleteError) return NextResponse.json({ success: false, error: "No se pudo validar el atleta." }, { status: 503 });
    if (!athlete) return forbidden();
    const { data: membership, error: membershipError } = await client
      .from("club_class_athletes")
      .select("class_id")
      .eq("class_id", params.id)
      .eq("athlete_id", athlete.id)
      .maybeSingle();
    if (membershipError) return NextResponse.json({ success: false, error: "No se pudo validar la matrícula." }, { status: 503 });
    if (!membership) return forbidden();
  } else if (access.session.role !== "ADMIN" && clubClass.club_id !== access.clubId) {
    return forbidden();
  }

  const { data, error } = await client
    .from("class_training_sessions")
    .select("*")
    .eq("class_id", params.id)
    .order("scheduled_at", { ascending: true });
  if (error) return NextResponse.json({ success: false, error: "No se pudieron cargar los entrenamientos de clase." }, { status: 503 });
  return NextResponse.json({ success: true, data: (data || []).map(mapTraining) });
}

export async function POST(request: Request, { params }: Context) {
  const access = await authorizeFeature(request, "class-training");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  const body = await request.json();
  const scheduledAt = new Date(body.scheduledAt);
  const duration = Number(body.durationMinutes);
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  if (!body.title?.trim() || !Number.isFinite(scheduledAt.getTime()) || !Number.isInteger(duration) || duration < 1 || duration > 1440 || blocks.length > 50) {
    return NextResponse.json({ success: false, error: "Título, fecha, duración y bloques deben ser válidos." }, { status: 400 });
  }
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "Los entrenamientos de clase requieren una conexión configurada con Supabase." }, { status: 503 });
  const id = `class-training-${randomUUID()}`;

  const { data: clubClass, error: classError } = await client
    .from("club_classes")
    .select("id,club_id")
    .eq("id", params.id)
    .maybeSingle();
  if (classError) return NextResponse.json({ success: false, error: "No se pudo validar la clase." }, { status: 503 });
  if (!clubClass || (access.session.role !== "ADMIN" && clubClass.club_id !== access.clubId)) return forbidden();
  const { data, error } = await client
    .from("class_training_sessions")
    .insert({
      id,
      class_id: params.id,
      coach_id: body.coachId || null,
      title: String(body.title).trim(),
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: duration,
      session_type: body.type || "SPARRING_TACTICAL",
      notes: String(body.notes || ""),
      blocks,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ success: false, error: "No se pudo crear el entrenamiento compartido." }, { status: 409 });
  return NextResponse.json({ success: true, data: mapTraining(data) }, { status: 201 });
}
