"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, CalendarPlus, Check, Send, ShieldCheck, UserRound } from "lucide-react";

type AthleteOption = {
  id: string;
  fullName: string;
  category?: string;
  isCompetitor?: boolean;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const greeting: ChatMessage = {
  role: "assistant",
  content:
    "Soy el Coach Táctico IA. Cuéntame tu idea para el entrenamiento, el combate o la semana de un competidor y la desarrollo yo: plan, ejercicios, progresión y correcciones. Si eliges un atleta, uso sus datos. Mis propuestas no se aplican ni publican automáticamente.",
};

export default function CopilotChat() {
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [draft, setDraft] = useState("");
  const [loadingAthletes, setLoadingAthletes] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endOfMessages = useRef<HTMLDivElement>(null);
  const [planDate, setPlanDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [planTarget, setPlanTarget] = useState("ALL");
  const [savingPlan, setSavingPlan] = useState<number | null>(null);
  const [savedPlans, setSavedPlans] = useState<number[]>([]);

  const scheduleTraining = async (index: number, content: string) => {
    const firstLine = content.split("\n").find((line) => line.trim()) || "Entrenamiento IA";
    const title = firstLine.replace(/^[#>*\-\s]+/, "").replace(/\*+/g, "").trim().slice(0, 120) || "Entrenamiento IA";
    setSavingPlan(index);
    setError("");
    try {
      const targets = planTarget === "ALL" ? athletes.map((athlete) => athlete.id) : [planTarget];
      if (targets.length === 0) throw new Error("No hay atletas a los que programar el entrenamiento.");
      for (const target of targets) {
        const response = await fetch("/api/v1/trainings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            athleteId: target,
            date: new Date(`${planDate}T12:00:00`).toISOString(),
            durationMinutes: 60,
            type: "SPARRING_TACTICAL",
            status: "SCHEDULED",
            tacticalNotes: content.slice(0, 4_000),
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "No se pudo programar el entrenamiento.");
      }
      setSavedPlans((current) => [...current, index]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo programar el entrenamiento.");
    } finally {
      setSavingPlan(null);
    }
  };

  useEffect(() => {
    let active = true;
    fetch("/api/v1/athletes")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "No se pudieron cargar los atletas.");
        }
        if (active) {
          const records = result.data as AthleteOption[];
          setAthletes(records);
          
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "No se pudieron cargar los atletas.");
        }
      })
      .finally(() => {
        if (active) setLoadingAthletes(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = draft.trim();
    if (!prompt || sending) return;

    const history = messages.slice(-8).map((message) => ({
      ...message,
      content: message.content.slice(0, 2_000),
    }));
    const userMessage: ChatMessage = { role: "user", content: prompt };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setError("");
    setSending(true);
    try {
      const response = await fetch("/api/v1/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, athleteId: athleteId || undefined, history }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || typeof result.answer !== "string") {
        throw new Error(result.error || "No se pudo obtener una respuesta.");
      }
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo obtener una respuesta.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-slate-400">
          Dale tu idea al Coach Táctico IA y la desarrolla: entrenamientos, semanas de competidores y trabajos de corrección.
        </p>
        <label className="min-w-56 text-xs font-medium text-slate-300">
          Contexto del atleta
          <select
            value={athleteId}
            onChange={(event) => setAthleteId(event.target.value)}
            disabled={loadingAthletes || athletes.length === 0}
            className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-500"
          >
            <option value="">Todos los atletas / general</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.fullName}{athlete.category ? ` · ${athlete.category}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="flex min-h-[30rem] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-3 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          Acceso autenticado · Solo programa un entrenamiento cuando pulsas «Programar este plan»
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "assistant" && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div className="max-w-[85%]">
              <p className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "bg-sky-700 text-white"
                  : "border border-slate-800 bg-slate-900 text-slate-200"
              }`}>
                {message.content}
              </p>
              {message.role === "assistant" && index > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {savedPlans.includes(index) ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Check className="h-4 w-4" /> Programado en Entrenamientos
                    </span>
                  ) : (
                    <>
                      <select value={planTarget} onChange={(event) => setPlanTarget(event.target.value)} aria-label="Atleta destino" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-white"><option value="ALL">Todos los atletas</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.fullName}</option>)}</select>
                      <input type="date" value={planDate} onChange={(event) => setPlanDate(event.target.value)} aria-label="Fecha del entrenamiento" className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-white" />
                      <button type="button" onClick={() => scheduleTraining(index, message.content)} disabled={savingPlan === index} className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
                        <CalendarPlus className="h-4 w-4" />
                        {savingPlan === index ? "Guardando…" : "Programar este plan"}
                      </button>
                    </>
                  )}
                </div>
              )}
              </div>
              {message.role === "user" && (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                  <UserRound className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
          {sending && <p className="pl-11 text-xs text-slate-500">El Coach Táctico IA está preparando una respuesta…</p>}
          <div ref={endOfMessages} />
        </div>
        {error && <p role="alert" className="mx-5 mb-3 rounded-lg border border-rose-800 bg-rose-950/50 px-3 py-2 text-sm text-rose-300">{error}</p>}
        <form onSubmit={sendMessage} className="flex gap-3 border-t border-slate-800 p-4">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2_000}
            rows={2}
            placeholder="Escribe tu idea de entrenamiento y la IA la desarrolla…"
            aria-label="Mensaje para el Coach Táctico IA"
            className="min-h-12 flex-1 resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="flex h-12 shrink-0 items-center gap-2 self-end rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            Enviar
          </button>
        </form>
        <p className="border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
          Para revisar o publicar planes y correcciones propuestas, utiliza{" "}
          <Link href="/ai-studio" className="font-semibold text-sky-400 hover:text-sky-300">
            AI Studio
          </Link>
          .
        </p>
      </section>
    </div>
  );
}



