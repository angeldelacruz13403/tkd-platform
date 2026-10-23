"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Trophy,
  Download,
  Printer,
  Share2,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  ExternalLink,
  X,
  Swords,
  ChevronRight,
  ChevronLeft,
  Shield,
  Layers,
  Flag,
  Send,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { CompetitionMatch } from "@/lib/types";

export const CATEGORY_WEIGHT_LABELS: Record<string, string> = {
  OLYMPIC_M_58: "Olympic M -58kg",
  OLYMPIC_M_68: "Olympic M -68kg",
  OLYMPIC_M_80: "Olympic M -80kg",
  OLYMPIC_M_PLUS_80: "Olympic M +80kg",
  OLYMPIC_F_49: "Olympic W -49kg",
  OLYMPIC_F_57: "Olympic W -57kg",
  OLYMPIC_F_67: "Olympic W -67kg",
  OLYMPIC_F_PLUS_67: "Olympic W +67kg",
  SENIOR_M_54: "Senior Masc. -54kg",
  SENIOR_M_58: "Senior Masc. -58kg",
  SENIOR_M_63: "Senior Masc. -63kg",
  SENIOR_M_68: "Senior Masc. -68kg",
  SENIOR_M_74: "Senior Masc. -74kg",
  SENIOR_M_80: "Senior Masc. -80kg",
  SENIOR_M_87: "Senior Masc. -87kg",
  SENIOR_M_PLUS_87: "Senior Masc. +87kg",
  SENIOR_F_46: "Senior Fem. -46kg",
  SENIOR_F_49: "Senior Fem. -49kg",
  SENIOR_F_53: "Senior Fem. -53kg",
  SENIOR_F_57: "Senior Fem. -57kg",
  SENIOR_F_62: "Senior Fem. -62kg",
  SENIOR_F_67: "Senior Fem. -67kg",
  SENIOR_F_73: "Senior Fem. -73kg",
  SENIOR_F_PLUS_73: "Senior Fem. +73kg",
  JUNIOR_M_55: "Junior Masc. -55kg",
  JUNIOR_F_49: "Junior Fem. -49kg",
  CADET_M_45: "Cadete Masc. -45kg",
  CADET_F_41: "Cadete Fem. -41kg",
};

export const getCategoryLabel = (category: string) =>
  CATEGORY_WEIGHT_LABELS[category] || category.replace(/_/g, " ");

interface BracketViewerProps {
  tournament: {
    id: string;
    name: string;
    date?: string | null;
    venue?: string;
    category?: string;
    tatami_number?: number;
    registered_athletes?: any[];
  };
  matches: CompetitionMatch[];
  isPublic?: boolean;
  localApiUrl?: string;
  onClose?: () => void;
}

