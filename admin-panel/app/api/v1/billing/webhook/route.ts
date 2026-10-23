import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { getStripeClient, saveStripeSubscription } from "@/lib/stripe-billing";

export const runtime = "nodejs";

async function updateFailedInvoice(invoice: Stripe.Invoice) {
  const stripe = getStripeClient();
  const client = getSupabaseClient();
  if (!stripe || !client) throw new Error("Stripe y Supabase deben estar configurados.");
  const invoiceWithSubscription = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const subscriptionId = typeof invoiceWithSubscription.subscription === "string"
    ? invoiceWithSubscription.subscription
    : invoiceWithSubscription.subscription?.id;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await saveStripeSubscription(subscription);
  const clubId = subscription.metadata.clubId;
  if (clubId && invoice.status !== "paid") {
    const graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await client
      .from("club_subscriptions")
      .update({ status: "PAST_DUE", grace_ends_at: graceEndsAt, updated_at: new Date().toISOString() })
      .eq("club_id", clubId);
    if (error) throw error;
  }
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const client = getSupabaseClient();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !client || !signature || !webhookSecret) {
    return NextResponse.json({ success: false, error: "Configuración del webhook incompleta." }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.warn("[STRIPE WEBHOOK] Firma no válida:", error);
    return NextResponse.json({ success: false, error: "Firma Stripe no válida." }, { status: 400 });
  }

  const { data: alreadyProcessed, error: lookupError } = await client
    .from("stripe_webhook_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (lookupError) {
    console.error("[STRIPE WEBHOOK] No se pudo comprobar idempotencia:", lookupError);
    return NextResponse.json({ success: false, error: "No se pudo validar el evento." }, { status: 503 });
  }
  if (alreadyProcessed) return NextResponse.json({ received: true, duplicate: true });

  try {
    if (event.type.startsWith("customer.subscription.")) {
      await saveStripeSubscription(event.data.object as Stripe.Subscription);
    } else if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
      await updateFailedInvoice(event.data.object as Stripe.Invoice);
    } else if (event.type === "checkout.session.completed") {
      const checkout = event.data.object as Stripe.Checkout.Session;
      if (checkout.subscription) {
        const subscriptionId = typeof checkout.subscription === "string" ? checkout.subscription : checkout.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await saveStripeSubscription(subscription, String(checkout.metadata?.clubId || ""));
      }
    }

    const { error: insertError } = await client.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
    });
    if (insertError && insertError.code !== "23505") throw insertError;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[STRIPE WEBHOOK] No se pudo procesar el evento:", event.id, error);
    return NextResponse.json({ success: false, error: "No se pudo procesar el evento." }, { status: 500 });
  }
}
