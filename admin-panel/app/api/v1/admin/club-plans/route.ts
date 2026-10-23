import { NextResponse } from "next/server";
import { getSession, forbidden, unauthorized } from "@/lib/api-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { ClubPlan } from "@/lib/types";

function isClubPlan(value: unknown): value is ClubPlan {
  return value === "FREE" || value === "SEMIPRO" || value === "PRO";
}

function requireAdmin(request: Request) {
  const session = getSession(request);
  if (!session) return { response: unauthorized() } as const;
  if (session.role !== "ADMIN") return { response: forbidden() } as const;
  return { session } as const;
}

export async function GET(request: Request) {
  const access = requireAdmin(request);
  if ("response" in access) return access.response;
  const client = getSupabaseClient();
  if (!client) {
    return NextResponse.json({ success: false, error: "La gestión de planes requiere una conexión configurada con Supabase." }, { status: 503 });
  }

  const [{ data: clubs, error: clubsError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    client.from("clubs").select("id,name,city").order("name"),
    client.from("club_subscriptions").select("club_id,plan_tier,manual_plan_tier,manual_plan_set_at,status,billing_interval,current_period_end"),
  ]);
  if (clubsError || subscriptionsError) {
    console.error("[ADMIN CLUB PLANS] No se pudieron consultar los planes:", clubsError || subscriptionsError);
    return NextResponse.json({ success: false, error: "No se pudieron cargar los clubes y sus planes." }, { status: 503 });
  }

  const subscriptionByClub = new Map((subscriptions || []).map((item) => [item.club_id, item]));
  const data = (clubs || []).map((club) => {
    const subscription = subscriptionByClub.get(club.id);
    return {
      id: club.id,
      name: club.name,
      city: club.city,
      plan: subscription?.manual_plan_tier || subscription?.plan_tier || "FREE",
      automatedPlan: subscription?.plan_tier || "FREE",
      isManual: Boolean(subscription?.manual_plan_tier),
      manualPlanSetAt: subscription?.manual_plan_set_at || null,
      status: subscription?.status || "ACTIVE",
      billingInterval: subscription?.billing_interval || null,
      currentPeriodEnd: subscription?.current_period_end || null,
    };
  });
  return NextResponse.json({ success: true, data });
}

export async function PUT(request: Request) {
  const access = requireAdmin(request);
  if ("response" in access) return access.response;
  const client = getSupabaseClient();
  if (!client) {
    return NextResponse.json({ success: false, error: "La gestión de planes requiere una conexión configurada con Supabase." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const clubId = typeof body.clubId === "string" ? body.clubId.trim() : "";
    const resetToAutomatic = body.plan === null;
    if (!clubId || (!resetToAutomatic && !isClubPlan(body.plan))) {
      return NextResponse.json({ success: false, error: "Selecciona un club y un plan válido." }, { status: 400 });
    }

    const { data: club, error: clubError } = await client.from("clubs").select("id").eq("id", clubId).maybeSingle();
    if (clubError) return NextResponse.json({ success: false, error: "No se pudo verificar el club." }, { status: 503 });
    if (!club) return NextResponse.json({ success: false, error: "Club no encontrado." }, { status: 404 });

    const updatedAt = new Date().toISOString();
    const { data: existing, error: lookupError } = await client
      .from("club_subscriptions")
      .select("club_id")
      .eq("club_id", clubId)
      .maybeSingle();
    if (lookupError) return NextResponse.json({ success: false, error: "No se pudo consultar la suscripción actual." }, { status: 503 });

    const patch = resetToAutomatic
      ? { manual_plan_tier: null, manual_plan_set_at: null, updated_at: updatedAt }
      : { manual_plan_tier: body.plan, manual_plan_set_at: updatedAt, updated_at: updatedAt };
    const result = existing
      ? await client.from("club_subscriptions").update(patch).eq("club_id", clubId)
      : resetToAutomatic
        ? { error: null }
        : await client.from("club_subscriptions").insert({
            club_id: clubId,
            plan_tier: "FREE",
            status: "ACTIVE",
            ...patch,
          });
    if (result.error) {
      console.error("[ADMIN CLUB PLANS] No se pudo guardar el plan:", result.error);
      return NextResponse.json({ success: false, error: "No se pudo guardar el plan del club." }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      plan: resetToAutomatic ? null : body.plan,
      source: resetToAutomatic ? "AUTOMATIC" : "MANUAL",
    });
  } catch {
    return NextResponse.json({ success: false, error: "No se pudo actualizar el plan del club." }, { status: 400 });
  }
}
