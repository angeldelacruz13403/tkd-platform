"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, LoaderCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type Subscription = {
  plan_tier?: "FREE" | "SEMIPRO" | "PRO";
  status?: string;
  billing_interval?: "MONTH" | "YEAR";
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
  cancel_at_period_end?: boolean;
  pending_plan_tier?: string | null;
};

const offers = [
  { plan: "SEMIPRO", interval: "MONTH", price: "19,99 € / mes" },
  { plan: "SEMIPRO", interval: "YEAR", price: "219,99 € / año" },
  { plan: "PRO", interval: "MONTH", price: "29,99 € / mes" },
  { plan: "PRO", interval: "YEAR", price: "329,99 € / año" },
] as const;

export default function BillingPage() {
  const { role, user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/v1/billing");
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo consultar el plan.");
      setSubscription(result.subscription || { plan_tier: result.plan || "FREE", status: "ACTIVE" });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo consultar el plan.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const checkout = async (plan: string, interval: string) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/v1/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo cambiar el plan.");
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setMessage(result.effective === "period_end"
        ? `El cambio al plan ${result.plan} se aplicará al finalizar el periodo actual.`
        : `El plan ${result.plan} se ha actualizado.`);
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo cambiar el plan.");
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/billing/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo abrir la facturación.");
      window.location.assign(result.portalUrl);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "No se pudo abrir la facturación.");
    } finally {
      setBusy(false);
    }
  };

  if (role !== "CLUB" && role !== "ADMIN" && !(role === "COACH" && user?.isClubDirector === true)) {
    return <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-5 text-rose-200">Solo el club puede gestionar su plan.</div>;
  }

  const plan = subscription?.plan_tier || "FREE";
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><CreditCard className="h-6 w-6 text-sky-400" /> Plan y facturación</h1>
        <p className="mt-1 text-sm text-slate-400">Precios en EUR. El IVA aplicable se calcula en el pago.</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3 text-sm text-emerald-200">{message}</p>}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <p className="text-xs uppercase tracking-widest text-slate-400">Plan actual</p>
        <p className="mt-2 text-3xl font-bold text-white">{plan}</p>
        <p className="mt-2 text-sm text-slate-300">
          Estado: {subscription?.status || "Cargando"}
          {subscription?.current_period_end && ` · Fin del periodo: ${new Date(subscription.current_period_end).toLocaleDateString()}`}
          {subscription?.trial_ends_at && ` · Fin de prueba: ${new Date(subscription.trial_ends_at).toLocaleDateString()}`}
          {subscription?.grace_ends_at && ` · Fin de gracia: ${new Date(subscription.grace_ends_at).toLocaleDateString()}`}
          {subscription?.cancel_at_period_end && " · Cancelación al final del periodo"}
          {subscription?.pending_plan_tier && ` · Próximo plan: ${subscription.pending_plan_tier}`}
        </p>
        {subscription?.plan_tier !== "FREE" && (
          <button disabled={busy} onClick={openPortal} className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50">
            Abrir portal de facturación
          </button>
        )}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {offers.map((offer) => (
          <article key={`${offer.plan}-${offer.interval}`} className={`rounded-2xl border p-5 ${plan === offer.plan ? "border-sky-500/60 bg-sky-950/20" : "border-slate-800 bg-slate-900/50"}`}>
            <div className="flex items-start justify-between">
              <div><h2 className="text-lg font-bold text-white">{offer.plan}</h2><p className="mt-1 text-sm text-slate-400">{offer.price}</p></div>
              {offer.plan === "PRO" && <span className="rounded-full bg-amber-950 px-2 py-1 text-xs text-amber-300">Prueba inicial 30 días</span>}
            </div>
            <button disabled={busy || (plan === offer.plan && subscription?.billing_interval === offer.interval)} onClick={() => void checkout(offer.plan, offer.interval)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {plan === offer.plan && subscription?.billing_interval === offer.interval ? "Plan actual" : plan === offer.plan ? "Cambiar periodicidad" : "Elegir plan"}
            </button>
          </article>
        ))}
      </section>
      {plan !== "FREE" && (
        <button disabled={busy || subscription?.cancel_at_period_end} onClick={() => void checkout("FREE", subscription?.billing_interval || "MONTH")}
          className="rounded-lg border border-rose-900 px-4 py-2 text-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-50">
          {subscription?.cancel_at_period_end ? "Cancelación programada" : "Cancelar al final del periodo"}
        </button>
      )}
    </div>
  );
}
