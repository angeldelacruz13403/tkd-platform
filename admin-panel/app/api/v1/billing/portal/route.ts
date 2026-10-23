import { NextResponse } from "next/server";
import { getSession, forbidden, hasRole, unauthorized } from "@/lib/api-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { resolveClubId } from "@/lib/entitlements";
import { configuredBillingReturnUrl, getStripeClient } from "@/lib/stripe-billing";

export async function POST(request: Request) {
  const session = getSession(request);
  if (!session) return unauthorized();
  if (!hasRole(session, "CLUB") && session.role !== "ADMIN") return forbidden();

  const client = getSupabaseClient();
  const stripe = getStripeClient();
  if (!client || !stripe) {
    return NextResponse.json({ success: false, error: "La facturación requiere Stripe y Supabase service role." }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const clubId = session.role === "ADMIN"
      ? body.clubId
      : await resolveClubId(session.id, session.role, session.clubId || undefined);
    if (!clubId) return forbidden();

    const { data, error } = await client
      .from("club_subscriptions")
      .select("stripe_customer_id")
      .eq("club_id", clubId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.stripe_customer_id) {
      return NextResponse.json({ success: false, error: "Este club todavía no tiene un cliente de facturación." }, { status: 404 });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: configuredBillingReturnUrl(),
    });
    return NextResponse.json({ success: true, portalUrl: portal.url });
  } catch (error) {
    console.error("[BILLING PORTAL] No se pudo crear el portal:", error);
    return NextResponse.json({ success: false, error: "No se pudo abrir el portal de facturación." }, { status: 500 });
  }
}
