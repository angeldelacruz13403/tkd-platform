"use client";

import { useEffect, useState } from "react";
import {
  BrainCircuit,
  Upload,
  FileText,
  Video,
  Sparkles,
  BookOpen,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Layers,
  Activity,
  Trophy,
  Flame,
  Plus,
} from "lucide-react";
import { db } from "@/lib/db";
import { AIKnowledgeItem, KnowledgeCategory, AIRetrainMetrics, Athlete } from "@/lib/types";
import {
  AIPlanStatus,
  AIVideoAnalysisResult,
  AIWeeklyPlan,
  CorrectiveWorkStatus,
} from "@/lib/ai-types";

type PlanApiRecord = {
  id: string;
  status: AIPlanStatus;
  objective: string;
  periodization_phase: string;
  week_start: string;
  plan: AIWeeklyPlan;
};

type CorrectiveWorkApiRecord = {
  id: string;
  status: CorrectiveWorkStatus;
  title: string;
  objective: string;
  optional: boolean;
  training_plan_id?: string | null;
  planned_session_date?: string | null;
  coach_notes?: string | null;
};
type VideoAnalysisApiRecord = {
  id: string;
  status: string;
  original_filename: string;
  result: AIVideoAnalysisResult;
  created_at: string;
};

export default function AIStudioPage() {
  const [knowledgeBase, setKnowledgeBase] = useState<AIKnowledgeItem[]>(db.knowledgeBase);
  const [metrics, setMetrics] = useState<AIRetrainMetrics>(db.retrainMetrics);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);
  const [retrainError, setRetrainError] = useState("");
  const [retrainMessage, setRetrainMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<{
    id: string;
    status: "NEEDS_REVIEW" | "APPROVED";
    result: AIVideoAnalysisResult;
  } | null>(null);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [videoAnalysisError, setVideoAnalysisError] = useState("");
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [videoConsent, setVideoConsent] = useState(false);
  const [videoMatchId, setVideoMatchId] = useState("");
  const [plans, setPlans] = useState<PlanApiRecord[]>([]);
  const [correctiveWorks, setCorrectiveWorks] = useState<CorrectiveWorkApiRecord[]>([]);
  const [videoAnalyses, setVideoAnalyses] = useState<VideoAnalysisApiRecord[]>([]);
  const [weeklyObjective, setWeeklyObjective] = useState("");
  const [weekStart, setWeekStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  });
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [aiStudioError, setAiStudioError] = useState("");
  const [aiStudioMessage, setAiStudioMessage] = useState("");
  const [assignmentPlanId, setAssignmentPlanId] = useState("");
  const [assignmentDate, setAssignmentDate] = useState("");
  const [suggestionsAreOptional, setSuggestionsAreOptional] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    category: "EXERCISE" as KnowledgeCategory,
    description: "",
    fileType: "PDF" as "PDF" | "VIDEO_MP4" | "TEXT_PROTOCOL" | "URL",
    fileUrl: "",
    tags: "Taekwondo, WT, Entrenamiento",
  });

  const categories = [
    { key: "ALL", label: "Todos los Contenidos" },
    { key: "EXERCISE", label: "Ejercicios Físicos" },
    { key: "WT_RULES", label: "Reglamentos WT (PDF)" },
    { key: "TECHNIQUE", label: "Técnicas & Biomecánica" },
    { key: "VIDEO_DRILL", label: "Vídeos Demostrativos" },
    { key: "PHYSIOLOGY_PDF", label: "Fisiología & Cardio" },
  ];

  const filteredItems = knowledgeBase.filter(
    (item) => selectedCategory === "ALL" || item.category === selectedCategory
  );

  useEffect(() => {
    let active = true;
    fetch("/api/v1/athletes")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "No se pudieron cargar los atletas.");
        if (active) {
          const records = result.data as Athlete[];
          setAthletes(records);
          setSelectedAthleteId((current) =>
            current && records.some((athlete) => athlete.id === current) ? current : records[0]?.id || ""
          );
        }
      })
      .catch((error: unknown) => {
        if (active) setAiStudioError(error instanceof Error ? error.message : "No se pudieron cargar los atletas.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedAthleteId) {
      setPlans([]);
      setCorrectiveWorks([]);
      setVideoAnalyses([]);
      return;
    }
    let active = true;
    setAiStudioError("");
    Promise.all([
      fetch(`/api/v1/ai/plans?athleteId=${encodeURIComponent(selectedAthleteId)}`),
      fetch(`/api/v1/ai/corrective-work?athleteId=${encodeURIComponent(selectedAthleteId)}`),
      fetch(`/api/v1/ai/analyze-video?athleteId=${encodeURIComponent(selectedAthleteId)}`),
    ])
      .then(async ([plansResponse, worksResponse, videosResponse]) => {
        const [plansResult, worksResult, videosResult] = await Promise.all([
          plansResponse.json(),
          worksResponse.json(),
          videosResponse.json(),
        ]);
        if (!plansResponse.ok || !plansResult.success) {
          throw new Error(plansResult.error || "No se pudieron cargar los planes.");
        }
        if (!worksResponse.ok || !worksResult.success) {
          throw new Error(worksResult.error || "No se pudieron cargar los trabajos correctivos.");
        }
        if (!videosResponse.ok || !videosResult.success) {
          throw new Error(videosResult.error || "No se pudieron cargar los análisis de vídeo.");
        }
        if (active) {
          setPlans(plansResult.data as PlanApiRecord[]);
          setCorrectiveWorks(worksResult.data as CorrectiveWorkApiRecord[]);
          setVideoAnalyses(videosResult.data as VideoAnalysisApiRecord[]);
        }
      })
      .catch((error: unknown) => {
        if (active) setAiStudioError(error instanceof Error ? error.message : "No se pudieron cargar los datos de IA.");
      });
    return () => { active = false; };
  }, [selectedAthleteId]);

  const reloadWorkflows = async () => {
    if (!selectedAthleteId) return;
    const [plansResponse, worksResponse, videosResponse] = await Promise.all([
      fetch(`/api/v1/ai/plans?athleteId=${encodeURIComponent(selectedAthleteId)}`),
      fetch(`/api/v1/ai/corrective-work?athleteId=${encodeURIComponent(selectedAthleteId)}`),
      fetch(`/api/v1/ai/analyze-video?athleteId=${encodeURIComponent(selectedAthleteId)}`),
    ]);
    const [plansResult, worksResult, videosResult] = await Promise.all([
      plansResponse.json(),
      worksResponse.json(),
      videosResponse.json(),
    ]);
    if (!plansResponse.ok || !plansResult.success || !worksResponse.ok || !worksResult.success || !videosResponse.ok || !videosResult.success) {
      throw new Error(plansResult.error || worksResult.error || videosResult.error || "No se pudieron actualizar los datos.");
    }
    setPlans(plansResult.data as PlanApiRecord[]);
    setCorrectiveWorks(worksResult.data as CorrectiveWorkApiRecord[]);
    setVideoAnalyses(videosResult.data as VideoAnalysisApiRecord[]);
  };

  const generateWeeklyPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setAiStudioError("");
    setAiStudioMessage("");
    setIsGeneratingPlan(true);
    try {
      const response = await fetch("/api/v1/ai/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: selectedAthleteId, weekStart, objective: weeklyObjective }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo generar el plan.");
      setAiStudioMessage("Plan generado como borrador. Revísalo antes de aprobarlo y publicarlo.");
      setWeeklyObjective("");
      await reloadWorkflows();
    } catch (error) {
      setAiStudioError(error instanceof Error ? error.message : "No se pudo generar el plan semanal.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const updatePlanStatus = async (planId: string, status: AIPlanStatus) => {
    setAiStudioError("");
    setAiStudioMessage("");
    try {
      const response = await fetch("/api/v1/ai/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId: selectedAthleteId, planId, status }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo actualizar el plan.");
      setAiStudioMessage(`Plan actualizado: ${status}.`);
      await reloadWorkflows();
    } catch (error) {
      setAiStudioError(error instanceof Error ? error.message : "No se pudo actualizar el plan.");
    }
  };

  const createCorrectiveWork = async (suggestionIndex: number) => {
    if (!videoAnalysis) return;
    setAiStudioError("");
    setAiStudioMessage("");
    try {
      const response = await fetch("/api/v1/ai/corrective-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: selectedAthleteId,
          videoAnalysisId: videoAnalysis.id,
          suggestionIndex,
          optional: suggestionsAreOptional,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo crear la corrección.");
      setAiStudioMessage("Trabajo correctivo creado como propuesta pendiente de revisión.");
      await reloadWorkflows();
    } catch (error) {
      setAiStudioError(error instanceof Error ? error.message : "No se pudo crear el trabajo correctivo.");
    }
  };

  const approveVideoAnalysis = async () => {
    if (!videoAnalysis) return;
    setAiStudioError("");
    setAiStudioMessage("");
    try {
      const response = await fetch("/api/v1/ai/analyze-video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: selectedAthleteId,
          analysisId: videoAnalysis.id,
          status: "APPROVED",
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo aprobar el análisis.");
      setVideoAnalysis((current) => current ? { ...current, status: "APPROVED" } : current);
      setVideoAnalyses((current) => current.map((record) =>
        record.id === videoAnalysis.id ? { ...record, status: "APPROVED" } : record
      ));
      setAiStudioMessage("Análisis revisado y aprobado por el entrenador.");
    } catch (error) {
      setAiStudioError(error instanceof Error ? error.message : "No se pudo aprobar el análisis.");
    }
  };

  const updateCorrectiveWork = async (
    workId: string,
    status: CorrectiveWorkStatus,
    assignment?: { trainingPlanId?: string; plannedSessionDate?: string }
  ) => {
    setAiStudioError("");
    setAiStudioMessage("");
    try {
      const response = await fetch("/api/v1/ai/corrective-work", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: selectedAthleteId,
          workId,
          status,
          ...assignment,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo actualizar la corrección.");
      setAiStudioMessage(`Trabajo correctivo actualizado: ${status}.`);
      await reloadWorkflows();
    } catch (error) {
      setAiStudioError(error instanceof Error ? error.message : "No se pudo actualizar el trabajo correctivo.");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description) return;

    if (formData.fileType === "VIDEO_MP4" && selectedFile) {
      if (!selectedAthleteId || !videoConsent) {
        setVideoAnalysisError("Selecciona el atleta y confirma que existe consentimiento para analizar el vídeo.");
        return;
      }
      setIsAnalyzingVideo(true);
      setVideoAnalysisError("");
      const analysisBody = new FormData();
      analysisBody.append("video", selectedFile);
      analysisBody.append("athleteId", selectedAthleteId);
      analysisBody.append("consent", "true");
      if (videoMatchId.trim()) analysisBody.append("competitionMatchId", videoMatchId.trim());
      try {
        const analysisResponse = await fetch("/api/v1/ai/analyze-video", {
          method: "POST",
          body: analysisBody,
        });
        const analysisResult = await analysisResponse.json();
        if (!analysisResponse.ok || !analysisResult.success) {
          throw new Error(analysisResult.error || "No se pudo analizar el vídeo");
        }
        setVideoAnalysis({
          id: analysisResult.data.id,
          status: analysisResult.data.status,
          result: analysisResult.data.result as AIVideoAnalysisResult,
        });
        setVideoAnalyses((current) => [{
          id: analysisResult.data.id,
          status: analysisResult.data.status,
          original_filename: selectedFile.name,
          result: analysisResult.data.result as AIVideoAnalysisResult,
          created_at: new Date().toISOString(),
        }, ...current]);
        setShowUploadModal(false);
        setVideoConsent(false);
        setVideoMatchId("");
        setSelectedFile(null);
      } catch (error: any) {
        setVideoAnalysisError(error?.message || "No se pudo analizar el vídeo");
      } finally {
        setIsAnalyzingVideo(false);
      }
      return;
    }

    const body = new FormData();
    body.append("title", formData.title);
    body.append("category", formData.category);
    body.append("description", formData.description);
    body.append("fileType", formData.fileType);
    body.append("tags", formData.tags);
    body.append("addedBy", "Administrador");
    if (selectedFile) body.append("video", selectedFile);

    const res = await fetch("/api/v1/ai/knowledge", { method: "POST", body });
    const result = await res.json();
    if (result.success) {
      setKnowledgeBase([result.data, ...knowledgeBase]);
      setShowUploadModal(false);
      setFormData({
        title: "",
        category: "EXERCISE",
        description: "",
        fileType: "PDF",
        fileUrl: "",
        tags: "Taekwondo, WT, Entrenamiento",
      });
      setSelectedFile(null);
    }
  };

  const handleTriggerRetrain = async () => {
    setIsRetraining(true);
    setRetrainError("");
    setRetrainMessage("");
    try {
      const response = await fetch("/api/v1/ai/retrain", { method: "POST" });
      let data: {
        success?: boolean;
        error?: string;
        message?: string;
        metrics?: AIRetrainMetrics;
      } | null;

      try {
        data = await response.json();
      } catch {
        throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${response.status}).`);
      }

      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || `No se pudo reentrenar el modelo (HTTP ${response.status}).`);
      }
      if (!data.metrics) {
        throw new Error("El servidor no devolvió las métricas del modelo reentrenado.");
      }

      setMetrics(data.metrics);
      setRetrainMessage(data.message || "Reentrenamiento completado.");
    } catch (error) {
      setRetrainError(error instanceof Error ? error.message : "No se pudo reentrenar el modelo.");
    } finally {
      setIsRetraining(false);
    }
  };

  const getCategoryBadge = (cat: KnowledgeCategory) => {
    switch (cat) {
      case "WT_RULES":
        return "bg-rose-500/15 text-rose-300 border-rose-500/30";
      case "EXERCISE":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      case "TECHNIQUE":
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
      case "VIDEO_DRILL":
        return "bg-purple-500/15 text-purple-300 border-purple-500/30";
      case "PHYSIOLOGY_PDF":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-sky-400" />
            Gestión de Inteligencia Artificial & Reentrenamiento Continuo
          </h2>
          <p className="text-xs text-slate-400">
            Actualización de base de conocimiento (RAG), subida de reglamentos WT, técnicas y reentrenamiento adaptativo
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-all"
            >
              <Upload className="w-4 h-4 text-sky-400" />
              Subir Nuevo Conocimiento
            </button>
            <button
              onClick={handleTriggerRetrain}
              disabled={isRetraining}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              {isRetraining ? "Reentrenando..." : "Reentrenar Modelo Ahora"}
            </button>
          </div>
          {retrainError && <p role="alert" className="text-right text-xs text-rose-300">{retrainError}</p>}
          {retrainMessage && <p role="status" className="text-right text-xs text-emerald-300">{retrainMessage}</p>}
        </div>
      </div>

      {/* The API does not expose step-level progress, so show an honest indeterminate state. */}
      {isRetraining && (
        <div role="status" aria-live="polite" className="glass-panel p-5 rounded-2xl border border-sky-500/50 bg-sky-950/20 shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-sky-200 font-medium">
              <RefreshCw className="w-4 h-4 text-sky-400 animate-spin" />
            <span>El servidor está procesando la solicitud de reentrenamiento...</span>
          </div>
        </div>
      )}

      {/* Active Model Status & Learned Hyperparameters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Model Card */}
        <div className="glass-panel rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Modelo Activo</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PRODUCCIÓN
              </span>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base font-mono">{metrics.modelVersion}</h3>
                <p className="text-[11px] text-slate-400">
                  Último entreno: {new Date(metrics.trainedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Precisión Predicción Fatiga:</span>
                <span className="font-mono font-bold text-emerald-400">{metrics.fatiguePredictionAccuracy}%</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Score F1 Recomendación Táctica:</span>
                <span className="font-mono font-bold text-sky-400">{metrics.tacticalRecommendationF1}%</span>
              </div>
              <div className="flex justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Registros en el Dataset:</span>
                <span className="font-mono font-bold text-white">
                  {metrics.datasetSizeRecords.toLocaleString()} muestras
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 mt-4 leading-relaxed">
            <strong className="text-white block mb-1">Último Changelog:</strong>
            {metrics.changelog}
          </div>
        </div>

        {/* Learned Weight Parameters */}
        <div className="lg:col-span-2 glass-panel rounded-2xl border border-slate-800 p-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-5">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-white text-base">Pesos y Factores Adaptativos de la Red</h3>
            </div>
            <span className="text-xs text-slate-400">Calibración automática post-sesiones</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Tolerancia a Volumen Cardíaco</span>
                <span className="font-mono font-bold text-sky-400 text-sm">
                  {metrics.learnedWeights.cardioVolumeTolerance}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Ajusta los intervalos de descanso en función del tiempo acumulado en Zona 5 durante la semana.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Tasa de Recuperación Anaeróbica</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {metrics.learnedWeights.anaerobicRecoveryRate}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Multiplicador de recuperación estimado según la caída de BPM en los primeros 60s post-round.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Penalización de Riesgo Gam-Jeom</span>
                <span className="font-mono font-bold text-rose-400 text-sm">
                  {metrics.learnedWeights.gamJeomRiskWeight}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Incentiva técnicas de bajo riesgo de salida del tapiz o agarre cuando el atleta acumula faltas.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">Factor de Caída en Asalto 3</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {metrics.learnedWeights.round3FatigueDecayFactor}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Calcula la pérdida de potencia en pateo con giro al llegar al asalto decisivo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Knowledge Base Indexer */}
      {videoAnalysis && (
        <div className="glass-panel rounded-2xl border border-emerald-500/40 p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-emerald-400" />
                Informe de combate generado por IA
              </h3>
              <p className="text-xs text-slate-400">Análisis basado en fotogramas visibles. Estado: {videoAnalysis.status === "APPROVED" ? "revisado por el entrenador" : "pendiente de revisión"}.</p>
            </div>
            <div className="flex items-center gap-3">
              {videoAnalysis.status === "NEEDS_REVIEW" && (
                <button onClick={approveVideoAnalysis} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">Marcar revisado</button>
              )}
              <button onClick={() => setVideoAnalysis(null)} className="text-xs text-slate-400 hover:text-white">Cerrar</button>
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-200">{videoAnalysis.result.summary}</p>
          {videoAnalysis.result.recordedMatchMetrics && (
            <div className="rounded-xl border border-sky-900/70 bg-slate-950/70 p-4 text-xs text-slate-300">
              <p className="font-semibold text-sky-300">
                Datos oficiales registrados · {videoAnalysis.result.recordedMatchMetrics.competitionName || "Combate"} · ganador: {videoAnalysis.result.recordedMatchMetrics.recordedWinner || "pendiente"}
              </p>
              <p className="mt-1">
                Marcador registrado Chong/Hong: {videoAnalysis.result.recordedMatchMetrics.chongScore ?? "—"}–{videoAnalysis.result.recordedMatchMetrics.hongScore ?? "—"} · Gam-jeom: {videoAnalysis.result.recordedMatchMetrics.chongGamJeom ?? "—"}–{videoAnalysis.result.recordedMatchMetrics.hongGamJeom ?? "—"}
              </p>
              <p className="mt-1">
                Acciones registradas (cabeza/cuerpo/giro a cabeza/giro a cuerpo/puños): {videoAnalysis.result.recordedMatchMetrics.headKicks ?? 0}/{videoAnalysis.result.recordedMatchMetrics.bodyKicks ?? 0}/{videoAnalysis.result.recordedMatchMetrics.spinningHeadKicks ?? 0}/{videoAnalysis.result.recordedMatchMetrics.spinningBodyKicks ?? 0}/{videoAnalysis.result.recordedMatchMetrics.punches ?? 0}
              </p>
            </div>
          )}
          <div className="grid gap-3">
            {videoAnalysis.result.observations.map((observation, index) => (
              <div key={`${observation.category}-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <strong className="text-sky-300">{observation.category}</strong>
                  <span className="text-slate-500">Confianza: {observation.confidence}</span>
                </div>
                <p className="mt-2 text-sm text-slate-200">{observation.description}</p>
                {observation.evidence.map((evidence, evidenceIndex) => (
                  <p key={evidenceIndex} className="mt-1 text-xs text-slate-400">
                    {evidence.startSeconds}s–{evidence.endSeconds}s: {evidence.description}
                  </p>
                ))}
              </div>
            ))}
          </div>
          {!!videoAnalysis.result.suggestedCorrectiveWorks.length && (
            <div className="space-y-2 border-t border-slate-800 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-white">Propuestas de corrección</h4>
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={suggestionsAreOptional}
                    onChange={(event) => setSuggestionsAreOptional(event.target.checked)}
                    className="accent-amber-500"
                  />
                  Asignar como adicional opcional
                </label>
              </div>
              {videoAnalysis.result.suggestedCorrectiveWorks.map((suggestion, index) => (
                <div key={`${suggestion.title}-${index}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-950/70 p-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{suggestion.title}</p>
                    <p className="text-xs text-slate-400">{suggestion.objective}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => createCorrectiveWork(index)}
                    className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                  >
                    Crear propuesta
                  </button>
                </div>
              ))}
            </div>
          )}
          {videoAnalysis.result.limitations.length > 0 && (
            <p className="text-xs text-amber-300">
              Limitaciones: {videoAnalysis.result.limitations.join(" · ")}
            </p>
          )}
        </div>
      )}

      {videoAnalyses.length > 0 && (
        <div className="glass-panel rounded-2xl border border-slate-800 p-5">
          <h3 className="mb-3 text-sm font-bold text-white">Historial de análisis de combate</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {videoAnalyses.map((analysis) => (
              <button
                key={analysis.id}
                type="button"
                onClick={() => {
                  if (analysis.result && Array.isArray(analysis.result.observations)) {
                    setVideoAnalysis({
                      id: analysis.id,
                      status: analysis.status === "APPROVED" ? "APPROVED" : "NEEDS_REVIEW",
                      result: analysis.result,
                    });
                  }
                }}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left hover:border-sky-700"
              >
                <p className="text-xs font-semibold text-white">{analysis.original_filename}</p>
                <p className="mt-1 text-[11px] text-slate-400">{analysis.created_at.slice(0, 10)} · {analysis.status}</p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{analysis.result?.summary || analysis.status}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="glass-panel rounded-2xl border border-sky-500/30 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white">Planificación personalizada y trabajos correctivos</h3>
            <p className="text-xs text-slate-400">La IA propone; el entrenador revisa, aprueba y publica.</p>
          </div>
          <div className="w-full sm:w-80">
            <label className="mb-1 block text-xs text-slate-400">Atleta</label>
            <select
              value={selectedAthleteId}
              onChange={(event) => setSelectedAthleteId(event.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
              disabled={!athletes.length}
            >
              {!athletes.length && <option value="">No hay atletas disponibles</option>}
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.fullName}{athlete.isCompetitor ? " · Competidor" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {aiStudioError && <p role="alert" className="rounded-lg bg-rose-950/50 p-3 text-sm text-rose-300">{aiStudioError}</p>}
        {aiStudioMessage && <p role="status" className="rounded-lg bg-emerald-950/50 p-3 text-sm text-emerald-300">{aiStudioMessage}</p>}

        <form onSubmit={generateWeeklyPlan} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[180px_1fr_auto] md:items-end">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Inicio de semana</label>
            <input
              type="date"
              required
              value={weekStart}
              onChange={(event) => setWeekStart(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Objetivo semanal</label>
            <input
              required
              maxLength={1000}
              value={weeklyObjective}
              onChange={(event) => setWeeklyObjective(event.target.value)}
              placeholder="Ej. mejorar la defensa en contraataque y mantener la carga segura"
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={!selectedAthleteId || isGeneratingPlan}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isGeneratingPlan ? "Generando..." : "Generar borrador"}
          </button>
        </form>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-semibold text-white">Planes semanales</h4>
            {!plans.length && <p className="text-xs text-slate-500">Aún no hay planes guardados para este atleta.</p>}
            {plans.map((plan) => (
              <article key={plan.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{plan.objective}</p>
                    <p className="text-xs text-slate-400">Semana {plan.week_start} · Fase {plan.periodization_phase}</p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold text-sky-300">{plan.status}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {plan.plan.sessions.map((session, index) => (
                    <div key={`${session.date}-${index}`} className="border-l-2 border-sky-700 pl-3 text-xs">
                      <p className="font-semibold text-slate-200">
                        {session.date} · {session.title}{session.optional ? " · Opcional" : ""}
                      </p>
                      <p className="text-slate-400">{session.durationMinutes} min · {session.intensity} · {session.objective}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.status === "DRAFT" && (
                    <button onClick={() => updatePlanStatus(plan.id, "IN_REVIEW")} className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-white">Enviar a revisión</button>
                  )}
                  {plan.status === "IN_REVIEW" && (
                    <button onClick={() => updatePlanStatus(plan.id, "APPROVED")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white">Aprobar</button>
                  )}
                  {plan.status === "APPROVED" && (
                    <button onClick={() => updatePlanStatus(plan.id, "PUBLISHED")} className="rounded-lg bg-sky-700 px-3 py-2 text-xs text-white">Publicar al atleta</button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-white">Trabajos correctivos</h4>
            {!correctiveWorks.length && <p className="text-xs text-slate-500">Aún no hay trabajos propuestos o asignados.</p>}
            {correctiveWorks.map((work) => {
              const assignmentPlan = plans.find((plan) => plan.id === assignmentPlanId);
              const sessionDates = assignmentPlan?.plan.sessions.map((session) => session.date) || [];
              return (
                <article key={work.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{work.title}</p>
                      <p className="text-xs text-slate-400">{work.objective}</p>
                      {work.optional && <span className="mt-1 inline-block text-[10px] text-amber-300">Adicional opcional</span>}
                    </div>
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold text-amber-300">{work.status}</span>
                  </div>
                  {work.status === "PROPOSED" && (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => updateCorrectiveWork(work.id, "APPROVED")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs text-white">Aprobar</button>
                      <button onClick={() => updateCorrectiveWork(work.id, "REJECTED")} className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">Rechazar</button>
                    </div>
                  )}
                  {work.status === "APPROVED" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <select
                        value={assignmentPlanId}
                        onChange={(event) => {
                          setAssignmentPlanId(event.target.value);
                          setAssignmentDate("");
                        }}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-white"
                      >
                        <option value="">Selecciona un plan semanal</option>
                        {plans.filter((plan) => plan.status !== "ARCHIVED").map((plan) => (
                          <option key={plan.id} value={plan.id}>{plan.week_start} · {plan.status}</option>
                        ))}
                      </select>
                      <select
                        value={assignmentDate}
                        onChange={(event) => setAssignmentDate(event.target.value)}
                        disabled={!sessionDates.length}
                        className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-2 text-xs text-white disabled:opacity-50"
                      >
                        <option value="">Sesión de destino</option>
                        {sessionDates.map((date, index) => <option key={`${date}-${index}`} value={date}>{date}</option>)}
                      </select>
                      <button
                        disabled={!assignmentPlanId || !assignmentDate}
                        onClick={() => updateCorrectiveWork(work.id, "ASSIGNED", {
                          trainingPlanId: assignmentPlanId,
                          plannedSessionDate: assignmentDate,
                        })}
                        className="rounded-lg bg-sky-700 px-3 py-2 text-xs text-white disabled:opacity-50"
                      >
                        Asignar
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">Base de Conocimiento RAG (World Taekwondo)</h3>
            <p className="text-xs text-slate-400">Documentos oficiales, técnicas, ejercicios y vídeos indexados</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="glass-panel rounded-2xl border border-slate-800 p-5 hover:border-sky-500/40 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCategoryBadge(item.category)}`}>
                    {item.category.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {item.indexedTokens.toLocaleString()} tokens indexados
                  </span>
                </div>
                <h4 className="font-bold text-white text-sm mb-2">{item.title}</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{item.description}</p>
              </div>

              <div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {item.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Subido por: {item.addedBy}</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Vectorizado
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Knowledge Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Subir Conocimiento / Documento RAG</h3>
            <form onSubmit={handleUpload} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Título del Documento o Ejercicio</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  placeholder="Ej. Guía de Tácticas en Golden Point WT"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="EXERCISE">Ejercicio Físico</option>
                    <option value="WT_RULES">Reglamento Oficial WT</option>
                    <option value="TECHNIQUE">Técnica & Biomecánica</option>
                    <option value="VIDEO_DRILL">Vídeo Demostrativo</option>
                    <option value="PHYSIOLOGY_PDF">Estudio Fisiológico (PDF)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Tipo de Archivo</label>
                  <select
                    value={formData.fileType}
                    onChange={(e) => setFormData({ ...formData, fileType: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="PDF">Documento PDF</option>
                    <option value="VIDEO_MP4">Vídeo MP4</option>
                    <option value="TEXT_PROTOCOL">Protocolo de Texto</option>
                    <option value="URL">Enlace Web Externo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Descripción / Contenido Semántico</label>
                <textarea
                  rows={4}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white resize-none"
                  placeholder="Explica la biomecánica, el criterio arbitral o la pauta de series y descansos..."
                />
              </div>

              {formData.fileType === "VIDEO_MP4" && (
                <div>
                  <label className="block text-slate-400 mb-1">Vídeo de entrenamiento</label>
                <label className="mb-1 mt-2 block text-slate-400">Atleta relacionado</label>
                <select
                  required
                  value={selectedAthleteId}
                  onChange={(e) => setSelectedAthleteId(e.target.value)}
                  className="mb-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white"
                >
                  <option value="">Selecciona atleta</option>
                  {athletes.map((athlete) => (
                    <option key={athlete.id} value={athlete.id}>{athlete.fullName}</option>
                  ))}
                </select>
                <label className="mb-1 block text-slate-400">ID del combate (opcional)</label>
                <input
                  value={videoMatchId}
                  onChange={(e) => setVideoMatchId(e.target.value)}
                  className="mb-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white"
                  placeholder="Vincular con un combate registrado"
                />
                <input
                  type="file"
                  accept="video/*"
                    required
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300"
                  />
                  <label className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-slate-300">
                    <input
                      type="checkbox"
                      required
                      checked={videoConsent}
                      onChange={(e) => setVideoConsent(e.target.checked)}
                      className="mt-0.5 accent-sky-500"
                    />
                    Confirmo que el atleta ha autorizado el análisis del vídeo y su almacenamiento privado para esta finalidad.
                  </label>
                  <p className="text-[11px] text-slate-500 mt-2">Máximo 100 MB. El análisis queda pendiente de revisión del entrenador.</p>
                  {videoAnalysisError && <p className="text-[11px] text-rose-300 mt-2">{videoAnalysisError}</p>}
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Etiquetas (separadas por comas)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAnalyzingVideo}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-chong-glow"
                >
                  {isAnalyzingVideo ? "Analizando combate..." : formData.fileType === "VIDEO_MP4" ? "Analizar combate" : "Indexar en RAG"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
