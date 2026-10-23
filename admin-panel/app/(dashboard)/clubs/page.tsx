"use client";

import { useEffect, useState } from "react";
import { Layers, Plus, Search, MapPin, Users, Award, Building, CheckCircle2, Edit2, Trash2, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { Club, ClubPlan, Coach } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { useAuth } from "@/lib/auth-context";

const PAGE_SIZE = 6;

type ClubPlanInfo = {
  id: string;
  plan: ClubPlan;
  automatedPlan: ClubPlan;
  isManual: boolean;
  manualPlanSetAt: string | null;
  status: string;
};

async function fetchClubPlans(): Promise<ClubPlanInfo[]> {
  const response = await fetch("/api/v1/admin/club-plans");
  const result = await response.json();
  if (!response.ok || !result.success || !Array.isArray(result.data)) {
    throw new Error(result.error || "No se pudieron cargar los planes de los clubes.");
  }
  return result.data as ClubPlanInfo[];
}

export default function ClubsPage() {
  const toast = useToast();
  const { role, isLoading: authLoading } = useAuth();
  const [clubs, setClubs] = useState<Club[]>(db.clubs);
  const [coaches, setCoaches] = useState<Coach[]>(db.coaches);
  const [clubPlans, setClubPlans] = useState<Record<string, ClubPlanInfo>>({});
  const [draftPlans, setDraftPlans] = useState<Record<string, ClubPlan>>({});
  const [planError, setPlanError] = useState("");
  const [savingPlanFor, setSavingPlanFor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    dojangAddress: "",
    city: "Madrid",
    federationCode: "",
    coachId: "",
    directorName: "",
    athletesCount: 0,
    coachesCount: 1,
    foundedYear: 2018,
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Club | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/clubs")
      .then((response) => response.json())
      .then((result) => { if (active && result.success) setClubs(result.data || []); })
      .catch(() => undefined);
    fetch("/api/v1/coaches")
      .then((response) => response.json())
      .then((result) => { if (active && result.success) setCoaches(result.data || []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (authLoading || role !== "ADMIN") return;
    let active = true;
    fetchClubPlans()
      .then((plans) => {
        if (!active) return;
        setClubPlans(Object.fromEntries(plans.map((plan) => [plan.id, plan])));
        setDraftPlans(Object.fromEntries(plans.map((plan) => [plan.id, plan.plan])));
        setPlanError("");
      })
      .catch((error: unknown) => {
        if (active) setPlanError(error instanceof Error ? error.message : "No se pudieron cargar los planes de los clubes.");
      });
    return () => { active = false; };
  }, [authLoading, role]);

  const saveClubPlan = async (club: Club, plan: ClubPlan | null) => {
    setSavingPlanFor(club.id);
    setPlanError("");
    try {
      const response = await fetch("/api/v1/admin/club-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId: club.id, plan }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo guardar el plan.");
      const plans = await fetchClubPlans();
      setClubPlans(Object.fromEntries(plans.map((item) => [item.id, item])));
      setDraftPlans(Object.fromEntries(plans.map((item) => [item.id, item.plan])));
      toast.success(
        plan === null ? "Plan automático restaurado" : "Plan manual actualizado",
        plan === null ? `El plan de ${club.name} volverá a depender de la suscripción.` : `${club.name}: ${plan}.`
      );
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "No se pudo guardar el plan.");
    } finally {
      setSavingPlanFor(null);
    }
  };

  const filteredClubs = clubs.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.federationCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.directorName && c.directorName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredClubs.length / PAGE_SIZE) || 1;
  const paginatedClubs = filteredClubs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openCreateModal = () => {
    setEditingClub(null);
    setFormData({
      name: "",
      dojangAddress: "Calle Deportiva 1",
      city: "Madrid",
      federationCode: `FED-MAD-${Math.floor(1000 + Math.random() * 9000)}`,
      coachId: "",
      directorName: "",
      athletesCount: 0,
      coachesCount: 1,
      foundedYear: 2018,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (club: Club) => {
    setEditingClub(club);
    const matchedCoach = coaches.find((c) => c.id === club.coachId);
    setFormData({
      name: club.name,
      dojangAddress: club.dojangAddress,
      city: club.city,
      federationCode: club.federationCode,
      coachId: club.coachId || matchedCoach?.id || "",
      directorName: club.directorName || matchedCoach?.fullName || "",
      athletesCount: club.athletesCount,
      coachesCount: Math.max(1, club.coachesCount),
      foundedYear: club.foundedYear,
    });
    setIsModalOpen(true);
  };

  const handleSaveClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.warning("Nombre obligatorio", "Introduce el nombre oficial del club.");
      return;
    }
    if (!formData.coachId) {
      toast.warning("Entrenador obligatorio", "Debes seleccionar obligatoriamente un entrenador de los que ya están creados.");
      return;
    }

    try {
      if (editingClub) {
        const res = await fetch("/api/v1/clubs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingClub.id,
            ...formData,
          }),
        });
        const result = await res.json();
        if (result.success) {
          setClubs(clubs.map((c) => (c.id === editingClub.id ? result.data : c)));
          toast.success("Club actualizado", `${result.data.name} modificado con su entrenador.`);
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      } else {
        const res = await fetch("/api/v1/clubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (result.success) {
          setClubs([...clubs, result.data]);
          toast.success("Club registrado", `${result.data.name} creado y asignado al entrenador.`);
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      }
    } catch {
      toast.error("Error de red", "No se pudo conectar con el servidor.");
    }
  };

  const handleDeleteClub = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/clubs?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setClubs(clubs.filter((c) => c.id !== deleteTarget.id));
        toast.success("Club eliminado", `${deleteTarget.name} ha sido dado de baja.`);
        setDeleteTarget(null);
      } else {
        toast.error("Error al eliminar", result.error);
      }
    } catch {
      toast.error("Error", "No se pudo eliminar el club.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-sky-400" />
            Gestión de Clubes, Dojangs & Sedes
          </h2>
          <p className="text-xs text-slate-400">
            Censo federativo, instalaciones, licencias de dojang y atletas afiliados
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Registrar Dojang / Club
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar club por nombre, ciudad o código..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {planError && role === "ADMIN" && (
        <p role="alert" className="rounded-lg border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{planError}</p>
      )}

      {/* Clubs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedClubs.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs">
            No se encontraron clubes que coincidan con la búsqueda.
          </div>
        ) : (
          paginatedClubs.map((club) => (
            <div
              key={club.id}
              className="glass-panel rounded-2xl border border-slate-800 p-6 flex flex-col justify-between hover:border-sky-500/40 transition-all shadow-xl"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black border border-amber-500/30 text-base">
                      <Building className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight">{club.name}</h3>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-sky-400" />
                        {club.city}, España
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-sky-400 border border-slate-700 font-mono">
                    {club.federationCode}
                  </span>
                </div>

                <div className="space-y-2 text-xs mb-4">
                  <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Entrenador Responsable:</span>
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                      {club.directorName || club.coachName || "Sin asignar"}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Dirección:</span>
                    <span className="text-slate-300 truncate max-w-[170px]">{club.dojangAddress}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Atletas Federados:</span>
                    <span className="font-bold text-emerald-400 font-mono">{club.athletesCount}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Entrenadores:</span>
                    <span className="font-bold text-sky-400 font-mono">{club.coachesCount}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Año de Fundación:</span>
                    <span className="font-mono text-slate-300">{club.foundedYear}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Afiliación federativa activa y al corriente</span>
                </div>
                {role === "ADMIN" && (
                  <div className="mt-3 space-y-2 rounded-lg border border-amber-800/50 bg-amber-950/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-amber-200">Plan del club</span>
                      {clubPlans[club.id] ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${clubPlans[club.id].isManual ? "bg-amber-900/60 text-amber-200" : "bg-slate-800 text-slate-300"}`}>
                          {clubPlans[club.id].isManual ? "Manual" : "Automático"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Cargando…</span>
                      )}
                    </div>
                    {clubPlans[club.id] && (
                      <>
                        <p className="text-[10px] text-slate-400">
                          Plan actual: <strong className="text-white">{clubPlans[club.id].plan}</strong>
                          {!clubPlans[club.id].isManual && ` · Suscripción: ${clubPlans[club.id].automatedPlan}`}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`Plan de ${club.name}`}
                            value={draftPlans[club.id] || clubPlans[club.id].plan}
                            onChange={(event) => setDraftPlans({ ...draftPlans, [club.id]: event.target.value as ClubPlan })}
                            className="min-w-28 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                          >
                            <option value="FREE">FREE</option>
                            <option value="SEMIPRO">SEMIPRO</option>
                            <option value="PRO">PRO</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => void saveClubPlan(club, draftPlans[club.id] || clubPlans[club.id].plan)}
                            disabled={savingPlanFor === club.id || (clubPlans[club.id].isManual && draftPlans[club.id] === clubPlans[club.id].plan)}
                            className="rounded-lg bg-sky-700 px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50"
                          >
                            Guardar plan
                          </button>
                          {clubPlans[club.id].isManual && (
                            <button
                              type="button"
                              onClick={() => void saveClubPlan(club, null)}
                              disabled={savingPlanFor === club.id}
                              className="rounded-lg border border-slate-700 px-3 py-2 text-[10px] font-semibold text-slate-200 disabled:opacity-50"
                            >
                              Usar automático
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex gap-2 mt-4">
                <button
                  onClick={() => openEditModal(club)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => setDeleteTarget(club)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition-colors"
                  title="Eliminar club"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredClubs.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      {/* Add / Edit Club Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white mb-4">
              {editingClub ? "Editar Dojang / Club" : "Registrar Nuevo Dojang / Club"}
            </h3>
            <form onSubmit={handleSaveClub} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nombre Oficial del Club</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  placeholder="Ej. Club Deportivo Taekwondo Olimpia"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Ciudad / Sede</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Código Federativo</label>
                  <input
                    type="text"
                    required
                    value={formData.federationCode}
                    onChange={(e) => setFormData({ ...formData, federationCode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                    placeholder="FED-MAD-9912"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Dirección del Dojang</label>
                <input
                  type="text"
                  value={formData.dojangAddress}
                  onChange={(e) => setFormData({ ...formData, dojangAddress: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-medium">
                    Entrenador Responsable / Director <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    Obligatorio
                  </span>
                </div>
                {coaches.length === 0 ? (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    ⚠️ <strong>No hay entrenadores creados todavía.</strong> Registra primero el entrenador sin club en la sección de{" "}
                    <a href="/coaches" className="underline font-bold text-white hover:text-sky-300">
                      Entrenadores
                    </a>{" "}
                    para poder asignarlo como responsable del club.
                  </div>
                ) : (
                  <select
                    required
                    value={formData.coachId}
                    onChange={(e) => {
                      const selected = coaches.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        coachId: e.target.value,
                        directorName: selected ? selected.fullName : "",
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- Selecciona un entrenador de la lista --</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} — Lic: {c.licenseNumber} ({c.specialty})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-slate-500 mt-1">
                  Selecciona el entrenador creado sin club para vincularlo al nuevo club.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Atletas</label>
                  <input
                    type="number"
                    value={formData.athletesCount}
                    onChange={(e) => setFormData({ ...formData, athletesCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Entrenadores</label>
                  <input
                    type="number"
                    value={formData.coachesCount}
                    onChange={(e) => setFormData({ ...formData, coachesCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Año Fundación</label>
                  <input
                    type="number"
                    value={formData.foundedYear}
                    onChange={(e) => setFormData({ ...formData, foundedYear: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-chong-glow transition-all active:scale-95"
                >
                  {editingClub ? "Guardar Cambios" : "Guardar Club"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="¿Eliminar club / dojang?"
        description={`Esta acción eliminará de la base federativa a "${deleteTarget?.name}" (${deleteTarget?.city}). Sus afiliaciones quedarán canceladas.`}
        confirmText="Eliminar Club"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteClub}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
