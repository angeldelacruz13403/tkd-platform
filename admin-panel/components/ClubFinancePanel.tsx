"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Athlete, ClubFinanceEntry } from "@/lib/types";

type Summary = { month: string; income: number; expenses: number; balance: number; pending: number };

export default function ClubFinancePanel() {
  const { role } = useAuth();
  const canManage = role === "ADMIN" || role === "COACH" || role === "CLUB";
  const [entries, setEntries] = useState<ClubFinanceEntry[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const response = await fetch(`/api/v1/finance?month=${encodeURIComponent(month)}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudieron cargar las finanzas.");
      setEntries(result.entries || []);
      setSummary(result.summary || null);
      if (canManage) {
        const athleteResponse = await fetch("/api/v1/athletes");
        const athleteResult = await athleteResponse.json();
        if (athleteResponse.ok && athleteResult.success) setAthletes(athleteResult.data || []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las finanzas.");
    }
  }, [month, canManage]);

  useEffect(() => { void load(); }, [load]);

  const createEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType: form.get("entryType"),
          description: form.get("description"),
          amount: Number(form.get("amount")),
          athleteId: form.get("athleteId") || undefined,
          dueDate: form.get("dueDate") || undefined,
          occurredAt: form.get("occurredAt"),
          status: form.get("status"),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo registrar el movimiento.");
      event.currentTarget.reset();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo registrar el movimiento.");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (entry: ClubFinanceEntry) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/finance/${encodeURIComponent(entry.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo actualizar el pago.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar el pago.");
    } finally {
      setBusy(false);
    }
  };

  const currency = (amount: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(amount);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Wallet className="h-6 w-6 text-emerald-400" /> Finanzas del club</h1>
        <p className="mt-1 text-sm text-slate-400">Los pagos de cuotas se registran manualmente.</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      <label className="flex items-center gap-3 text-sm text-slate-300">Mes del resumen
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
      </label>
      {summary && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Ingresos", summary.income],
            ["Gastos", summary.expenses],
            ["Balance", summary.balance],
            ["Pendiente", summary.pending],
          ].map(([label, amount]) => (
            <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase text-slate-400">{label}</p><p className="mt-2 text-xl font-bold text-white">{currency(Number(amount))}</p>
            </div>
          ))}
        </section>
      )}
      {canManage && (
        <form onSubmit={(event) => void createEntry(event)} className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="text-lg font-semibold text-white sm:col-span-2 lg:col-span-3">Registrar movimiento</h2>
          <select name="entryType" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white">
            <option value="STUDENT_DUE">Cuota de alumno</option><option value="INCOME">Ingreso</option><option value="EXPENSE">Gasto</option>
          </select>
          <input name="description" required maxLength={255} placeholder="Descripción" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Importe (€)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          <select name="athleteId" defaultValue="" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white">
            <option value="">Alumno (solo cuotas)</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.fullName}</option>)}
          </select>
          <input name="dueDate" type="date" aria-label="Fecha de vencimiento de la cuota" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          <input name="occurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" />
          <select name="status" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white">
            <option value="PAID">Pagado</option><option value="PENDING">Pendiente</option>
          </select>
          <button disabled={busy} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 lg:col-span-2">Guardar movimiento</button>
        </form>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-800">
        <div className="border-b border-slate-800 bg-slate-900/70 p-4 font-semibold text-white">Movimientos y cuotas</div>
        <div className="divide-y divide-slate-800">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-white">{entry.description}</p>
                <p className="text-xs text-slate-400">{entry.entryType} · {entry.status} · {entry.occurredAt}{entry.dueDate ? ` · Vence ${entry.dueDate}` : ""}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-white">{currency(entry.amount)}</span>
                {canManage && entry.entryType === "STUDENT_DUE" && entry.status === "PENDING" && <button disabled={busy} onClick={() => void markPaid(entry)} className="rounded-lg border border-emerald-800 px-3 py-1.5 text-xs text-emerald-300">Registrar pago</button>}
              </div>
            </div>
          ))}
          {!entries.length && <p className="p-6 text-center text-sm text-slate-400">No hay movimientos para mostrar.</p>}
        </div>
      </section>
    </div>
  );
}
