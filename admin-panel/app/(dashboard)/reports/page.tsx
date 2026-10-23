"use client";

import { useState } from "react";
import { FileSpreadsheet, Download, FileText, CheckCircle2, ShieldCheck, Printer, Sparkles, Filter } from "lucide-react";
import { db } from "@/lib/db";

export default function ReportsPage() {
  const [reportType, setReportType] = useState("GRANT_SCHOLARSHIP");
  const [selectedFormat, setSelectedFormat] = useState<"CSV" | "JSON" | "PDF">("CSV");
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadReport = () => {
    if (selectedFormat === "CSV") {
      window.open("/api/v1/reports?format=csv", "_blank");
    } else if (selectedFormat === "JSON") {
      window.open("/api/v1/reports?format=json", "_blank");
    } else {
      window.print();
    }
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 4000);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-sky-400" />
            Centro de Exportación de Informes & Becas Deportivas
          </h2>
          <p className="text-xs text-slate-400">
            Generación de memorias técnicas para federaciones, organismos de financiación y comités olímpicos
          </p>
        </div>
      </div>

      {/* Main Report Configuration Card */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-8 shadow-2xl">
        <div className="max-w-2xl space-y-6">
          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
              Tipo de Informe Técnico a Generar
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: "GRANT_SCHOLARSHIP",
                  title: "Memoria de Beca / Financiación",
                  desc: "Métricas biométricas, telemetría cardíaca y progresión competitiva para ayudas deportivas.",
                },
                {
                  id: "FEDERATION_ANNUAL",
                  title: "Informe Federativo Oficial",
                  desc: "Censo de atletas, cinturones Dan, clubes inscritos y porcentaje de victorias WT.",
                },
                {
                  id: "AI_DIAGNOSTIC",
                  title: "Auditoría del Modelo de IA",
                  desc: "Pesos aprendidos, precisión en predicción de fatiga y dataset analizado.",
                },
                {
                  id: "TRIMP_PHYSIO",
                  title: "Dossier Fisiológico & Cardio",
                  desc: "Desglose por zonas Z1-Z5 y respuesta de recuperación cardíaca a 60s.",
                },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setReportType(item.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    reportType === item.id
                      ? "bg-sky-950/40 border-sky-500 shadow-chong-glow text-white"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <h4 className="font-bold text-sm text-white mb-1">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white uppercase tracking-wider mb-2">
              Formato de Salida
            </label>
            <div className="flex gap-3">
              {(["CSV", "JSON", "PDF"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setSelectedFormat(fmt)}
                  className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    selectedFormat === fmt
                      ? "bg-sky-600 text-white border-sky-500 shadow-chong-glow"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {fmt === "CSV" && <FileSpreadsheet className="w-4 h-4" />}
                  {fmt === "JSON" && <FileText className="w-4 h-4" />}
                  {fmt === "PDF" && <Printer className="w-4 h-4" />}
                  Exportar en {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Datos actualizados al instante con persistencia lista para Vercel / Postgres.
            </div>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-chong-glow transition-all"
            >
              <Download className="w-4 h-4" />
              Descargar Informe Completo ({selectedFormat})
            </button>
          </div>

          {downloadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Informe generado y descargado con éxito.
            </div>
          )}
        </div>
      </div>

      {/* Preview Section */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-6">
        <h3 className="text-sm font-bold text-white mb-3">Vista Previa de la Estructura del Informe</h3>
        <div className="p-4 rounded-xl bg-slate-900 font-mono text-[11px] text-slate-300 border border-slate-800 overflow-x-auto space-y-1">
          <div>// Resumen Ejecutivo Federación Taekwondo 2026</div>
          <div>Organización: Real Federación de Taekwondo - Ecosistema de Rendimiento</div>
          <div>Versión IA: {db.retrainMetrics.modelVersion} (Precisión: {db.retrainMetrics.fatiguePredictionAccuracy}%)</div>
          <div>Atletas Registrados: {db.athletes.length} (Categorías Olímpicas: -49kg, -57kg, -68kg, -80kg)</div>
          <div>Muestras de Telemetría Cardíaca: {db.trainings.length} sesiones (100% analizadas)</div>
          <div>Promedio de Caída HRR a 60s: -40.5 BPM (Excelente adaptación cardiovascular)</div>
        </div>
      </div>
    </div>
  );
}
