"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Swords,
  Search,
  Plus,
  Edit2,
  Trash2,
  ShieldOff,
  Award,
  UserPlus,
  UserCheck,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { db } from "@/lib/db";
import { Athlete, Club, WTCategory } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { useAuth } from "@/lib/auth-context";

const PAGE_SIZE = 6;

type RosterView = "students" | "competitors";

type AthletesPageProps = {
  initialRosterView?: RosterView;
  showRosterTabs?: boolean;
};

export default function AthletesPage() {
  const pathname = usePathname();
  const initialRosterView: RosterView = pathname === "/competitors" ? "competitors" : "students";
  const showRosterTabs = pathname === "/athletes";
  const toast = useToast();
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>(db.athletes);
  const [rosterView, setRosterView] = useState<RosterView>(initialRosterView);
  const activeRosterView = showRosterTabs ? rosterView : initialRosterView;
  const [clubs, setClubs] = useState<Club[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  // User Generation State
  const [generatingAthleteId, setGeneratingAthleteId] = useState<string | null>(null);
  const [credentialsModal, setCredentialsModal] = useState<{
    athleteName: string;
    username: string;
    email: string;
    password: string;
    role: string;
    userId: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [customUsername, setCustomUsername] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [athleteLicense, setAthleteLicense] = useState({
    federationCode: "",
    federationRegion: "",
    licenseExpiryDate: "",
    insurancePolicy: "",
    insuranceValidUntil: "",
    medicalClearanceDate: "",
    medicalClearanceValidUntil: "",
    minorConsentSigned: false,
  });
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseSaving, setLicenseSaving] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAthlete, setEditingAthlete] = useState<Athlete | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    category: "SENIOR_M_68" as WTCategory,
    beltRank: "2nd_Dan" as Athlete["beltRank"],
    weightKg: 68.0,
    heightCm: 182,
    maxHeartRateBpm: 200,
    restingHeartRateBpm: 48,
    vo2MaxEstimate: 60.5,
    readinessScore: 85,
    clubId: "",
    clubName: "",
    coachId: "",
    coachName: "",
    favouriteTechnique: "Bandal Chagui",
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Athlete | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/athletes")
      .then((res) => res.json())
      .then((result) => { if (active && result.success) setAthletes(result.data || []); })
      .catch(() => undefined);
    fetch("/api/v1/clubs")
      .then((res) => res.json())
      .then((result) => { if (active && result.success) setClubs(result.data || []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const categories = [
    { key: "ALL", label: "Todas las Categorías" },
    { key: "SENIOR_F_49", label: "Senior Fem. -49kg" },
    { key: "SENIOR_M_68", label: "Senior Masc. -68kg" },
    { key: "SENIOR_M_80", label: "Senior Masc. -80kg" },
  ];

  // Todos los miembros son alumnos de la escuela; los competidores son un subconjunto habilitado
  const students = athletes;
  const competitors = athletes.filter((athlete) => athlete.isCompetitor);
  const visibleAthletes = rosterView === "competitors" ? competitors : students;
  const filteredAthletes = visibleAthletes.filter((a) => {
    const matchesSearch =
      a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.clubName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || a.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredAthletes.length / PAGE_SIZE) || 1;
  const paginatedAthletes = filteredAthletes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // When a club is selected, auto-fill coachId/coachName from that club
  const handleClubChange = (clubId: string) => {
    const selected = clubs.find((c) => c.id === clubId);
    setFormData((prev) => ({
      ...prev,
      clubId,
      clubName: selected?.name || "",
      coachId: selected?.coachId || "",
      coachName: selected?.coachName || "",
    }));
  };

  const openCreateModal = () => {
    setEditingAthlete(null);
    setCustomUsername("");
    setCustomPassword("");
    // If user already belongs to a club, pre-select it
    const preClub = user?.clubId ? clubs.find((c) => c.id === user.clubId) : undefined;
    setFormData({
      fullName: "",
      category: "SENIOR_M_68",
      beltRank: "2nd_Dan",
      weightKg: 68.0,
      heightCm: 182,
      maxHeartRateBpm: 200,
      restingHeartRateBpm: 48,
      vo2MaxEstimate: 60.5,
      readinessScore: 85,
      clubId: preClub?.id || "",
      clubName: preClub?.name || "",
      coachId: preClub?.coachId || "",
      coachName: preClub?.coachName || "",
      favouriteTechnique: "Bandal Chagui",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (athlete: Athlete) => {
    setEditingAthlete(athlete);
    setAthleteLicense({
      federationCode: "",
      federationRegion: "",
      licenseExpiryDate: "",
      insurancePolicy: "",
      insuranceValidUntil: "",
      medicalClearanceDate: "",
      medicalClearanceValidUntil: "",
      minorConsentSigned: false,
    });
    setLicenseLoading(true);
    fetch(`/api/v1/athletes/${encodeURIComponent(athlete.id)}/license`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "No se pudo consultar la licencia.");
        if (result.data) setAthleteLicense({
          federationCode: result.data.federationCode || "",
          federationRegion: result.data.federationRegion || "",
          licenseExpiryDate: result.data.licenseExpiryDate || "",
          insurancePolicy: result.data.insurancePolicy || "",
          insuranceValidUntil: result.data.insuranceValidUntil || "",
          medicalClearanceDate: result.data.medicalClearanceDate || "",
          medicalClearanceValidUntil: result.data.medicalClearanceValidUntil || "",
          minorConsentSigned: Boolean(result.data.minorConsentSigned),
        });
      })
      .catch((error) => toast.error("Licencia", error instanceof Error ? error.message : "No se pudo consultar la licencia."))
      .finally(() => setLicenseLoading(false));
    setFormData({
      fullName: athlete.fullName,
      category: athlete.category,
      beltRank: athlete.beltRank,
      weightKg: athlete.weightKg,
      heightCm: athlete.heightCm,
      maxHeartRateBpm: athlete.maxHeartRateBpm,
      restingHeartRateBpm: athlete.restingHeartRateBpm,
      vo2MaxEstimate: athlete.vo2MaxEstimate,
      readinessScore: athlete.readinessScore,
      clubId: athlete.clubId || "",
      clubName: athlete.clubName || "",
      coachId: athlete.coachId || "",
      coachName: athlete.coachName || "",
      favouriteTechnique: athlete.stats.favouriteTechnique,
    });
    setIsModalOpen(true);
  };

  const handleSaveAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName) {
      toast.warning("Campo obligatorio", "Introduce el nombre del atleta.");
      return;
    }
    if (!formData.clubId) {
      toast.warning("Club obligatorio", "Debes asignar el atleta a un club antes de guardar.");
      return;
    }

    try {
      if (editingAthlete) {
        const res = await fetch("/api/v1/athletes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingAthlete.id, ...formData }),
        });
        const result = await res.json();
        if (result.success) {
          setAthletes(athletes.map((a) => (a.id === editingAthlete.id ? result.data : a)));
          toast.success("Ficha actualizada", `${result.data.fullName} modificado.`);
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      } else {
        const res = await fetch("/api/v1/athletes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            username: customUsername.trim() || undefined,
            password: customPassword || undefined,
            isCompetitor: activeRosterView === "competitors",
          }),
        });
        const result = await res.json();
        if (result.success) {
          setAthletes([...athletes, result.data]);
          if (result.autoCredentials) {
            setShowPassword(true);
            setCredentialsModal({
              athleteName: result.data.fullName,
              username: result.autoCredentials.username,
              email: result.autoCredentials.email,
              password: result.autoCredentials.password,
              role: "ATHLETE",
              userId: result.data.userId,
            });
          }
          toast.success("Atleta registrado", `${result.data.fullName} incorporado al club con acceso automático.`);
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      }
    } catch {
      toast.error("Error de red", "No se pudo conectar con el servidor.");
    }
  };

  const saveAthleteLicense = async () => {
    if (!editingAthlete) return;
    if (!athleteLicense.federationCode.trim()) {
      toast.warning("Número obligatorio", "Introduce el número de licencia federativa.");
      return;
    }
    if (
      !athleteLicense.federationRegion.trim() ||
      !athleteLicense.licenseExpiryDate ||
      !athleteLicense.insurancePolicy.trim() ||
      !athleteLicense.insuranceValidUntil ||
      !athleteLicense.medicalClearanceDate ||
      !athleteLicense.medicalClearanceValidUntil
    ) {
      toast.warning("Datos incompletos", "Completa los datos de federación, seguro y apto médico para guardar la licencia.");
      return;
    }
    setLicenseSaving(true);
    try {
      const response = await fetch(`/api/v1/athletes/${encodeURIComponent(editingAthlete.id)}/license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(athleteLicense),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo guardar la licencia.");
      toast.success("Licencia guardada", `Licencia ${result.data.federationCode} registrada para ${editingAthlete.fullName}.`);
      setAthleteLicense({
        federationCode: result.data.federationCode,
        federationRegion: result.data.federationRegion,
        licenseExpiryDate: result.data.licenseExpiryDate,
        insurancePolicy: result.data.insurancePolicy,
        insuranceValidUntil: result.data.insuranceValidUntil,
        medicalClearanceDate: result.data.medicalClearanceDate,
        medicalClearanceValidUntil: result.data.medicalClearanceValidUntil,
        minorConsentSigned: result.data.minorConsentSigned,
      });
    } catch (error) {
      toast.error("Error al guardar licencia", error instanceof Error ? error.message : "No se pudo guardar la licencia.");
    } finally {
      setLicenseSaving(false);
    }
  };

  const handleDeleteAthlete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/athletes?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setAthletes(athletes.filter((a) => a.id !== deleteTarget.id));
        toast.success("Atleta eliminado", `${deleteTarget.fullName} ha sido eliminado.`);
        setDeleteTarget(null);
      } else {
        toast.error("Error al eliminar", result.error);
      }
    } catch {
      toast.error("Error", "No se pudo eliminar el atleta.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Competitors remain athlete rows; this role toggle cannot create a competitor without a student record.
  const handleCompetitorRole = async (athlete: Athlete) => {
    const nextValue = !athlete.isCompetitor;
    try {
      const response = await fetch("/api/v1/athletes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: athlete.id, isCompetitor: nextValue }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo actualizar el rol.");
      setAthletes((current) => current.map((item) => item.id === athlete.id ? result.data : item));
      toast.success(nextValue ? "Competidor habilitado" : "Competidor retirado", `${athlete.fullName} sigue como alumno.`);
    } catch (error) {
      toast.error("No se pudo cambiar el rol", error instanceof Error ? error.message : "Error de conexión.");
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success("Copiado", `${fieldName} copiado al portapapeles.`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAll = () => {
    if (!credentialsModal) return;
    const text = `Credenciales de acceso TKD Global Hub:
Atleta: ${credentialsModal.athleteName}
Usuario: ${credentialsModal.username}
Contraseña: ${credentialsModal.password}
Email: ${credentialsModal.email}
Rol: ${credentialsModal.role}`;
    navigator.clipboard.writeText(text);
    setCopiedField("all");
    toast.success("Copiado", "Todas las credenciales han sido copiadas al portapapeles.");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleGenerateUser = async (athlete: Athlete) => {
    setGeneratingAthleteId(athlete.id);
    try {
      const res = await fetch("/api/v1/athletes/generate-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: athlete.id }),
      });
      const result = await res.json();
      if (result.success && result.credentials) {
        // Actualizar el userId del atleta localmente
        setAthletes((prev) =>
          prev.map((a) => (a.id === athlete.id ? { ...a, userId: result.credentials.userId } : a))
        );
        setShowPassword(true);
        setCredentialsModal({
          athleteName: result.credentials.athleteName || athlete.fullName,
          username: result.credentials.username,
          email: result.credentials.email,
          password: result.credentials.password,
          role: result.credentials.role,
          userId: result.credentials.userId,
        });
        toast.success("Usuario generado", `Credenciales creadas para ${athlete.fullName}.`);
      } else {
        toast.error("Error", result.error || "No se pudo generar el usuario.");
      }
    } catch {
      toast.error("Error de red", "No se pudo conectar con el servidor.");
    } finally {
      setGeneratingAthleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Swords className="w-6 h-6 text-sky-400" />
            {activeRosterView === "competitors" ? "Gestión de Competidores WT" : "Gestión de Alumnos WT"}
          </h2>
          <p className="text-xs text-slate-400">
            Fichas biométricas, categorías oficiales World Taekwondo, FC Máxima y Readiness
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          {activeRosterView === "competitors" ? "Registrar Competidor" : "Registrar Alumno"}
        </button>
      </div>

      {showRosterTabs && <div className="flex gap-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => { setRosterView("students"); setCurrentPage(1); }}
          aria-pressed={rosterView === "students"}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${rosterView === "students" ? "border-sky-400 text-sky-300" : "border-transparent text-slate-500 hover:text-white"}`}
        >Alumnos <span className="ml-1 text-[10px]">{students.length}</span></button>
        <button
          type="button"
          onClick={() => { setRosterView("competitors"); setCurrentPage(1); }}
          aria-pressed={rosterView === "competitors"}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${rosterView === "competitors" ? "border-amber-400 text-amber-300" : "border-transparent text-slate-500 hover:text-white"}`}
        >Competidores <span className="ml-1 text-[10px]">{competitors.length}</span></button>
      </div>}

      {/* Filter and Search */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nombre o club..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setSelectedCategory(cat.key);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.key
                  ? "bg-sky-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Students and competitors share one athlete record; the selected tab filters the role view. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedAthletes.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs">
            No se encontraron atletas que coincidan con la búsqueda.
          </div>
        ) : (
          paginatedAthletes.map((athlete) => {
            const winRate = Math.round(
              (athlete.stats.matchesWon / (athlete.stats.matchesPlayed || 1)) * 100
            );
            return (
              <div
                key={athlete.id}
                className="glass-panel rounded-2xl border border-slate-800 p-6 flex flex-col justify-between hover:border-sky-500/40 transition-all shadow-xl relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-rose-500 p-0.5">
                        <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center text-white font-black text-sm">
                          {athlete.fullName.split(" ").map((n) => n[0]).join("")}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{athlete.fullName}</h3>
                        <p className="text-[11px] text-slate-400">{athlete.clubName || <span className="text-rose-400 flex items-center gap-1"><ShieldOff className="w-3 h-3 inline" /> Sin club</span>}</p>
                        {athlete.coachName && (
                          <p className="text-[10px] text-sky-400/70">Entrenador: {athlete.coachName}</p>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800/60 font-mono">
                      {athlete.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mb-3 flex items-center justify-between text-[10px]">
                    <span className={athlete.isCompetitor ? "text-amber-300 font-semibold" : "text-slate-400 font-medium"}>
                      {athlete.isCompetitor ? "COMPETIDOR WT" : "ALUMNO"}
                    </span>
                    {athlete.isCompetitor ? <Award className="h-3.5 w-3.5 text-amber-300" /> : null}
                  </div>

                  {/* Biometrics Matrix */}
                  <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-900/90 border border-slate-800 mb-4">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">Readiness</div>
                      <div className="font-mono font-black text-sm text-emerald-400">
                        {athlete.readinessScore}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">FC Máx</div>
                      <div className="font-mono font-black text-sm text-rose-400">
                        {athlete.maxHeartRateBpm}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase">VO2 Máx</div>
                      <div className="font-mono font-black text-sm text-sky-400">
                        {athlete.vo2MaxEstimate}
                      </div>
                    </div>
                  </div>

                  {/* Additional details */}
                  <div className="space-y-1.5 text-xs mb-4">
                    <div className="flex justify-between text-slate-400">
                      <span>Peso / Altura:</span>
                      <span className="text-white font-mono">{athlete.weightKg} kg / {athlete.heightCm} cm</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Cinturón:</span>
                      <span className="text-white font-medium">{athlete.beltRank.replace("_", " ")}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Efectividad en Combate:</span>
                      <span className="text-amber-400 font-bold font-mono">
                        {winRate}% ({athlete.stats.matchesWon}V - {athlete.stats.matchesPlayed - athlete.stats.matchesWon}D)
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Técnica Favorita:</span>
                      <span className="text-sky-300 font-medium truncate max-w-[150px]">
                        {athlete.stats.favouriteTechnique}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleCompetitorRole(athlete)}
                    className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${athlete.isCompetitor ? "border-amber-800/60 bg-amber-950/20 text-amber-300 hover:border-rose-700 hover:text-rose-300" : "border-sky-800/60 bg-sky-950/20 text-sky-300 hover:border-amber-700 hover:text-amber-300"}`}
                  >{athlete.isCompetitor ? "Quitar de competidores" : "Convertir en competidor"}</button>
                  {/* Botón / Estado de generación automática de usuario */}
                  {athlete.userId ? (
                    <div className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-[11px]">
                      <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        Usuario Activo
                      </span>
                      <button
                        onClick={() => handleGenerateUser(athlete)}
                        disabled={generatingAthleteId === athlete.id}
                        className="text-[10px] text-slate-400 hover:text-amber-300 flex items-center gap-1 transition-colors disabled:opacity-50"
                        title="Regenerar contraseña y ver credenciales"
                      >
                        {generatingAthleteId === athlete.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        ) : (
                          <Key className="w-3 h-3 text-amber-400" />
                        )}
                        <span>Regenerar Clave</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleGenerateUser(athlete)}
                      disabled={generatingAthleteId === athlete.id}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 hover:from-sky-500/30 hover:to-indigo-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 shadow-sm"
                    >
                      {generatingAthleteId === athlete.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                          <span>Generando usuario...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 text-sky-400" />
                          <span>Generar Usuario Automático</span>
                        </>
                      )}
                    </button>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(athlete)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold border border-slate-700 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteTarget(athlete)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition-colors"
                      title="Eliminar atleta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredAthletes.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      {/* Add / Edit Athlete Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white mb-4">
              {editingAthlete ? "Editar Ficha" : activeRosterView === "competitors" ? "Registrar Competidor WT" : "Registrar Alumno WT"}
            </h3>
            <form onSubmit={handleSaveAthlete} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                    placeholder="Ej. Javier Pérez"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Categoría Oficial WT</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as WTCategory })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="SENIOR_M_58">Senior Masc. -58kg</option>
                    <option value="SENIOR_M_68">Senior Masc. -68kg</option>
                    <option value="SENIOR_M_80">Senior Masc. -80kg</option>
                    <option value="SENIOR_M_PLUS_80">Senior Masc. +80kg</option>
                    <option value="SENIOR_F_49">Senior Fem. -49kg</option>
                    <option value="SENIOR_F_57">Senior Fem. -57kg</option>
                    <option value="SENIOR_F_67">Senior Fem. -67kg</option>
                    <option value="SENIOR_F_PLUS_67">Senior Fem. +67kg</option>
                  </select>
                </div>
              </div>

              {!editingAthlete && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="col-span-2 text-[11px] font-semibold text-sky-300">Credenciales del alumno (opcionales)</div>
                  <label className="text-slate-400">
                    Usuario personalizado
                    <input
                      value={customUsername}
                      onChange={(event) => setCustomUsername(event.target.value)}
                      minLength={3}
                      maxLength={32}
                      pattern="[A-Za-z0-9._-]{3,32}"
                      autoComplete="off"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white"
                      placeholder="Se genera automáticamente si se deja vacío"
                    />
                  </label>
                  <label className="text-slate-400">
                    Contraseña personalizada
                    <input
                      type="password"
                      value={customPassword}
                      onChange={(event) => setCustomPassword(event.target.value)}
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-white"
                      placeholder="Se genera automáticamente si se deja vacío"
                    />
                  </label>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weightKg}
                    onChange={(e) => setFormData({ ...formData, weightKg: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Altura (cm)</label>
                  <input
                    type="number"
                    value={formData.heightCm}
                    onChange={(e) => setFormData({ ...formData, heightCm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">FC Máxima (BPM)</label>
                  <input
                    type="number"
                    value={formData.maxHeartRateBpm}
                    onChange={(e) => setFormData({ ...formData, maxHeartRateBpm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">FC Reposo (BPM)</label>
                  <input
                    type="number"
                    value={formData.restingHeartRateBpm}
                    onChange={(e) => setFormData({ ...formData, restingHeartRateBpm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">VO2 Máx Estimado</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.vo2MaxEstimate}
                    onChange={(e) => setFormData({ ...formData, vo2MaxEstimate: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Readiness (%)</label>
                  <input
                    type="number"
                    value={formData.readinessScore}
                    onChange={(e) => setFormData({ ...formData, readinessScore: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              {/* Club obligatorio */}
              <div>
                <label className="block text-slate-400 mb-1">
                  Club <span className="text-rose-400">*</span>
                </label>
                {user?.role === "ADMIN" ? (
                  <select
                    required
                    value={formData.clubId}
                    onChange={(e) => handleClubChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">— Selecciona un club —</option>
                    {clubs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.coachName ? `(Ent: ${c.coachName})` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    readOnly
                    value={formData.clubName || "(tu club asignado)"}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-400 cursor-not-allowed"
                  />
                )}
                {formData.coachName && (
                  <p className="mt-1 text-[10px] text-sky-400">Entrenador asignado: <strong>{formData.coachName}</strong></p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Técnica Especialista / Favorita</label>
                <input
                  type="text"
                  value={formData.favouriteTechnique}
                  onChange={(e) => setFormData({ ...formData, favouriteTechnique: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  placeholder="Ej. Mondollyo Naeryo Chagui"
                />
              </div>

              {editingAthlete && (
                <section className="space-y-3 rounded-xl border border-emerald-800/50 bg-emerald-950/10 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-200">Licencia federativa</h4>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Regístrala aquí cuando el documento haya sido expedido. El número federativo es obligatorio.
                    </p>
                  </div>
                  {licenseLoading ? (
                    <p className="text-xs text-slate-400">Consultando licencia…</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-[11px] text-slate-400">
                          Nº de licencia federativa *
                          <input value={athleteLicense.federationCode} onChange={(event) => setAthleteLicense({ ...athleteLicense, federationCode: event.target.value })} maxLength={50} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          Federación / región *
                          <input value={athleteLicense.federationRegion} onChange={(event) => setAthleteLicense({ ...athleteLicense, federationRegion: event.target.value })} maxLength={255} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          Vencimiento licencia *
                          <input type="date" value={athleteLicense.licenseExpiryDate} onChange={(event) => setAthleteLicense({ ...athleteLicense, licenseExpiryDate: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          Póliza del seguro *
                          <input value={athleteLicense.insurancePolicy} onChange={(event) => setAthleteLicense({ ...athleteLicense, insurancePolicy: event.target.value })} maxLength={255} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          Seguro válido hasta *
                          <input type="date" value={athleteLicense.insuranceValidUntil} onChange={(event) => setAthleteLicense({ ...athleteLicense, insuranceValidUntil: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          Fecha apto médico *
                          <input type="date" value={athleteLicense.medicalClearanceDate} onChange={(event) => setAthleteLicense({ ...athleteLicense, medicalClearanceDate: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          Apto médico válido hasta *
                          <input type="date" value={athleteLicense.medicalClearanceValidUntil} onChange={(event) => setAthleteLicense({ ...athleteLicense, medicalClearanceValidUntil: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                        </label>
                        <label className="flex items-center gap-2 self-end pb-2 text-[11px] text-slate-300">
                          <input type="checkbox" checked={athleteLicense.minorConsentSigned} onChange={(event) => setAthleteLicense({ ...athleteLicense, minorConsentSigned: event.target.checked })} />
                          Consentimiento de tutor firmado
                        </label>
                      </div>
                      <button type="button" onClick={() => void saveAthleteLicense()} disabled={licenseSaving || !athleteLicense.federationCode.trim()} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        {licenseSaving ? "Guardando licencia…" : "Guardar licencia"}
                      </button>
                    </>
                  )}
                </section>
              )}

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
                  {editingAthlete ? "Guardar Cambios" : "Guardar Ficha del Atleta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="¿Eliminar atleta?"
        description={`Esta acción eliminará de forma permanente la ficha y datos biométricos de "${deleteTarget?.fullName}" (${deleteTarget?.category}).`}
        confirmText="Eliminar Atleta"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteAthlete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Credentials Modal */}
      {credentialsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full rounded-2xl border border-sky-500/50 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-chong-glow">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Credenciales de Acceso</h3>
                <p className="text-xs text-slate-400">
                  Usuario vinculado a <span className="text-sky-300 font-semibold">{credentialsModal.athleteName}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 bg-sky-950/40 border border-sky-800/40 p-3 rounded-xl leading-relaxed">
              El deportista puede usar estas credenciales para iniciar sesión en la aplicación móvil o en la web.
            </p>

            <div className="space-y-3 mb-5">
              {/* Username */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex justify-between items-center">
                  <span>Usuario de Acceso</span>
                  <span className="text-[10px] text-slate-500">Login principal</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-white text-sm font-semibold select-all">
                    {credentialsModal.username}
                  </span>
                  <button
                    onClick={() => handleCopy(credentialsModal.username, "Usuario")}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Copiar usuario"
                  >
                    {copiedField === "Usuario" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Password */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex justify-between items-center">
                  <span>Contraseña Temporal / Generada</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-emerald-400 text-sm font-bold select-all tracking-wider">
                    {showPassword ? credentialsModal.password : "••••••••••••"}
                  </span>
                  <button
                    onClick={() => handleCopy(credentialsModal.password, "Contraseña")}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Copiar contraseña"
                  >
                    {copiedField === "Contraseña" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex justify-between items-center">
                  <span>Email Asignado</span>
                  <span className="text-[10px] text-slate-500">Alternativa de login</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-slate-300 text-xs truncate max-w-[240px] select-all">
                    {credentialsModal.email}
                  </span>
                  <button
                    onClick={() => handleCopy(credentialsModal.email, "Email")}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Copiar email"
                  >
                    {copiedField === "Email" ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyAll}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
              >
                {copiedField === "all" ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-sky-400" />
                    <span>Copiar Todo</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setCredentialsModal(null)}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
