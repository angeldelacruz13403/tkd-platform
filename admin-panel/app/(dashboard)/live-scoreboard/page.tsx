"use client";

import { useEffect, useState } from "react";
import { Activity, Plus, Radio, X } from "lucide-react";
import { DaedoScoreboard } from "@/components/DaedoScoreboard";

const STORAGE_KEY = "tkd-live-mats";

export default function LiveScoreboardPage() {
  const [mats, setMats] = useState<string[]>(["1"]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved) && saved.length) setMats(saved.map(String));
    } catch { /* keep default */ }
  }, []);

  const save = (next: string[]) => {
    setMats(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addMat = () => {
    const next = String(Math.max(0, ...mats.map((m) => Number(m) || 0)) + 1);
    save([...mats, next]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
            <Activity className="h-6 w-6 text-rose-400" />
            Marcadores en vivo
          </h2>
          <p className="text-xs text-slate-400">Un marcador por tapiz, cada uno recibido desde su puente TkStrike / Daedo (DAEDO_MAT)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addMat} className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/30 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-900/40">
            <Plus className="h-4 w-4" /> Añadir tapiz
          </button>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            <Radio className="h-4 w-4" />
            Tiempo real
          </div>
        </div>
      </div>
      {mats.map((mat) => (
        <section key={mat} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">Tapiz {mat}</h3>
            {mats.length > 1 && (
              <button onClick={() => save(mats.filter((m) => m !== mat))} aria-label={`Quitar tapiz ${mat}`} className="rounded p-1 text-slate-500 hover:text-rose-400">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <DaedoScoreboard mat={mat} />
        </section>
      ))}
    </div>
  );
}
