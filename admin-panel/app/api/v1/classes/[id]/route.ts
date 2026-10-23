import { NextResponse } from "next/server";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";

type Context = { params: { id: string } };

export async function PATCH(request: Request, { params }: Context) {
  const access = await authorizeFeature(request, "class-management");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  const body = await request.json();
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "La gestión de clases requiere una conexión configurada con Supabase." }, { status: 503 });

  const { data: record, error: lookupError } = await client.from("club_classes")
    .select("id,club_id")
    .eq("id", params.id)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ success: false, error: "No se pudo consultar la clase." }, { status: 503 });
  if (!record) return NextResponse.json({ success: false, error: "Clase no encontrada." }, { status: 404 });
  if (access.session.role !== "ADMIN" && record.club_id !== access.clubId) return forbidden();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 160) {
      return NextResponse.json({ success: false, error: "Nombre de clase no válido." }, { status: 400 });
    }
    updates.name = body.name.trim();
  }
  if (body.description !== undefined) updates.description = String(body.description).slice(0, 2000);
  if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive);
  let desiredIds: string[] | null = null;
  if (body.athleteIds !== undefined) {
    if (!Array.isArray(body.athleteIds) || body.athleteIds.some((id: unknown) => typeof id !== "string")) {
      return NextResponse.json({ success: false, error: "La lista de alumnos no es válida." }, { status: 400 });
    }
    desiredIds = Array.from(new Set<string>(body.athleteIds));
    if (desiredIds.length) {
      const { data: validAthletes, error: athleteError } = await client.from("athletes")
        .select("id").eq("club_id", record.club_id).in("id", desiredIds);
      if (athleteError) return NextResponse.json({ success: false, error: "No se pudieron validar los alumnos." }, { status: 503 });
      if (validAthletes?.length !== desiredIds.length) return forbidden();
    }
  }
  const { error: updateError } = await client.from("club_classes").update(updates).eq("id", params.id);
  if (updateError) return NextResponse.json({ success: false, error: "No se pudo actualizar la clase." }, { status: 409 });

  if (desiredIds !== null) {
    const { data: current, error: currentError } = await client.from("club_class_athletes")
      .select("athlete_id").eq("class_id", params.id);
    if (currentError) return NextResponse.json({ success: false, error: "No se pudieron consultar las matrículas." }, { status: 503 });
    const currentIds = (current || []).map((item) => item.athlete_id);
    const toAdd = desiredIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !desiredIds.includes(id));
    if (toAdd.length) {
      const { error } = await client.from("club_class_athletes").insert(toAdd.map((athlete_id) => ({ class_id: params.id, athlete_id })));
      if (error) return NextResponse.json({ success: false, error: "No se pudieron añadir alumnos a la clase." }, { status: 409 });
    }
    if (toRemove.length) {
      const { error } = await client.from("club_class_athletes").delete().eq("class_id", params.id).in("athlete_id", toRemove);
      if (error) return NextResponse.json({ success: false, error: "La clase se actualizó, pero no se pudieron retirar algunas matrículas." }, { status: 503 });
    }
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: Context) {
  const access = await authorizeFeature(request, "class-management");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "La gestión de clases requiere una conexión configurada con Supabase." }, { status: 503 });
  let query = client.from("club_classes").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", params.id);
  if (access.session.role !== "ADMIN") query = query.eq("club_id", access.clubId || "__none__");
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return NextResponse.json({ success: false, error: "No se pudo archivar la clase." }, { status: 503 });
  if (!data) return NextResponse.json({ success: false, error: "Clase no encontrada." }, { status: 404 });
  return NextResponse.json({ success: true });
}
