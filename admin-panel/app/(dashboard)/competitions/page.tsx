"use client";

import { useEffect, useRef, useState } from "react";
import { Trophy, Plus, Search, Swords, ShieldAlert, Award, Calendar, CheckCircle2, Edit2, Trash2, Link as LinkIcon, Copy, ExternalLink, Network, Download, FileSpreadsheet, Printer } from "lucide-react";
import { db } from "@/lib/db";
import { CompetitionMatch } from "@/lib/types";
import {
  getTournamentDivisionForAthlete,
  getTournamentWeightCategories,
  getTournamentWeightModeLabel,
  getTkStrikeEventAbbreviation,
  getTkStrikeEventDivision,
  getTkStrikeEventGender,
  getTkStrikeSensorThresholds,
  getTkStrikeWeightCategoryLabel,
  type TournamentWeightMode,
} from "@/lib/tournament-categories";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { BracketViewer } from "@/components/BracketViewer";

const PAGE_SIZE = 4;
const TKS_PHASES = new Set(["R64", "R32", "SF", "R128", "F", "R16", "BRZ", "R256", "QF"]);

function toTkStrikePhase(phase: string) {
  const normalized = phase.trim().toUpperCase();
  if (normalized === "PRELIM" || normalized === "PRELIMINARY") return "R64";
  return TKS_PHASES.has(normalized) ? normalized : "R64";
}

type GeneratedBracketBout = {
  a: any;
  b: any;
  phase: string;
  matchNum: number;
  round: number;
  tournamentDivision: string;
  isPlaceholder: boolean;
  sourceMatchNumbers: number[];
};

const getSensorThresholds = getTkStrikeSensorThresholds;
const getWeightLabel = (category: string) => getTkStrikeWeightCategoryLabel(category) || category;

function downloadSvgFromBracketTree(
  category: string,
  pairs: any[],
  byes: any[],
  tournamentName = "Competición WT"
) {
  const firstRoundPairs = pairs.filter((pair) => Number(pair.round) === 0);
  const entrantCount = firstRoundPairs.length * 2 + byes.length;
  if (entrantCount < 2) return;

  const bracketSize = 2 ** Math.ceil(Math.log2(entrantCount));
  const roundCount = Math.log2(bracketSize);
  const phaseNames = Array.from({ length: roundCount }, (_, round) =>
    pairs.find((pair) => Number(pair.round) === round)?.phase || `Ronda ${round + 1}`
  );
  const fixtures = [
    ...firstRoundPairs.map((pair) => ({ key: `match-${pair.matchNum}`, pair, bye: null })),
    ...byes.map((athlete, index) => ({ key: `bye-${athlete.id}`, pair: null, bye: athlete, byeIndex: index })),
  ];
  const columnWidth = 260;
  const cardWidth = 224;
  const slotHeight = 68;
  const chartHeight = bracketSize * slotHeight;
  const chartWidth = roundCount * columnWidth - (columnWidth - cardWidth);
  const totalW = chartWidth + 60;
  const totalH = chartHeight + 140;

  let svgPaths = "";
  for (let r = 0; r < roundCount - 1; r++) {
    const nextRoundMatches = bracketSize / 2 ** (r + 2);
    const slotsPerMatch = 2 ** (r + 1);
    for (let n = 0; n < nextRoundMatches; n++) {
      const topY = (n * slotsPerMatch * 2 + slotsPerMatch / 2) * slotHeight + 90;
      const bottomY = (n * slotsPerMatch * 2 + slotsPerMatch + slotsPerMatch / 2) * slotHeight + 90;
      const targetY = (n * slotsPerMatch * 2 + slotsPerMatch) * slotHeight + 90;
      const startX = r * columnWidth + cardWidth + 30;
      const joinX = startX + 18;
      const endX = (r + 1) * columnWidth + 30;

      svgPaths += `<path d="M ${startX} ${topY} H ${joinX} V ${bottomY} H ${startX}" fill="none" stroke="#475569" stroke-width="2" />`;
      svgPaths += `<path d="M ${joinX} ${targetY} H ${endX}" fill="none" stroke="#475569" stroke-width="2" />`;
    }
  }

  let svgCards = "";
  for (let r = 0; r < roundCount; r++) {
    const matchCount = bracketSize / 2 ** (r + 1);
    const slotsPerMatch = 2 ** (r + 1);
    const roundBouts = pairs.filter((p) => Number(p.round) === r);

    for (let m = 0; m < matchCount; m++) {
      const centerY = (m * slotsPerMatch + slotsPerMatch / 2) * slotHeight + 90;
      const fixture = r === 0 ? fixtures[m] : null;
      const bout = r === 0 ? fixture?.pair : roundBouts[m];
      const byeAthlete = r === 0 ? fixture?.bye : null;

      const topName = (bout?.a?.fullName || (byeAthlete ? byeAthlete.fullName : (bout?.sourceMatchNumbers?.[0] ? `Ganador #${bout.sourceMatchNumbers[0]}` : `Ganador anterior`))).slice(0, 24);
      const bottomName = (bout?.b?.fullName || (byeAthlete ? "BYE · Pase directo" : (bout?.sourceMatchNumbers?.[1] ? `Ganador #${bout.sourceMatchNumbers[1]}` : `Ganador anterior`))).slice(0, 24);
      const matchNum = bout?.matchNum ? `#${bout.matchNum}` : `R${r + 1}-${m + 1}`;

      const x = r * columnWidth + 30;
      const y = centerY - 28;

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
  <text x="30" y="35" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#ffffff">${tournamentName}</text>
  <text x="30" y="58" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#38bdf8">${getWeightLabel(category)} · Cuadro Oficial WT</text>
  <text x="30" y="78" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Generado por TKD Platform · ${new Date().toLocaleDateString("es-ES")}</text>
  ${svgPaths}
  ${svgCards}
</svg>`;

  const blob = new Blob([svgDoc], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bracket-${tournamentName.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${category}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsvFromBracketTree(
  category: string,
  pairs: any[],
  byes: any[],
  tournamentName = "Competición WT"
) {
  const headers = ["Nº Combate", "Categoría", "Fase", "Ronda", "Atleta Chong (Azul)", "Atleta Hong (Rojo)", "Tipo"];
  const rows: string[][] = [];

  pairs.forEach((p, idx) => {
    rows.push([
      `"${p.matchNum || idx + 1}"`,
      `"${getWeightLabel(category)}"`,
      `"${p.phase || `Ronda ${Number(p.round) + 1}`}"`,
      `"${Number(p.round) + 1}"`,
      `"${p.a?.fullName || "Por clasificar"}"`,
      `"${p.b?.fullName || "Por clasificar"}"`,
      `"${p.isPlaceholder ? "Por clasificar" : "Oficial"}"`,
    ]);
  });

  byes.forEach((b, idx) => {
    rows.push([
      `"BYE-${idx + 1}"`,
      `"${getWeightLabel(category)}"`,
      `"Pase directo"`,
      `"1"`,
      `"${b.fullName || "Atleta"}"`,
      `"BYE (Pase directo)"`,
      `"BYE"`,
    ]);
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bracket-${tournamentName.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${category}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function BracketTree({ category, pairs, byes, tournamentName }: { category: string; pairs: any[]; byes: any[]; tournamentName?: string }) {
  const firstRoundPairs = pairs.filter((pair) => Number(pair.round) === 0);
  const entrantCount = firstRoundPairs.length * 2 + byes.length;
  if (entrantCount < 2) return null;

  const bracketSize = 2 ** Math.ceil(Math.log2(entrantCount));
  const roundCount = Math.log2(bracketSize);
  const phaseNames = Array.from({ length: roundCount }, (_, round) =>
    pairs.find((pair) => Number(pair.round) === round)?.phase || `Ronda ${round + 1}`
  );
  const fixtures = [
    ...firstRoundPairs.map((pair) => ({ key: `match-${pair.matchNum}`, pair, bye: null })),
    ...byes.map((athlete, index) => ({ key: `bye-${athlete.id}`, pair: null, bye: athlete, byeIndex: index })),
  ];
  const columnWidth = 260;
  const cardWidth = 224;
  const slotHeight = 68;
  const chartHeight = bracketSize * slotHeight;
  const chartWidth = roundCount * columnWidth - (columnWidth - cardWidth);

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <h4 className="text-[12px] font-bold uppercase text-slate-200">{getWeightLabel(category)} · {entrantCount} atletas</h4>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            Avance automático activo
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => downloadSvgFromBracketTree(category, pairs, byes, tournamentName)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition-all active:scale-95 shadow-sm"
            title="Descargar diagrama en imagen vectorial SVG"
          >
            <Download className="w-3 h-3" />
            <span>Descargar SVG</span>
          </button>
          <button
            type="button"
            onClick={() => downloadCsvFromBracketTree(category, pairs, byes, tournamentName)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all active:scale-95 shadow-sm"
            title="Descargar lista de combates en CSV"
          >
            <FileSpreadsheet className="w-3 h-3" />
            <span>Descargar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition-all active:scale-95 shadow-sm"
            title="Imprimir o guardar en PDF oficial"
          >
            <Printer className="w-3 h-3 text-slate-950" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ width: chartWidth, height: chartHeight + 35 }}>
          {phaseNames.map((phase, roundIndex) => (
            <div key={`header-${phase}-${roundIndex}`} className="absolute top-0 text-[10px] font-black uppercase tracking-wider text-slate-400" style={{ left: roundIndex * columnWidth, width: cardWidth }}>
              {phase} {roundIndex > 0 ? `(Ronda ${roundIndex + 1})` : ""}
            </div>
          ))}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ left: 0, top: 32, width: chartWidth, height: chartHeight }}
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
                const joinX = startX + 18;
                const endX = (roundIndex + 1) * columnWidth;
                return [
                  <path key={`bracket-top-${roundIndex}-${nextIndex}`} d={`M ${startX} ${topY} H ${joinX} V ${bottomY} H ${startX}`} fill="none" stroke="#475569" strokeWidth="1.5" />,
                  <path key={`bracket-next-${roundIndex}-${nextIndex}`} d={`M ${joinX} ${targetY} H ${endX}`} fill="none" stroke="#475569" strokeWidth="1.5" />,
                ];
              });
            })}
          </svg>
          {Array.from({ length: roundCount }).flatMap((_, roundIndex) => {
            const matchCount = bracketSize / 2 ** (roundIndex + 1);
            const slotsPerMatch = 2 ** (roundIndex + 1);
            const roundBouts = pairs.filter((p) => Number(p.round) === roundIndex);

            return Array.from({ length: matchCount }).map((__, matchIndex) => {
              const centerY = (matchIndex * slotsPerMatch + slotsPerMatch / 2) * slotHeight;
              const fixture = roundIndex === 0 ? fixtures[matchIndex] : null;
              const bout = roundIndex === 0 ? fixture?.pair : roundBouts[matchIndex];
              const byeAthlete = roundIndex === 0 ? fixture?.bye : null;

              const isTopAdvanced = Boolean(bout?.a?.id && !String(bout.a.fullName || "").startsWith("Ganador"));
              const isBottomAdvanced = Boolean(bout?.b?.id && !String(bout.b.fullName || "").startsWith("Ganador"));

              const topName = bout?.a?.fullName || (byeAthlete ? byeAthlete.fullName : (bout?.sourceMatchNumbers?.[0] ? `Ganador combate #${bout.sourceMatchNumbers[0]}` : `Ganador ${phaseNames[roundIndex - 1] || "anterior"}`));
              const bottomName = bout?.b?.fullName || (byeAthlete ? "BYE · pase directo" : (bout?.sourceMatchNumbers?.[1] ? `Ganador combate #${bout.sourceMatchNumbers[1]}` : `Ganador ${phaseNames[roundIndex - 1] || "anterior"}`));

              return (
                <div
                  key={`${category}-${roundIndex}-${matchIndex}`}
                  className={`absolute flex h-14 flex-col justify-center overflow-hidden rounded-lg border px-2.5 shadow-sm transition-all ${
                    byeAthlete
                      ? "border-amber-500/50 bg-amber-950/40"
                      : (isTopAdvanced || isBottomAdvanced)
                      ? "border-sky-500/50 bg-slate-900 ring-1 ring-sky-500/20"
                      : "border-slate-800 bg-slate-900/90"
                  }`}
                  style={{ left: roundIndex * columnWidth, top: centerY - 28 + 32, width: cardWidth }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`truncate text-[10px] font-semibold ${isTopAdvanced ? "text-sky-300 font-bold" : byeAthlete ? "text-amber-200" : "text-slate-300"}`}>
                      {topName}
                    </span>
                    {isTopAdvanced && <span className="text-[8px] font-extrabold text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-500/30">CLASIF</span>}
                  </div>
                  <div className="my-0.5 border-t border-slate-700/60" />
                  <div className="flex items-center justify-between gap-1">
                    <span className={`truncate text-[10px] font-semibold ${isBottomAdvanced ? "text-rose-300 font-bold" : byeAthlete ? "text-amber-300" : "text-slate-400"}`}>
                      {bottomName}
                    </span>
                    {isBottomAdvanced && <span className="text-[8px] font-extrabold text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-500/30">CLASIF</span>}
                  </div>
                </div>
              );
            });
          })}
        </div>
      </div>
    </section>
  );
}

