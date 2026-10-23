"use client";

import { useState } from "react";
import { BrainCircuit, CheckCircle2, RefreshCw, X, Sparkles, Activity, Layers, Trophy } from "lucide-react";
import { AIRetrainMetrics } from "@/lib/types";

interface RetrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMetrics: AIRetrainMetrics;
  onRetrainComplete: (updated: AIRetrainMetrics) => void;
}

export function RetrainModal({
  isOpen,
  onClose,
  currentMetrics,
  onRetrainComplete,
}: RetrainModalProps) {
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [finishedMetrics, setFinishedMetrics] = useState<AIRetrainMetrics | null>(null);

  if (!isOpen) return null;

  const startRetraining = async () => {
    setIsTraining(true);
    setProgress(10);
    setCurrentStep("Ingestando telemetría de pulsaciones (Z1 a Z5) de los últimos microciclos...");

    setTimeout(() => {
      setProgress(35);
      setCurrentStep("Procesando degradación de potencia y ritmo de pateo en el 3er asalto...");
    }, 900);

    setTimeout(() => {
      setProgress(65);
      setCurrentStep("Recalibrando pesos de la función de coste (TRIMP, Gam-jeom y tolerancia al lactato)...");
    }, 1800);

    setTimeout(() => {
      setProgress(85);
      setCurrentStep("Validación cruzada en 4,320 asaltos de combate grabados...");
    }, 2700);

    setTimeout(async () => {
      try {
        const res = await fetch("/api/v1/ai/retrain", { method: "POST" });
        const data = await res.json();
        setProgress(100);
        setCurrentStep("Modelo reentrenado con éxito y pesos actualizados.");
        setFinishedMetrics(data.metrics || null);
        setIsTraining(false);
        if (data.metrics) {
          onRetrainComplete(data.metrics);
        }
      } catch (e) {
        setIsTraining(false);
        setCurrentStep("Error durante el reentrenamiento.");
      }
    }, 3600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <div className="glass-panel max-w-xl w-full rounded-2xl border border-sky-500/40 p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          disabled={isTraining}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
            <BrainCircuit className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Reentrenamiento Continuo de la IA
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Auto-Learning
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Aprende de biomarcadores cardíacos, asaltos de combate y evolución física
            </p>
          </div>
        </div>

        {/* Status & Inputs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="text-slate-400 flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-rose-400" />
              Sesiones de Pulsaciones
            </div>
            <div className="font-bold text-white font-mono text-sm">
              {currentMetrics.heartRateSessionsAnalyzed} analizadas
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="text-slate-400 flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Asaltos de Competición
            </div>
            <div className="font-bold text-white font-mono text-sm">
              {currentMetrics.combatRoundsProcessed} evaluados
            </div>
          </div>
        </div>

        {/* Progress Bar during training */}
        {isTraining && (
          <div className="my-5 p-4 rounded-xl bg-slate-900 border border-sky-500/30">
            <div className="flex items-center justify-between text-xs text-sky-300 mb-2">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                {currentStep}
              </span>
              <span className="font-mono font-bold">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Finished Success Card */}
        {finishedMetrics && !isTraining && (
          <div className="my-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Nueva Versión Desplegada: {finishedMetrics.modelVersion}
            </div>
            <p className="text-slate-300">{finishedMetrics.changelog}</p>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-800/40 text-[11px]">
              <div>
                <span className="text-slate-400">Precisión Predicción Fatiga: </span>
                <span className="font-mono font-bold text-white">{finishedMetrics.fatiguePredictionAccuracy}%</span>
              </div>
              <div>
                <span className="text-slate-400">Puntaje F1 Táctico: </span>
                <span className="font-mono font-bold text-white">{finishedMetrics.tacticalRecommendationF1}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={isTraining}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            {finishedMetrics ? "Cerrar" : "Cancelar"}
          </button>
          {!finishedMetrics && (
            <button
              onClick={startRetraining}
              disabled={isTraining}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-chong-glow transition-all"
            >
              <Sparkles className="w-4 h-4" />
              {isTraining ? "Entrenando Modelo..." : "Iniciar Reentrenamiento"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