export function BracketViewer({
  tournament,
  matches,
  isPublic = false,
  localApiUrl = "http://localhost:5001",
  onClose,
}: BracketViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [isSendingRound, setIsSendingRound] = useState(false);
  const [sendRoundStatus, setSendRoundStatus] = useState<"idle" | "ok" | "error">("idle");
  const printableRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filtrar todos los combates de este torneo
  const tournamentMatches = useMemo(
    () => matches.filter((m) => m.tournamentId === tournament.id),
    [matches, tournament.id]
  );

  // Obtener categorías únicas con combates o inscritos
  const categories = useMemo(() => {
    const set = new Set<string>();
    tournamentMatches.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    if (Array.isArray(tournament.registered_athletes)) {
      tournament.registered_athletes.forEach((a: any) => {
        if (a.tournamentCategory) set.add(a.tournamentCategory);
        else if (a.category) set.add(a.category);
      });
    }
    if (set.size === 0 && tournament.category) {
      set.add(tournament.category);
    }
    return Array.from(set);
  }, [tournamentMatches, tournament.category, tournament.registered_athletes]);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    categories[0] || "SENIOR_M_68"
  );

  // Asegurar categoría seleccionada válida si cambian
  const currentCategory = categories.includes(selectedCategory)
    ? selectedCategory
    : categories[0] || "SENIOR_M_68";

  // Combates de la categoría seleccionada (de DB o calculados a partir de inscritos)
  const categoryMatches = useMemo(() => {
    const fromDb = tournamentMatches.filter(
      (m) => (m.category || "SENIOR_M_68") === currentCategory
    );
    if (fromDb.length > 0) return fromDb;

    // Si no hay combates guardados aún en DB pero hay inscritos para esta categoría, armar cuadro previo
    const athletes = (tournament.registered_athletes || []).filter((a: any) => {
      const cat = a.tournamentCategory || a.category || tournament.category;
      return cat === currentCategory;
    });
    if (athletes.length < 2) return [];

    const count = athletes.length;
    const size = 2 ** Math.ceil(Math.log2(count));
    const byeCount = size - count;
    const nonByeCount = count - byeCount;
    const firstRoundPairsCount = Math.floor(nonByeCount / 2);

    const synthMatches: CompetitionMatch[] = [];
    let matchCounter = 1;

    for (let i = 0; i < firstRoundPairsCount; i++) {
      const a = athletes[i * 2];
      const b = athletes[i * 2 + 1];
      const currentMatchNum = String(matchCounter++);
      synthMatches.push({
        id: `synth-${i + 1}`,
        matchNumber: currentMatchNum,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        athleteId: a.id || a.athleteId || `ath-${i * 2}`,
        athleteName: a.fullName || a.name || "Atleta Chong",
        opponentAthleteId: b.id || b.athleteId || `ath-${i * 2 + 1}`,
        opponentName: b.fullName || b.name || "Atleta Hong",
        category: currentCategory,
        weightDivision: currentCategory,
        chongWtId: "",
        hongWtId: "",
        started: false,
        lastUpdatedAt: new Date().toISOString(),
        opponentCountryClub: "",
        corner: "CHONG",
        phase: size <= 4 ? "Semifinal" : size <= 8 ? "Cuartos de final" : "Ronda 1",
        round: 0,
        tatamiNumber: tournament.tatami_number || 1,
        date: tournament.date || new Date().toISOString(),
        result: "",
        round1Score: { athlete: 0, opponent: 0 },
        round2Score: { athlete: 0, opponent: 0 },
        round3Score: { athlete: 0, opponent: 0 },
        gamJeomsReceived: 0,
        pointsByTechnique: { headKicks: 0, spinningHead: 0, bodyKicks: 0, spinningBody: 0, punches: 0 },
        staminaDropInRound3: false,
      });
    }

    for (let i = 0; i < byeCount; i++) {
      const athlete = athletes[nonByeCount + i];
      if (athlete) {
        const currentMatchNum = String(matchCounter++);
        synthMatches.push({
          id: `synth-bye-${i + 1}`,
          matchNumber: currentMatchNum,
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          athleteId: athlete.id || athlete.athleteId || `ath-bye-${i}`,
          athleteName: athlete.fullName || athlete.name || "Atleta Directo",
          opponentAthleteId: "",
          opponentName: "BYE · Pase directo",
          category: currentCategory,
          weightDivision: currentCategory,
          chongWtId: "",
          hongWtId: "",
          started: false,
          lastUpdatedAt: new Date().toISOString(),
          opponentCountryClub: "",
          corner: "CHONG",
          phase: "Pase a siguiente ronda",
          round: 0,
          tatamiNumber: tournament.tatami_number || 1,
          date: tournament.date || new Date().toISOString(),
          isBye: true,
          result: "",
          round1Score: { athlete: 0, opponent: 0 },
          round2Score: { athlete: 0, opponent: 0 },
          round3Score: { athlete: 0, opponent: 0 },
          gamJeomsReceived: 0,
          pointsByTechnique: { headKicks: 0, spinningHead: 0, bodyKicks: 0, spinningBody: 0, punches: 0 },
          staminaDropInRound3: false,
        });
      }
    }
    return synthMatches;
  }, [tournamentMatches, currentCategory, tournament.registered_athletes, tournament.category, tournament.id, tournament.name, tournament.tatami_number, tournament.date]);

  const firstRoundMatches = useMemo(
    () => categoryMatches.filter((m) => Number(m.round) === 0 && !m.isBye),
    [categoryMatches]
  );

  const byes = useMemo(
    () => categoryMatches.filter((m) => m.isBye),
    [categoryMatches]
  );

  const entrantCount = firstRoundMatches.length * 2 + byes.length;
  const bracketSize = Math.max(2, 2 ** Math.ceil(Math.log2(Math.max(2, entrantCount))));
  const roundCount = Math.max(1, Math.log2(bracketSize));

  const phaseNames = useMemo(() => {
    const standard = ["Ronda Preliminar", "Octavos", "Cuartos de final", "Semifinal", "Gran Final"];
    return Array.from({ length: roundCount }, (_, i) => {
      const remainingRounds = roundCount - 1 - i;
      if (remainingRounds === 0) return "Gran Final";
      if (remainingRounds === 1) return "Semifinales";
      if (remainingRounds === 2) return "Cuartos de final";
      if (remainingRounds === 3) return "Octavos de final";
      const fromMatch = categoryMatches.find((m) => Number(m.round) === i)?.phase;
      return fromMatch || `Ronda ${i + 1}`;
    });
  }, [roundCount, categoryMatches]);

  const columnWidth = 270;
  const cardWidth = 230;
  const slotHeight = 72;
  const chartHeight = bracketSize * slotHeight;
  const chartWidth = roundCount * columnWidth - (columnWidth - cardWidth);

  // Scroll to active round column when changed
  useEffect(() => {
    if (activeRound === null) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const targetX = activeRound * columnWidth * zoom;
    container.scrollTo({ left: Math.max(0, targetX - 32), behavior: "smooth" });
    setSendRoundStatus("idle");
  }, [activeRound, columnWidth, zoom]);

  // Convierte fase interna al código TKStrike (R64, QF, SF, F, BRZ…)
  const toTkStrikePhase = (phase: string): string => {
    const TKS_PHASES = new Set(["R256", "R128", "R64", "R32", "R16", "QF", "SF", "BRZ", "F"]);
    const normalized = phase.trim().toUpperCase();
    if (normalized === "PRELIM" || normalized === "PRELIMINARY" || normalized === "RONDA PRELIMINAR") return "R64";
    if (normalized.includes("CUARTOS")) return "QF";
    if (normalized.includes("SEMI")) return "SF";
    if (normalized.includes("FINAL") && !normalized.includes("SEMI")) return "F";
    if (normalized.includes("BRONCE") || normalized === "BRZ") return "BRZ";
    if (normalized.includes("OCTAVO")) return "R16";
    return TKS_PHASES.has(normalized) ? normalized : "R64";
  };

  // Envía los combates de la ronda seleccionada al bridge TKStrike
  const handleSendRoundToTkStrike = async () => {
    if (activeRound === null) return;
    const roundMatches = categoryMatches.filter(
      (m) => Number(m.round) === activeRound && !m.isBye && !m.isPlaceholder
    );
    if (roundMatches.length === 0) return;

    setIsSendingRound(true);
    setSendRoundStatus("idle");

    const baseUrls = [localApiUrl.replace(/\/$/, "")];
    if (localApiUrl.includes("localhost")) baseUrls.push(localApiUrl.replace("localhost", "127.0.0.1"));
    if (localApiUrl.includes("127.0.0.1")) baseUrls.push(localApiUrl.replace("127.0.0.1", "localhost"));

    let sent = 0;
    for (let i = 0; i < roundMatches.length; i++) {
      const m = roundMatches[i];
      const payload = {
        id: m.id,
        matchNumber: m.matchNumber,
        tournamentId: m.tournamentId,
        tournamentName: m.tournamentName,
        tatamiNumber: m.tatamiNumber ?? tournament.tatami_number ?? 1,
        phase: toTkStrikePhase(m.phase || ""),
        weightDivision: m.weightDivision || m.category,
        category: m.category,
        athleteId: m.athleteId,
        athleteName: m.athleteName,
        opponentAthleteId: m.opponentAthleteId ?? "",
        opponentName: m.opponentName,
        opponentCountryClub: m.opponentCountryClub ?? "",
        corner: m.corner,
        chongWtId: m.chongWtId,
        hongWtId: m.hongWtId,
        round: m.round,
        replaceTournamentQueue: i === 0,
      };

      for (const baseUrl of baseUrls) {
        try {
          const res = await fetch(`${baseUrl}/api/match`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (res.ok) { sent += 1; break; }
        } catch {
          // intenta la siguiente URL
        }
      }
    }

    setIsSendingRound(false);
    setSendRoundStatus(sent > 0 ? "ok" : "error");
    setTimeout(() => setSendRoundStatus("idle"), 3500);
  };

  // Copiar enlace web público
  const handleCopyPublicLink = () => {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/bracket/${tournament.id}`
      : `/bracket/${tournament.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Descarga en formato CSV / Excel
  const handleDownloadCsv = () => {
    const headers = [
      "ID Combate",
      "Nº Combate",
      "Categoría",
      "Fase",
      "Ronda",
      "Esquina Azul (Chong)",
      "Esquina Roja (Hong)",
      "Puntuación Chong",
      "Puntuación Hong",
      "Vencedor",
      "Tipo",
    ];

    const rows = categoryMatches.map((m) => [
      `"${m.id}"`,
      `"${m.matchNumber || ""}"`,
      `"${getCategoryLabel(m.category || currentCategory)}"`,
      `"${m.phase || ""}"`,
      `"${Number(m.round) + 1}"`,
      `"${m.athleteName || ""}"`,
      `"${m.opponentName || ""}"`,
      `"${m.round1Score?.athlete ?? 0}"`,
      `"${m.round1Score?.opponent ?? 0}"`,
      `"${m.winner || ""}"`,
      `"${m.isBye ? "BYE (Pase directo)" : m.isPlaceholder ? "Por clasificar" : "Oficial"}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bracket-${tournament.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${currentCategory}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Descargar imagen vectorial SVG
  const handleDownloadSvg = () => {
    const totalW = chartWidth + 60;
    const totalH = chartHeight + 160;

    let svgPaths = "";
    for (let r = 0; r < roundCount - 1; r++) {
      const nextRoundMatches = bracketSize / 2 ** (r + 2);
      const slotsPerMatch = 2 ** (r + 1);
      for (let n = 0; n < nextRoundMatches; n++) {
        const topY = (n * slotsPerMatch * 2 + slotsPerMatch / 2) * slotHeight + 110;
        const bottomY = (n * slotsPerMatch * 2 + slotsPerMatch + slotsPerMatch / 2) * slotHeight + 110;
        const targetY = (n * slotsPerMatch * 2 + slotsPerMatch) * slotHeight + 110;
        const startX = r * columnWidth + cardWidth + 30;
        const joinX = startX + 20;
        const endX = (r + 1) * columnWidth + 30;

        svgPaths += `<path d="M ${startX} ${topY} H ${joinX} V ${bottomY} H ${startX}" fill="none" stroke="#475569" stroke-width="2" />`;
        svgPaths += `<path d="M ${joinX} ${targetY} H ${endX}" fill="none" stroke="#475569" stroke-width="2" />`;
      }
    }

    let svgCards = "";
    for (let r = 0; r < roundCount; r++) {
      const matchCount = bracketSize / 2 ** (r + 1);
      const slotsPerMatch = 2 ** (r + 1);
      const roundBouts = categoryMatches.filter((p) => Number(p.round) === r && !p.isBye);

      for (let m = 0; m < matchCount; m++) {
        const centerY = (m * slotsPerMatch + slotsPerMatch / 2) * slotHeight + 110;
        const x = r * columnWidth + 30;
        const y = centerY - 28;
        const bout = roundBouts[m];
        const isFinished = bout?.result && bout?.winner;
        const topName = (bout?.athleteName || "Por determinar").slice(0, 24);
        const bottomName = (bout?.opponentName || (r === 0 ? "BYE · Pase directo" : "Por clasificar")).slice(0, 24);
        const matchNum = bout?.matchNumber ? `#${bout.matchNumber}` : `M${r + 1}-${m + 1}`;

        svgCards += `
          <g transform="translate(${x}, ${y})">
            <rect width="${cardWidth}" height="56" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1.5" />
            <rect x="0" y="0" width="4" height="28" rx="2" fill="#0284c7" />
            <rect x="0" y="28" width="4" height="28" rx="2" fill="#e11d48" />
            <text x="12" y="19" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#f8fafc">${topName}</text>
            <line x1="8" y1="28" x2="${cardWidth - 8}" y2="28" stroke="#1e293b" stroke-width="1" />
            <text x="12" y="47" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="${bottomName.includes("BYE") ? "#fbbf24" : "#f8fafc"}">${bottomName}</text>
            <rect x="${cardWidth - 36}" y="4" width="30" height="14" rx="4" fill="#1e293b" />
            <text x="${cardWidth - 21}" y="14" font-family="monospace" font-size="9" font-weight="bold" fill="#38bdf8" text-anchor="middle">${matchNum}</text>
          </g>
        `;
      }
    }

    const svgDoc = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
  <rect width="100%" height="100%" fill="#070b14" />
  <!-- Header -->
  <text x="30" y="40" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#ffffff">${tournament.name}</text>
  <text x="30" y="65" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#38bdf8">${getCategoryLabel(currentCategory)} · Tatami #${tournament.tatami_number || 1} · Cuadro Piramidal Oficial WT</text>
  <text x="30" y="85" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Generado por TKD Platform · ${new Date().toLocaleDateString("es-ES")}</text>
  ${svgPaths}
  ${svgCards}
</svg>`;

    const blob = new Blob([svgDoc], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bracket-${tournament.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${currentCategory}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Imprimir / Guardar en PDF
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col bg-slate-950 text-white rounded-2xl border border-slate-800 shadow-2xl overflow-hidden w-full max-w-full">
      {/* Estilos específicos de impresión para formato de cuadro oficial WT */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-sheet {
            display: block !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 10px !important;
          }
          .print-sheet * {
            color: black !important;
          }
          .print-card {
            background: white !important;
            border: 1.5px solid #000 !important;
            box-shadow: none !important;
          }
          .print-card-blue {
            border-left: 4px solid #0284c7 !important;
          }
          .print-card-red {
            border-left: 4px solid #e11d48 !important;
          }
          .print-line {
            stroke: #000 !important;
          }
          @page {
            size: landscape;
            margin: 8mm;
          }
        }
      `}</style>

      {/* Top Bar: Title & Actions */}
      <header className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                {tournament.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800/50">
                Tatami {tournament.tatami_number || 1}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Cuadro Piramidal Oficial World Taekwondo · {categoryMatches.length} combates registrados
            </p>
          </div>
        </div>

        {/* Action Buttons: Downloads, Print, Share */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              title="Reducir zoom"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] font-mono font-semibold text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors border-l border-slate-800"
              title="Restablecer tamaño"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download SVG */}
          <button
            onClick={handleDownloadSvg}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all active:scale-95 shadow-md"
            title="Descargar imagen vectorial (.SVG) de alta definición"
          >
            <Download className="w-4 h-4 text-white" />
            <span>Descargar SVG</span>
          </button>

          {/* Download CSV */}
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95 shadow-md"
            title="Descargar hoja de combates en CSV (Excel)"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Descargar CSV</span>
          </button>

          {/* Print / Save PDF */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-lg ring-1 ring-amber-300"
            title="Imprimir o Guardar en PDF oficial para el tatami"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>Imprimir / PDF Oficial</span>
          </button>

          {/* Copy Public Link */}
          <button
            onClick={handleCopyPublicLink}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800/80 border border-purple-500/40 text-xs font-semibold text-purple-200 transition-all active:scale-95"
            title="Copiar enlace web público para compartir"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            <span>{copiedLink ? "¡Copiado!" : "Compartir Web"}</span>
          </button>

          {/* Close button if modal */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-slate-700"
              title="Cerrar visor"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <nav className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-print">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-2 shrink-0">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            Categoría:
          </span>
          {categories.map((cat) => {
            const count = categoryMatches.length;
            const isSelected = cat === currentCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-sky-500 text-slate-950 shadow-md font-bold"
                    : "bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
                }`}
              >
                <span>{getCategoryLabel(cat)}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${isSelected ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-400"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Round Navigation Bar */}
      {roundCount > 1 && (
        <nav className="px-4 py-3 bg-slate-950/80 border-b border-slate-700/60 flex items-center gap-3 no-print">
          {/* Prev button */}
          <button
            onClick={() => setActiveRound((r) => Math.max(0, (r ?? 0) - 1))}
            disabled={activeRound === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95 shrink-0"
            title="Ronda anterior"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          {/* Phase pills */}
          <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {phaseNames.map((phase, idx) => {
              const isActive = activeRound === idx;
              const isLast = idx === roundCount - 1;
              return (
                <button
                  key={`round-nav-${idx}`}
                  onClick={() => setActiveRound(idx === activeRound ? null : idx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border ${
                    isActive
                      ? isLast
                        ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 scale-105"
                        : "bg-sky-500 text-slate-950 border-sky-400 shadow-md shadow-sky-500/20 scale-105"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-600"
                  }`}
                  title={`Ir a ${phase}`}
                >
                  {isLast && <Flag className="w-3 h-3" />}
                  {phase}
                  <span className={`text-[10px] font-mono px-1 rounded ${
                    isActive ? "bg-slate-950/20" : "bg-slate-800 text-slate-500"
                  }`}>
                    R{idx + 1}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Next button */}
          <button
            onClick={() => setActiveRound((r) => Math.min(roundCount - 1, (r ?? -1) + 1))}
            disabled={activeRound === roundCount - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95 shrink-0"
            title="Siguiente ronda"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Active round label + TKStrike send button */}
          {activeRound !== null && (
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <div className="hidden md:flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Viendo:</span>
                <span className="text-xs font-black text-sky-300 bg-sky-950/50 border border-sky-800/50 px-2 py-0.5 rounded-lg">
                  {phaseNames[activeRound]}
                </span>
                <button
                  onClick={() => setActiveRound(null)}
                  className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors"
                  title="Ver todas las rondas"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Separator */}
              <span className="w-px h-5 bg-slate-700 hidden md:block" />

              {/* Send to TKStrike */}
              <button
                onClick={handleSendRoundToTkStrike}
                disabled={isSendingRound}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg border shrink-0 ${
                  sendRoundStatus === "ok"
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/20"
                    : sendRoundStatus === "error"
                    ? "bg-rose-700 border-rose-600 text-white shadow-rose-500/20"
                    : "bg-gradient-to-r from-orange-600 to-amber-500 border-amber-400 text-slate-950 shadow-amber-500/30 hover:from-orange-500 hover:to-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
                }`}
                title={`Enviar combates de ${phaseNames[activeRound]} al bridge TKStrike`}
              >
                {isSendingRound ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : sendRoundStatus === "ok" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : sendRoundStatus === "error" ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>
                  {isSendingRound
                    ? "Enviando..."
                    : sendRoundStatus === "ok"
                    ? "¡Enviado!"
                    : sendRoundStatus === "error"
                    ? "Sin puente"
                    : `Enviar ${phaseNames[activeRound]} a TKStrike`}
                </span>
              </button>
            </div>
          )}
        </nav>
      )}

      {/* Direct Download Action Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-700/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-amber-300">
            Descargar Bracket ({getCategoryLabel(currentCategory)}):
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Exporta el cuadro para imprimir o publicar
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadSvg}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow transition-all active:scale-95"
            title="Descargar diagrama en imagen vectorial SVG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar SVG</span>
          </button>
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all active:scale-95"
            title="Descargar lista de combates en CSV (Excel)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Descargar CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow transition-all active:scale-95"
            title="Imprimir directamente o guardar en PDF oficial WT"
          >
            <Printer className="w-3.5 h-3.5 text-slate-950" />
            <span>Imprimir / Guardar en PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet & Live Interactive Tree Container */}
      <div className="p-4 sm:p-6 overflow-auto max-h-[75vh]" ref={(el) => { (printableRef as any).current = el; (scrollContainerRef as any).current = el; }}>
        {/* Printable Header (Visible only when printing) */}
        <div className="hidden print:block mb-4 pb-2 border-b border-black">
          <h1 className="text-xl font-black uppercase text-black">{tournament.name}</h1>
          <p className="text-sm font-bold text-black">
            Categoría: {getCategoryLabel(currentCategory)} · Tatami #{tournament.tatami_number || 1} · Cuadro Oficial WT
          </p>
          <p className="text-xs text-black">Fecha: {tournament.date ? new Date(tournament.date).toLocaleDateString("es-ES") : "Fecha oficial"} | Plataforma Oficial TKD Hub</p>
        </div>

        {categoryMatches.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Swords className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
            <h3 className="text-sm font-bold text-slate-400">Aún no hay combates sorteados para esta categoría</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Genera o sortea el bracket desde la sección de Competiciones para visualizar el cuadro piramidal completo.
            </p>
          </div>
        ) : (
          <div
            className="transition-transform origin-top-left"
            style={{ transform: `scale(${zoom})`, transformOrigin: "0 0" }}
          >
            {/* SVG Tree Grid */}
            <div className="relative" style={{ width: chartWidth, height: chartHeight + 40 }}>
              {/* Round Phase Headers */}
              {phaseNames.map((phase, roundIndex) => (
                <div
                  key={`header-${phase}-${roundIndex}`}
                  className="absolute top-0 text-[11px] font-black uppercase tracking-wider text-sky-400 bg-sky-950/30 border border-sky-900/40 px-3 py-1 rounded-lg text-center"
                  style={{ left: roundIndex * columnWidth, width: cardWidth }}
                >
                  {phase}
                </div>
              ))}

              {/* Connecting Bracket Lines */}
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{ left: 0, top: 38, width: chartWidth, height: chartHeight }}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
              >
                {Array.from({ length: Math.max(0, roundCount - 1) }).flatMap((_, roundIndex) => {
                  const nextRoundMatches = bracketSize / 2 ** (roundIndex + 2);
                  const slotsPerMatch = 2 ** (roundIndex + 1);
                  return Array.from({ length: nextRoundMatches }).flatMap((__, nextIndex) => {
                    const topY = (nextIndex * slotsPerMatch * 2 + slotsPerMatch / 2) * slotHeight;
                    const bottomY = (nextIndex * slotsPerMatch * 2 + slotsPerMatch + slotsPerMatch / 2) * slotHeight;
                    const targetY = (nextIndex * slotsPerMatch * 2 + slotsPerMatch) * slotHeight;
                    const startX = roundIndex * columnWidth + cardWidth;
                    const joinX = startX + 20;
                    const endX = (roundIndex + 1) * columnWidth;

                    return [
                      <path
                        key={`bracket-top-${roundIndex}-${nextIndex}`}
                        d={`M ${startX} ${topY} H ${joinX} V ${bottomY} H ${startX}`}
                        fill="none"
                        stroke="#475569"
                        strokeWidth="2"
                        className="print-line"
                      />,
                      <path
                        key={`bracket-next-${roundIndex}-${nextIndex}`}
                        d={`M ${joinX} ${targetY} H ${endX}`}
                        fill="none"
                        stroke="#475569"
                        strokeWidth="2"
                        className="print-line"
                      />,
                    ];
                  });
                })}
              </svg>

              {/* Match Bout Cards */}
              {Array.from({ length: roundCount }).flatMap((_, roundIndex) => {
                const matchCount = bracketSize / 2 ** (roundIndex + 1);
                const slotsPerMatch = 2 ** (roundIndex + 1);
                const roundBouts = categoryMatches.filter((p) => Number(p.round) === roundIndex && !p.isBye);

                return Array.from({ length: matchCount }).map((__, matchIndex) => {
                  const centerY = (matchIndex * slotsPerMatch + slotsPerMatch / 2) * slotHeight;
                  const bout = roundBouts[matchIndex];
                  const isFinished = bout?.result && bout?.winner;
                  const isTopWinner = bout?.winner === "CHONG";
                  const isBottomWinner = bout?.winner === "HONG";

                  const topName = bout?.athleteName || (roundIndex === 0 ? "Por clasificar" : `Ganador combate previo`);
                  const bottomName = bout?.opponentName || (roundIndex === 0 ? "BYE · Pase directo" : `Ganador combate previo`);
                  const matchNumber = bout?.matchNumber ? `#${bout.matchNumber}` : `#${roundIndex + 1}-${matchIndex + 1}`;

                  const isRoundActive = activeRound === null || activeRound === roundIndex;
                  const isFocusedRound = activeRound === roundIndex;

                  return (
                    <div
                      key={`card-${roundIndex}-${matchIndex}`}
                      className={`absolute flex flex-col justify-between overflow-hidden rounded-xl border transition-all print-card ${
                        isFocusedRound
                          ? "ring-2 ring-sky-400/60 shadow-lg shadow-sky-500/10"
                          : ""
                      } ${
                        isFinished
                          ? "bg-slate-900 border-sky-500/50 shadow-md ring-1 ring-sky-500/20"
                          : "bg-slate-900/95 border-slate-800 hover:border-slate-700 shadow-sm"
                      }`}
                      style={{
                        left: roundIndex * columnWidth,
                        top: centerY - 28 + 38,
                        width: cardWidth,
                        height: 58,
                        opacity: isRoundActive ? 1 : 0.25,
                        transition: "opacity 0.3s ease, box-shadow 0.2s ease",
                      }}
                    >
                      {/* Top Fighter: Chong (Blue) */}
                      <div className={`flex items-center justify-between px-2.5 py-1 border-b border-slate-800/80 print-card-blue ${isTopWinner ? "bg-sky-950/40" : ""}`}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0"></span>
                          <span className={`text-[11px] font-semibold truncate ${isTopWinner ? "text-sky-300 font-bold" : "text-slate-200"}`}>
                            {topName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isTopWinner && (
                            <span className="text-[8px] font-black text-amber-300 bg-amber-500/20 px-1 rounded border border-amber-500/30">
                              🏆 GANÓ
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            {bout?.round1Score?.athlete ?? "—"}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Fighter: Hong (Red) */}
                      <div className={`flex items-center justify-between px-2.5 py-1 print-card-red ${isBottomWinner ? "bg-rose-950/40" : ""}`}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                          <span className={`text-[11px] font-semibold truncate ${bottomName.includes("BYE") ? "text-amber-300 italic text-[10px]" : isBottomWinner ? "text-rose-300 font-bold" : "text-slate-300"}`}>
                            {bottomName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isBottomWinner && (
                            <span className="text-[8px] font-black text-amber-300 bg-amber-500/20 px-1 rounded border border-amber-500/30">
                              🏆 GANÓ
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            {bottomName.includes("BYE") ? "" : bout?.round1Score?.opponent ?? "—"}
                          </span>
                        </div>
                      </div>

                      {/* Match Number badge */}
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none">
                        <span className="text-[8px] font-mono font-bold text-slate-500 bg-slate-950 px-1 py-0.5 rounded border border-slate-800">
                          {matchNumber}
                        </span>
                      </div>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Download Bar */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5 no-print">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-white">
            Descargar archivo del cuadro ({getCategoryLabel(currentCategory)}):
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadSvg}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow transition-all active:scale-95"
            title="Descargar imagen vectorial (.SVG)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar SVG</span>
          </button>
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition-all active:scale-95"
            title="Descargar lista de combates (.CSV)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Descargar CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow transition-all active:scale-95"
            title="Imprimir o Guardar en PDF oficial"
          >
            <Printer className="w-3.5 h-3.5 text-slate-950" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