export default function CompetitionsPage() {
  const toast = useToast();
  const [matches, setMatches] = useState<CompetitionMatch[]>(db.competitions);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [selectedBracketTournament, setSelectedBracketTournament] = useState<any | null>(null);
  const [isEditingSavedTournamentBracket, setIsEditingSavedTournamentBracket] = useState(false);
  const [registeredAthletes, setRegisteredAthletes] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [createdTournamentRegistrationUrl, setCreatedTournamentRegistrationUrl] = useState("");
  const [tournamentData, setTournamentData] = useState({
    name: "",
    date: "",
    venue: "",
    category: "OFFICIAL_WEIGHTS" as TournamentWeightMode,
    tatamiNumber: 1,
    athleteIds: [] as string[],
    eventAbbreviation: "SEN-M68",
    eventGender: "MALE",
    rounds: 3,
    roundTime: "02:00",
    restTime: "01:00",
    injuryTime: "01:00",
    bodyThreshold: 0,
    headThreshold: 0,
    maxDifference: 12,
    maxPenalties: 5,
  });
  const [generatedPairs, setGeneratedPairs] = useState<GeneratedBracketBout[]>([]);
  const [byeAthletes, setByeAthletes] = useState<any[]>([]);
  const [isSendingGeneratedMatches, setIsSendingGeneratedMatches] = useState(false);
  const [editingMatch, setEditingMatch] = useState<CompetitionMatch | null>(null);
  const [formData, setFormData] = useState({
    tournamentName: "",
    matchNumber: "",
    phase: "R64",
    weightDivision: "SENIOR_M_68",
    chongWtId: "",
    hongWtId: "",
    started: false,
    eventAbbreviation: "SEN-M68",
    eventGender: "MALE",
    rounds: 3,
    roundTime: "02:00",
    restTime: "01:00",
    injuryTime: "01:00",
    bodyThreshold: 0,
    headThreshold: 0,
    maxDifference: 12,
    maxPenalties: 5,
    athleteId: db.athletes[0]?.id || "",
    opponentAthleteId: "",
    opponentName: "",
    opponentCountryClub: "",
    opponentWeightKg: "",
    corner: "CHONG" as "CHONG" | "HONG",
    category: "SENIOR_M_68" as CompetitionMatch["category"],
    result: "WIN_POINTS" as CompetitionMatch["result"],
    gamJeomsReceived: 0,
    round1Athlete: 0,
    round1Opponent: 0,
    round2Athlete: 0,
    round2Opponent: 0,
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<CompetitionMatch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTournamentTarget, setDeleteTournamentTarget] = useState<any | null>(null);
  const [isDeletingTournament, setIsDeletingTournament] = useState(false);
  const [localApiUrl, setLocalApiUrl] = useState("http://localhost:5001");
  const [localApiUrl2, setLocalApiUrl2] = useState("http://localhost:5003");
  const [localUploadStatus, setLocalUploadStatus] = useState("");
  const draftTournamentIdRef = useRef("");

  useEffect(() => {
    let active = true;
    const loadCompetitions = () => {
      fetch("/api/v1/competitions")
        .then((response) => response.json())
        .then((result) => { if (active && result.success) setMatches(result.data || []); })
        .catch(() => undefined);
    };
    loadCompetitions();
    const interval = setInterval(loadCompetitions, 3500);

    fetch("/api/v1/athletes")
      .then((response) => response.json())
      .then((result) => { if (active && result.success) setRegisteredAthletes((result.data || []).filter((athlete: any) => athlete.isCompetitor)); })
      .catch(() => undefined);
    fetch("/api/v1/tournaments")
      .then((response) => response.json())
      .then((result) => { if (active && result.success) setTournaments(result.data || []); })
      .catch(() => undefined);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const eligibleTournamentAthletes = registeredAthletes.filter((athlete) => athlete.isCompetitor).flatMap((athlete) => {
    const division = getTournamentDivisionForAthlete(tournamentData.category, athlete.category);
    return division ? [{ ...athlete, tournamentDivision: division.value, tournamentDivisionLabel: division.label }] : [];
  });

  const changeTournamentWeightMode = (mode: TournamentWeightMode) => {
    setTournamentData((current) => ({ ...current, category: mode, athleteIds: [] }));
    setGeneratedPairs([]);
    setByeAthletes([]);
  };

  const openTournamentModal = () => {
    draftTournamentIdRef.current = `tournament-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    setCreatedTournamentRegistrationUrl("");
    setIsEditingSavedTournamentBracket(false);
    setTournamentData({
      name: "",
      date: "",
      venue: "",
      category: "OFFICIAL_WEIGHTS",
      tatamiNumber: 1,
      athleteIds: [],
      eventAbbreviation: "SEN-M68",
      eventGender: "MALE",
      rounds: 3,
      roundTime: "02:00",
      restTime: "01:00",
      injuryTime: "01:00",
      bodyThreshold: 0,
      headThreshold: 0,
      maxDifference: 12,
      maxPenalties: 5,
    });
    setGeneratedPairs([]);
    setByeAthletes([]);
    setIsTournamentModalOpen(true);
  };

  const toggleTournamentAthlete = (athleteId: string) => {
    setTournamentData((current) => {
      const isSelected = current.athleteIds.includes(athleteId);
      return {
        ...current,
        athleteIds: isSelected
          ? current.athleteIds.filter((id) => id !== athleteId)
          : [...current.athleteIds, athleteId],
      };
    });
  };

  const openSavedTournamentBracket = async (tournament: any) => {
    const registrations = Array.isArray(tournament.registered_athletes) ? tournament.registered_athletes : [];
    if (registrations.length < 2) {
      toast.error("Faltan inscritos", "Se necesitan al menos dos atletas inscritos para sortear el bracket.");
      return;
    }

    try {
      const response = await fetch("/api/v1/athletes");
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudieron cargar los atletas.");

      const athleteDirectory = Array.isArray(result.data) ? result.data.filter((athlete: any) => athlete.isCompetitor) : [];
      const tournamentMode: TournamentWeightMode = tournament.category === "OLYMPIC_WEIGHTS"
        ? "OLYMPIC_WEIGHTS"
        : "OFFICIAL_WEIGHTS";
      const participants = registrations.map((registration: any) => {
        const athleteId = registration.athleteId || registration.id;
        const profile = athleteDirectory.find((athlete: any) => athlete.id === athleteId);
        const category = registration.category || profile?.category || "SIN_CATEGORIA";
        const division = getTournamentDivisionForAthlete(tournamentMode, category);
        return {
          ...profile,
          id: athleteId,
          fullName: profile?.fullName || registration.fullName || registration.name || "Atleta",
          clubName: profile?.clubName || registration.clubName || registration.club || "",
          category,
          tournamentDivision: division?.value,
          tournamentDivisionLabel: division?.label,
          weightKg: Number(registration.weightKg) || Number(profile?.weightKg) || 0,
        };
      }).filter((athlete: any) => Boolean(athlete.tournamentDivision));

      if (participants.length < 2) {
        toast.error("Inscritos insuficientes", "Hay menos de dos atletas elegibles para la modalidad de pesos de este torneo.");
        return;
      }

      setRegisteredAthletes((current) => {
        const merged = new Map(current.map((athlete) => [athlete.id, athlete]));
        participants.forEach((athlete: any) => merged.set(athlete.id, athlete));
        return Array.from(merged.values());
      });
      draftTournamentIdRef.current = tournament.id;
      setIsEditingSavedTournamentBracket(true);
      setTournamentData((current) => ({
        ...current,
        name: tournament.name,
        date: tournament.date ? new Date(tournament.date).toISOString().slice(0, 16) : "",
        venue: tournament.venue || "",
        category: tournamentMode,
        tatamiNumber: Number(tournament.tatami_number ?? tournament.tatamiNumber) || 1,
        athleteIds: participants.map((athlete: any) => athlete.id),
      }));
      setGeneratedPairs([]);
      setByeAthletes([]);
      setIsTournamentModalOpen(true);
    } catch (error: any) {
      toast.error("No se pudo preparar el sorteo", error?.message || "Comprueba los inscritos y vuelve a intentarlo.");
    }
  };

  const handleGenerateRandomMatches = () => {
    const selected = registeredAthletes
      .filter((athlete) => tournamentData.athleteIds.includes(athlete.id))
      .flatMap((athlete) => {
        const division = getTournamentDivisionForAthlete(tournamentData.category, athlete.category);
        return division ? [{ ...athlete, tournamentDivision: division.value, tournamentDivisionLabel: division.label }] : [];
      });
    if (selected.length < 2) {
      toast.error("Faltan deportistas", "Selecciona al menos 2 deportistas para generar la pirámide de combates.");
      return;
    }
    const groups: Record<string, any[]> = {};
    selected.forEach((athlete) => {
      const key = athlete.tournamentDivision || athlete.category || "SIN_CATEGORIA";
      groups[key] = groups[key] || [];
      groups[key].push(athlete);
    });

    const pairs: GeneratedBracketBout[] = [];
    const byes: any[] = [];
    let boutSequence = 1;
    const tatamiNumber = Math.min(99, Math.max(1, Number(tournamentData.tatamiNumber) || 1));
    const phaseForBoutCount = (boutCount: number) => {
      if (boutCount <= 1) return "F";
      if (boutCount === 2) return "SF";
      if (boutCount === 4) return "QF";
      if (boutCount === 8) return "R16";
      if (boutCount === 16) return "R32";
      if (boutCount === 32) return "R64";
      return `R${boutCount * 2}`;
    };
    const nextMatchNumber = () => tatamiNumber * 100 + boutSequence++;
    const unpairedAthletes: any[] = [];

    Object.values(groups).forEach((group) => {
      if (group.length < 2) {
        unpairedAthletes.push(...group);
        return;
      }
      const shuffled = [...group];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
      const count = shuffled.length;
      const bracketSize = 2 ** Math.ceil(Math.log2(count));
      const byeCount = bracketSize - count;
      const directAdvancers = byeCount ? shuffled.splice(0, byeCount) : [];
      byes.push(...directAdvancers);
      let advancingSlots: Array<{ athlete?: any; winnerOf?: number }> = [];
      let round = 0;

      if (byeCount > 0) {
        while (shuffled.length >= 2) {
          const firstAthlete = shuffled.pop();
          const secondAthlete = shuffled.pop();
          const matchNum = nextMatchNumber();
          pairs.push({
            a: firstAthlete,
            b: secondAthlete,
            phase: "PRELIM",
            matchNum,
            round: 0,
            tournamentDivision: firstAthlete.tournamentDivision,
            isPlaceholder: false,
            sourceMatchNumbers: [],
          });
          advancingSlots.push({ winnerOf: matchNum });
        }
        advancingSlots.push(...directAdvancers.map((athlete) => ({ athlete })));
        round = 1;
      } else {
        const initialBoutCount = shuffled.length / 2;
        while (shuffled.length >= 2) {
          const firstAthlete = shuffled.pop();
          const secondAthlete = shuffled.pop();
          const matchNum = nextMatchNumber();
          pairs.push({
            a: firstAthlete,
            b: secondAthlete,
            phase: phaseForBoutCount(initialBoutCount),
            matchNum,
            round: 0,
            tournamentDivision: firstAthlete.tournamentDivision,
            isPlaceholder: false,
            sourceMatchNumbers: [],
          });
          advancingSlots.push({ winnerOf: matchNum });
        }
        round = 1;
      }

      while (advancingSlots.length > 1) {
        const boutCount = Math.ceil(advancingSlots.length / 2);
        const nextRound: Array<{ winnerOf: number }> = [];
        for (let index = 0; index < advancingSlots.length; index += 2) {
          const firstSlot = advancingSlots[index];
          const secondSlot = advancingSlots[index + 1];
          if (!secondSlot) {
            if (firstSlot.athlete) byes.push(firstSlot.athlete);
            else if (firstSlot.winnerOf) nextRound.push({ winnerOf: firstSlot.winnerOf });
            continue;
          }
          const sourceMatchNumbers = [firstSlot.winnerOf, secondSlot.winnerOf].filter((value): value is number => Boolean(value));
          const matchNum = nextMatchNumber();
          const firstAthlete = firstSlot.athlete || {
            id: "",
            fullName: `Ganador combate ${firstSlot.winnerOf}`,
            pendingMatchNumber: firstSlot.winnerOf,
            category: group[0].category,
            tournamentDivision: group[0].tournamentDivision,
          };
          const secondAthlete = secondSlot.athlete || {
            id: "",
            fullName: `Ganador combate ${secondSlot.winnerOf}`,
            pendingMatchNumber: secondSlot.winnerOf,
            category: group[0].category,
            tournamentDivision: group[0].tournamentDivision,
          };
          pairs.push({
            a: firstAthlete,
            b: secondAthlete,
            phase: phaseForBoutCount(boutCount),
            matchNum,
            round,
            tournamentDivision: group[0].tournamentDivision,
            isPlaceholder: sourceMatchNumbers.length > 0,
            sourceMatchNumbers,
          });
          nextRound.push({ winnerOf: matchNum });
        }
        advancingSlots = nextRound;
        round += 1;
      }
    });

    if (pairs.length === 0) {
      toast.error("No hay categorías con rivales", "Selecciona al menos dos atletas de la misma categoría de peso.");
      return;
    }

    setGeneratedPairs(pairs);
    setByeAthletes(byes);
    if (unpairedAthletes.length > 0) {
      toast.warning("Atletas fuera del sorteo", `${unpairedAthletes.length} atleta(s) no tienen rival en su categoría y no se añadieron al bracket.`);
      return;
    }
    toast.success(
      "Pirámide de torneo generada",
      byes.length > 0
        ? `${pairs.length} combates listos. ${byes.length} atleta(s) avanzan directamente por BYE.`
        : `${pairs.length} combates listos en el bracket piramidal.`
    );
  };

  const handleSendGeneratedMatches = async () => {
    if (generatedPairs.length === 0) return;
    const incompletePairs = generatedPairs.filter((pair) =>
      !pair.isPlaceholder && (!pair.a.id || !pair.b.id)
    );
    if (incompletePairs.length > 0) {
      const athleteNames = Array.from(new Set(incompletePairs.flatMap(({ a, b }) => [
        ...(!a.id ? [a.fullName] : []),
        ...(!b.id ? [b.fullName] : []),
      ])));
      toast.error(
        "Atleta sin ficha vinculada",
        `No se enviaron los combates. Vincula ${athleteNames.join(", ")} a una ficha de atleta y vuelve a generar el bracket.`
      );
      return;
    }
    setIsSendingGeneratedMatches(true);
    let created = 0;
    let createdByes = 0;
    let sentToBridge = 0;
    let bridgeFailures = 0;
    const apiFailures: string[] = [];
    const bridgeFailureDetails: string[] = [];
    const byeFailures: string[] = [];
    const bridgeBaseUrls = [localApiUrl.replace(/\/$/, "")];
    if (localApiUrl.includes("127.0.0.1")) bridgeBaseUrls.push(localApiUrl.replace("127.0.0.1", "localhost"));
    if (localApiUrl.includes("localhost")) bridgeBaseUrls.push(localApiUrl.replace("localhost", "127.0.0.1"));
    let bridgeQueueCleared = false;
    for (const baseUrl of Array.from(new Set(bridgeBaseUrls))) {
      const response = await fetch(`${baseUrl}/api/match`, { method: "DELETE" }).catch(() => null);
      if (response?.ok) {
        bridgeQueueCleared = true;
        break;
      }
    }
    for (let index = 0; index < generatedPairs.length; index += 1) {
      const pair = generatedPairs[index];
      const { a, b } = pair;
      const corner: "CHONG" | "HONG" = Math.random() > 0.5 ? "CHONG" : "HONG";
      const weightB = b.weightKg;
      const bracketCategory = a.tournamentDivision || a.category || "SIN_CATEGORIA";
      const sensorThresholds = getSensorThresholds(bracketCategory);
      const matchPayload = {
        id: `bracket-${draftTournamentIdRef.current}-${pair.matchNum}`.slice(0, 50),
        tournamentId: draftTournamentIdRef.current,
        tatamiNumber: tournamentData.tatamiNumber,
        round: pair.round,
        isPlaceholder: pair.isPlaceholder,
        sourceMatchNumbers: pair.sourceMatchNumbers,
        advancementSources: {
          athlete: a.pendingMatchNumber,
          opponent: b.pendingMatchNumber,
        },
        tournamentName: tournamentData.name,
        matchNumber: String(pair.matchNum || index + 1),
        phase: pair.phase || "QF",
        weightDivision: bracketCategory,
        chongWtId: a.id ? "" : `PEND-${a.pendingMatchNumber}`,
        hongWtId: b.id ? "" : `PEND-${b.pendingMatchNumber}`,
        started: false,
        athleteId: a.id,
        athleteName: a.fullName,
        opponentAthleteId: b.id,
        opponentName: b.fullName,
        opponentCountryClub: b.clubName || "",
        opponentWeightKg: weightB,
        corner,
        category: bracketCategory,
        weightCategory: getWeightLabel(bracketCategory),
        result: "WIN_POINTS",
        gamJeomsReceived: 0,
        round1Score: { athlete: 0, opponent: 0 },
        round2Score: { athlete: 0, opponent: 0 },
        pointsByTechnique: { headKicks: 0, spinningHead: 0, bodyKicks: 0, spinningBody: 0, punches: 0 },
        eventAbbreviation: getTkStrikeEventAbbreviation(bracketCategory) || bracketCategory,
        eventGender: getTkStrikeEventGender(bracketCategory),
        rounds: tournamentData.rounds,
        roundTime: tournamentData.roundTime,
        restTime: tournamentData.restTime,
        injuryTime: tournamentData.injuryTime,
        bodyThreshold: sensorThresholds.body,
        headThreshold: sensorThresholds.head,
        division: getTkStrikeEventDivision(bracketCategory),
        maxDifference: tournamentData.maxDifference,
        maxPenalties: tournamentData.maxPenalties,
      };
      const { advancementSources: _advancementSources, ...bridgeMatchPayload } = matchPayload;
      try {
        const res = await fetch("/api/v1/competitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(matchPayload),
        });
        const result = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
        if (res.ok && result.success) {
          created += 1;
          setMatches((current) => [result.data, ...current]);
          let sentThisBout = false;
          try {
            for (const baseUrl of Array.from(new Set(bridgeBaseUrls))) {
              const bridgeRes = await fetch(`${baseUrl}/api/match`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...bridgeMatchPayload,
                    id: result.data.id,
                    phase: toTkStrikePhase(matchPayload.phase),
                    replaceTournamentQueue: sentToBridge === 0,
                  }),
              }).catch(() => null);
              if (bridgeRes?.ok) {
                sentToBridge += 1;
                sentThisBout = true;
                break;
              } else {
                const bridgeResult = await bridgeRes?.json().catch(() => null);
                bridgeFailureDetails.push(`${matchPayload.matchNumber}: ${bridgeResult?.error || (bridgeRes ? `HTTP ${bridgeRes.status}` : "sin respuesta del bridge")}`);
              }
            }
          } catch (error) {
            bridgeFailureDetails.push(`${matchPayload.matchNumber}: ${error instanceof Error ? error.message : "error de red"}`);
          }
          if (!sentThisBout) {
            bridgeFailures += 1;
          }
        } else {
          apiFailures.push(`${matchPayload.matchNumber}: ${result.error || `HTTP ${res.status}`}`);
        }
      } catch (error) {
        apiFailures.push(`${matchPayload.matchNumber}: ${error instanceof Error ? error.message : "error de red"}`);
      }
    }
    for (let byeIndex = 0; byeIndex < byeAthletes.length; byeIndex += 1) {
      const athlete = byeAthletes[byeIndex];
      const byePayload = {
        id: `bye-${draftTournamentIdRef.current}-${byeIndex + 1}`.slice(0, 50),
        tournamentId: draftTournamentIdRef.current,
        tatamiNumber: tournamentData.tatamiNumber,
        round: 0,
        tournamentName: tournamentData.name,
        matchNumber: `BYE-${athlete.id}`.slice(0, 30),
        phase: generatedPairs.find((pair) => pair.a.tournamentDivision === athlete.tournamentDivision)?.phase || "QF",
        weightDivision: athlete.tournamentDivision || athlete.category || "SIN_CATEGORIA",
        athleteId: athlete.id,
        athleteName: athlete.fullName,
        opponentAthleteId: "",
        opponentName: "BYE · pase directo",
        opponentCountryClub: "",
        corner: "CHONG",
        category: athlete.tournamentDivision || athlete.category,
        result: "WIN_POINTS",
        isBye: true,
        round1Score: { athlete: 0, opponent: 0 },
        round2Score: { athlete: 0, opponent: 0 },
        pointsByTechnique: { headKicks: 0, spinningHead: 0, bodyKicks: 0, spinningBody: 0, punches: 0 },
      };
      try {
        const response = await fetch("/api/v1/competitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(byePayload),
        });
        const result = await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` }));
        if (response.ok && result.success) {
          createdByes += 1;
          setMatches((current) => [result.data, ...current]);
        } else {
          byeFailures.push(`${byePayload.matchNumber}: ${result.error || `HTTP ${response.status}`}`);
        }
      } catch (error) {
        byeFailures.push(`${byePayload.matchNumber}: ${error instanceof Error ? error.message : "error de red"}`);
      }
    }
    setIsSendingGeneratedMatches(false);
    const allBracketRecordsSaved = created === generatedPairs.length && createdByes === byeAthletes.length;
    const allBoutsQueued = sentToBridge === generatedPairs.length;
    if (created > 0 || createdByes > 0) {
      if (allBracketRecordsSaved && allBoutsQueued) {
        toast.success("Bracket enviado a TkStrike", `${created} combates, incluidas las rondas pendientes, están en la cola del tatami ${tournamentData.tatamiNumber}. ${bridgeQueueCleared ? "Se reemplazó la cola anterior." : "No se pudo confirmar el vaciado previo de la cola."}`);
      } else {
        const failureDetails = [
          ...apiFailures.slice(0, 3).map((failure) => `API ${failure}`),
          ...byeFailures.slice(0, 2).map((failure) => `BYE ${failure}`),
          ...bridgeFailureDetails.slice(0, 3).map((failure) => `Bridge ${failure}`),
        ];
        toast.warning(
          "Envío parcial",
          `${created}/${generatedPairs.length} combates guardados; ${sentToBridge}/${generatedPairs.length} enviados a TkStrike${bridgeFailures ? `. Bridge inaccesible para ${bridgeFailures}` : ""}. ${failureDetails.length ? `Motivos: ${failureDetails.join("; ")}. ` : ""}Cola anterior ${bridgeQueueCleared ? "reemplazada" : "sin confirmar"}. Puedes reintentar sin duplicar.`
        );
      }
      if (!allBracketRecordsSaved || !allBoutsQueued) return;
      setGeneratedPairs([]);
      setByeAthletes([]);
      if (isEditingSavedTournamentBracket) setIsTournamentModalOpen(false);
    } else {
      const failureDetails = [...apiFailures.slice(0, 3), ...byeFailures.slice(0, 2)];
      toast.error("Error", failureDetails.length ? failureDetails.join("; ") : "No se pudo registrar ningún combate generado.");
    }
  };

  const handleSaveTournament = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedAthletes = registeredAthletes
      .filter((athlete) => tournamentData.athleteIds.includes(athlete.id))
      .map((athlete) => ({
        id: athlete.id,
        name: athlete.fullName,
        club: athlete.clubName,
        weightKg: Number(athlete.weightKg) || 0,
        category: athlete.category,
      }));
    const response = await fetch("/api/v1/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draftTournamentIdRef.current, ...tournamentData, registeredAthletes: selectedAthletes }),
    });
    const result = await response.json();
    if (result.success) {
      setTournaments((current) => [result.data, ...current]);
      const registrationUrl = `${window.location.origin}/register-tournament/${result.data.id}`;
      setCreatedTournamentRegistrationUrl(registrationUrl);
      toast.success("Competición creada", "Ya puedes compartir el enlace público de inscripción.");
      setIsTournamentModalOpen(false);
    } else {
      toast.error("No se pudo crear la competición", result.error);
    }
  };

  const handleSendTournamentToTkStrike = async () => {
    const selectedAthletes = registeredAthletes
      .filter((athlete) => tournamentData.athleteIds.includes(athlete.id))
      .map((athlete) => ({
        id: athlete.id,
        name: athlete.fullName,
        club: athlete.clubName,
        weightKg: Number(athlete.weightKg) || 0,
        category: athlete.category,
      }));
    if (!tournamentData.name || !tournamentData.date || selectedAthletes.length === 0) {
      toast.error("Faltan datos", "Completa nombre, fecha/hora y deportistas antes de enviar el torneo.");
      return;
    }
    const scheduledAt = new Date(new Date(tournamentData.date).getTime() + 5 * 60 * 1000).toISOString();
    try {
      const response = await fetch(`${localApiUrl.replace(/\/$/, "")}/api/tournament`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tournamentData.name,
          venue: tournamentData.venue,
          category: selectedAthletes[0]?.category || "",
          scheduledAt,
          scheduledAtOriginal: new Date(tournamentData.date).toISOString(),
          delayMinutes: 5,
          athletes: selectedAthletes,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "El puente local rechazó el torneo");
      toast.success("Torneo enviado a TkStrike", `Hora enviada: ${new Date(scheduledAt).toLocaleString()}`);
    } catch (error: any) {
      toast.error("Puente local no disponible", error?.message || "Abre INICIAR-TKSTRIKE.ps1 en el portátil.");
    }
  };

  const filteredMatches = matches.filter(
    (m) =>
      m.tournamentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.athleteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.opponentName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredMatches.length / PAGE_SIZE) || 1;
  const paginatedMatches = filteredMatches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const openCreateModal = () => {
    setEditingMatch(null);
    setFormData({
      tournamentName: "",
      matchNumber: "",
      phase: "R64",
      weightDivision: "SENIOR_M_68",
      chongWtId: "",
      hongWtId: "",
      started: false,
      eventAbbreviation: "SEN-M68",
      eventGender: "MALE",
      rounds: 3,
      roundTime: "02:00",
      restTime: "01:00",
      injuryTime: "01:00",
      bodyThreshold: 0,
      headThreshold: 0,
      maxDifference: 12,
      maxPenalties: 5,
      athleteId: registeredAthletes.find((athlete) => athlete.isCompetitor)?.id || "",
      opponentAthleteId: "",
      opponentName: "",
      opponentCountryClub: "",
      opponentWeightKg: "",
      corner: "CHONG",
      category: "SENIOR_M_68",
      result: "WIN_POINTS",
      gamJeomsReceived: 0,
      round1Athlete: 0,
      round1Opponent: 0,
      round2Athlete: 0,
      round2Opponent: 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (match: CompetitionMatch) => {
    setEditingMatch(match);
    setFormData({
      tournamentName: match.tournamentName,
      matchNumber: match.matchNumber,
      phase: match.phase,
      weightDivision: match.weightDivision,
      chongWtId: match.chongWtId,
      hongWtId: match.hongWtId,
      started: match.started,
      eventAbbreviation: "SEN-M68",
      eventGender: "MALE",
      rounds: 3,
      roundTime: "02:00",
      restTime: "01:00",
      injuryTime: "01:00",
      bodyThreshold: 0,
      headThreshold: 0,
      maxDifference: 12,
      maxPenalties: 5,
      athleteId: match.athleteId,
      opponentAthleteId: match.opponentAthleteId || "",
      opponentName: match.opponentName,
      opponentCountryClub: match.opponentCountryClub,
      opponentWeightKg: "",
      corner: match.corner,
      category: match.category,
      result: (match.result as any) || "WIN_POINTS",
      gamJeomsReceived: match.gamJeomsReceived ?? 0,
      round1Athlete: match.round1Score?.athlete ?? 0,
      round1Opponent: match.round1Score?.opponent ?? 0,
      round2Athlete: match.round2Score?.athlete ?? 0,
      round2Opponent: match.round2Score?.opponent ?? 0,
    });
    setIsModalOpen(true);
  };

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const athlete = registeredAthletes.find((a) => a.id === formData.athleteId && a.isCompetitor);
    const selectedOpponent = registeredAthletes.find((a) => a.id === formData.opponentAthleteId && a.isCompetitor && a.id !== athlete?.id);
    if (!athlete || !selectedOpponent) {
      toast.error("Faltan competidores registrados", "Selecciona dos competidores distintos con ficha activa.");
      return;
    }
    const opponentName = selectedOpponent.fullName;
    const opponentClub = selectedOpponent.clubName;
    try {
      if (editingMatch) {
        const res = await fetch("/api/v1/competitions", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingMatch.id,
            tournamentName: formData.tournamentName,
            matchNumber: formData.matchNumber,
            phase: formData.phase,
            weightDivision: formData.weightDivision,
            chongWtId: formData.chongWtId,
            hongWtId: formData.hongWtId,
            started: formData.started,
            athleteId: athlete.id,
            athleteName: athlete.fullName,
            opponentAthleteId: selectedOpponent.id,
            opponentName,
            opponentCountryClub: opponentClub,
            corner: formData.corner,
            category: formData.category,
            result: formData.result,
            gamJeomsReceived: Number(formData.gamJeomsReceived),
            round1Score: { athlete: Number(formData.round1Athlete), opponent: Number(formData.round1Opponent) },
            round2Score: { athlete: Number(formData.round2Athlete), opponent: Number(formData.round2Opponent) },
          }),
        });
        const result = await res.json();
        if (result.success) {
          const updatedMatches = [result.data, ...(result.advancedMatches || [])];
          const updatesById = new Map(updatedMatches.map((match: CompetitionMatch) => [match.id, match]));
          setMatches((current) => current.map((match) => updatesById.get(match.id) || match));
          if (result.advancementError) toast.warning("Resultado guardado parcialmente", result.message);
          else toast.success("Combate actualizado", result.advancedMatches?.length ? `Resultado guardado; ${result.advancedMatches.length} combate(s) de la siguiente ronda avanzaron.` : "Puntuaciones y registro guardados.");
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      } else {
        const res = await fetch("/api/v1/competitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            athleteName: athlete.fullName,
            opponentName,
            opponentCountryClub: opponentClub,
            round1Score: { athlete: Number(formData.round1Athlete), opponent: Number(formData.round1Opponent) },
            round2Score: { athlete: Number(formData.round2Athlete), opponent: Number(formData.round2Opponent) },
            pointsByTechnique: {
              headKicks: 2,
              spinningHead: 1,
              bodyKicks: 4,
              spinningBody: 1,
              punches: 1,
            },
          }),
        });
        const result = await res.json();
        if (result.success) {
          setMatches([result.data, ...matches]);
          toast.success("Combate registrado", "Resultado federativo indexado.");
          setIsModalOpen(false);
        } else {
          toast.error("Error", result.error);
        }
      }
    } catch {
      toast.error("Error de conexión", "No se pudo conectar con el servidor.");
    }
  };

  const handleSendToTkStrike = async (targetMat: 1 | 2 = 1) => {
    const targetUrl = targetMat === 2 ? localApiUrl2 : localApiUrl;
    const athlete = registeredAthletes.find((a) => a.id === formData.athleteId);
    const opponent = registeredAthletes.find((a) => a.id === formData.opponentAthleteId);
    const payload = {
      id: editingMatch?.id || `local-${Date.now()}`,
      tatamiNumber: targetMat,
      tournamentName: formData.tournamentName,
      category: formData.category,
      weightDivision: formData.weightDivision,
      weightCategory: getWeightLabel(formData.weightDivision),
      athleteName: athlete?.fullName || "",
      athleteId: athlete?.id || formData.athleteId,
      opponentAthleteId: opponent?.id || formData.opponentAthleteId,
      opponentName: opponent?.fullName || formData.opponentName,
      opponentCountryClub: opponent?.clubName || formData.opponentCountryClub,
      opponentWeightKg: opponent?.weightKg || Number(formData.opponentWeightKg) || 0,
      corner: formData.corner,
      eventAbbreviation: getTkStrikeEventAbbreviation(formData.weightDivision) || formData.weightDivision,
      eventGender: getTkStrikeEventGender(formData.weightDivision),
      rounds: Number(formData.rounds),
      roundTime: formData.roundTime,
      restTime: formData.restTime,
      injuryTime: formData.injuryTime,
      bodyThreshold: getSensorThresholds(formData.weightDivision).body,
      headThreshold: getSensorThresholds(formData.weightDivision).head,
      division: getTkStrikeEventDivision(formData.weightDivision),
      maxDifference: Number(formData.maxDifference),
      maxPenalties: Number(formData.maxPenalties),
    };
    if (!payload.tournamentName || !payload.athleteName || !payload.opponentName) {
      setLocalUploadStatus("Completa torneo, atleta y rival antes de enviarlo.");
      return;
    }
    try {
      const baseUrls = [targetUrl.replace(/\/$/, "")];
      if (targetUrl.includes("127.0.0.1")) baseUrls.push(targetUrl.replace("127.0.0.1", "localhost"));
      if (targetUrl.includes("localhost")) baseUrls.push(targetUrl.replace("localhost", "127.0.0.1"));
      let response: Response | null = null;
      let lastError: unknown;
      for (const baseUrl of Array.from(new Set(baseUrls))) {
        try {
          response = await fetch(`${baseUrl}/api/match`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!response) throw lastError || new Error("No se pudo conectar con localhost:5001");
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "El puente local rechazó el combate");
      setLocalUploadStatus(`Combate cargado en el puente del Tapiz ${targetMat} correctamente.`);
      toast.success(`Enviado al Tapiz ${targetMat}`, "El combate ya está disponible para OVR en ese puente.");
    } catch (error: any) {
      setLocalUploadStatus(error?.message || "No se pudo conectar con el puente local.");
      toast.error(`Puente del Tapiz ${targetMat} no disponible`, "Comprueba que el puente esté abierto.");
    }
  };

  const handleDeleteMatch = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/competitions?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setMatches(matches.filter((m) => m.id !== deleteTarget.id));
        toast.success("Combate eliminado", "Registro borrado de las estadísticas.");
        setDeleteTarget(null);
      } else {
        toast.error("Error al eliminar", result.error);
      }
    } catch {
      toast.error("Error", "No se pudo eliminar el combate.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!deleteTournamentTarget) return;
    setIsDeletingTournament(true);
    try {
      const res = await fetch(`/api/v1/tournaments?id=${deleteTournamentTarget.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (result.success) {
        setTournaments((current) => current.filter((t) => t.id !== deleteTournamentTarget.id));
        toast.success("Torneo eliminado", "La competición y sus inscripciones fueron borradas.");
        setDeleteTournamentTarget(null);
      } else {
        toast.error("Error al eliminar", result.error);
      }
    } catch {
      toast.error("Error", "No se pudo eliminar el torneo.");
    } finally {
      setIsDeletingTournament(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-sky-400" />
            Gestión de Competiciones, Brackets & Combates
          </h2>
          <p className="text-xs text-slate-400">
            Torneos oficiales World Taekwondo, registro de asaltos, puntos por técnica y penalizaciones
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold text-xs shadow-chong-glow transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Registrar Combate
        </button>
        <button
          onClick={openTournamentModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all"
        >
          <Trophy className="w-4 h-4" />
          Crear Competición / Torneo
        </button>
      </div>

      {createdTournamentRegistrationUrl && (
        <section className="flex flex-col gap-3 rounded-lg border border-emerald-500/40 bg-emerald-950/25 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-emerald-200">Torneo guardado · enlace público de inscripción</h3>
            <p className="mt-1 break-all font-mono text-xs text-slate-300">{createdTournamentRegistrationUrl}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(createdTournamentRegistrationUrl)
                  .then(() => toast.success("Enlace copiado", "Ya puedes enviarlo a los deportistas."))
                  .catch(() => toast.error("No se pudo copiar", "Selecciona y copia el enlace mostrado."));
              }}
              className="flex items-center gap-2 rounded-md border border-emerald-500/40 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/40"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar enlace
            </button>
            <a
              href={createdTournamentRegistrationUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir inscripción
            </a>
          </div>
        </section>
      )}

      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por torneo, atleta o rival..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>
      </div>

      {/* Registered tournaments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Competiciones registradas</h3>
            <p className="text-xs text-slate-400">Torneos guardados con sus deportistas, clubes y pesos.</p>
          </div>
          <span className="text-xs text-emerald-300">{tournaments.length} torneos</span>
        </div>
        {tournaments.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-slate-800 p-5 text-center text-slate-500 text-xs">
            Todavía no hay competiciones guardadas.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tournaments.map((tournament) => (
              <article key={tournament.id} className="glass-panel rounded-2xl border border-emerald-500/30 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-white">{tournament.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{tournament.venue || "Sede sin asignar"} · {tournament.date ? new Date(tournament.date).toLocaleDateString() : "Fecha pendiente"}</p>
                    <p className="mt-1 text-[10px] font-semibold text-sky-300">{getTournamentWeightModeLabel(tournament.category)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/register-tournament/${tournament.id}`;
                        navigator.clipboard.writeText(publicUrl);
                        toast.success("Enlace de inscripción copiado", "Comparte este link público para que los deportistas se inscriban.");
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 text-xs transition-colors"
                      title="Copiar enlace público de inscripción"
                    >
                      <LinkIcon className="w-3 h-3" />
                      Link Inscripción
                    </button>
                    <span className="text-xs font-mono text-emerald-300">{(tournament.registered_athletes || []).length} atletas</span>
                    <button
                      onClick={() => setDeleteTournamentTarget(tournament)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition-colors"
                      title="Eliminar torneo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {(tournament.registered_athletes || []).map((athlete: any) => {
                    const division = getTournamentWeightCategories(tournament.category)
                      .find((category) => category.value === athlete.tournamentCategory)
                      || getTournamentDivisionForAthlete(tournament.category, athlete.category);
                    return (
                      <div key={athlete.id || athlete.athleteId} className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-xs">
                        <span className="text-slate-200">{athlete.name || athlete.fullName}<span className="block text-[10px] text-slate-500">{athlete.club || athlete.clubName || "Sin club"} · {division?.label || getWeightLabel(athlete.category || "")}</span></span>
                        <span className="font-mono text-emerald-300">{athlete.weightKg || 0} kg</span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    disabled={(tournament.registered_athletes || []).length < 2}
                    onClick={() => { void openSavedTournamentBracket(tournament); }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-950/40 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-900/40 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                  >
                    <Network className="h-3.5 w-3.5" />
                    <span>Sortear bracket ({(tournament.registered_athletes || []).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedBracketTournament(tournament)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 px-3 py-2 text-xs font-black shadow-md transition-all active:scale-95"
                    title="Ver cuadro piramidal completo, descargar en SVG/CSV e imprimir PDF"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Ver Bracket & Descargas</span>
                  </button>
                </div>

                {/* Botones directos de descarga rápida */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" />
                    Descargar:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedBracketTournament(tournament)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition-all active:scale-95 shadow-sm"
                      title="Descargar diagrama en imagen vectorial SVG"
                    >
                      <Download className="w-3 h-3" />
                      <span>SVG</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBracketTournament(tournament)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all active:scale-95 shadow-sm"
                      title="Descargar combates en formato CSV para Excel"
                    >
                      <FileSpreadsheet className="w-3 h-3" />
                      <span>CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedBracketTournament(tournament)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black transition-all active:scale-95 shadow-sm"
                      title="Imprimir o guardar en PDF oficial WT"
                    >
                      <Printer className="w-3 h-3 text-slate-950" />
                      <span>PDF Oficial</span>
                    </button>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800 text-[11px]">
                  <a
                    href={`/bracket/${tournament.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Abrir enlace web público</span>
                  </a>
                  <span className="text-slate-500 font-mono text-[10px]">
                    {matches.filter((match) => match.tournamentId === tournament.id).length} combates
                  </span>
                </div>

                {matches.some((match) => match.tournamentId === tournament.id) && (
                  <details className="mt-2 pt-2 border-t border-slate-800/60">
                    <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-sky-300 transition-colors">
                      Vista previa rápida del cuadro
                    </summary>
                    <div className="mt-3 space-y-3">
                      {Array.from(new Set(matches
                        .filter((match) => match.tournamentId === tournament.id)
                        .map((match) => match.category || "SIN_CATEGORIA")))
                        .map((category) => {
                          const savedCategoryMatches = matches.filter((match) => match.tournamentId === tournament.id && (match.category || "SIN_CATEGORIA") === category);
                          const savedPairs = savedCategoryMatches.filter((match) => !match.isBye).map((match, index) => ({
                            matchNum: Number(match.matchNumber) || index + 1,
                            phase: match.phase,
                            round: Number(match.round) || 0,
                            isPlaceholder: Boolean(match.isPlaceholder),
                            sourceMatchNumbers: match.sourceMatchNumbers || [],
                            a: { id: match.athleteId, fullName: match.athleteName, category: match.category },
                            b: { id: match.opponentAthleteId, fullName: match.opponentName, category: match.category },
                          }));
                          const savedByes = savedCategoryMatches.filter((match) => match.isBye).map((match) => ({
                            id: match.athleteId,
                            fullName: match.athleteName,
                            category: match.category,
                          }));
                          return <BracketTree key={category} category={category} pairs={savedPairs} byes={savedByes} tournamentName={tournament.name} />;
                        })}
                    </div>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Matches Grid */}
      <div className="space-y-4">
        {paginatedMatches.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-slate-800 p-8 text-center text-slate-500 text-xs">
            Esperando conexión UDP del sistema oficial. No hay combates conectados.
          </div>
        ) : (
          paginatedMatches.map((match) => (
            <div
              key={match.id}
              className="glass-panel rounded-2xl border border-slate-800 p-5 hover:border-sky-500/40 transition-all shadow-xl"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      {match.tournamentName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {new Date(match.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-base mt-1">
                    Categoría: {match.category.replace(/_/g, " ")}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {match.isBye ? "PASE DIRECTO · BYE" : match.result === "WIN_POINTS" ? "VICTORIA POR PUNTOS" : match.result}
                  </span>
                  <button
                    onClick={() => openEditModal(match)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-white border border-slate-700 transition-colors"
                    title="Editar combate"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(match)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition-colors"
                    title="Eliminar combate"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-7 gap-2 mb-4 text-xs">
                {[
                  ["Match Number", match.matchNumber],
                  ["Phase", match.phase],
                  ["Weight division", match.weightDivision],
                  ["Chong WT ID", match.chongWtId || "-"],
                  ["Hong WT ID", match.hongWtId || "-"],
                  ["Started?", match.started ? "Yes" : "No"],
                  ["Last Update Date", new Date(match.lastUpdatedAt).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                    <span className="block text-[10px] text-slate-500">{label}</span>
                    <strong className="block text-slate-200 mt-1 truncate">{value}</strong>
                  </div>
                ))}
              </div>

              {/* Score and Fighter confrontation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-4">
                {/* Corner Athlete */}
                <div
                  className={`p-3.5 rounded-xl border ${
                    match.corner === "CHONG"
                      ? "bg-sky-950/30 border-sky-500/40 text-sky-300"
                      : "bg-rose-950/30 border-rose-500/40 text-rose-300"
                  }`}
                >
                  <span className="text-[10px] font-black tracking-widest uppercase block mb-1">
                    Esquina {match.corner} (NUESTRO ATLETA)
                  </span>
                  <div className="font-bold text-white text-sm">{match.athleteName}</div>
                </div>

                {/* Center Score */}
                <div className="text-center p-3 rounded-xl bg-slate-900 border border-slate-800 font-mono">
                  <div className="text-[11px] text-slate-400 mb-1">Rondas Asalto a Asalto</div>
                  <div className="text-lg font-black text-amber-400">
                    R1: {match.round1Score.athlete}-{match.round1Score.opponent} | R2:{" "}
                    {match.round2Score.athlete}-{match.round2Score.opponent}{" "}
                    {match.round3Score && `| R3: ${match.round3Score.athlete}-${match.round3Score.opponent}`}
                  </div>
                </div>

                {/* Corner Opponent */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase block mb-1">
                    Rival Internacional
                  </span>
                  <div className="font-bold text-white text-sm">{match.opponentName}</div>
                  <div className="text-[11px] text-slate-400">{match.opponentCountryClub}</div>
                </div>
              </div>

              {/* Points by Technique Matrix */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="text-slate-400 font-semibold">Técnicas Puntuadas:</div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                    Cabeza (+3): <strong className="text-sky-400 font-mono">{match.pointsByTechnique.headKicks}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                    Giro Cabeza (+5): <strong className="text-amber-400 font-mono">{match.pointsByTechnique.spinningHead}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                    Peto (+2): <strong className="text-emerald-400 font-mono">{match.pointsByTechnique.bodyKicks}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                    Giro Peto (+4): <strong className="text-indigo-400 font-mono">{match.pointsByTechnique.spinningBody}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-white border border-slate-700">
                    Puño (+1): <strong className="text-slate-300 font-mono">{match.pointsByTechnique.punches}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-800/50">
                    Gam-Jeoms: <strong className="font-mono">{match.gamJeomsReceived}</strong>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredMatches.length}
        pageSize={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      {/* Tournament form */}
      {isTournamentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-3xl w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-emerald-500/40 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">
              {isEditingSavedTournamentBracket ? `Generar bracket · ${tournamentData.name}` : "Crear competición / torneo"}
            </h3>
            <form onSubmit={handleSaveTournament} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input required placeholder="Nombre del torneo" value={tournamentData.name} onChange={(e) => setTournamentData({ ...tournamentData, name: e.target.value })} className="sm:col-span-2 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                <input type="datetime-local" required value={tournamentData.date} onChange={(e) => setTournamentData({ ...tournamentData, date: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select value={tournamentData.venue} onChange={(e) => setTournamentData({ ...tournamentData, venue: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white">
                  <option value="">Sede sin asignar</option><option value="Pabellón principal">Pabellón principal</option><option value="Pabellón municipal">Pabellón municipal</option><option value="Pista 1">Pista 1</option><option value="Pista 2">Pista 2</option>
                </select>
                <div>
                  <label className="mb-1.5 block text-slate-400">Modalidad de pesos</label>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modalidad de pesos">
                    <button
                      type="button"
                      aria-pressed={tournamentData.category === "OLYMPIC_WEIGHTS"}
                      onClick={() => changeTournamentWeightMode("OLYMPIC_WEIGHTS")}
                      className={`rounded-lg border px-3 py-2 text-left font-semibold transition-colors ${tournamentData.category === "OLYMPIC_WEIGHTS" ? "border-sky-500 bg-sky-950/50 text-sky-200" : "border-slate-700 bg-slate-900 text-slate-400"}`}
                    >
                      Pesos olímpicos
                    </button>
                    <button
                      type="button"
                      aria-pressed={tournamentData.category === "OFFICIAL_WEIGHTS"}
                      onClick={() => changeTournamentWeightMode("OFFICIAL_WEIGHTS")}
                      className={`rounded-lg border px-3 py-2 text-left font-semibold transition-colors ${tournamentData.category === "OFFICIAL_WEIGHTS" ? "border-emerald-500 bg-emerald-950/40 text-emerald-200" : "border-slate-700 bg-slate-900 text-slate-400"}`}
                    >
                      Pesos oficiales
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500">
                    {tournamentData.category === "OLYMPIC_WEIGHTS"
                      ? "Masculino: -58, -68, -80, +80 kg · Femenino: -49, -57, -67, +67 kg"
                      : "Incluye todas las divisiones senior oficiales."}
                  </p>
                </div>
              </div>
              <div className="max-w-xs">
                <label className="mb-1.5 block text-slate-400">Tatami</label>
                <select
                  value={tournamentData.tatamiNumber}
                  onChange={(event) => setTournamentData({ ...tournamentData, tatamiNumber: Number(event.target.value) })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-white"
                >
                  {Array.from({ length: 8 }, (_, index) => index + 1).map((tatami) => (
                    <option key={tatami} value={tatami}>Tatami {tatami} · combate {tatami}01 en adelante</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-2">Atletas elegibles y peso de inscripción</label>
                <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-slate-800 p-3 bg-slate-950">
                  {eligibleTournamentAthletes.length === 0 ? (
                    <p className="text-slate-500">No hay atletas registrados en estas divisiones de peso.</p>
                  ) : eligibleTournamentAthletes.map((athlete) => {
                    const isSelected = tournamentData.athleteIds.includes(athlete.id);
                    return (
                      <div key={athlete.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900 hover:bg-slate-800">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleTournamentAthlete(athlete.id)} />
                        <span className="flex-1 text-white">{athlete.fullName}<span className="block text-[10px] text-slate-500">{athlete.clubName || "Club sin asignar"} · {athlete.category}</span></span>
                        <span className={`font-mono ${isSelected ? "text-emerald-300" : "text-slate-500"}`}>
                          {athlete.weightKg || "—"} kg
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
                <p className="text-emerald-300 font-semibold">Configuración WT / TkStrike para todos los combates del torneo</p>
                <p className="text-[11px] text-slate-500">Los umbrales de peto/casco se calculan automáticamente por categoría de peso al sortear combates. Estos campos solo aplican como reserva para categorías sin tabla.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <p className="col-span-full text-[11px] text-slate-400">La categoría, el género y la abreviatura TkStrike se asignan automáticamente según la división de cada combate.</p>
                  <select value={tournamentData.rounds} onChange={(e) => setTournamentData({ ...tournamentData, rounds: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"><option value="3">3 rondas</option><option value="1">1 ronda</option></select>
                  <select value={tournamentData.roundTime} onChange={(e) => setTournamentData({ ...tournamentData, roundTime: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"><option value="02:00">Ronda 02:00</option><option value="01:30">Ronda 01:30</option><option value="05:00">Ronda 05:00</option></select>
                  <select value={tournamentData.restTime} onChange={(e) => setTournamentData({ ...tournamentData, restTime: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"><option value="01:00">Descanso 01:00</option><option value="00:30">Descanso 00:30</option></select>
                  <select value={tournamentData.injuryTime} onChange={(e) => setTournamentData({ ...tournamentData, injuryTime: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"><option value="01:00">Kye-shi 01:00</option><option value="00:30">Kye-shi 00:30</option></select>
                  <select value={tournamentData.maxDifference} onChange={(e) => setTournamentData({ ...tournamentData, maxDifference: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"><option value="12">Diferencia 12</option><option value="20">Diferencia 20</option><option value="30">Diferencia 30</option></select>
                  <select value={tournamentData.maxPenalties} onChange={(e) => setTournamentData({ ...tournamentData, maxPenalties: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"><option value="5">Máx. gam-jeoms 5</option><option value="10">Máx. gam-jeoms 10</option></select>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-amber-300 font-semibold">Generar combates aleatoriamente</p>
                  <button type="button" onClick={handleGenerateRandomMatches} disabled={tournamentData.athleteIds.length < 2} className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold">
                    Sortear combates
                  </button>
                </div>
                {generatedPairs.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5" />
                        <span>Estructura de Cuadro Piramidal WT</span>
                      </div>
                      <span className="text-[10px] text-amber-300 font-semibold lowercase">
                        (Descarga directa disponible en cada cuadro de peso)
                      </span>
                    </div>
                    <div className="max-h-[420px] space-y-3 overflow-y-auto">
                      {Array.from(new Set([
                        ...generatedPairs.map((pair) => pair.a.tournamentDivision || pair.a.category || "SIN_CATEGORIA"),
                        ...byeAthletes.map((athlete) => athlete.tournamentDivision || athlete.category || "SIN_CATEGORIA"),
                      ])).map((category) => (
                        <BracketTree
                          key={category}
                          category={category}
                          pairs={generatedPairs.filter((pair) => (pair.a.tournamentDivision || pair.a.category || "SIN_CATEGORIA") === category)}
                          byes={byeAthletes.filter((athlete) => (athlete.tournamentDivision || athlete.category || "SIN_CATEGORIA") === category)}
                          tournamentName={tournamentData.name || "Competición WT"}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleSendGeneratedMatches}
                      disabled={isSendingGeneratedMatches}
                      className="w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg transition-all"
                    >
                      {isSendingGeneratedMatches ? "Enviando todos los combates a TkStrike..." : "Enviar todos los combates a TkStrike"}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsTournamentModalOpen(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold">Cancelar</button>
                {!isEditingSavedTournamentBracket && (
                  <button type="submit" disabled={tournamentData.athleteIds.length === 0} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">Guardar competición</button>
                )}
                <button type="button" onClick={handleSendTournamentToTkStrike} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold">Enviar a TkStrike (+5 min)</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Match Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-sky-500/40 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-white mb-4">
              {editingMatch ? "Editar Combate" : "Registrar Combate Oficial WT"}
            </h3>
            <form onSubmit={handleSaveMatch} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-400 mb-1">Match Number</label><input required value={formData.matchNumber} onChange={(e) => setFormData({ ...formData, matchNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" /></div>
                <div><label className="block text-slate-400 mb-1">Phase</label><select value={formData.phase} onChange={(e) => setFormData({ ...formData, phase: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"><option>R256</option><option>R128</option><option>R64</option><option>R32</option><option>R16</option><option>QF</option><option>SF</option><option>F</option><option>BRZ</option></select></div>
                <div>
                  <label className="block text-slate-400 mb-1">Weight division</label>
                  <select
                    required
                    value={formData.weightDivision}
                    onChange={(e) => {
                      const nextCategory = e.target.value;
                      const thresholds = getSensorThresholds(nextCategory);
                      setFormData({ ...formData, weightDivision: nextCategory, category: nextCategory as CompetitionMatch["category"], bodyThreshold: thresholds.body, headThreshold: thresholds.head });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    {getTournamentWeightCategories("OFFICIAL_WEIGHTS").map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div><label className="block text-slate-400 mb-1">Started?</label><select value={String(formData.started)} onChange={(e) => setFormData({ ...formData, started: e.target.value === "true" })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"><option value="false">No</option><option value="true">Yes</option></select></div>
                <div><label className="block text-slate-400 mb-1">Chong WT ID</label><input value={formData.chongWtId} onChange={(e) => setFormData({ ...formData, chongWtId: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" /></div>
                <div><label className="block text-slate-400 mb-1">Hong WT ID</label><input value={formData.hongWtId} onChange={(e) => setFormData({ ...formData, hongWtId: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" /></div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
                <p className="text-sky-300 font-semibold">Configuración WT / TkStrike</p>
                <div className="grid grid-cols-2 gap-3">
                  <p className="col-span-2 text-slate-400">TkStrike: {getWeightLabel(formData.weightDivision)} · {getTkStrikeEventAbbreviation(formData.weightDivision) || formData.weightDivision} · {getTkStrikeEventGender(formData.weightDivision)}</p>
                  <input type="number" min="1" placeholder="Rondas" value={formData.rounds} onChange={(e) => setFormData({ ...formData, rounds: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                  <input placeholder="Tiempo ronda (02:00)" value={formData.roundTime} onChange={(e) => setFormData({ ...formData, roundTime: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                  <input placeholder="Descanso (01:00)" value={formData.restTime} onChange={(e) => setFormData({ ...formData, restTime: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                  <input placeholder="Lesión (01:00)" value={formData.injuryTime} onChange={(e) => setFormData({ ...formData, injuryTime: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                  <input type="number" placeholder="Umbral peto" value={getSensorThresholds(formData.weightDivision).body} readOnly className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                  <input type="number" placeholder="Umbral cabeza" value={getSensorThresholds(formData.weightDivision).head} readOnly className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                  <input type="number" placeholder="Diferencia máxima" value={formData.maxDifference} onChange={(e) => setFormData({ ...formData, maxDifference: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                  <input type="number" placeholder="Máx. gam-jeoms" value={formData.maxPenalties} onChange={(e) => setFormData({ ...formData, maxPenalties: Number(e.target.value) })} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Nombre del Torneo</label>
                <input
                  type="text"
                  required
                  value={formData.tournamentName}
                  onChange={(e) => setFormData({ ...formData, tournamentName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Competidor del club</label>
                  <select
                    required
                    value={formData.athleteId}
                    onChange={(e) => setFormData({ ...formData, athleteId: e.target.value, opponentAthleteId: e.target.value === formData.opponentAthleteId ? "" : formData.opponentAthleteId })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    {registeredAthletes.filter((a) => a.isCompetitor).length === 0 ? (
                      <option value="">Sin competidores habilitados</option>
                    ) : (
                      registeredAthletes.filter((a) => a.isCompetitor).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.fullName} · {a.clubName || "Sin club"} · {a.weightKg} kg
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Esquina</label>
                  <select
                    value={formData.corner}
                    onChange={(e) => setFormData({ ...formData, corner: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="CHONG">CHONG (Azul)</option>
                    <option value="HONG">HONG (Rojo)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Rival registrado</label>
                  <select
                    required
                    value={formData.opponentAthleteId}
                    onChange={(e) => {
                      const opponent = registeredAthletes.find((a) => a.id === e.target.value && a.isCompetitor);
                      setFormData({ ...formData, opponentAthleteId: e.target.value, opponentName: opponent?.fullName || "", opponentCountryClub: opponent?.clubName || "", opponentWeightKg: opponent?.weightKg ? String(opponent.weightKg) : "" });
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="">Seleccionar competidor</option>
                    {registeredAthletes.filter((a) => a.isCompetitor && a.id !== formData.athleteId).map((a) => <option key={a.id} value={a.id}>{a.fullName} · {a.clubName || "Sin club"} · {a.weightKg} kg</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Resultado</label>
                  <select
                    value={formData.result}
                    onChange={(e) => setFormData({ ...formData, result: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white"
                  >
                    <option value="WIN_POINTS">Victoria por Puntos (PTF)</option>
                    <option value="WIN_GAP">Victoria por Diferencia (PTG)</option>
                    <option value="WIN_KO">Victoria por KO / TKO</option>
                    <option value="LOSS_POINTS">Derrota por Puntos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Gam-Jeoms Recibidos</label>
                  <input
                    type="number"
                    value={formData.gamJeomsReceived}
                    onChange={(e) => setFormData({ ...formData, gamJeomsReceived: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">R1 (Atleta - Rival)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.round1Athlete}
                      onChange={(e) => setFormData({ ...formData, round1Athlete: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                    <input
                      type="number"
                      value={formData.round1Opponent}
                      onChange={(e) => setFormData({ ...formData, round1Opponent: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">R2 (Atleta - Rival)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formData.round2Athlete}
                      onChange={(e) => setFormData({ ...formData, round2Athlete: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                    <input
                      type="number"
                      value={formData.round2Opponent}
                      onChange={(e) => setFormData({ ...formData, round2Opponent: Number(e.target.value) })}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
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
                  {editingMatch ? "Guardar Cambios" : "Guardar Combate"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendToTkStrike(1)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold"
                >
                  Enviar a TkStrike local
                </button>
                <button
                  type="button"
                  onClick={() => handleSendToTkStrike(1)}
                  className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-semibold"
                >
                  Enviar a puente Tapiz 1
                </button>
                <button
                  type="button"
                  onClick={() => handleSendToTkStrike(2)}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold"
                >
                  Enviar a puente Tapiz 2
                </button>
              </div>
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <label className="block text-slate-400">URL del puente local (Tapiz 1)</label>
                <input value={localApiUrl} onChange={(e) => setLocalApiUrl(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                <label className="block text-slate-400">URL del puente Tapiz 2</label>
                <input value={localApiUrl2} onChange={(e) => setLocalApiUrl2(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white" />
                {localUploadStatus && <p className="text-xs text-amber-300">{localUploadStatus}</p>}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="¿Eliminar combate?"
        description={`Esta acción eliminará el registro del combate en "${deleteTarget?.tournamentName}" vs "${deleteTarget?.opponentName}".`}
        confirmText="Eliminar Combate"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteMatch}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Delete Tournament Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTournamentTarget)}
        title="¿Eliminar torneo?"
        description={`Esta acción eliminará la competición "${deleteTournamentTarget?.name}" y las inscripciones de sus deportistas.`}
        confirmText="Eliminar Torneo"
        isDanger={true}
        isLoading={isDeletingTournament}
        onConfirm={handleDeleteTournament}
        onCancel={() => setDeleteTournamentTarget(null)}
      />

      {/* Bracket Viewer & Downloader Modal */}
      {selectedBracketTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-7xl max-h-[94vh] flex flex-col">
            <BracketViewer
              tournament={selectedBracketTournament}
              matches={matches}
              localApiUrl={localApiUrl}
              onClose={() => setSelectedBracketTournament(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
