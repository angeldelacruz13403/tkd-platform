"use client";

import { useEffect, useState, useMemo } from "react";
import {
  ClipboardCheck,
  CreditCard,
  FileCheck,
  Award,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
  Plus,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Send,
  Printer,
  ChevronRight,
  Filter,
  Sparkles,
  ExternalLink,
  Wallet,
} from "lucide-react";
import { AttendanceRecord, AttendanceStatus, ClubFinanceEntry, ClubMemberLicense, BeltExamEvent, BeltExamCandidate } from "@/lib/types";
import { useToast } from "@/components/Toast";
import ClubFinancePanel from "@/components/ClubFinancePanel";

type TabKey = "attendance" | "dues" | "licenses" | "exams" | "finance";

export default function ClubManagementPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("attendance");
  const [loading, setLoading] = useState(true);

  // Filtros globales
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedGroup, setSelectedGroup] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Datos
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    presentToday: 0,
    attendanceRate: 0,
    duesCollected: 0,
    duesPending: 0,
    expiringLicenses: 0,
    readyForExam: 0,
  });

  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [dues, setDues] = useState<ClubFinanceEntry[]>([]);
  const [licenses, setLicenses] = useState<ClubMemberLicense[]>([]);
  const [exams, setExams] = useState<BeltExamEvent[]>([]);

  // Modales
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrInputCode, setQrInputCode] = useState("");
  const [qrLastChecked, setQrLastChecked] = useState<string | null>(null);

  const [payModalDue, setPayModalDue] = useState<ClubFinanceEntry | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BIZUM" | "CARD" | "TRANSFER">("BIZUM");

  const [receiptDue, setReceiptDue] = useState<ClubFinanceEntry | null>(null);

  const [renewModalLic, setRenewModalLic] = useState<ClubMemberLicense | null>(null);
  const [renewDate, setRenewDate] = useState("");

  const [gradeCandidateModal, setGradeCandidateModal] = useState<{
    examId: string;
    candidate: BeltExamCandidate;
  } | null>(null);
  const [scores, setScores] = useState({
    poomsae: 8.0,
    sparring: 8.0,
    technique: 8.0,
    breaking: 8.0,
    notes: "",
  });

  const [diplomaCandidate, setDiplomaCandidate] = useState<BeltExamCandidate | null>(null);

  // Cargar datos del servidor
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/v1/club-management?date=${selectedDate}&month=${selectedMonth}&group=${selectedGroup}`
      );
      const json = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || "No se pudieron cargar los datos del club.");
      }
      setMetrics(json.data.metrics);
      setAttendances(json.data.attendances || []);
      setGroups(json.data.groups || []);
      setDues(json.data.dues || []);
      setLicenses(json.data.licenses || []);
      setExams(json.data.exams || []);
    } catch (error) {
      setMetrics({
        totalStudents: 0,
        presentToday: 0,
        attendanceRate: 0,
        duesCollected: 0,
        duesPending: 0,
        expiringLicenses: 0,
        readyForExam: 0,
      });
      setAttendances([]);
      setGroups([]);
      setDues([]);
      setLicenses([]);
      setExams([]);
      toast.error(error instanceof Error ? error.message : "Error al conectar con la base de datos del club");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedMonth, selectedGroup]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "finance") setActiveTab("finance");
  }, []);

  const changeTab = (tab: TabKey) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", tab === "finance" ? "/club-management?tab=finance" : "/club-management");
  };

  // Manejador Asistencias
  const updateAttendanceStatus = async (
    athleteId: string,
    status: AttendanceStatus,
    group?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/v1/club-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_ATTENDANCE",
          athleteId,
          date: selectedDate,
          status,
          group,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "No se pudo actualizar asistencia.");
      setAttendances((prev) =>
        prev.map((a) => (a.athleteId === athleteId ? { ...a, status, checkInTime: json.data.checkInTime } : a))
      );
      toast.success("Asistencia actualizada");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar asistencia");
      return false;
    }
  };

  const markAllAttendances = async (status: Exclude<AttendanceStatus, "UNMARKED">) => {
    try {
      const res = await fetch("/api/v1/club-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BATCH_MARK_ALL",
          date: selectedDate,
          group: selectedGroup,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Error en actualización masiva.");
      toast.success(`Todos marcados como ${status}`);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error en actualización masiva");
    }
  };

  // Manejador Check-in QR
  const handleQrCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInputCode.trim()) return;

    // Buscamos si coincide con algún alumno
    const match = attendances.find(
      (a) =>
        a.athleteName.toLowerCase().includes(qrInputCode.toLowerCase()) ||
        a.athleteId.toLowerCase() === qrInputCode.toLowerCase()
    );

    if (match) {
      const updated = await updateAttendanceStatus(match.athleteId, "PRESENT", match.group);
      if (!updated) return;
      setQrLastChecked(match.athleteName);
      setQrInputCode("");
      toast.success(`¡Entrada registrada para ${match.athleteName}!`);
    } else {
      toast.warning("Taekwondista no encontrado en este turno");
    }
  };

  // Manejador Cobro
  const confirmPayment = async () => {
    if (!payModalDue) return;
    try {
      const res = await fetch("/api/v1/club-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "PAY_DUE",
          dueId: payModalDue.id,
          paymentMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Error al registrar pago.");
      toast.success("Pago registrado con éxito");
      setDues((prev) =>
        prev.map((d) => (d.id === payModalDue.id ? { ...d, status: "PAID", paymentMethod } : d))
      );
      setPayModalDue(null);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al registrar pago");
    }
  };

  // Generar cuotas mensuales
  const handleGenerateMonthlyDues = async () => {
    try {
      const res = await fetch("/api/v1/club-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GENERATE_MONTHLY_DUES",
          month: selectedMonth,
          defaultAmount: 55,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Error al generar cuotas.");
      toast.success(`Se han generado ${json.count} cuotas para ${selectedMonth}`);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al generar cuotas");
    }
  };

  // WhatsApp recordatorio
  const sendWhatsAppReminder = (due: ClubFinanceEntry) => {
    const text = encodeURIComponent(
      `🥋 *Dojang Taekwondo* - Estimada familia de *${due.athleteName || "alumno"}*:\n\nLe recordamos amablemente que la cuota correspondiente a *${due.description}* (${due.amount}€) está pendiente de abono.\n\nPuede abonarla en recepción (Efectivo/Tarjeta/Bizum). ¡Muchas gracias!`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Renovar Licencia
  const handleRenewLicense = async () => {
    if (!renewModalLic || !renewDate) return;
    try {
      const res = await fetch("/api/v1/club-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RENEW_LICENSE",
          licenseId: renewModalLic.id,
          newExpiryDate: renewDate,
          insuranceValidUntil: renewDate,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Error renovando licencia.");
      toast.success("Licencia federativa renovada");
      setLicenses((prev) =>
        prev.map((l) => (l.id === renewModalLic.id ? { ...l, licenseExpiryDate: renewDate, status: "ACTIVE" } : l))
      );
      setRenewModalLic(null);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error renovando licencia");
    }
  };

  // Calificar Examen
  const handleGradeExam = async () => {
    if (!gradeCandidateModal) return;
    try {
      const res = await fetch("/api/v1/club-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GRADE_EXAM_CANDIDATE",
          examId: gradeCandidateModal.examId,
          athleteId: gradeCandidateModal.candidate.athleteId,
          poomsaeScore: scores.poomsae,
          sparringScore: scores.sparring,
          techniqueScore: scores.technique,
          breakingScore: scores.breaking,
          notes: scores.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Error guardando calificaciones.");
      toast.success("Notas guardadas correctamente");
      setGradeCandidateModal(null);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error guardando calificaciones");
    }
  };

  // Emitir diploma
  const handleIssueDiploma = async (examId: string, candidate: BeltExamCandidate) => {
    try {
      const res = await fetch("/api/v1/club-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ISSUE_DIPLOMA",
          examId,
          athleteId: candidate.athleteId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Error emitiendo diploma.");
      toast.success(`¡Diploma emitido para ${candidate.athleteName}!`);
      setDiplomaCandidate(candidate);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error emitiendo diploma");
    }
  };

  // Filtrados
  const filteredAttendances = attendances.filter((a) =>
    a.athleteName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDues = dues.filter((d) =>
    (d.athleteName || d.description).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLicenses = licenses.filter((l) =>
    l.athleteName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.federationCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-6 rounded-2xl backdrop-blur-md shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Gestión Integral del Club
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                  DOJANG HUB
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Pase de lista diario, cobro de cuotas, licencias federativas y exámenes de grado
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS RÁPIDAS (KPIS) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Asistencia Hoy */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Asistencia Hoy</div>
            <div className="text-xl font-bold text-white">
              {metrics.attendanceRate}%{" "}
              <span className="text-xs font-normal text-slate-400">
                ({metrics.presentToday}/{metrics.totalStudents})
              </span>
            </div>
          </div>
        </div>

        {/* Cuotas del Mes */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Recaudación ({selectedMonth})</div>
            <div className="text-xl font-bold text-white">
              {metrics.duesCollected}€{" "}
              <span className="text-xs font-normal text-amber-400">
                ({metrics.duesPending}€ pend.)
              </span>
            </div>
          </div>
        </div>

        {/* Licencias en Alerta */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Licencias a Renovar</div>
            <div className="text-xl font-bold text-white">
              {metrics.expiringLicenses}{" "}
              <span className="text-xs font-normal text-slate-400">requieren atención</span>
            </div>
          </div>
        </div>

        {/* Exámenes de Grado */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400">Aptos para Pase Kup</div>
            <div className="text-xl font-bold text-white">
              {metrics.readyForExam}{" "}
              <span className="text-xs font-normal text-slate-400">con clases cumplidas</span>
            </div>
          </div>
        </div>
      </div>

      {/* BARRA DE NAVEGACIÓN DE PESTAÑAS */}
      <div className="flex border-b border-slate-800 bg-slate-900/40 rounded-xl p-1 gap-2 overflow-x-auto">
        <button
          onClick={() => changeTab("attendance")}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold transition ${
            activeTab === "attendance"
              ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Asistencias de Hoy</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-200 border border-cyan-800/40">
            {metrics.presentToday}
          </span>
        </button>

        <button
          onClick={() => changeTab("dues")}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold transition ${
            activeTab === "dues"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Cuotas y Cobros</span>
          {metrics.duesPending > 0 && (
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/40">
              {metrics.duesPending}€ pend.
            </span>
          )}
        </button>

        <button
          onClick={() => changeTab("licenses")}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold transition ${
            activeTab === "licenses"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Licencias y Documentación</span>
          {metrics.expiringLicenses > 0 && (
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/40">
              {metrics.expiringLicenses}
            </span>
          )}
        </button>

        <button
          onClick={() => changeTab("exams")}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold transition ${
            activeTab === "exams"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Grados y Exámenes</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-200 border border-purple-800/40">
            KUP / DAN
          </span>
        </button>
        <button
          onClick={() => changeTab("finance")}
          className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold transition ${
            activeTab === "finance"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Finanzas</span>
        </button>
      </div>

      {activeTab === "finance" && <ClubFinancePanel />}

      {/* ======================================================== */}
      {/* PESTAÑA 1: ASISTENCIAS DE HOY                            */}
      {/* ======================================================== */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          {/* Controles de filtro y acciones rápidas */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-sm text-slate-200">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent border-none text-slate-200 focus:outline-none"
                />
              </div>

              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">🥋 Todos los grupos / turnos</option>
                {groups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>

              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar alumno..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => markAllAttendances("PRESENT")}
                className="px-3 py-2 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Marcar Todos Presentes</span>
              </button>

              <button
                onClick={() => setQrModalOpen(true)}
                className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/30 transition"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Check-in Rápido / QR</span>
              </button>
            </div>
          </div>

          {/* Lista de Alumnos para Pase de Lista */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAttendances.length === 0 ? (
              <div className="col-span-full rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
                No hay alumnos ni asistencias registradas para este club y fecha en Supabase.
              </div>
            ) : filteredAttendances.map((rec) => {
              const isPresent = rec.status === "PRESENT";
              const isLate = rec.status === "LATE";
              const isAbsent = rec.status === "ABSENT";
              const isJustified = rec.status === "JUSTIFIED";
              const isUnmarked = rec.status === "UNMARKED";

              return (
                <div
                  key={rec.id}
                  className={`border rounded-xl p-4 transition flex flex-col justify-between ${
                    isPresent
                      ? "bg-slate-900/90 border-emerald-800/40 shadow-sm shadow-emerald-950/20"
                      : isLate
                      ? "bg-slate-900/90 border-amber-800/40"
                      : isJustified
                      ? "bg-slate-900/90 border-blue-800/40"
                        : isUnmarked
                          ? "bg-slate-900/60 border-slate-800"
                          : "bg-slate-900/60 border-slate-800 opacity-90"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-sm border border-slate-700">
                        {rec.athleteName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-base leading-tight">
                          {rec.athleteName}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {rec.group}
                          </span>
                          {rec.checkInTime && (
                            <span className="text-cyan-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {rec.checkInTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isPresent
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                            : isLate
                            ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                            : isJustified
                            ? "bg-blue-950 text-blue-400 border border-blue-800/60"
                            : isUnmarked
                            ? "bg-slate-800 text-slate-300 border border-slate-700"
                            : "bg-rose-950 text-rose-400 border border-rose-800/60"
                        }`}
                      >
                        {isPresent
                          ? "Presente"
                          : isLate
                          ? "Retraso"
                          : isJustified
                          ? "Justificado"
                          : isUnmarked
                          ? "Sin marcar"
                          : "Ausente"}
                      </span>
                    </div>
                  </div>

                  {rec.notes && (
                    <div className="text-xs text-slate-400 bg-slate-950/60 border border-slate-800/80 rounded-md p-2 mb-3">
                      💬 {rec.notes}
                    </div>
                  )}

                  {/* Botonera de Estado con 1 clic */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => updateAttendanceStatus(rec.athleteId, "PRESENT", rec.group)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center ${
                        isPresent
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-800/80 hover:bg-emerald-950 text-slate-400 hover:text-emerald-300"
                      }`}
                    >
                      Presente
                    </button>
                    <button
                      onClick={() => updateAttendanceStatus(rec.athleteId, "LATE", rec.group)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center ${
                        isLate
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-slate-800/80 hover:bg-amber-950 text-slate-400 hover:text-amber-300"
                      }`}
                    >
                      Tarde
                    </button>
                    <button
                      onClick={() => updateAttendanceStatus(rec.athleteId, "ABSENT", rec.group)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center ${
                        isAbsent
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-slate-800/80 hover:bg-rose-950 text-slate-400 hover:text-rose-300"
                      }`}
                    >
                      Falta
                    </button>
                    <button
                      onClick={() => updateAttendanceStatus(rec.athleteId, "JUSTIFIED", rec.group)}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center ${
                        isJustified
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-800/80 hover:bg-blue-950 text-slate-400 hover:text-blue-300"
                      }`}
                    >
                      Justif.
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 2: CUOTAS Y COBROS DEL DOJANG                    */}
      {/* ======================================================== */}
      {activeTab === "dues" && (
        <div className="space-y-4">
          {/* Barra de Filtros y Generación Masiva */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-sm text-slate-200">
                <Calendar className="w-4 h-4 text-blue-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent border-none text-slate-200 focus:outline-none"
                />
              </div>

              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar cuota o alumno..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleGenerateMonthlyDues}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Generar Cuotas ({selectedMonth})</span>
              </button>
            </div>
          </div>

          {/* Tabla de Cuotas de Alumnos */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Taekwondista</th>
                    <th className="py-3.5 px-4 font-semibold">Concepto / Cuota</th>
                    <th className="py-3.5 px-4 font-semibold">Importe</th>
                    <th className="py-3.5 px-4 font-semibold">Vencimiento</th>
                    <th className="py-3.5 px-4 font-semibold">Estado</th>
                    <th className="py-3.5 px-4 font-semibold">Método</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {filteredDues.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No hay cuotas registradas para este mes. Pulsa en &quot;Generar Cuotas&quot; para crearlas automáticamente.
                      </td>
                    </tr>
                  ) : (
                    filteredDues.map((due) => {
                      const isPaid = due.status === "PAID";
                      return (
                        <tr key={due.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            {due.athleteName || "Alumno"}
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">{due.description}</td>
                          <td className="py-3.5 px-4 font-bold text-white text-base">
                            {due.amount} {due.currency}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400">
                            {due.dueDate || due.occurredAt}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                                isPaid
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                                  : "bg-amber-950 text-amber-300 border-amber-800/60"
                              }`}
                            >
                              {isPaid ? "PAGADO" : "PENDIENTE"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-slate-300">
                            {due.paymentMethod ? (
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                                {due.paymentMethod}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!isPaid ? (
                                <>
                                  <button
                                    onClick={() => setPayModalDue(due)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Cobrar</span>
                                  </button>
                                  <button
                                    onClick={() => sendWhatsAppReminder(due)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg border border-slate-700 transition"
                                    title="Enviar recordatorio WhatsApp"
                                  >
                                    <Send className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setReceiptDue(due)}
                                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition"
                                >
                                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Recibo</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 3: LICENCIAS Y DOCUMENTACIÓN                     */}
      {/* ======================================================== */}
      {activeTab === "licenses" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por atleta o código RFET..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Vigor
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Vence pronto (&lt;30d)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Expirada
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLicenses.map((lic) => {
              const isExpired = lic.status === "EXPIRED";
              const isExpiring = lic.status === "EXPIRING_SOON";

              return (
                <div
                  key={lic.id}
                  className={`border rounded-xl p-5 bg-slate-900/80 flex flex-col justify-between transition ${
                    isExpired
                      ? "border-rose-800/50 bg-rose-950/10"
                      : isExpiring
                      ? "border-amber-800/50 bg-amber-950/10"
                      : "border-slate-800"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="font-bold text-white text-base">{lic.athleteName}</div>
                        <div className="text-xs text-slate-400">{lic.federationRegion}</div>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                          isExpired
                            ? "bg-rose-950 text-rose-300 border-rose-800/60"
                            : isExpiring
                            ? "bg-amber-950 text-amber-300 border-amber-800/60"
                            : "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                        }`}
                      >
                        {isExpired ? "CADUCADA" : isExpiring ? "VENCE PRONTO" : "ACTIVA"}
                      </span>
                    </div>

                    <div className="space-y-2 bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg text-xs text-slate-300 mb-4">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Nº Licencia RFET:</span>
                        <span className="font-mono font-medium text-cyan-400">{lic.federationCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Vigencia Licencia:</span>
                        <span className={isExpired ? "text-rose-400 font-bold" : isExpiring ? "text-amber-400 font-bold" : "text-slate-200"}>
                          {lic.licenseExpiryDate}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Seguro Deportivo:</span>
                        <span className="text-slate-200 truncate max-w-[170px]" title={lic.insurancePolicy}>
                          {lic.insurancePolicy}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Apto Médico:</span>
                        <span className="text-emerald-400 font-medium">
                          ✓ Válido hasta {lic.medicalClearanceValidUntil}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Consentimiento Tutor:</span>
                        <span className="text-slate-200">
                          {lic.minorConsentSigned ? "✓ Firmado" : "Pendiente"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setRenewModalLic(lic);
                      const nextYear = new Date();
                      nextYear.setFullYear(nextYear.getFullYear() + 1);
                      setRenewDate(nextYear.toISOString().slice(0, 10));
                    }}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Renovar Licencia & Seguro</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PESTAÑA 4: GRADOS Y EXÁMENES (KUP / DAN)                 */}
      {/* ======================================================== */}
      {activeTab === "exams" && (
        <div className="space-y-6">
          {exams.map((exam) => (
            <div key={exam.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-950 text-purple-300 border border-purple-800/60">
                      CONVOCATORIA ABIERTA
                    </span>
                    <span className="text-xs text-slate-400">Fecha: {exam.examDate}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">{exam.title}</h2>
                  <p className="text-xs text-slate-400">Tribunal evaluador: {exam.examinerName}</p>
                </div>

                <div className="text-sm text-slate-300 bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-xl">
                  Candidatos convocados: <strong className="text-purple-400">{exam.candidates.length}</strong>
                </div>
              </div>

              {/* Lista de Candidatos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exam.candidates.map((cand) => {
                  const meetsAttendance = cand.attendedClasses >= cand.minClassesRequired;
                  const hasScores = cand.poomsaeScore !== undefined;

                  return (
                    <div
                      key={cand.athleteId}
                      className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-white text-base">{cand.athleteName}</div>
                            <div className="text-xs text-slate-400">
                              {cand.currentBelt} ➜ <strong className="text-cyan-400">{cand.targetBelt}</strong>
                            </div>
                          </div>

                          {hasScores && (
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                                cand.passed
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                                  : "bg-rose-950 text-rose-300 border-rose-800/60"
                              }`}
                            >
                              {cand.passed ? "APTO" : "NO APTO"}
                            </span>
                          )}
                        </div>

                        {/* Barra de Asistencias Requeridas */}
                        <div className="mt-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Asistencia mínima:</span>
                            <span className={meetsAttendance ? "text-emerald-400 font-bold" : "text-amber-400"}>
                              {cand.attendedClasses} / {cand.minClassesRequired} clases
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                meetsAttendance ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.round((cand.attendedClasses / cand.minClassesRequired) * 100)
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Notas si existen */}
                        {hasScores && (
                          <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800 text-center text-xs">
                            <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                              <div className="text-slate-500 text-[10px]">PUMSE</div>
                              <div className="font-bold text-white">{cand.poomsaeScore}</div>
                            </div>
                            <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                              <div className="text-slate-500 text-[10px]">COMBATE</div>
                              <div className="font-bold text-white">{cand.sparringScore}</div>
                            </div>
                            <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                              <div className="text-slate-500 text-[10px]">TÉCNICA</div>
                              <div className="font-bold text-white">{cand.techniqueScore}</div>
                            </div>
                            <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                              <div className="text-slate-500 text-[10px]">ROTURA</div>
                              <div className="font-bold text-white">{cand.breakingScore}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => {
                            setGradeCandidateModal({ examId: exam.id, candidate: cand });
                            setScores({
                              poomsae: cand.poomsaeScore || 8.0,
                              sparring: cand.sparringScore || 8.0,
                              technique: cand.techniqueScore || 8.0,
                              breaking: cand.breakingScore || 8.0,
                              notes: cand.notes || "",
                            });
                          }}
                          className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                        >
                          {hasScores ? "Editar Notas" : "Evaluar Examen"}
                        </button>

                        {cand.passed && (
                          <button
                            onClick={() => handleIssueDiploma(exam.id, cand)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{cand.diplomaIssued ? "Ver Diploma" : "Emitir Diploma"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MODO KIOSKO / CHECK-IN QR                         */}
      {/* ======================================================== */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setQrModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center space-y-3 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/80 border border-cyan-800/50 flex items-center justify-center text-cyan-400 mx-auto">
                <QrCode className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-bold text-white">Check-in Rápido de Dojang</h3>
              <p className="text-xs text-slate-400">
                Pasa el carnet QR por el lector o introduce el nombre o ID del alumno
              </p>
            </div>

            <form onSubmit={handleQrCheckIn} className="space-y-4">
              <div>
                <input
                  type="text"
                  autoFocus
                  placeholder="Escanear carnet o teclear nombre..."
                  value={qrInputCode}
                  onChange={(e) => setQrInputCode(e.target.value)}
                  className="w-full bg-slate-950 border border-cyan-500/50 rounded-xl px-4 py-3 text-white text-center font-mono text-base focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {qrLastChecked && (
                <div className="bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 p-3 rounded-xl text-xs text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Última entrada: <strong>{qrLastChecked}</strong></span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-cyan-600/30"
              >
                Registrar Asistencia
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: COBRAR CUOTA                                      */}
      {/* ======================================================== */}
      {payModalDue && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setPayModalDue(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-white mb-2">Cobrar Cuota Mensual</h3>
            <p className="text-xs text-slate-400 mb-4">{payModalDue.description}</p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center mb-5">
              <div className="text-xs text-slate-500">IMPORTE A COBRAR</div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                {payModalDue.amount} {payModalDue.currency}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <label className="text-xs font-semibold text-slate-300 block">
                Selecciona Método de Pago:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["BIZUM", "CARD", "CASH", "TRANSFER"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition ${
                      paymentMethod === m
                        ? "bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-600/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {m === "BIZUM" ? "📱 Bizum" : m === "CARD" ? "💳 Tarjeta / TPV" : m === "CASH" ? "💶 Efectivo" : "🏛️ Transferencia"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPayModalDue(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPayment}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RECIBO OFICIAL DEL CLUB                           */}
      {/* ======================================================== */}
      {receiptDue && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-white">
            <button
              onClick={() => setReceiptDue(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="border border-slate-800 bg-white text-slate-900 p-6 rounded-xl space-y-4">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-extrabold text-base tracking-tight uppercase text-blue-900">
                    Dojang Taekwondo - Recibo Oficial
                  </h4>
                  <p className="text-xs text-slate-500">CIF / Código Club: TKD-MAD-2026</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Recibo Nº: {receiptDue.id.slice(-8).toUpperCase()}</div>
                  <div>Fecha: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              <div className="text-sm space-y-1">
                <div><strong>Alumno:</strong> {receiptDue.athleteName || "Taekwondista"}</div>
                <div><strong>Concepto:</strong> {receiptDue.description}</div>
                <div><strong>Método de pago:</strong> {receiptDue.paymentMethod || "Efectivo"}</div>
              </div>

              <div className="border-t border-b border-slate-200 py-3 flex justify-between items-center text-lg font-bold">
                <span>TOTAL ABONADO:</span>
                <span className="text-blue-900 font-extrabold text-2xl">
                  {receiptDue.amount} {receiptDue.currency}
                </span>
              </div>

              <div className="flex justify-between items-end pt-2 text-[11px] text-slate-400">
                <div>Firma / Sello de Recepción: <br /><span className="font-script text-slate-600 italic">Maestro Director</span></div>
                <div className="text-emerald-700 font-bold border border-emerald-500 px-2 py-0.5 rounded">
                  PAGADO
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RENOVAR LICENCIA                                   */}
      {/* ======================================================== */}
      {renewModalLic && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setRenewModalLic(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Renovar Licencia Federativa</h3>
            <p className="text-xs text-slate-400 mb-4">{renewModalLic.athleteName} ({renewModalLic.federationCode})</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1 block">
                  Nueva Fecha de Caducidad de Licencia & Seguro:
                </label>
                <input
                  type="date"
                  value={renewDate}
                  onChange={(e) => setRenewDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setRenewModalLic(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenewLicense}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30"
              >
                Guardar Renovación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: EVALUACIÓN DE EXAMEN (TRIBUNAL)                   */}
      {/* ======================================================== */}
      {gradeCandidateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setGradeCandidateModal(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-white mb-1">Acta de Calificación de Examen</h3>
            <p className="text-xs text-slate-400 mb-4">
              Candidato: <strong>{gradeCandidateModal.candidate.athleteName}</strong> ➜ Grado pretendido: <strong>{gradeCandidateModal.candidate.targetBelt}</strong>
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Poomsae / Formas (0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={scores.poomsae}
                  onChange={(e) => setScores({ ...scores, poomsae: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Combate / Kyorugi (0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={scores.sparring}
                  onChange={(e) => setScores({ ...scores, sparring: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Técnica Fundamental (0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={scores.technique}
                  onChange={(e) => setScores({ ...scores, technique: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">Rotura / Kyokpa (0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={scores.breaking}
                  onChange={(e) => setScores({ ...scores, breaking: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-300 font-medium block mb-1">Observaciones del Tribunal</label>
              <textarea
                rows={2}
                value={scores.notes}
                onChange={(e) => setScores({ ...scores, notes: e.target.value })}
                placeholder="Buena posición en Ap Kubi, mejorar guardia en combate..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200"
              />
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between mb-5">
              <span className="text-xs text-slate-400">Nota media calculada:</span>
              <span className="text-base font-bold text-cyan-400">
                {((scores.poomsae + scores.sparring + scores.technique + scores.breaking) / 4).toFixed(1)} / 10
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setGradeCandidateModal(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleGradeExam}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30"
              >
                Registrar Calificación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: DIPLOMA OFICIAL DE GRADO KUP / DAN                */}
      {/* ======================================================== */}
      {diplomaCandidate && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative text-white">
            <button
              onClick={() => setDiplomaCandidate(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            {/* Certificado con marco honorífico */}
            <div className="border-4 border-double border-amber-600/80 bg-gradient-to-b from-amber-50 to-orange-50 text-slate-900 p-8 rounded-xl text-center space-y-4 shadow-xl">
              <div className="text-xs font-bold tracking-widest uppercase text-amber-800">
                FEDERACIÓN DE TAEKWONDO • DOJANG OFICIAL
              </div>
              <h3 className="text-3xl font-serif font-black tracking-wide text-slate-900">
                DIPLOMA DE GRADO
              </h3>
              <p className="text-xs text-slate-600 italic">
                Por cuanto el tribunal calificador ha comprobado la destreza técnica, disciplina y espíritu marcial de:
              </p>
              <div className="text-2xl font-bold text-amber-900 border-b border-amber-400/60 pb-2 inline-block px-6">
                {diplomaCandidate.athleteName}
              </div>
              <p className="text-sm text-slate-700">
                Se le otorga formalmente el grado de:
              </p>
              <div className="text-xl font-black text-slate-900 uppercase tracking-wider bg-amber-200/60 py-2 px-4 rounded-lg inline-block border border-amber-300">
                {diplomaCandidate.targetBelt}
              </div>
              <div className="flex justify-between items-end pt-6 text-xs text-slate-600">
                <div>
                  <div className="border-t border-slate-400 pt-1 w-32 font-medium">Director Técnico</div>
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-700 flex items-center justify-center text-[10px] font-bold text-amber-800 uppercase transform -rotate-12">
                  SELLO TKD
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 w-32 font-medium">Maestro Evaluador</div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-600/20"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Diploma</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
