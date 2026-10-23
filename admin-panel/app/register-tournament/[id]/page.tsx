"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Trophy, CheckCircle2, User, Shield, AlertCircle, ArrowRight } from "lucide-react";
import { getDefaultWeightKg, getTournamentWeightCategories, getTournamentWeightModeLabel } from "@/lib/tournament-categories";

export default function PublicTournamentRegisterPage() {
  const routeParams = useParams<{ id: string }>();
  const routeTournamentId = routeParams.id;
  const [tournamentId, setTournamentId] = useState<string>("");
  const [tournament, setTournament] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    athleteName: "",
    clubName: "",
    category: "SENIOR_M_68",
    weightKg: "68",
    dni: "",
    email: "",
    phone: "",
  });
  const weightCategories = getTournamentWeightCategories(tournament?.category);

  useEffect(() => {
    if (!routeTournamentId) {
      setLoading(false);
      return;
    }

    setTournamentId(routeTournamentId);
    fetch("/api/v1/tournaments")
      .then((res) => res.json())
      .then((result) => {
        if (result.success && Array.isArray(result.data)) {
          const found = result.data.find((item: any) => item.id === routeTournamentId);
          setTournament(found || null);
          if (found) {
            const categories = getTournamentWeightCategories(found.category);
            setFormData((current) => {
              const category = categories.some((item) => item.value === current.category)
                ? current.category
                : categories[0].value;
              return {
                ...current,
                category,
                weightKg: String(category === current.category ? Number(current.weightKg) || getDefaultWeightKg(category) : getDefaultWeightKg(category)),
              };
            });
          }
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [routeTournamentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.athleteName.trim()) {
      setError("Introduce el nombre y apellidos del competidor.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/v1/tournaments/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          ...formData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || "No se pudo procesar la inscripción.");
      }
    } catch {
      setError("Error de conexión al enviar la inscripción.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
          <div className="h-10 w-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Inscripción Oficial de Torneo</h1>
            <p className="text-xs text-slate-400">
              {loading ? "Cargando evento..." : tournament?.name || "Competición World Taekwondo"}
            </p>
          </div>
        </div>

        {tournament && (
          <div className="mb-6 rounded-xl bg-slate-950 p-4 border border-slate-800/80 text-xs space-y-1">
            <div className="text-emerald-400 font-semibold">{tournament.name}</div>
            <div className="text-slate-400">Modalidad: {getTournamentWeightModeLabel(tournament.category)}</div>
            <div className="text-slate-400">Sede: {tournament.venue || "Pabellón Oficial"}</div>
            {tournament.date && (
              <div className="text-slate-400">
                Fecha del pesaje y combate: {new Date(tournament.date).toLocaleDateString()} {new Date(tournament.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <div className="pt-2">
              <a
                href={`/bracket/${tournament.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-semibold text-xs transition-colors"
              >
                <Trophy className="w-3.5 h-3.5" />
                Ver Cuadro Oficial / Bracket en Vivo
              </a>
            </div>
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Buscando el torneo...</p>
        ) : !tournament ? (
          <div className="py-8 text-center">
            <AlertCircle className="mx-auto h-10 w-10 text-amber-400" />
            <h2 className="mt-3 text-base font-bold text-white">Enlace de inscripción no disponible</h2>
            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-400">
              Este enlace no corresponde a un torneo guardado o el torneo ya no existe. Pide al organizador que guarde el torneo y te comparta el enlace nuevo.
            </p>
          </div>
        ) : success ? (
          <div className="text-center py-8 space-y-4">
            <div className="h-14 w-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-white">¡Inscripción Confirmada!</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Has quedado registrado en la competición. Tu pesaje y sorteo de bracket piramidal quedarán indexados en el sistema oficial.
            </p>
            <div className="pt-2">
              <a
                href={`/bracket/${tournamentId}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
              >
                <Trophy className="w-4 h-4" />
                Ver Bracket del Torneo
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/50 text-rose-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-400 mb-1">Nombre Completo del Deportista *</label>
              <input
                required
                type="text"
                placeholder="Ej. Carlos Ortiz Ramos"
                value={formData.athleteName}
                onChange={(e) => setFormData({ ...formData, athleteName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Club / Delegación *</label>
                <input
                  required
                  type="text"
                  placeholder="Club Taekwondo"
                  value={formData.clubName}
                  onChange={(e) => setFormData({ ...formData, clubName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">DNI / Licencia</label>
                <input
                  type="text"
                  placeholder="12345678X"
                  value={formData.dni}
                  onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">División de Peso (WT)</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value, weightKg: String(getDefaultWeightKg(e.target.value)) })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                >
                  {weightCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Peso Exacto Estimado (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weightKg}
                  onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Email de Contacto</label>
                <input
                  type="email"
                  placeholder="coach@club.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Teléfono</label>
                <input
                  type="tel"
                  placeholder="+34 600..."
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
            >
              {submitting ? "Procesando inscripción..." : "Confirmar Inscripción al Torneo"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
