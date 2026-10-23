"use client";

import { useState } from "react";
import {
  Sparkles,
  Award,
  Users,
  BrainCircuit,
  Heart,
  Trophy,
  Activity,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  Check,
  Zap,
  Info,
  Calendar,
  Layers,
  ChevronRight,
  School,
  Wallet,
  Play,
  Flame,
  Clock,
  TrendingUp,
} from "lucide-react";
import { ClubPlan } from "@/lib/types";

type SimulatorRole = "COACH" | "ATHLETE";

interface FeatureMatrixItem {
  id: string;
  name: string;
  category: "Gestión" | "Rendimiento & Biometría" | "Competición" | "IA & Táctica";
  coachMinPlan: ClubPlan;
  athleteMinPlan: ClubPlan;
  coachDesc: string;
  athleteDesc: string;
}

const FEATURES_LIST: FeatureMatrixItem[] = [
  {
    id: "student-management",
    name: "Ficha & Gestión de Alumnos",
    category: "Gestión",
    coachMinPlan: "FREE",
    athleteMinPlan: "FREE",
    coachDesc: "Hasta 5 alumnos en Free. Hasta 25 en SemiPro. Ilimitados en Pro.",
    athleteDesc: "Acceso a su perfil deportivo, carnet y datos de dojang.",
  },
  {
    id: "attendance-and-dues",
    name: "Control de Asistencias & Cuotas",
    category: "Gestión",
    coachMinPlan: "FREE",
    athleteMinPlan: "FREE",
    coachDesc: "Pase de lista diario, cobro rápido y emisión de recibos oficiales.",
    athleteDesc: "Visualización de sus clases asistidas para examen y estado de cuota.",
  },
  {
    id: "federation-licenses",
    name: "Licencias Federativas & Seguros",
    category: "Gestión",
    coachMinPlan: "SEMIPRO",
    athleteMinPlan: "FREE",
    coachDesc: "Semáforo de caducidades RFET, control de seguros y apto médico.",
    athleteDesc: "Consulta de validez de su licencia federativa y cobertura médica.",
  },
  {
    id: "classes-and-drills",
    name: "Clases & Vídeos Compartidos",
    category: "Gestión",
    coachMinPlan: "SEMIPRO",
    athleteMinPlan: "SEMIPRO",
    coachDesc: "Programación de clases compartidas y videoteca técnica WT.",
    athleteDesc: "Acceso a vídeos de entrenamiento y tareas encomendadas.",
  },
  {
    id: "training-trimp",
    name: "Carga de Entrenamiento (TRIMP) & RPE",
    category: "Rendimiento & Biometría",
    coachMinPlan: "SEMIPRO",
    athleteMinPlan: "SEMIPRO",
    coachDesc: "Monitoreo de fatiga, RPE Borg y volumen aeróbico acumulado.",
    athleteDesc: "Historial de sus sesiones, esfuerzo percibido y descanso sugerido.",
  },
  {
    id: "squad-telemetry",
    name: "Telemetría Escuadrón (PPM en Vivo)",
    category: "Rendimiento & Biometría",
    coachMinPlan: "PRO",
    athleteMinPlan: "PRO",
    coachDesc: "Monitoreo simultáneo en tiempo real de hasta 16 pulsómetros.",
    athleteDesc: "Visualización de zona cardíaca (Z1-Z5) en vivo durante combate.",
  },
  {
    id: "gamification-medals",
    name: "Logros, Medallas & Gamificación",
    category: "Rendimiento & Biometría",
    coachMinPlan: "SEMIPRO",
    athleteMinPlan: "SEMIPRO",
    coachDesc: "Otorgar medallas marciales de constancia, técnica y combate.",
    athleteDesc: "Desbloqueo de medallas, nivel marcial y progresión por cinturón.",
  },
  {
    id: "competitions-brackets",
    name: "Competiciones & Brackets Daedo",
    category: "Competición",
    coachMinPlan: "PRO",
    athleteMinPlan: "SEMIPRO",
    coachDesc: "Generador de cuadros eliminatorios, registro OVR y estadísticas WT.",
    athleteDesc: "Consulta de sus cruces en el torneo, rival asignado y horario.",
  },
  {
    id: "live-scoreboard",
    name: "Marcador Digital WT en Vivo",
    category: "Competición",
    coachMinPlan: "PRO",
    athleteMinPlan: "FREE",
    coachDesc: "Marcador electrónico oficial con rounds de 2 min, gam-jeoms y petos.",
    athleteDesc: "Vista de espectador o seguimiento de puntos de su tatami.",
  },
  {
    id: "ai-tactics-coach",
    name: "Coach Táctico IA & Diagnóstico",
    category: "IA & Táctica",
    coachMinPlan: "PRO",
    athleteMinPlan: "PRO",
    coachDesc: "Diagnóstico biomecánico, planes correctivos y tácticas anti-rival.",
    athleteDesc: "Asistente IA personal con consejos para corregir patadas y fatiga.",
  },
  {
    id: "ai-retrain",
    name: "Reentrenamiento de Red Neuronal",
    category: "IA & Táctica",
    coachMinPlan: "PRO",
    athleteMinPlan: "PRO",
    coachDesc: "Ajuste de pesos algorítmicos según el estilo y tácticas del dojang.",
    athleteDesc: "Recomendaciones hiperpersonalizadas según sus combates pasados.",
  },
];

