"use client";

import { useState, useEffect } from "react";
import {
  BrainCircuit,
  Swords,
  BookOpen,
  Target,
  Sparkles,
  Shield,
  Activity,
  Award,
  Clock,
  Printer,
  Copy,
  Check,
  ChevronRight,
  Flame,
  UserCheck,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Athlete } from "@/lib/types";
import { useToast } from "@/components/Toast";
import CopilotChat from "@/components/CopilotChat";

type ActiveTab = "CHAT" | "GAME_PLAN" | "CLASS_PLAN" | "DIAGNOSIS";

export default function CoachTacticsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("CHAT");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [isLoadingAthletes, setIsLoadingAthletes] = useState(true);

  // Estados Tab 1: Game Plan
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");
  const [rivalGuard, setRivalGuard] = useState<"DIESTRA" | "ZURDA" | "CAMBIANTE">("DIESTRA");
  const [rivalHeight, setRivalHeight] = useState<"MAS_ALTO" | "SIMILAR" | "MAS_BAJO">("SIMILAR");
  const [rivalStyle, setRivalStyle] = useState<
    "PIERNA_DELANTERA_CUT" | "CONTRAGOLPE_GIRO" | "PRESION_CUERPO_A_CUERPO" | "DEFENSIVO_ESPERA" | "OFENSIVO_COMBINADO"
  >("PIERNA_DELANTERA_CUT");
  const [rivalDangerKick, setRivalDangerKick] = useState("Dwi Chagi a la contra tras finta");
  const [rivalWeakness, setRivalWeakness] = useState("Baja la guardia delantera al patear");
  const [tournamentName, setTournamentName] = useState("Open Internacional / Campeonato Autonómico");
  const [tournamentPhase, setTournamentPhase] = useState("Semifinal");
  const [gamePlanResult, setGamePlanResult] = useState<any>(null);
  const [isGeneratingGamePlan, setIsGeneratingGamePlan] = useState(false);

  // Estados Tab 2: Class Plan
  const [classCategory, setClassCategory] = useState<"INFANTIL" | "CADETE" | "JUNIOR" | "SENIOR" | "MASTER">("CADETE");
  const [classFocus, setClassFocus] = useState<
    "TECNICO_BASICO" | "TACTICA_COMBATE" | "POTENCIA_VELOCIDAD" | "RESISTENCIA_ESPECIFICA" | "PRE_COMPETICION"
  >("TACTICA_COMBATE");
  const [classDuration, setClassDuration] = useState<number>(60);
  const [athletesCount, setAthletesCount] = useState<number>(14);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([
    "Petos y cascos",
    "Paletas dobles",
    "Escudos de impacto",
  ]);
  const [coachNotes, setCoachNotes] = useState("Enfatizar salidas laterales en 45 grados y contragolpe");
  const [classPlanResult, setClassPlanResult] = useState<any>(null);
  const [isGeneratingClassPlan, setIsGeneratingClassPlan] = useState(false);

  // Estados Tab 3: Diagnosis
  const [diagAthleteId, setDiagAthleteId] = useState<string>("");
  const [selectedIssues, setSelectedIssues] = useState<string[]>([
    "Encaja puntos de giro en salida lineal",
    "Caída de cadencia y fatiga en el Asalto 3",
  ]);
  const [customIssue, setCustomIssue] = useState("");
  const [diagResult, setDiagResult] = useState<any>(null);
  const [isGeneratingDiag, setIsGeneratingDiag] = useState(false);

  const [copied, setCopied] = useState(false);

  const availableIssuesList = [
    "Encaja puntos de giro en salida lineal",
    "Caída de cadencia y fatiga en el Asalto 3",
    "Exceso de Gam-jeoms por clinch o empujar",
    "Lenta recogida de la pierna adelantada",
    "Dificultad para puntuar a la cabeza",
    "Falta de finta previa antes de atacar",
  ];

  const materialOptions = [
    "Petos y cascos",
    "Paletas dobles",
    "Escudos de impacto",
    "Gomas elásticas",
    "Conos / Escalera coordinativa",
    "Petos electrónicos Daedo",
  ];

  useEffect(() => {
    fetch("/api/v1/athletes")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setAthletes(json.data);
          if (json.data.length > 0) {
            setSelectedAthleteId(json.data[0].id);
            setDiagAthleteId(json.data[0].id);
          }
        }
      })
      .catch((err) => console.error("Error cargando atletas:", err))
      .finally(() => setIsLoadingAthletes(false));
  }, []);

  const handleGenerateGamePlan = async () => {
    if (!selectedAthleteId) {
      toast.error("Selecciona un competidor");
      return;
    }
    setIsGeneratingGamePlan(true);
    try {
      const res = await fetch("/api/v1/ai/coach/game-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: selectedAthleteId,
          rivalProfile: {
            guard: rivalGuard,
            heightRelative: rivalHeight,
            fightingStyle: rivalStyle,
            keyDangerKick: rivalDangerKick,
            knownWeakness: rivalWeakness,
          },
          tournamentContext: {
            tournamentName,
            roundPhase: tournamentPhase,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGamePlanResult(data.data);
        toast.success("Game Plan táctico generado con éxito");
      } else {
        toast.error(data.error || "No se pudo generar el plan");
      }
    } catch (e: any) {
      toast.error("Error de conexión al generar el Game Plan");
    } finally {
      setIsGeneratingGamePlan(false);
    }
  };

  const handleGenerateClassPlan = async () => {
    setIsGeneratingClassPlan(true);
    try {
      const res = await fetch("/api/v1/ai/coach/plan-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: classCategory,
          targetFocus: classFocus,
          durationMinutes: classDuration,
          athletesCount,
          availableMaterial: selectedMaterials,
          coachNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setClassPlanResult(data.data);
        toast.success("Sesión de entrenamiento planificada");
      } else {
        toast.error(data.error || "Error al diseñar la sesión");
      }
    } catch {
      toast.error("Error al conectar con el asistente de clases");
    } finally {
      setIsGeneratingClassPlan(false);
    }
  };

  const handleGenerateDiagnosis = async () => {
    if (!diagAthleteId) {
      toast.error("Selecciona un competidor a diagnosticar");
      return;
    }
    setIsGeneratingDiag(true);
    try {
      const res = await fetch("/api/v1/ai/coach/athlete-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: diagAthleteId,
          competitionIssues: selectedIssues,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDiagResult(data.data);
        toast.success("Diagnóstico técnico completado");
      } else {
        toast.error(data.error || "Error en diagnóstico");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsGeneratingDiag(false);
    }
  };

  const toggleMaterial = (item: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(item) ? prev.filter((m) => m !== item) : [...prev, item]
    );
  };

  const toggleIssue = (issue: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  };

  const handleAddCustomIssue = () => {
    if (customIssue.trim() && !selectedIssues.includes(customIssue.trim())) {
      setSelectedIssues([...selectedIssues, customIssue.trim()]);
      setCustomIssue("");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Coach Táctico IA
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  WT Olympic Intelligence
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Estrategia pre-competición, diseño metodológico de clases y diagnóstico de rendimiento para maestros y entrenadores.
              </p>
            </div>
          </div>
        </div>

        {/* Action tabs switcher */}
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab("CHAT")}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "CHAT"
                ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            Conversación
          </button>
          <button
            onClick={() => setActiveTab("GAME_PLAN")}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "GAME_PLAN"
                ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            Game Plan Pre-Torneo
          </button>
          <button
            onClick={() => setActiveTab("CLASS_PLAN")}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "CLASS_PLAN"
                ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Planificador de Clases
          </button>
          <button
            onClick={() => setActiveTab("DIAGNOSIS")}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === "DIAGNOSIS"
                ? "bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            Diagnóstico de Atleta
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: GAME PLAN PRE-COMPETICIÓN                                         */}
      {/* ========================================================================= */}
      {activeTab === "CHAT" && <CopilotChat />}

      {activeTab === "GAME_PLAN" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulario lateral */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Shield className="w-4 h-4 text-amber-400" />
                Configuración del Enfrentamiento
              </div>

              {/* Selector Atleta propio */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Tu Competidor
                </label>
                {isLoadingAthletes ? (
                  <div className="h-10 bg-slate-800/50 rounded-lg animate-pulse" />
                ) : (
                  <select
                    value={selectedAthleteId}
                    onChange={(e) => setSelectedAthleteId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {athletes.map((ath) => (
                      <option key={ath.id} value={ath.id}>
                        {ath.fullName} ({ath.category} - {ath.stats?.favouriteTechnique || "Kyorugi"})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Guardia del Rival */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Guardia del Rival
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["DIESTRA", "ZURDA", "CAMBIANTE"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setRivalGuard(g)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                        rivalGuard === g
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 font-semibold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {g === "DIESTRA" ? "Diestra (Cerrada)" : g === "ZURDA" ? "Zurda (Abierta)" : "Cambiante"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estatura relativa */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Estatura y Alcance del Rival
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["MAS_ALTO", "SIMILAR", "MAS_BAJO"] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setRivalHeight(h)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-center transition-all ${
                        rivalHeight === h
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 font-semibold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {h === "MAS_ALTO" ? "Más Alto (Alcance)" : h === "SIMILAR" ? "Similar" : "Más Bajo"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estilo de combate */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Estilo Predominante del Rival
                </label>
                <select
                  value={rivalStyle}
                  onChange={(e: any) => setRivalStyle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="PIERNA_DELANTERA_CUT">Pierna delantera agresiva (Step-cut constante)</option>
                  <option value="CONTRAGOLPE_GIRO">Contragolpeador de giro (Dwi Chagi / Mondollyo)</option>
                  <option value="PRESION_CUERPO_A_CUERPO">Presión alta y búsqueda de clinch / empuje</option>
                  <option value="DEFENSIVO_ESPERA">Defensivo pasivo a la espera del error</option>
                  <option value="OFENSIVO_COMBINADO">Ofensivo de ráfaga y pateo a la cabeza</option>
                </select>
              </div>

              {/* Patada más peligrosa */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">
                  Técnica de Mayor Peligro del Rival
                </label>
                <input
                  type="text"
                  value={rivalDangerKick}
                  onChange={(e) => setRivalDangerKick(e.target.value)}
                  placeholder="ej. Dwi Chagi de contraataque o Dolgai a la cabeza"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Debilidad identificada */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">
                  Debilidad Conocida del Rival (Scouting)
                </label>
                <input
                  type="text"
                  value={rivalWeakness}
                  onChange={(e) => setRivalWeakness(e.target.value)}
                  placeholder="ej. Baja la guardia tras patear, retrocede en línea recta"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Torneo y Fase */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Torneo</label>
                  <input
                    type="text"
                    value={tournamentName}
                    onChange={(e) => setTournamentName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Fase</label>
                  <input
                    type="text"
                    value={tournamentPhase}
                    onChange={(e) => setTournamentPhase(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>

              {/* Botón generar */}
              <button
                type="button"
                onClick={handleGenerateGamePlan}
                disabled={isGeneratingGamePlan}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingGamePlan ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Analizando Biomecánica y Scouting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generar Game Plan Táctico con IA
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Visor de Resultados Game Plan */}
          <div className="lg:col-span-7">
            {gamePlanResult ? (
              <div className="space-y-4">
                {/* Barra de acciones de exportación */}
                <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>
                      Game Plan para <strong className="text-white">{gamePlanResult.athleteName}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(gamePlanResult.markdownDoc)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copiar
                    </button>
                    <button
                      onClick={handlePrint}
                      className="px-2.5 py-1 text-xs rounded-lg bg-amber-500 text-slate-950 font-semibold flex items-center gap-1.5 hover:bg-amber-400 transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir Ficha
                    </button>
                  </div>
                </div>

                {/* Estrategia Maestra Destacada */}
                <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
                  <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" /> Clave Táctica del Enfrentamiento
                  </h4>
                  <p className="text-sm text-slate-200 font-medium">
                    {gamePlanResult.keyStrategy}
                  </p>
                </div>

                {/* Desglose por Asaltos */}
                {gamePlanResult.roundsStrategy && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {gamePlanResult.roundsStrategy.map((r: any) => (
                      <div key={r.round} className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-xs font-bold text-amber-400">Asalto {r.round}</span>
                          <span className="text-[10px] text-slate-400">{r.distanceManagement}</span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium">{r.objective}</p>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase block font-semibold">Técnicas clave</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {r.priorityTechniques?.map((tech: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded">
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                        {r.cornerKeywords && (
                          <div className="pt-1 border-t border-slate-850">
                            <span className="text-[10px] text-amber-400/80 font-semibold block">Gritos de Esquina:</span>
                            <p className="text-[11px] text-slate-300 italic">{r.cornerKeywords.join(" • ")}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Markdown Completo */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 prose prose-invert max-w-none text-xs leading-relaxed overflow-x-auto whitespace-pre-line text-slate-300">
                  {gamePlanResult.markdownDoc}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
                <Swords className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-base font-semibold text-slate-300">Esperando datos del combate</h3>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Configura la guardia y características del rival en el panel izquierdo y pulsa en "Generar Game Plan Táctico" para que la IA diseñe el plan asalto por asalto.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PLANIFICADOR DE CLASES & SESIONES                                  */}
      {/* ========================================================================= */}
      {activeTab === "CLASS_PLAN" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <BookOpen className="w-4 h-4 text-amber-400" />
                Parámetros de la Clase de Taekwondo
              </div>

              {/* Categoría */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Categoría de Alumnos</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(["INFANTIL", "CADETE", "JUNIOR", "SENIOR", "MASTER"] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setClassCategory(cat)}
                      className={`py-1.5 text-[11px] font-medium rounded-lg border text-center transition-all ${
                        classCategory === cat
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 font-semibold"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enfoque / Objetivo */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Objetivo Principal de la Sesión</label>
                <select
                  value={classFocus}
                  onChange={(e: any) => setClassFocus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="TACTICA_COMBATE">Táctica de combate Kyorugi y toma de decisiones</option>
                  <option value="POTENCIA_VELOCIDAD">Potencia explosiva, velocidad de reacción y pliometría</option>
                  <option value="RESISTENCIA_ESPECIFICA">Resistencia anaeróbica láctica (Z5) y tolerancia a asaltos</option>
                  <option value="TECNICO_BASICO">Mecánica de pateo de base, cadera y estabilidad</option>
                  <option value="PRE_COMPETICION">Puesta a punto pre-competición (Afilamiento y chispa)</option>
                </select>
              </div>

              {/* Duración y Alumnos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Duración (minutos)</label>
                  <select
                    value={classDuration}
                    onChange={(e) => setClassDuration(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos (Estándar)</option>
                    <option value={75}>75 minutos</option>
                    <option value={90}>90 minutos (Avanzado)</option>
                    <option value={120}>120 minutos (Doble sesión)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 block">Nº de Alumnos</label>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={athletesCount}
                    onChange={(e) => setAthletesCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>

              {/* Material Disponible */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Material Disponible en Dojang</label>
                <div className="flex flex-wrap gap-1.5">
                  {materialOptions.map((mat) => {
                    const isSelected = selectedMaterials.includes(mat);
                    return (
                      <button
                        key={mat}
                        type="button"
                        onClick={() => toggleMaterial(mat)}
                        className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500 text-amber-400 font-semibold"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        {mat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notas del Entrenador */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Indicaciones Específicas del Entrenador</label>
                <textarea
                  rows={2}
                  value={coachNotes}
                  onChange={(e) => setCoachNotes(e.target.value)}
                  placeholder="ej. Hacer énfasis en no cruzar los pies al retroceder"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateClassPlan}
                disabled={isGeneratingClassPlan}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingClassPlan ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Diseñando Microciclo y Drills...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Diseñar Sesión de Entrenamiento con IA
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Resultado de la Clase */}
          <div className="lg:col-span-7">
            {classPlanResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>
                      Sesión de <strong className="text-white">{classPlanResult.durationMinutes} min</strong> para categoría{" "}
                      <strong className="text-amber-400">{classPlanResult.category}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(classPlanResult.markdownDoc)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copiar
                    </button>
                    <button
                      onClick={handlePrint}
                      className="px-2.5 py-1 text-xs rounded-lg bg-amber-500 text-slate-950 font-semibold flex items-center gap-1.5 hover:bg-amber-400"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir
                    </button>
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 prose prose-invert max-w-none text-xs leading-relaxed overflow-x-auto whitespace-pre-line text-slate-300">
                  {classPlanResult.markdownDoc}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
                <BookOpen className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-base font-semibold text-slate-300">Diseñador de Entrenamientos listo</h3>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Define el tiempo, el material y la categoría para obtener un plan de clase completo con calentamiento, trabajo en petos, sparring condicionado y regeneración.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DIAGNÓSTICO & PLAN DE MEJORA DE COMPETIDOR                        */}
      {/* ========================================================================= */}
      {activeTab === "DIAGNOSIS" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Target className="w-4 h-4 text-amber-400" />
                Diagnóstico de Rendimiento Individual
              </div>

              {/* Atleta */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Competidor a Evaluar</label>
                <select
                  value={diagAthleteId}
                  onChange={(e) => setDiagAthleteId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {athletes.map((ath) => (
                    <option key={ath.id} value={ath.id}>
                      {ath.fullName} (Readiness: {ath.readinessScore}/100 - {ath.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Errores comunes */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Problemas Detectados en Combates Recientes
                </label>
                <div className="space-y-1.5">
                  {availableIssuesList.map((issue) => {
                    const isSelected = selectedIssues.includes(issue);
                    return (
                      <button
                        key={issue}
                        type="button"
                        onClick={() => toggleIssue(issue)}
                        className={`w-full text-left px-3 py-2 text-xs rounded-lg border transition-all flex items-center justify-between ${
                          isSelected
                            ? "bg-amber-500/10 border-amber-500 text-amber-400 font-medium"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <span>{issue}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Añadir problema personalizado */}
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Añadir Otro Aspecto a Corregir</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customIssue}
                    onChange={(e) => setCustomIssue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCustomIssue()}
                    placeholder="ej. No bloquea puñetazo al cuerpo..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomIssue}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg"
                  >
                    Añadir
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateDiagnosis}
                disabled={isGeneratingDiag}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGeneratingDiag ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Generando Hoja de Ruta de 4 Semanas...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Diagnosticar y Generar Plan de 4 Semanas
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Resultado de Diagnóstico */}
          <div className="lg:col-span-7">
            {diagResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <span>
                      Diagnóstico de <strong className="text-white">{diagResult.athleteName}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(diagResult.markdownDoc)}
                      className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copiar
                    </button>
                    <button
                      onClick={handlePrint}
                      className="px-2.5 py-1 text-xs rounded-lg bg-amber-500 text-slate-950 font-semibold flex items-center gap-1.5 hover:bg-amber-400"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir
                    </button>
                  </div>
                </div>

                {/* Hoja de ruta 4 semanas */}
                {diagResult.customFourWeekRoadmap && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {diagResult.customFourWeekRoadmap.map((wk: any) => (
                      <div key={wk.week} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                        <span className="text-[10px] uppercase font-bold text-amber-400">Semana {wk.week}</span>
                        <p className="text-xs font-semibold text-slate-200">{wk.focus}</p>
                        <p className="text-[11px] text-slate-400">{wk.keyExercise}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 prose prose-invert max-w-none text-xs leading-relaxed overflow-x-auto whitespace-pre-line text-slate-300">
                  {diagResult.markdownDoc}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
                <Target className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="text-base font-semibold text-slate-300">Esperando selección de deportista</h3>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Selecciona a un competidor e indica qué aspectos o errores ha mostrado en sus últimos asaltos para obtener un informe biomecánico y un plan de 4 semanas.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

