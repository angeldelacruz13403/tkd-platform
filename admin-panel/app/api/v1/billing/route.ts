import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSession, forbidden, hasRole, unauthorized } from "@/lib/api-auth";
import { getClubPlan, resolveClubId } from "@/lib/entitlements";
import { getSupabaseClient } from "@/lib/supabase";
import { BillingInterval, ClubPlan } from "@/lib/types";
import {
  configuredBillingReturnUrl,
  getConfiguredStripePrice,
  getStripeClient,
  saveStripeSubscription,
} from "@/lib/stripe-billing";

function isClubPlan(value: unknown): value is ClubPlan {
  return value === "FREE" || value === "SEMIPRO" || value === "PRO";
}

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "MONTH" || value === "YEAR";
}

async function authorizedClub(request: Request, requestedClubId?: string) {
  const session = getSession(request);
  if (!session) return { response: unauthorized() } as const;
  if (!hasRole(session, "CLUB") && session.role !== "ADMIN") {
    return { response: forbidden() } as const;
  }
  const clubId = await resolveClubId(session.id, session.role, session.role === "ADMIN" ? requestedClubId || session.clubId : session.clubId);
  if (!clubId || (session.role !== "ADMIN" && requestedClubId && requestedClubId !== clubId)) {
    return { response: forbidden() } as const;
  }
  return { session, clubId } as const;
}