const PLAN_RANKS: Record<ClubPlan, number> = {
  FREE: 0,
  SEMIPRO: 1,
  PRO: 2,
};

export default function RoleSimulatorPage() {
  const [simulatedRole, setSimulatedRole] = useState<SimulatorRole>("COACH");
  const [simulatedPlan, setSimulatedPlan] = useState<ClubPlan>("PRO");
  const [activeTab, setActiveTab] = useState<"preview" | "matrix" | "scenarios">("preview");

  const hasAccess = (item: FeatureMatrixItem) => {
    const requiredPlan = simulatedRole === "COACH" ? item.coachMinPlan : item.athleteMinPlan;
    return PLAN_RANKS[simulatedPlan] >= PLAN_RANKS[requiredPlan];
  };

  return (
    <div className="space-y-6 pb-16">
      {/* CABECERA HEROICA */}
      <div className="bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-slate-800 p-6 md:p-8 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-8 -mr-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Sparkles className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-purple-400">
                Simulador de Experiencia de Usuario
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Visión por Roles y Planes de Suscripción
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              Prueba de forma interactiva qué ve y qué herramientas tiene disponibles un{" "}
              <strong className="text-white">Entrenador (Coach)</strong> o un{" "}
              <strong className="text-white">Atleta (Alumno)</strong> en cada nivel:{" "}
              <span className="text-slate-400">Free</span>,{" "}
              <span className="text-cyan-400">SemiPro</span> o{" "}
              <span className="text-purple-400">Pro</span>.
            </p>
          </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-xl border border-purple-500/30 bg-purple-950/30 px-4 py-3 text-xs text-purple-200">
                Demostración pública: no modifica cuentas ni permisos.
              </span>

              <a
                href="/login"
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition"
              >
                Iniciar Sesión Real
              </a>
            </div>
          </div>

          {/* Banner de Acceso Público Sin Registro */}
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span>
                <strong>Acceso Público Sin Registro:</strong> Este simulador está abierto sin necesidad de crear cuenta ni introducir credenciales. Puedes interactuar y probar todas las vistas y planes.
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
              MODO DEMO PÚBLICA
            </span>
          </div>

          {/* SELECTORES DUALES: ROL + PLAN */}
          <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Selector 1: ROL */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 block">
              1. Selecciona el Rol a Simular:
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800">
              <button
                onClick={() => setSimulatedRole("COACH")}
                className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                  simulatedRole === "COACH"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                <Award className="w-4 h-4" />
                <span>🥋 Entrenador (Coach)</span>
              </button>

              <button
                onClick={() => setSimulatedRole("ATHLETE")}
                className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                  simulatedRole === "ATHLETE"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>🥊 Atleta (Alumno)</span>
              </button>
            </div>
          </div>

          {/* Selector 2: PLAN */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 block">
              2. Selecciona el Nivel de Plan:
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800">
              <button
                onClick={() => setSimulatedPlan("FREE")}
                className={`py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition ${
                  simulatedPlan === "FREE"
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                <span>🥉 FREE</span>
                <span className="text-[10px] font-normal opacity-70">Básico (0€)</span>
              </button>

              <button
                onClick={() => setSimulatedPlan("SEMIPRO")}
                className={`py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition ${
                  simulatedPlan === "SEMIPRO"
                    ? "bg-cyan-700 text-white shadow-md shadow-cyan-700/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                <span>🥈 SEMIPRO</span>
                <span className="text-[10px] font-normal opacity-70">Avanzado (29€/m)</span>
              </button>

              <button
                onClick={() => setSimulatedPlan("PRO")}
                className={`py-3 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 transition ${
                  simulatedPlan === "PRO"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                <span>🥇 PRO ÉLITE</span>
                <span className="text-[10px] font-normal opacity-70">Completo (79€/m)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PESTAÑAS DEL SIMULADOR */}
      <div className="flex border-b border-slate-800 bg-slate-900/50 p-1 rounded-2xl gap-2">
        <button
          onClick={() => setActiveTab("preview")}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            activeTab === "preview"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900/60"
          }`}
        >
          <Eye className="w-4 h-4 text-purple-400" />
          <span>Vista Previa en Vivo (Dashboard que ve este usuario)</span>
        </button>

        <button
          onClick={() => setActiveTab("matrix")}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            activeTab === "matrix"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900/60"
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Matriz de Permisos & Módulos Activos vs Bloqueados</span>
        </button>

        <button
          onClick={() => setActiveTab("scenarios")}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
            activeTab === "scenarios"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900/60"
          }`}
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <span>Casos de Uso Típicos del Taekwondo</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. VISTA PREVIA EN VIVO (MOCK DASHBOARD INTERACTIVO)     */}
      {/* ======================================================== */}
      {activeTab === "preview" && (
        <div className="space-y-6">
          {/* Marco del Viewport Simulado */}
          <div className="bg-slate-950 border-2 border-purple-500/30 rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
                </div>
                <div className="text-xs font-mono text-slate-400 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800">
                  simulador://dojang-hub/{simulatedRole.toLowerCase()}/plan-{simulatedPlan.toLowerCase()}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300">Modo Activo:</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60">
                  {simulatedRole === "COACH" ? "Entrenador" : "Atleta"} • {simulatedPlan}
                </span>
              </div>
            </div>

            {/* CONTENIDO INTERACTIVO SEGÚN ROL Y PLAN */}
            {simulatedRole === "COACH" && (
              <div className="space-y-6">
                {/* Resumen del Coach */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Tarjeta 1: Alumnos */}
                  <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-slate-400 font-semibold">Alumnos Registrados</div>
                      <Users className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {simulatedPlan === "FREE" ? "4 / 5" : simulatedPlan === "SEMIPRO" ? "18 / 25" : "48 (Ilimitados)"}
                    </div>
                    <div className="text-xs mt-2 text-slate-400">
                      {simulatedPlan === "FREE" ? (
                        <span className="text-amber-400 font-medium">⚠️ 1 cupo restante en Plan Free</span>
                      ) : simulatedPlan === "SEMIPRO" ? (
                        <span className="text-emerald-400 font-medium">✓ Capacidad para 7 más</span>
                      ) : (
                        <span className="text-purple-400 font-medium">✓ Capacidad ilimitada</span>
                      )}
                    </div>
                  </div>

                  {/* Tarjeta 2: Telemetría / Carga */}
                  <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-slate-400 font-semibold">Telemetría de Pulsaciones</div>
                      <Heart className="w-5 h-5 text-rose-400" />
                    </div>
                    {simulatedPlan === "PRO" ? (
                      <div>
                        <div className="text-2xl font-bold text-rose-400 flex items-center gap-2">
                          178 BPM <span className="text-xs font-normal text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">EN VIVO</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-2">6 pulsómetros sincronizados en tatami</div>
                      </div>
                    ) : simulatedPlan === "SEMIPRO" ? (
                      <div>
                        <div className="text-2xl font-bold text-slate-300">TRIMP 145 pts</div>
                        <div className="text-xs text-slate-400 mt-2">Carga acumulada (Sin streaming en vivo)</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-amber-500" /> Requiere Plan SemiPro/Pro
                        </div>
                        <div className="text-xs text-slate-500">Monitoreo cardíaco no disponible en Free</div>
                      </div>
                    )}
                  </div>

                  {/* Tarjeta 3: Coach Táctico IA */}
                  <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-slate-400 font-semibold">Coach Táctico IA WT</div>
                      <BrainCircuit className="w-5 h-5 text-purple-400" />
                    </div>
                    {simulatedPlan === "PRO" ? (
                      <div>
                        <div className="text-sm font-bold text-purple-300">Diagnóstico Listo (IA v2.4)</div>
                        <div className="text-xs text-slate-300 mt-1">
                          Recomendación: &quot;Intensificar Twichagui de contraataque en Round 3&quot;
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-purple-400" /> Módulo Exclusivo Plan PRO
                        </div>
                        <div className="text-xs text-slate-500">
                          Algoritmo de diagnóstico y juego táctico reservado para Pro
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner de Upselling contextual si es Free o SemiPro */}
                {simulatedPlan !== "PRO" && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">
                          {simulatedPlan === "FREE"
                            ? "Desbloquea hasta 25 alumnos y telemetría TRIMP con Plan SemiPro"
                            : "Desbloquea el Coach Táctico IA y Brackets con Plan Pro"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {simulatedPlan === "FREE" ? "Por solo 29€ al mes para tu dojang" : "Por 79€/mes con soporte ilimitado"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSimulatedPlan(simulatedPlan === "FREE" ? "SEMIPRO" : "PRO")}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                    >
                      Ver cómo se vería en {simulatedPlan === "FREE" ? "SemiPro" : "Pro"} ➜
                    </button>
                  </div>
                )}

                {/* Vista previa de herramientas del Entrenador */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bloque 1: Asistencias y Cuotas (disponible en todos) */}
                  <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Pase de Lista & Cuotas (Disponible en tu plan)
                      </h3>
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                        ACTIVO
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Como entrenador puedes pasar lista en tus grupos (Infantil, Cadete, Adultos) y marcar pagos de cuotas en efectivo o Bizum.
                    </p>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs space-y-2">
                      <div className="flex justify-between text-slate-300">
                        <span>Mateo Fernández (Cadete)</span>
                        <span className="text-emerald-400 font-semibold">Presente (17:30)</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Lucía Morales (Competición)</span>
                        <span className="text-emerald-400 font-semibold">Presente (17:32)</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloque 2: Competición y Marcador */}
                  <div className={`p-5 rounded-2xl border transition ${
                    simulatedPlan === "PRO"
                      ? "bg-slate-900/80 border-slate-800"
                      : "bg-slate-900/40 border-slate-800/50 opacity-75"
                  }`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        {simulatedPlan === "PRO" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-500" />
                        )}
                        Competiciones, Brackets & Marcador WT
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        simulatedPlan === "PRO"
                          ? "bg-purple-950 text-purple-300 border-purple-800/60"
                          : "bg-amber-950 text-amber-300 border-amber-800/60"
                      }`}>
                        {simulatedPlan === "PRO" ? "PRO EXCLUSIVO" : "BLOQUEADO EN ESTE PLAN"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Generador de cruces tipo Daedo, marcador digital con cronómetro y penalizaciones (Gam-Jeoms).
                    </p>
                    {simulatedPlan !== "PRO" && (
                      <div className="mt-3 p-2.5 bg-slate-950/80 rounded-xl border border-amber-900/40 text-xs text-amber-300/90 flex items-center gap-2">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>Para gestionar torneos oficiales se requiere suscripción Plan PRO.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO INTERACTIVO SI EL ROL ES ATLETA */}
            {simulatedRole === "ATHLETE" && (
              <div className="space-y-6">
                {/* Resumen del Atleta */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Tarjeta 1: Carnet y Cinturón */}
                  <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-slate-400 font-semibold">Grado Actual</div>
                      <Award className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="text-xl font-bold text-white">Cinturón Rojo-Negro</div>
                    <div className="text-xs mt-2 text-cyan-400 font-medium">
                      38 / 40 clases cumplidas para examen
                    </div>
                  </div>

                  {/* Tarjeta 2: Biometría / Pulsaciones */}
                  <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-slate-400 font-semibold">Frecuencia Cardíaca</div>
                      <Heart className="w-5 h-5 text-rose-400" />
                    </div>
                    {simulatedPlan === "PRO" ? (
                      <div>
                        <div className="text-2xl font-bold text-rose-400">182 BPM</div>
                        <div className="text-xs text-amber-400 mt-1">Zona Z4 (Umbral Anaeróbico)</div>
                      </div>
                    ) : simulatedPlan === "SEMIPRO" ? (
                      <div>
                        <div className="text-lg font-bold text-slate-300">TRIMP: 112 pts</div>
                        <div className="text-xs text-slate-400 mt-1">Histórico de sesiones disponible</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-500" /> Solo disponible en SemiPro/Pro
                        </div>
                        <div className="text-[11px] text-slate-500">No puedes ver tus pulsaciones en Free</div>
                      </div>
                    )}
                  </div>

                  {/* Tarjeta 3: Coach IA para el Atleta */}
                  <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-slate-400 font-semibold">Consejo Táctico IA Personal</div>
                      <BrainCircuit className="w-5 h-5 text-purple-400" />
                    </div>
                    {simulatedPlan === "PRO" ? (
                      <div>
                        <div className="text-xs text-purple-300 font-semibold">
                          &quot;Tu patada Nerio tiene 88% de efectividad al contragolpe tras esquive.&quot;
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-purple-400" /> IA Personalizada en Plan PRO
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Pide a tu maestro activar el Plan PRO para acceder a tácticas IA
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lo que ve en su pantalla el alumno */}
                <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-sm">
                      Mi Portal de Alumno ({simulatedPlan})
                    </h3>
                    <span className="text-xs text-slate-400">Dojang Central TKD</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="font-semibold text-slate-200">Estado de mi Cuota de Alumno:</div>
                      <div className="text-emerald-400 font-bold text-sm">✓ AL DÍA (Octubre 2026 - 55€)</div>
                      <div className="text-slate-400">Método de pago: Bizum</div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="font-semibold text-slate-200">Licencia Federativa:</div>
                      <div className="text-cyan-400 font-mono font-medium">RFET-202647</div>
                      <div className="text-slate-400">Válida hasta: 31/12/2026 (Seguro en vigor)</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. MATRIZ DE PERMISOS & ENTITLEMENTS                     */}
      {/* ======================================================== */}
      {activeTab === "matrix" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">
                Matriz de Características: {simulatedRole === "COACH" ? "Entrenador" : "Atleta"} en Plan {simulatedPlan}
              </h3>
              <p className="text-xs text-slate-400">
                Los módulos marcados en verde están completamente accesibles; los candados indican que requieren plan superior.
              </p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 font-semibold self-start sm:self-auto">
              {simulatedRole} • {simulatedPlan}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Módulo / Función</th>
                  <th className="py-3 px-4 font-semibold">Categoría</th>
                  <th className="py-3 px-4 font-semibold">Plan Mínimo</th>
                  <th className="py-3 px-4 font-semibold">Estado en tu Selección</th>
                  <th className="py-3 px-4 font-semibold">Descripción del Alcance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {FEATURES_LIST.map((feat) => {
                  const allowed = hasAccess(feat);
                  const minRequired = simulatedRole === "COACH" ? feat.coachMinPlan : feat.athleteMinPlan;

                  return (
                    <tr
                      key={feat.id}
                      className={`hover:bg-slate-800/40 transition ${
                        !allowed ? "opacity-60 bg-slate-950/30" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                        {allowed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span>{feat.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px]">
                          {feat.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-400">
                        {minRequired}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                            allowed
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800/60"
                              : "bg-rose-950 text-rose-300 border-rose-800/60"
                          }`}
                        >
                          {allowed ? "HABILITADO" : `BLOQUEADO (Requiere ${minRequired})`}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {simulatedRole === "COACH" ? feat.coachDesc : feat.athleteDesc}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. CASOS DE USO TÍPICOS                                  */}
      {/* ======================================================== */}
      {activeTab === "scenarios" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Escenario 1 */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-950/80 text-cyan-400 flex items-center justify-center font-bold text-lg border border-cyan-800/50">
              1
            </div>
            <h3 className="font-bold text-white text-base">
              Dojang de Barrio / Escuela Familiar (Plan Free)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              El maestro necesita controlar las asistencias diarias de los niños, saber quién ha pagado la cuota mensual de 55€ y no complicarse con sensores electrónicos.
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <div>• <strong>Herramienta clave:</strong> Gestión de Club (Asistencias + Cuotas).</div>
              <div>• <strong>Coste:</strong> 0€/mes.</div>
              <div>• <strong>Límite:</strong> Hasta 5 competidores federados.</div>
            </div>
            <button
              onClick={() => {
                setSimulatedRole("COACH");
                setSimulatedPlan("FREE");
                setActiveTab("preview");
              }}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
            >
              Simular este Dojang ➜
            </button>
          </div>

          {/* Escenario 2 */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-950/80 text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-800/50">
              2
            </div>
            <h3 className="font-bold text-white text-base">
              Club de Tecnificación Regional (Plan SemiPro)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              El club tiene entre 20 y 30 alumnos, monitoriza la fatiga con la escala de Borg y TRIMP, y comparte vídeos técnicos de los Pumses para que los alumnos practiquen en casa.
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <div>• <strong>Herramienta clave:</strong> Clases compartidas, TRIMP y Videoteca.</div>
              <div>• <strong>Coste:</strong> 29€/mes.</div>
              <div>• <strong>Límite:</strong> Hasta 25 atletas.</div>
            </div>
            <button
              onClick={() => {
                setSimulatedRole("COACH");
                setSimulatedPlan("SEMIPRO");
                setActiveTab("preview");
              }}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition"
            >
              Simular este Dojang ➜
            </button>
          </div>

          {/* Escenario 3 */}
          <div className="bg-slate-900/80 border border-purple-800/40 p-6 rounded-2xl space-y-4 bg-gradient-to-b from-purple-950/20 to-slate-900/80">
            <div className="w-12 h-12 rounded-xl bg-purple-950/80 text-purple-400 flex items-center justify-center font-bold text-lg border border-purple-800/50">
              3
            </div>
            <h3 className="font-bold text-white text-base">
              Equipo de Alta Competición Daedo / WT (Plan Pro)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Entrenadores de élite con pulsómetros en tiempo real en los petos, brackets de torneos oficiales y Coach Táctico IA para descifrar cómo ganar al rival en el 3er asalto.
            </p>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <div>• <strong>Herramienta clave:</strong> Telemetría en Vivo, IA Táctica y Brackets.</div>
              <div>• <strong>Coste:</strong> 79€/mes.</div>
              <div>• <strong>Límite:</strong> Sin límites técnicos ni de atletas.</div>
            </div>
            <button
              onClick={() => {
                setSimulatedRole("COACH");
                setSimulatedPlan("PRO");
                setActiveTab("preview");
              }}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg shadow-md transition"
            >
              Simular este Dojang ➜
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
