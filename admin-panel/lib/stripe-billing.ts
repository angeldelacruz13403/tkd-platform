import Stripe from "stripe";
import { BillingInterval, ClubPlan, SubscriptionStatus } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase";
import { PLAN_PRICES_EUR } from "@/lib/entitlements";

let stripeInstance: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeInstance) stripeInstance = new Stripe(secretKey);
  return stripeInstance;
}

export function getStripePriceId(plan: Exclude<ClubPlan, "FREE">, interval: BillingInterval): string | null {
  const key = `STRIPE_PRICE_${plan}_${interval}`;
  return process.env[key] || null;
}

export async function getConfiguredStripePrice(
  stripe: Stripe,
  plan: Exclude<ClubPlan, "FREE">,
  interval: BillingInterval
): Promise<Stripe.Price | null> {
  const priceId = getStripePriceId(plan, interval);
  if (!priceId) return null;
  const price = await stripe.prices.retrieve(priceId);
  const expectedInterval = interval === "MONTH" ? "month" : "year";
  if (
    !price.active ||
    price.currency !== "eur" ||
    price.unit_amount !== PLAN_PRICES_EUR[plan][interval] ||
    price.recurring?.interval !== expectedInterval ||
    price.recurring.interval_count !== 1
  ) {
    throw new Error(`El precio Stripe ${plan} ${interval} no coincide con el importe recurrente esperado.`);
  }
  return price;
}

export function getPlanForStripePrice(priceId?: string | null): { plan: ClubPlan; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const plan of ["SEMIPRO", "PRO"] as const) {
    for (const interval of ["MONTH", "YEAR"] as const) {
      if (getStripePriceId(plan, interval) === priceId) return { plan, interval };
    }
  }
  return null;
}

export function toSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === "trialing") return "TRIALING";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "PAST_DUE";
  if (status === "canceled" || status === "incomplete_expired") return "CANCELED";
  return "ACTIVE";
}

export async function saveStripeSubscription(subscription: Stripe.Subscription, explicitClubId?: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase service role debe estar configurado para procesar facturación.");

  const clubId = explicitClubId || subscription.metadata.clubId;
  if (!clubId) throw new Error("La suscripción de Stripe no contiene clubId.");

  const item = subscription.items.data[0];
  const mappedPrice = getPlanForStripePrice(item?.price.id);
  if (!mappedPrice) throw new Error("El precio de Stripe no está asociado a un plan configurado.");

  const { data: previous, error: lookupError } = await client
    .from("club_subscriptions")
    .select("trial_used_at,grace_ends_at")
    .eq("club_id", clubId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString()
    : null;
  const currentPeriodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000).toISOString()
    : null;
  const status = toSubscriptionStatus(subscription.status);
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;
  const graceEndsAt = status === "PAST_DUE"
    ? previous?.grace_ends_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const expiredTrial = status === "CANCELED" && subscription.status === "canceled";
  const planTier = expiredTrial ? "FREE" : mappedPrice.plan;

  const { error } = await client.from("club_subscriptions").upsert({
    club_id: clubId,
    plan_tier: planTier,
    status,
    billing_interval: mappedPrice.interval,
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    stripe_schedule_id: typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule?.id || null,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    grace_ends_at: graceEndsAt,
    cancel_at_period_end: cancelAtPeriodEnd,
    pending_plan_tier: null,
    pending_billing_interval: null,
    trial_used_at: subscription.trial_start
      ? previous?.trial_used_at || new Date(subscription.trial_start * 1000).toISOString()
      : previous?.trial_used_at || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "club_id" });
  if (error) throw error;
}

export function subscriptionClubId(subscription: Stripe.Subscription): string | null {
  return subscription.metadata.clubId || null;
}

export function configuredBillingReturnUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL debe estar configurado.");
  return new URL("/billing", base).toString();
}
