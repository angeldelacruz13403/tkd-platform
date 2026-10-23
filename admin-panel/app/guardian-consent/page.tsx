"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ConsentRequest = { guardianName: string; athleteName: string; policyVersion: string; expiresAt: string };

function GuardianConsentContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [request, setRequest] = useState<ConsentRequest | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/v1/guardian-consent?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "No se pudo consultar la solicitud.");
        setRequest(result);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Enlace no válido."));
  }, [token]);

  const grant = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/guardian-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo registrar el consentimiento.");
      setDone(true);
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : "No se pudo registrar el consentimiento.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#06090f] px-4 py-16 text-slate-100">
      <section className="mx-auto max-w-xl space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-7">
        <h1 className="text-2xl font-bold">Consentimiento del tutor</h1>
        {error && <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
        {done ? (
          <p role="status" className="text-emerald-200">Consentimiento registrado. El club podrá activar la función de gamificación para el perfil.</p>
        ) : request ? (
          <>
            <p className="text-sm leading-6 text-slate-300">
              Hola {request.guardianName}. Al aceptar, autorizas que TKD Global Hub habilite para {request.athleteName} un perfil de gamificación con logros deportivos y nivel, visible para el atleta y las personas autorizadas de su club.
            </p>
            <p className="text-xs text-slate-400">Versión de política: {request.policyVersion} · Enlace válido hasta {new Date(request.expiresAt).toLocaleString()}.</p>
            <button disabled={busy} onClick={() => void grant()} className="w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-50">Doy mi consentimiento</button>
          </>
        ) : !error ? <p className="text-sm text-slate-400">Validando el enlace…</p> : null}
      </section>
    </main>
  );
}

export default function GuardianConsentPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#06090f] p-8 text-slate-400">Cargando solicitud de consentimiento…</main>}>
      <GuardianConsentContent />
    </Suspense>
  );
}
