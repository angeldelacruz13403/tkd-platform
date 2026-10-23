"use client";

import { useEffect, useState } from "react";
import { Award, Plus, Search, Users, Edit2, Trash2, ChevronDown, ChevronUp, Swords, Heart } from "lucide-react";
import { db } from "@/lib/db";
import { Athlete, Coach, Club } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 6;

export default function CoachesPage() {
  const toast = useToast();
  const [coaches, setCoaches] = useState<Coach[]>(db.coaches);
  const [clubs, setClubs] = useState<Club[]>(db.clubs);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [formData, setFormData] = useState<{
    fullName: string;
    licenseNumber: string;
    specialty: Coach["specialty"];
    yearsOfExperience: number;
    clubId: string;
    clubName: string;
    athletesCount: number;
    certificationsStr: string;
  }>({
    fullName: "",
    licenseNumber: "",
    specialty: "COMBAT_KYORUGI",
    yearsOfExperience: 8,
    clubId: "",
    clubName: "",
    athletesCount: 0,
    certificationsStr: "WT Coach License Level 2, Especialista en Daedo Gen3",
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Coach | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/coaches")
      .then((response) => response.json())
      .then((result) => { if (active && result.success) setCoaches(result.data || []); })
      .catch(() => undefined);
    fetch("/api/v1/clubs")
      .then((response) => response.json())
      .then((result) => { if (active && result.success) setClubs(result.data || []); })
      .catch(() => undefined);
    fetch("/api/v1/athletes")
      .then((response) => response.json())
      .then((result) => { if (active && result.success) setAthletes(result.data || []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  // Group athletes by coachId
  const coachAthletesMap = athletes.reduce<Record<string, Athlete[]>>((acc, a) => {
    if (a.coachId) { acc[a.coachId] = [...(acc[a.coachId] || []), a]; }
    return acc;
  }, {});

  const filteredCoaches = coaches.filter(
    (c) =>
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.clubName && c.clubName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredCoaches.length / PAGE_SIZE) || 1;
  const paginatedCoaches = filteredCoaches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openCreateModal = () => {
    setEditingCoach(null);
    setFormData({
      fullName: "",
      licenseNumber: "",
      specialty: "COMBAT_KYORUGI",
      yearsOfExperience: 8,
      clubId: "",
      clubName: "",
      athletesCount: 0,
      certificationsStr: "WT Coach License Level 2, Monitor Nacional",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (coach: Coach) => {
    setEditingCoach(coach);
    setFormData({
      fullName: coach.fullName,
      licenseNumber: coach.licenseNumber,
      specialty: coach.specialty,
      yearsOfExperience: coach.yearsOfExperience,
      clubId: coach.clubId || "",
      clubName: coach.clubName || "",
      athletesCount: coach.athletesCount,
      certificationsStr: coach.certifications.join(", "),
    });
    setIsModalOpen(true);
  };

  const handleSaveCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.licenseNumber) {
      toast.warning("Campos obligatorios", "Por favor completa el nombre y la licencia.");
      return;
    }
    if (editingCoach && !formData.clubId) {
      toast.warning("Club obligatorio", "Crea el club y asígnalo al entrenador antes de guardar los cambios.");
      return;
    }

    const certifications = formData.certificationsStr
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      if (editingCoach) {
        const res = await fetch("/api/v1/coaches", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCoach.id,
            fullName: formData.fullName,
            licenseNumber: formData.licenseNumber,
            specialty: formData.specialty,
            yearsOfExperience: Number(formData.yearsOfExperience),
            clubId: formData.clubId,
            clubName: formData.clubName,
            athletesCount: Number(formData.athletesCount),
            certifications,
          }),
        });
        const result = await res.json();
        if (result.success) {
          setCoaches(coaches.map((c) => (c.id === editingCoach.id ? result.data : c)));
          toast.success("Entrenador actualizado", `${result.data.fullName} guardado.`);
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      } else {
        const res = await fetch("/api/v1/coaches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: formData.fullName,
            licenseNumber: formData.licenseNumber,
            specialty: formData.specialty,
            yearsOfExperience: Number(formData.yearsOfExperience),
            clubId: formData.clubId,
            clubName: formData.clubName,
            athletesCount: Number(formData.athletesCount),
            certifications,
          }),
        });
        const result = await res.json();
        if (result.success) {
          setCoaches([...coaches, result.data]);
          toast.success("Entrenador registrado", `${result.data.fullName} incorporado.`);
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      }
    } catch {
      toast.error("Error de conexión", "No se pudo conectar con el servidor.");
    }
  };

  const handleDeleteCoach = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/coaches?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setCoaches(coaches.filter((c) => c.id !== deleteTarget.id));
        toast.success("Entrenador eliminado", `${deleteTarget.fullName} ha sido desvinculado.`);
        setDeleteTarget(null);
      } else {
        toast.error("Error al eliminar", result.error);
      }
    } catch {
      toast.error("Error", "No se pudo eliminar el entrenador.");
    } finally {
      setIsDeleting(false);
    }
  };

  const getSpecialtyLabel = (spec: Coach["specialty"]) => {
    switch (spec) {
      case "COMBAT_KYORUGI":
        return "Combate Olímpico (Kyorugi)";
      case "POOMSAE":
        return "Técnica Tradicional (Poomsae)";
      case "PHYSICAL_CONDITIONING":
        return "Preparación Física & Biomédica";
      case "HIGH_PERFORMANCE":
        return "Alto Rendimiento";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-6 h-6 text-sky-400" />
            Gestión de Entrenadores & Cuerpo Técnico
          </h2>
          <p className="text-xs text-slate-400">
            Fichas técnicas, licencias oficiales World Taekwondo y asignación de atletas
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Registrar Entrenador
        </button>
      </div>

      {/* Search Input */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre o número de licencia..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Coaches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedCoaches.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs">
            No se encontraron entrenadores que coincidan con la búsqueda.
          </div>
        ) : (
          paginatedCoaches.map((coach) => (
            <div
              key={coach.id}
              className="glass-panel rounded-2xl border border-slate-800 p-6 flex flex-col justify-between hover:border-sky-500/40 transition-all shadow-lg"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-black border border-sky-500/30 text-base">
                      {coach.fullName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">{coach.fullName}</h3>
                      <p className="text-[11px] text-sky-400 font-medium">{coach.clubName || "Sin club asignado"}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800/60 font-mono">
                    {coach.licenseNumber}
                  </span>
                </div>

              {/* Athlete count + expand toggle */}
                <div className="space-y-2 text-xs mb-4">
                  <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Especialidad:</span>
                    <span className="font-semibold text-white">{getSpecialtyLabel(coach.specialty)}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-400">Experiencia:</span>
                    <span className="font-bold text-white font-mono">{coach.yearsOfExperience} años</span>
                  </div>
                  {/* Athletes assigned */}
                  <button
                    type="button"
                    onClick={() => setExpandedCoach(expandedCoach === coach.id ? null : coach.id)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-amber-950/40 border border-amber-800/40 hover:border-amber-600/60 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                      <Users className="w-3.5 h-3.5" />
                      {coachAthletesMap[coach.id]?.length ?? 0} deportista{(coachAthletesMap[coach.id]?.length ?? 0) !== 1 ? "s" : ""} asignado{(coachAthletesMap[coach.id]?.length ?? 0) !== 1 ? "s" : ""}
                    </span>
                    {expandedCoach === coach.id
                      ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                      : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                    }
                  </button>

                  {/* Expandable athlete list */}
                  {expandedCoach === coach.id && (
                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 divide-y divide-slate-800 overflow-hidden">
                      {(coachAthletesMap[coach.id] ?? []).length === 0 ? (
                        <p className="px-3 py-2 text-slate-500 italic">Sin deportistas asignados aún.</p>
                      ) : (
                        (coachAthletesMap[coach.id] ?? []).map((ath) => (
                          <div key={ath.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-800/50 transition-colors">
                            <div>
                              <p className="font-semibold text-white">{ath.fullName}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{ath.category.replace(/_/g, " ")}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 text-rose-400 font-mono text-[10px]">
                                <Heart className="w-2.5 h-2.5" />{ath.maxHeartRateBpm}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                ath.readinessScore >= 80 ? "bg-emerald-950 text-emerald-400 border border-emerald-800" :
                                ath.readinessScore >= 60 ? "bg-amber-950 text-amber-400 border border-amber-800" :
                                "bg-rose-950 text-rose-400 border border-rose-800"
                              }`}>{ath.readinessScore}%</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                <Swords className="w-2.5 h-2.5 inline mr-0.5" />{ath.beltRank.replace("_", " ")}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-1.5">
                    Certificaciones & Acreditaciones
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {coach.certifications.map((cert, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-800/80 text-slate-300 border border-slate-700/60"
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex gap-2">
                <button
                  onClick={() => openEditModal(coach)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  onClick={() => setDeleteTarget(coach)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition-colors"
                  title="Eliminar entrenador"
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
        totalItems={filteredCoaches.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      {/* Add / Edit Coach Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white mb-4">
              {editingCoach ? "Editar Ficha de Entrenador" : "Registrar Nuevo Entrenador"}
            </h3>
            <form onSubmit={handleSaveCoach} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nombre Completo y Grado</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  placeholder="Ej. Sabonim Juan Pérez (5º Dan)"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Número de Licencia WT / Federación</label>
                <input
                  type="text"
                  required
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500 font-mono"
                  placeholder="WT-COACH-LVL2-ESP-098"
                />
              </div>
              {editingCoach ? (
                <div>
                  <label className="block text-slate-400 mb-1">Club / Dojang Asignado</label>
                  <select
                    value={formData.clubId}
                    onChange={(e) => {
                      const selectedClub = clubs.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        clubId: e.target.value,
                        clubName: selectedClub ? selectedClub.name : "",
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- Sin Club Asignado --</option>
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.city})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-slate-300">
                  El entrenador se creará sin club. Asígnalo después de crear el club.
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Especialidad</label>
                  <select
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="COMBAT_KYORUGI">Combate Kyorugi</option>
                    <option value="POOMSAE">Poomsae</option>
                    <option value="PHYSICAL_CONDITIONING">Preparación Física</option>
                    <option value="HIGH_PERFORMANCE">Alto Rendimiento</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Años Experiencia</label>
                  <input
                    type="number"
                    value={formData.yearsOfExperience}
                    onChange={(e) => setFormData({ ...formData, yearsOfExperience: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Certificaciones (separadas por coma)</label>
                <input
                  type="text"
                  value={formData.certificationsStr}
                  onChange={(e) => setFormData({ ...formData, certificationsStr: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  placeholder="WT Coach L3, Especialista Daedo Gen3, CSD"
                />
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
                  {editingCoach ? "Guardar Cambios" : "Guardar Entrenador"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="¿Eliminar entrenador?"
        description={`Esta acción desvinculará a "${deleteTarget?.fullName}" (${deleteTarget?.licenseNumber}). Sus atletas quedarán pendientes de reasignación.`}
        confirmText="Eliminar Entrenador"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteCoach}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
