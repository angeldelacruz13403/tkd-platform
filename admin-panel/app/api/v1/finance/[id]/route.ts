import { NextResponse } from "next/server";
import { forbidden } from "@/lib/api-auth";
import { authorizeFeature, isAuthorizationResponse } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";

type Context = { params: { id: string } };

export async function PATCH(request: Request, { params }: Context) {
  const access = await authorizeFeature(request, "club-finance");
  if (isAuthorizationResponse(access)) return access.response;
  if (access.session.role !== "ADMIN" && access.session.role !== "COACH" && access.session.role !== "CLUB") return forbidden();
  const body = await request.json();
  if (body.status !== "PAID" && body.status !== "CANCELLED") {
    return NextResponse.json({ success: false, error: "Solo se puede marcar una cuota como pagada o cancelada." }, { status: 400 });
  }

  const client = getSupabaseClient();
  if (!client) return NextResponse.json({ success: false, error: "La gestión financiera requiere una conexión configurada con Supabase." }, { status: 503 });

  let query = client
    .from("club_finance_entries")
    .update({
      status: body.status,
      paid_at: body.status === "PAID" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("entry_type", "STUDENT_DUE");
  if (access.session.role !== "ADMIN") query = query.eq("club_id", access.clubId || "__none__");
  const { data, error } = await query.select("*").maybeSingle();
  if (error) return NextResponse.json({ success: false, error: "No se pudo actualizar la cuota." }, { status: 503 });
  if (!data) return NextResponse.json({ success: false, error: "Cuota no encontrada." }, { status: 404 });
  return NextResponse.json({ success: true, data });
}