export async function GET(request: Request) {
  const authorization = await authorizedClub(request, new URL(request.url).searchParams.get("clubId") || undefined);
  if ("response" in authorization) return authorization.response;

  const { clubId } = authorization;
  const client = getSupabaseClient();
  if (client) {
    const { data, error } = await client
      .from("club_subscriptions")
      .select("plan_tier,manual_plan_tier,status,billing_interval,current_period_end,trial_ends_at,grace_ends_at,cancel_at_period_end,pending_plan_tier,pending_billing_interval")
      .eq("club_id", clubId)
      .maybeSingle();
    if (error) return NextResponse.json({ success: false, error: "No se pudo consultar la suscripción." }, { status: 503 });
    const subscription = data
      ? { ...data, plan_tier: data.manual_plan_tier || data.plan_tier, plan_source: data.manual_plan_tier ? "MANUAL" : "AUTOMATIC" }
      : { plan_tier: "FREE", status: "ACTIVE", plan_source: "AUTOMATIC" };
    return NextResponse.json({ success: true, subscription });
  }

  return NextResponse.json({ success: true, plan: await getClubPlan(clubId) });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const authorization = await authorizedClub(request, body.clubId);
    if ("response" in authorization) return authorization.response;
    if (!isClubPlan(body.plan) || !isBillingInterval(body.interval)) {
      return NextResponse.json({ success: false, error: "Plan o periodicidad no válidos." }, { status: 400 });
    }
    const requestedPlan: ClubPlan = body.plan;
    const requestedInterval: BillingInterval = body.interval;

    const stripe = getStripeClient();
    const client = getSupabaseClient();
    if (!stripe || !client) {
      return NextResponse.json({ success: false, error: "La facturación requiere STRIPE_SECRET_KEY y Supabase service role." }, { status: 503 });
    }
    let configuredPrice = null;
    if (requestedPlan !== "FREE") {
      try {
        configuredPrice = await getConfiguredStripePrice(stripe, requestedPlan, requestedInterval);
      } catch (priceError) {
        console.error("[BILLING POST] Precio Stripe no válido:", priceError);
        return NextResponse.json({ success: false, error: "El precio de Stripe no coincide con el plan configurado." }, { status: 503 });
      }
    }
    const priceId = configuredPrice?.id || null;
    if (requestedPlan !== "FREE" && !priceId) {
      return NextResponse.json({ success: false, error: `Falta configurar el precio Stripe para ${requestedPlan} ${requestedInterval}.` }, { status: 503 });
    }

    const { data: subscription, error: subscriptionError } = await client
      .from("club_subscriptions")
      .select("*")
      .eq("club_id", authorization.clubId)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    const baseUrl = configuredBillingReturnUrl();
    if (subscription?.stripe_subscription_id) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const currentItem = stripeSubscription.items.data[0];
      if (!currentItem) throw new Error("La suscripción de Stripe no contiene productos.");
      const currentPrice = currentItem.price.id;
      const currentPlan = subscription.plan_tier as ClubPlan;
      const ranks: Record<ClubPlan, number> = { FREE: 0, SEMIPRO: 1, PRO: 2 };

      if (requestedPlan === currentPlan && requestedInterval === subscription.billing_interval) {
        return NextResponse.json({ success: false, error: "El club ya tiene este plan y periodicidad." }, { status: 409 });
      }

      if (requestedPlan === "FREE") {
        await stripe.subscriptions.update(stripeSubscription.id, { cancel_at_period_end: true });
        const { error } = await client.from("club_subscriptions").update({
          cancel_at_period_end: true,
          pending_plan_tier: "FREE",
          pending_billing_interval: null,
          updated_at: new Date().toISOString(),
        }).eq("club_id", authorization.clubId);
        if (error) throw error;
        return NextResponse.json({ success: true, effective: "period_end", plan: "FREE" });
      }
      if (!priceId) throw new Error("No se pudo resolver el precio de Stripe.");

      if (ranks[requestedPlan] > ranks[currentPlan]) {
        const updated = await stripe.subscriptions.update(stripeSubscription.id, {
          items: [{ id: currentItem.id, price: priceId }],
          proration_behavior: "create_prorations",
          cancel_at_period_end: false,
        });
        await saveStripeSubscription(updated, authorization.clubId);
        return NextResponse.json({ success: true, effective: "immediately", plan: requestedPlan });
      }

      if (ranks[requestedPlan] < ranks[currentPlan] || requestedInterval !== subscription.billing_interval) {
        const currentEnd = currentItem.current_period_end;
        if (!currentEnd) throw new Error("Stripe no devolvió el fin del periodo actual.");
        const schedule = stripeSubscription.schedule
          ? await stripe.subscriptionSchedules.retrieve(
              typeof stripeSubscription.schedule === "string" ? stripeSubscription.schedule : stripeSubscription.schedule.id
            )
          : await stripe.subscriptionSchedules.create({ from_subscription: stripeSubscription.id });
        await stripe.subscriptionSchedules.update(schedule.id, {
          end_behavior: "release",
          phases: [
            {
              start_date: schedule.current_phase?.start_date ?? currentItem.current_period_start,
              end_date: currentEnd,
              items: [{ price: currentPrice, quantity: currentItem.quantity || 1 }],
            },
            {
              start_date: currentEnd,
              items: [{ price: priceId, quantity: currentItem.quantity || 1 }],
            },
          ],
        });
        const { error } = await client.from("club_subscriptions").update({
          stripe_schedule_id: schedule.id,
          pending_plan_tier: requestedPlan,
          pending_billing_interval: requestedInterval,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }).eq("club_id", authorization.clubId);
        if (error) throw error;
        return NextResponse.json({ success: true, effective: "period_end", plan: requestedPlan });
      }
    }

    if (requestedPlan === "FREE") {
      return NextResponse.json({ success: false, error: "El club ya está en el plan Gratuito." }, { status: 409 });
    }
    if (!priceId) throw new Error("No se pudo resolver el precio de Stripe.");

    const { data: user, error: userError } = await client
      .from("users")
      .select("email,name")
      .eq("id", authorization.session.id)
      .maybeSingle();
    if (userError) throw userError;
    if (!user?.email) {
      return NextResponse.json({ success: false, error: "La cuenta debe tener un email para iniciar la facturación." }, { status: 400 });
    }

    let customerId = subscription?.stripe_customer_id as string | null;
    if (!customerId) {
      const { data: club, error: clubError } = await client
        .from("clubs")
        .select("name")
        .eq("id", authorization.clubId)
        .maybeSingle();
      if (clubError) throw clubError;
      const customer = await stripe.customers.create({
        email: user.email,
        name: club?.name || user.name || undefined,
        metadata: { clubId: authorization.clubId },
      }, { idempotencyKey: `club-customer-${authorization.clubId}` });
      customerId = customer.id;
      const { error } = await client.from("club_subscriptions").upsert({
        club_id: authorization.clubId,
        plan_tier: subscription?.plan_tier || "FREE",
        status: subscription?.status || "ACTIVE",
        stripe_customer_id: customerId,
      }, { onConflict: "club_id" });
      if (error) throw error;
    }

    const startProTrial = requestedPlan === "PRO" && !subscription?.trial_used_at && !subscription?.stripe_subscription_id;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      payment_method_collection: startProTrial ? "if_required" : "always",
      subscription_data: {
        ...(startProTrial ? {
          trial_period_days: 30,
          trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        } : {}),
        metadata: { clubId: authorization.clubId, plan: requestedPlan, interval: requestedInterval },
      },
      metadata: { clubId: authorization.clubId, requestedBy: authorization.session.id },
      success_url: `${baseUrl}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}?billing=cancelled`,
    }, { idempotencyKey: `checkout-${authorization.clubId}-${randomUUID()}` });

    return NextResponse.json({ success: true, checkoutUrl: checkout.url });
  } catch (error) {
    console.error("[BILLING POST] No se pudo iniciar el checkout de Stripe:", error);
    return NextResponse.json({ success: false, error: "No se pudo iniciar el proceso de facturación." }, { status: 500 });
  }
}
