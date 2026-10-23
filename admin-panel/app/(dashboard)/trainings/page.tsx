"use client";

import { useEffect, useState } from "react";
import { Dumbbell, Heart, Plus, Search, Flame, Activity, Sparkles, Clock, CheckCircle, Edit2, Trash2, LineChart, TrendingUp, BarChart3, X, CalendarPlus, CircleCheck } from "lucide-react";
import { Athlete, TrainingSession } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { useAuth } from "@/lib/auth-context";

const PAGE_SIZE = 5;

export default function TrainingsPage() {
  const toast = useToast();
  const { role, isLoading: isAuthLoading } = useAuth();
  const isAthlete = role === "ATHLETE";
  const canManageTrainings = !isAuthLoading && !isAthlete;
  const [trainings, setTrainings] = useState<TrainingSession[]>([]);
  const [athleteOptions, setAthleteOptions] = useState<Athlete[]>([]);
  const [clubClasses, setClubClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [sharedClassSessions, setSharedClassSessions] = useState<Array<Record<string, any>>>([]);
  const [classSessionsError, setClassSessionsError] = useState("");
  const [isLoadingTrainings, setIsLoadingTrainings] = useState(true);
  const [trainingsLoadError, setTrainingsLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
  const [selectedChartSession, setSelectedChartSession] = useState<TrainingSession | null>(null);
  const [formData, setFormData] = useState({
    title: "Sesión Táctica de Asaltos Continuos",
    athleteId: "",
    durationMinutes: 60,
    type: "SPARRING_TACTICAL" as TrainingSession["type"],
    rpeScore: 8,
    avgHeartRateBpm: 172,
    maxHeartRateBpm: 198,
    heartRateRecovery1Min: 40,
  });

  // Planned (to-do) trainings
  const emptyPlan = () => ({
    title: "",
    athleteId: "",
    classId: "",
    date: new Date().toISOString().slice(0, 10),
    durationMinutes: 60,
    type: "SPARRING_TACTICAL" as TrainingSession["type"],
    notes: "",
    blocks: [{ id: "block-1", title: "Bloque 1", durationMinutes: 60 }],
  });
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TrainingSession | null>(null);
  const [planForm, setPlanForm] = useState(emptyPlan());

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<TrainingSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return;
    let active = true;
    fetch("/api/v1/trainings")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "No se pudo cargar el historial.");
        if (active) setTrainings(Array.isArray(result.data) ? result.data : []);
      })
      .catch((error) => {
        if (active) setTrainingsLoadError(error instanceof Error ? error.message : "No se pudo cargar el historial.");
      })
      .finally(() => {
        if (active) setIsLoadingTrainings(false);
      });
    return () => { active = false; };
  }, [isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || isAthlete) return;
    let active = true;
    const loadSharedSessions = async () => {
      try {
        const classesResponse = await fetch("/api/v1/classes");
        const classesResult = await classesResponse.json();
        if (!classesResponse.ok || !classesResult.success) {
          throw new Error(classesResult.error || "No se pudieron cargar las clases del club.");
        }
        const classes = Array.isArray(classesResult.data) ? classesResult.data : [];
        const sessionGroups = await Promise.all(classes.map(async (clubClass: { id: string; name: string }) => {
          const response = await fetch(`/api/v1/classes/${encodeURIComponent(clubClass.id)}/trainings`);
          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || `No se pudieron cargar los entrenamientos de ${clubClass.name}.`);
          }
          return (Array.isArray(result.data) ? result.data : []).map((session: Record<string, any>) => ({
            ...session,
            className: clubClass.name,
          }));
        }));
        if (active) {
          setClubClasses(classes);
          setSharedClassSessions(sessionGroups.flat().sort((a, b) =>
            Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)
          ));
          setClassSessionsError("");
        }
      } catch (error) {
        if (active) setClassSessionsError(error instanceof Error ? error.message : "No se pudieron cargar los entrenamientos compartidos.");
      }
    };
    void loadSharedSessions();
    return () => { active = false; };
  }, [isAthlete, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading || isAthlete) return;
    let active = true;
    fetch("/api/v1/athletes")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "No se pudieron cargar los atletas.");
        if (active) {
          const data = Array.isArray(result.data) ? result.data : [];
          setAthleteOptions(data);
          if (data[0]) {
            setFormData((current) => ({ ...current, athleteId: current.athleteId || data[0].id }));
            setPlanForm((current) => ({ ...current, athleteId: current.athleteId || data[0].id }));
          }
        }
      })
      .catch((error) => {
        if (active) setTrainingsLoadError(error instanceof Error ? error.message : "No se pudieron cargar los atletas.");
      });
    return () => { active = false; };
  }, [isAthlete, isAuthLoading]);

  const visibleTrainings = isAthlete
    ? trainings.filter((training) => training.status === "COMPLETED")
    : trainings;
  const filteredTrainings = visibleTrainings.filter(
    (trn) =>
      trn.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trn.athleteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trn.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTrainings.length / PAGE_SIZE) || 1;
  const paginatedTrainings = filteredTrainings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const averageSessionBpm = visibleTrainings.length
    ? Math.round(visibleTrainings.reduce((sum, session) => sum + session.avgHeartRateBpm, 0) / visibleTrainings.length)
    : 0;
  const averageSessionTrimp = visibleTrainings.length
    ? Math.round(visibleTrainings.reduce((sum, session) => sum + session.trimpScore, 0) / visibleTrainings.length)
    : 0;
  const sessionsWithRecovery = visibleTrainings.filter((session) => session.heartRateRecovery1Min > 0);
  const averageRecoveryDrop = sessionsWithRecovery.length
    ? Math.round(sessionsWithRecovery.reduce((sum, session) => sum + session.heartRateRecovery1Min, 0) / sessionsWithRecovery.length)
    : 0;

  const openCreateModal = () => {
    setEditingSession(null);
    setFormData({
      title: "Sesión Táctica de Asaltos Continuos",
      athleteId: athleteOptions[0]?.id || "",
      durationMinutes: 60,
      type: "SPARRING_TACTICAL",
      rpeScore: 8,
      avgHeartRateBpm: 172,
      maxHeartRateBpm: 198,
      heartRateRecovery1Min: 40,
    });
    setIsModalOpen(true);
  };

  const openPlanModal = (session?: TrainingSession) => {
    setEditingPlan(session || null);
    setPlanForm(session ? {
      title: session.title,
      athleteId: session.athleteId,
      classId: "",
      date: session.date.slice(0, 10),
      durationMinutes: session.durationMinutes,
      type: session.type,
      notes: session.aiFeedback || "",
      blocks: session.blocks?.length
        ? session.blocks
        : [{ id: `block-${session.id}`, title: "Entrenamiento completo", durationMinutes: session.durationMinutes }],
    } : emptyPlan());
    setIsPlanOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planForm.classId && !editingPlan) {
      try {
        const res = await fetch(`/api/v1/classes/${encodeURIComponent(planForm.classId)}/trainings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: planForm.title,
            scheduledAt: new Date(`${planForm.date}T12:00:00`).toISOString(),
            durationMinutes: planForm.blocks.reduce((sum, block) => sum + Number(block.durationMinutes || 0), 0),
            type: planForm.type,
            notes: planForm.notes,
            blocks: planForm.blocks,
          }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) return toast.error("Error", result.error || "No se pudo programar la clase.");
        const className = clubClasses.find((item) => item.id === planForm.classId)?.name || "Clase";
        setSharedClassSessions((current) => [...current, { ...result.data, className }].sort((a, b) =>
          Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)
        ));
        toast.success("Entrenamiento de clase programado", `Se compartió con los alumnos de ${className}.`);
        setIsPlanOpen(false);
      } catch {
        toast.error("Error de red", "No se pudo conectar con el servidor.");
      }
      return;
    }
    const payload = {
      title: planForm.title,
      athleteId: planForm.athleteId,
      date: new Date(`${planForm.date}T12:00:00`).toISOString(),
      durationMinutes: planForm.blocks.reduce((sum, block) => sum + Number(block.durationMinutes || 0), 0),
      type: planForm.type,
      status: "SCHEDULED",
      tacticalNotes: planForm.notes,
      aiFeedback: planForm.notes,
      blocks: planForm.blocks,
    };
    try {
      const targets = [planForm.athleteId].filter(Boolean);
      if (targets.length === 0) return toast.error("Error", "No hay atletas.");
      const created: TrainingSession[] = [];
      let updated: TrainingSession | null = null;
      for (const target of targets) {
        const body = { ...payload, athleteId: target };
        const res = await fetch("/api/v1/trainings", {
          method: editingPlan ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingPlan ? { id: editingPlan.id, ...body } : body),
        });
        const result = await res.json();
        if (!result.success) return toast.error("Error", result.error);
        if (editingPlan) updated = result.data; else created.push(result.data);
      }
      setTrainings(editingPlan ? trainings.map((t) => (t.id === editingPlan.id && updated ? updated : t)) : [...created, ...trainings]);
      toast.success(editingPlan ? "Entrenamiento actualizado" : "Entrenamiento programado", targets.length > 1 ? `Programado para ${targets.length} atletas.` : "Queda pendiente de realizar.");
      setIsPlanOpen(false);
    } catch {
      toast.error("Error de red", "No se pudo conectar con el servidor.");
    }
  };

  const openEditModal = (session: TrainingSession) => {
    setEditingSession(session);
    setFormData({
      title: session.title,
      athleteId: session.athleteId,
      durationMinutes: session.durationMinutes,
      type: session.type,
      rpeScore: session.rpeScore,
      avgHeartRateBpm: session.avgHeartRateBpm,
      maxHeartRateBpm: session.maxHeartRateBpm,
      heartRateRecovery1Min: session.heartRateRecovery1Min,
    });
    setIsModalOpen(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSession) {
        const res = await fetch("/api/v1/trainings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingSession.id,
            ...formData,
            status: "COMPLETED",
          }),
        });
        const result = await res.json();
        if (result.success) {
          setTrainings(trainings.map((t) => (t.id === editingSession.id ? result.data : t)));
          toast.success("Sesión actualizada", "Cálculos TRIMP recalculados.");
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      } else {
        const res = await fetch("/api/v1/trainings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (result.success) {
          setTrainings([result.data, ...trainings]);
          toast.success("Sesión registrada", "Telemetría biométrica indexada con IA.");
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      }
    } catch {
      toast.error("Error de red", "No se pudo conectar con el servidor.");
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/trainings?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setTrainings(trainings.filter((t) => t.id !== deleteTarget.id));
        toast.success("Sesión eliminada", "Registro eliminado del historial de cargas.");
        setDeleteTarget(null);
      } else {
        toast.error("Error al eliminar", result.error);
      }
    } catch {
      toast.error("Error", "No se pudo eliminar el entrenamiento.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-sky-400" />
            {isAthlete ? "Mis entrenamientos realizados" : "Gestión de Entrenamientos & Telemetría Cardíaca"}
          </h2>
          <p className="text-xs text-slate-400">
            Control de cargas internas TRIMP, zonas de frecuencia cardíaca (Z1-Z5) y recuperación (HRR)
          </p>
        </div>
        {canManageTrainings && <div className="flex flex-wrap gap-2">
        <button
          onClick={() => openPlanModal()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-all active:scale-95"
        >
          <CalendarPlus className="w-4 h-4" />
          Programar entrenamiento
        </button>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Registrar Sesión & Pulsómetro
        </button>
        </div>}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Heart className="w-5 h-5 fill-rose-500/30 animate-heart-pulse" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Media FC Asaltos</div>
            <div className="text-xl font-bold text-white font-mono">{averageSessionBpm ? `${averageSessionBpm} BPM` : "—"}</div>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Carga Media TRIMP</div>
            <div className="text-xl font-bold text-amber-400 font-mono">{visibleTrainings.length ? `${averageSessionTrimp} pts / sesión` : "—"}</div>
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Tasa de Recuperación 60s</div>
            <div className="text-xl font-bold text-emerald-400 font-mono">{averageRecoveryDrop ? `-${averageRecoveryDrop} BPM` : "—"}</div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={isAthlete ? "Buscar en mis entrenamientos..." : "Buscar por sesión o atleta..."}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Sessions Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white">{isAthlete ? "Mis sesiones completadas" : "Historial de Sesiones Monitorizadas"}</h3>
          <span className="text-xs text-slate-400 font-mono">{visibleTrainings.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Sesión / Tipo</th>
                {!isAthlete && <th className="py-3.5 px-4">Atleta</th>}
                <th className="py-3.5 px-4">Duración</th>
                <th className="py-3.5 px-4">FC Media / Máx</th>
                <th className="py-3.5 px-4">Zona 5 (&gt;90%)</th>
                <th className="py-3.5 px-4">Carga TRIMP</th>
                <th className="py-3.5 px-4">Diagnóstico IA</th>
                {!isAthlete && <th className="py-3.5 px-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoadingTrainings ? (
                <tr><td colSpan={isAthlete ? 6 : 8} className="py-8 text-center text-slate-400">Cargando sesiones guardadas...</td></tr>
              ) : trainingsLoadError ? (
                <tr><td colSpan={isAthlete ? 6 : 8} className="py-8 text-center text-rose-300">{trainingsLoadError}</td></tr>
              ) : paginatedTrainings.length === 0 ? (
                <tr>
                  <td colSpan={isAthlete ? 6 : 8} className="py-8 text-center text-slate-500">
                    {isAthlete ? "Aún no tienes entrenamientos completados." : "No se encontraron sesiones registradas."}
                  </td>
                </tr>
              ) : (
                paginatedTrainings.map((trn) => (
                  <tr key={trn.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{trn.title}</div>
                      <div className="text-[10px] text-sky-400 font-medium">
                        {trn.type.replace(/_/g, " ")}
                        {trn.status === "SCHEDULED" && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300 border border-amber-500/30">PROGRAMADO · {trn.date.slice(0, 10)}</span>}
                      </div>
                    </td>
                    {!isAthlete && <td className="py-3.5 px-4 font-semibold text-white">{trn.athleteName}</td>}
                    <td className="py-3.5 px-4 font-mono text-slate-300">{trn.durationMinutes} min</td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {trn.status === "SCHEDULED" ? <span className="text-slate-500">—</span> : <>
                      <span className="text-rose-400 font-bold">{trn.avgHeartRateBpm}</span> /{" "}
                      <span className="text-slate-400">{trn.maxHeartRateBpm} BPM</span></>}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                        {trn.heartRateZones.zone5AnaerobicMin} min
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-400">{trn.status === "SCHEDULED" ? "—" : `${trn.trimpScore} pts`}</td>
                    <td className="py-3.5 px-4 text-slate-300 text-[11px] max-w-xs truncate" title={trn.aiFeedback}>
                      {trn.aiFeedback}
                    </td>
                    {!isAthlete && <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {trn.status === "SCHEDULED" && (
                          <>
                            <button
                              onClick={() => openEditModal(trn)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950/60 text-emerald-400 border border-slate-700 transition-colors"
                              title="Marcar como realizado y añadir telemetría"
                            >
                              <CircleCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openPlanModal(trn)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors"
                              title="Editar plan"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {trn.status !== "SCHEDULED" && (<>
                        <button
                          onClick={() => setSelectedChartSession(trn)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950/60 text-emerald-400 hover:text-emerald-300 border border-slate-700 hover:border-emerald-700 transition-colors"
                          title="Ver gráfica y curvas de PPM"
                        >
                          <LineChart className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(trn)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white border border-slate-700 transition-colors"
                          title="Editar sesión"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button></>)}
                        <button
                          onClick={() => setDeleteTarget(trn)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition-colors"
                          title="Eliminar sesión"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredTrainings.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      {isPlanOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-amber-500/40 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">{editingPlan ? "Editar entrenamiento programado" : "Programar entrenamiento"}</h3>
            <form onSubmit={handleSavePlan} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Título</label>
                <input type="text" required value={planForm.title} onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })} placeholder="Ej. Velocidad de dollyo chagi" className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Destino · atleta individual</label>
                  <select required={!planForm.classId} disabled={Boolean(planForm.classId)} value={planForm.athleteId} onChange={(e) => setPlanForm({ ...planForm, athleteId: e.target.value, classId: "" })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-50">
                    {editingPlan && !athleteOptions.some((a) => a.id === planForm.athleteId) && <option value={planForm.athleteId}>{planForm.athleteId}</option>}
                    {athleteOptions.map((a) => <option key={a.id} value={a.id}>{a.fullName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Destino · clase compartida</label>
                  <select disabled={Boolean(editingPlan)} value={planForm.classId} onChange={(e) => setPlanForm({ ...planForm, classId: e.target.value, athleteId: e.target.value ? "" : planForm.athleteId })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white disabled:opacity-50">
                    <option value="">No es una clase</option>
                    {clubClasses.map((clubClass) => <option key={clubClass.id} value={clubClass.id}>{clubClass.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Fecha</label>
                <input type="date" required value={planForm.date} onChange={(e) => setPlanForm({ ...planForm, date: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
              </div>
              {!!classSessionsError && <p className="text-xs text-amber-300">{classSessionsError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Duración total</label>
                  <div className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 font-mono">
                    {planForm.blocks.reduce((sum, block) => sum + Number(block.durationMinutes || 0), 0)} min
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Tipo</label>
                  <select value={planForm.type} onChange={(e) => setPlanForm({ ...planForm, type: e.target.value as TrainingSession["type"] })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white">
                    <option value="SPARRING_TACTICAL">Sparring táctico</option>
                    <option value="POOMSAE_TECHNICAL">Poomsae / técnica</option>
                    <option value="HIGH_INTENSITY_INTERVALS">Intervalos alta intensidad</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Plan del entrenamiento (ejercicios, series, correcciones)</label>
                <textarea rows={5} value={planForm.notes} onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-400">Bloques y duración (la app avanza automáticamente)</label>
                  <button
                    type="button"
                    onClick={() => setPlanForm((current) => ({
                      ...current,
                      blocks: [...current.blocks, { id: `block-${Date.now()}`, title: `Bloque ${current.blocks.length + 1}`, durationMinutes: 10 }],
                    }))}
                    disabled={planForm.blocks.length >= 20}
                    className="rounded-lg bg-slate-800 px-2 py-1 text-amber-300 disabled:opacity-40"
                  >
                    Añadir bloque
                  </button>
                </div>
                {planForm.blocks.map((block, index) => (
                  <div key={block.id} className="flex gap-2">
                    <input
                      type="text"
                      required
                      maxLength={120}
                      aria-label={`Nombre del bloque ${index + 1}`}
                      value={block.title}
                      onChange={(event) => setPlanForm((current) => ({
                        ...current,
                        blocks: current.blocks.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item),
                      }))}
                      placeholder={`Bloque ${index + 1}`}
                      className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white"
                    />
                    <input
                      type="number"
                      required
                      min={1}
                      max={240}
                      aria-label={`Duración en minutos del bloque ${index + 1}`}
                      value={block.durationMinutes}
                      onChange={(event) => setPlanForm((current) => ({
                        ...current,
                        blocks: current.blocks.map((item, itemIndex) => itemIndex === index ? { ...item, durationMinutes: Number(event.target.value) } : item),
                      }))}
                      className="w-24 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-white"
                    />
                    <button
                      type="button"
                      aria-label={`Eliminar bloque ${index + 1}`}
                      onClick={() => setPlanForm((current) => ({ ...current, blocks: current.blocks.filter((_, itemIndex) => itemIndex !== index) }))}
                      disabled={planForm.blocks.length <= 1}
                      className="rounded-xl px-2 text-rose-400 disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold">Guardar</button>
                <button type="button" onClick={() => setIsPlanOpen(false)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold border border-slate-700">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isAthlete && <section className="glass-panel rounded-2xl border border-amber-500/20 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-white">Entrenamientos compartidos por clase</h3>
          <span className="text-xs text-slate-400">{sharedClassSessions.length} sesiones</span>
        </div>
        <div className="divide-y divide-slate-800/60">
          {classSessionsError
            ? <p className="p-4 text-xs text-amber-300">{classSessionsError}</p>
            : sharedClassSessions.length
              ? sharedClassSessions.map((session) => (
                <div key={session.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{session.title}</p>
                    <p className="text-xs text-amber-300">{session.className} · {session.type?.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right text-xs text-slate-300">
                    <p>{new Date(session.scheduledAt).toLocaleString()}</p>
                    <p>{session.durationMinutes} min · {session.status}</p>
                  </div>
                </div>
              ))
              : <p className="p-4 text-xs text-slate-500">No hay sesiones compartidas programadas.</p>}
        </div>
      </section>}

      {/* Add / Edit Training Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white mb-4">
              {editingSession ? "Editar Sesión & Telemetría" : "Registrar Sesión & Telemetría Cardíaca"}
            </h3>
            <form onSubmit={handleSaveSession} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Título de la Sesión</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Atleta</label>
                  <select
                    value={formData.athleteId}
                    onChange={(e) => setFormData({ ...formData, athleteId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    {athleteOptions.length === 0 ? (
                      <option value="">Sin atletas (Añade uno desde Atletas)</option>
                    ) : (
                      athleteOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.fullName}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Duración (minutos)</label>
                  <input
                    type="number"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">FC Media (BPM)</label>
                  <input
                    type="number"
                    value={formData.avgHeartRateBpm}
                    onChange={(e) => setFormData({ ...formData, avgHeartRateBpm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">FC Pico (BPM)</label>
                  <input
                    type="number"
                    value={formData.maxHeartRateBpm}
                    onChange={(e) => setFormData({ ...formData, maxHeartRateBpm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">HRR a 60s</label>
                  <input
                    type="number"
                    value={formData.heartRateRecovery1Min}
                    onChange={(e) => setFormData({ ...formData, heartRateRecovery1Min: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tipo de Sesión</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                >
                  <option value="SPARRING_TACTICAL">Sparring Táctico</option>
                  <option value="HIGH_INTENSITY_INTERVALS">Intervalos Alta Intensidad (HIIT)</option>
                  <option value="POOMSAE_TECHNICAL">Poomsae Técnico</option>
                  <option value="STRENGTH_POWER">Fuerza & Potencia</option>
                  <option value="RECOVERY_AEROBIC">Regenerativo / Aeróbico</option>
                </select>
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
                  {editingSession ? "Guardar Cambios" : "Procesar Carga TRIMP"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Gráfica Detallada de Entrenamiento */}
      {selectedChartSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full rounded-2xl border border-emerald-500/40 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  SESIÓN FINALIZADA
                </span>
                <h3 className="text-lg font-bold text-white mt-1">{selectedChartSession.title}</h3>
                <p className="text-xs text-slate-400">
                  {selectedChartSession.athleteName} · {selectedChartSession.date ? new Date(selectedChartSession.date).toLocaleString() : "Fecha de sesión"}
                </p>
              </div>
              <button
                onClick={() => setSelectedChartSession(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 block uppercase">Duración</span>
                <strong className="text-base text-white font-mono">{selectedChartSession.durationMinutes} min</strong>
              </div>
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 block uppercase">PPM Promedio</span>
                <strong className="text-base text-rose-400 font-mono">{selectedChartSession.avgHeartRateBpm} BPM</strong>
              </div>
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 block uppercase">PPM Máximo</span>
                <strong className="text-base text-amber-400 font-mono">{selectedChartSession.maxHeartRateBpm} BPM</strong>
              </div>
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
                <span className="text-[10px] text-slate-500 block uppercase">Carga TRIMP</span>
                <strong className="text-base text-emerald-400 font-mono">{selectedChartSession.trimpScore} pts</strong>
              </div>
            </div>

            {/* Gráfica SVG de Curva de PPM */}
            <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 mb-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-rose-400" />
                  Curva Continua de Pulsaciones
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Pico {selectedChartSession.maxHeartRateBpm} BPM
                </span>
              </div>
              <div className="h-32 w-full">
                {(() => {
                  const width = 560;
                  const height = 120;
                  const avg = selectedChartSession.avgHeartRateBpm || 160;
                  const max = selectedChartSession.maxHeartRateBpm || 190;
                  const min = 80;

                  const series = selectedChartSession.bpmSeries?.map((point) => point.bpm) || [];

                  if (series.length < 2) {
                    return (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        No hay muestras reales de PPM guardadas para esta sesión.
                      </div>
                    );
                  }

                  const points = series.map((bpm, idx) => {
                    const x = (idx / (series.length - 1)) * width;
                    const y = height - ((bpm - min) / (max - min || 1)) * height;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  });
                  const path = `M ${points.join(" L ")}`;

                  return (
                    <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`${path} L ${width},${height} L 0,${height} Z`}
                        fill="url(#areaGrad)"
                      />
                      <path d={path} fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  );
                })()}
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2">
                <span>00:00 (Inicio)</span>
                <span>{Math.round(selectedChartSession.durationMinutes / 2)}:00 (Pico)</span>
                <span>{selectedChartSession.durationMinutes}:00 (Fin)</span>
              </div>
            </div>

            {/* Desglose por Zonas Cardíacas */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3">
              <span className="text-[11px] font-bold text-slate-300 block mb-2">Desglose de Tiempo en Zonas Fisiológicas</span>
              <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <span className="text-slate-400 block font-semibold">Z1 (&lt;60%)</span>
                  <span className="font-mono text-emerald-400 font-bold">{selectedChartSession.heartRateZones?.zone1RecoveryMin || 5} min</span>
                </div>
                <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <span className="text-slate-400 block font-semibold">Z2 (60-70%)</span>
                  <span className="font-mono text-sky-400 font-bold">{selectedChartSession.heartRateZones?.zone2AerobicMin || 10} min</span>
                </div>
                <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <span className="text-slate-400 block font-semibold">Z3 (70-80%)</span>
                  <span className="font-mono text-yellow-400 font-bold">{selectedChartSession.heartRateZones?.zone3TempoMin || 15} min</span>
                </div>
                <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <span className="text-slate-400 block font-semibold">Z4 (80-90%)</span>
                  <span className="font-mono text-orange-400 font-bold">{selectedChartSession.heartRateZones?.zone4ThresholdMin || 20} min</span>
                </div>
                <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                  <span className="text-slate-400 block font-semibold">Z5 (&gt;90%)</span>
                  <span className="font-mono text-rose-400 font-bold">{selectedChartSession.heartRateZones?.zone5AnaerobicMin || 10} min</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedChartSession(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cerrar Análisis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="¿Eliminar sesión?"
        description={`Esta acción eliminará el registro de telemetría de "${deleteTarget?.title}" de ${deleteTarget?.athleteName}.`}
        confirmText="Eliminar Sesión"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
