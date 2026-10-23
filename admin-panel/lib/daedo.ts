import crypto from "node:crypto";
import {
  getTkStrikeEventAbbreviation,
  getTkStrikeEventDivision,
  getTkStrikeEventGender,
  getTkStrikeSensorThresholds,
  getTkStrikeWeightCategoryLabel,
} from "./tournament-categories";

export interface DaedoOvrMatch {
  matchId: string;
  mat: string;
  competition: string;
  category: string;
  round: number;
  status: "READY" | "LIVE" | "FINISHED";
  chong: { name: string; country?: string; club?: string; seed?: number; score: number; gamJeom: number };
  hong: { name: string; country?: string; club?: string; seed?: number; score: number; gamJeom: number };
  clock: { seconds: number; running: boolean };
}

export interface DaedoEventEnvelope {
  eventId: string;
  receivedAt: string;
  source: { ip?: string; port?: number; protocol: "udp" };
  mat?: string;
  matchId?: string;
  eventType: "POINT" | "GAMJEOM" | "CLOCK" | "ROUND" | "MATCH" | "MATCH_FINISHED" | "UNKNOWN";
  payload: Record<string, unknown>;
  raw: { encoding: "hex" | "base64"; value: string };
  state?: Partial<DaedoLiveMatch>;
}

export interface DaedoLiveMatch {
  matchId: string;
  mat: string;
  tournamentName: string;
  chongName: string;
  hongName: string;
  chongScore: number;
  hongScore: number;
  chongGamJeom: number;
  hongGamJeom: number;
  round: number;
  secondsLeft: number;
  clockRunning: boolean;
  status: "READY" | "LIVE" | "FINISHED";
  lastEventType: DaedoEventEnvelope["eventType"];
  lastEventAt: string;
  winner?: "CHONG" | "HONG";
  winnerName?: string;
  rawEncoding?: "hex" | "base64";
  rawValue?: string;
}

export function isValidApiKey(request: Request): boolean {
  const expected = process.env.DAEDO_API_KEY?.trim();
  if (!expected) return true;
  const provided = request.headers.get("x-api-key")?.trim();
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function getDaedoLiveState(mat?: string): DaedoLiveMatch | null {
  const g = globalThis as any;
  if (mat) return g.__daedoLiveStates?.[mat] || null;
  return g.__daedoLiveState || null;
}

export function setDaedoLiveState(patch: Partial<DaedoLiveMatch>): DaedoLiveMatch {
  const previous = getDaedoLiveState(String(patch.mat || "1"));
  const updated: DaedoLiveMatch = {
    matchId: String(patch.matchId || previous?.matchId || "1"),
    mat: String(patch.mat || previous?.mat || "1"),
    tournamentName: String(patch.tournamentName || previous?.tournamentName || "Campeonato Nacional TKD"),
    chongName: String(patch.chongName || previous?.chongName || "Carlos Garcia (ESP)"),
    hongName: String(patch.hongName || previous?.hongName || "Jean Dupont (FRA)"),
    chongScore: Number(patch.chongScore ?? previous?.chongScore ?? 0),
    hongScore: Number(patch.hongScore ?? previous?.hongScore ?? 0),
    chongGamJeom: Number(patch.chongGamJeom ?? previous?.chongGamJeom ?? 0),
    hongGamJeom: Number(patch.hongGamJeom ?? previous?.hongGamJeom ?? 0),
    round: Number(patch.round ?? previous?.round ?? 1),
    secondsLeft: Number(patch.secondsLeft ?? previous?.secondsLeft ?? 120),
    clockRunning: Boolean(patch.clockRunning ?? previous?.clockRunning ?? false),
    status: patch.status || previous?.status || "READY",
    lastEventType: patch.lastEventType || previous?.lastEventType || "MATCH",
    lastEventAt: patch.lastEventAt || new Date().toISOString(),
    winner: patch.winner || (patch.status === "FINISHED" ? ((Number(patch.chongScore ?? previous?.chongScore ?? 0) >= Number(patch.hongScore ?? previous?.hongScore ?? 0)) ? "CHONG" : "HONG") : previous?.winner),
    winnerName: patch.winnerName || (patch.status === "FINISHED" ? ((Number(patch.chongScore ?? previous?.chongScore ?? 0) >= Number(patch.hongScore ?? previous?.hongScore ?? 0)) ? String(patch.chongName || previous?.chongName || "CHONG") : String(patch.hongName || previous?.hongName || "HONG")) : previous?.winnerName),
    rawEncoding: patch.rawEncoding || previous?.rawEncoding,
    rawValue: patch.rawValue || previous?.rawValue,
  };
  (globalThis as any).__daedoLiveState = updated;
  const states = ((globalThis as any).__daedoLiveStates ||= {});
  states[updated.mat] = updated;
  return updated;
}

export function buildOvrResponse(mat: string, pending: any): DaedoOvrMatch {
  const matchId = String(pending?.id || "1");
  return {
    matchId,
    mat,
    competition: String(pending?.tournamentName || "Campeonato Nacional TKD"),
    category: String(pending?.category || "-68kg"),
    round: Number(pending?.round || 1),
    status: "READY",
    chong: {
      name: String(pending?.chong?.name || pending?.athleteName || "Carlos Garcia"),
      country: pending?.chong?.country || "ESP",
      club: pending?.chong?.club || pending?.opponentCountryClub || undefined,
      seed: pending?.chong?.seed || 1,
      score: Number(pending?.chong?.score || 0),
      gamJeom: Number(pending?.chong?.gamJeom || 0),
    },
    hong: {
      name: String(pending?.hong?.name || pending?.opponentName || "Jean Dupont"),
      country: pending?.hong?.country || "FRA",
      club: pending?.hong?.club || undefined,
      seed: pending?.hong?.seed || 2,
      score: Number(pending?.hong?.score || 0),
      gamJeom: Number(pending?.hong?.gamJeom || 0),
    },
    clock: { seconds: Number(pending?.clock?.seconds || 120), running: Boolean(pending?.clock?.running) },
  };
}

function compactOvrId(prefix: string, value: string): string {
  return `${prefix}-${crypto.createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}

function compactOvrLicense(value: unknown, fallback: string): string {
  const license = String(value || "").trim();
  if (license.length > 0 && license.length <= 25) return license;
  return `A-${crypto.createHash("sha256").update(license || fallback).digest("hex").slice(0, 23)}`;
}

function splitOvrName(name: string): { givenName: string; familyName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { givenName: parts[0] || "", familyName: parts.slice(1).join(" ") };
}

function normalizeOvrMatchNumber(value: unknown, matchId: string): string {
  const number = String(value || matchId).trim();
  if (number.length <= 15) return number;
  return number.match(/(\d{1,15})$/)?.[1] || `M${crypto.createHash("sha256").update(number).digest("hex").slice(0, 10)}`;
}

export function buildOvrJsonApiMatch(mat: string, pending: any) {
  const matchId = String(pending?.id || "1");
  const matchNumber = normalizeOvrMatchNumber(pending?.matchNumber, matchId);
  const tournamentName = String(pending?.tournamentName || "Campeonato Nacional TKD");
  const weightDivision = String(pending?.weightDivision || pending?.category || "SENIOR_M_68");
  const categoryName = String(pending?.weightCategory || getTkStrikeWeightCategoryLabel(weightDivision) || weightDivision);
  const chongName = String(pending?.chong?.name || pending?.athleteName || "Carlos Garcia");
  const hongName = String(pending?.hong?.name || pending?.opponentName || "Jean Dupont");
  const chongCountry = String(pending?.chong?.country || "ESP");
  const hongCountry = String(pending?.hong?.country || "ESP");
  const chongLicense = compactOvrLicense(pending?.chong?.licenseNumber || pending?.chongWtId || pending?.athleteId, `${matchId}:home`);
  const hongLicense = compactOvrLicense(pending?.hong?.licenseNumber || pending?.hongWtId || pending?.opponentAthleteId, `${matchId}:away`);
  const phaseValue = String(pending?.phase || "QF").toUpperCase();
  const allowedPhases = new Set(["R64", "R32", "SF", "R128", "F", "R16", "BRZ", "R256", "QF"]);
  const phase = phaseValue === "PRELIM" || phaseValue === "PRELIMINARY" ? "R64" : allowedPhases.has(phaseValue) ? phaseValue : "R64";
  const roundTime = String(pending?.roundTime || "02:00");
  const restTime = String(pending?.restTime || "01:00");
  const injuryTime = String(pending?.injuryTime || "01:00");
  const eventGender = getTkStrikeEventGender(weightDivision);
  const eventDivision = getTkStrikeEventDivision(weightDivision);
  const eventCategory = categoryName;
  const eventAbbreviation = getTkStrikeEventAbbreviation(weightDivision) || String(pending?.eventAbbreviation || weightDivision);
  const sensorThresholds = getTkStrikeSensorThresholds(weightDivision);
  const bodyThreshold = Number(pending?.bodyThreshold) || sensorThresholds.body;
  const headThreshold = Number(pending?.headThreshold) || sensorThresholds.head;
  const eventWeightLabel = categoryName.replace(/^(?:(?:OLYMPIC|JUNIOR|CADET)\s+)?[MW]\s*/i, "").replace(/KG$/i, " kg");
  const eventName = `${eventDivision === "SENIORS" ? "Senior" : eventDivision} ${eventGender === "FEMALE" ? "Femenino" : "Masculino"} ${eventWeightLabel}`;
  const eventKey = `${tournamentName}-${eventAbbreviation}`;
  const eventId = compactOvrId("event", eventKey);
  const configId = compactOvrId("config", eventKey);
  const matchKey = crypto.createHash("sha256").update(matchId).digest("hex").slice(0, 12);
  const homeCompetitorId = `home-${matchKey}`;
  const awayCompetitorId = `away-${matchKey}`;
  const homePartId = homeCompetitorId;
  const awayPartId = awayCompetitorId;
  const chongNameParts = splitOvrName(chongName);
  const hongNameParts = splitOvrName(hongName);

  return {
    jsonapi: { version: "1.0" },
    meta: { mat, source: "tkdcore-daedo-ovr", schemaVersion: "1.0" },
    data: {
      type: "matches",
      id: matchId,
      attributes: { status: "available", mat: Number(pending?.tatamiNumber || mat) || 1, number: matchNumber, phase, round: 1, roundTime },
      relationships: {
        event: { data: { type: "events", id: eventId } },
        matchConfiguration: { data: { type: "match-configurations", id: configId } },
        homeCompetitor: { data: { type: "competitors", id: homeCompetitorId } },
        awayCompetitor: { data: { type: "competitors", id: awayCompetitorId } },
        session: { data: null },
        refereeAssignment: { data: null },
        results: { data: [] },
      },
    },
    included: [
      { type: "events", id: eventId, attributes: { discipline: "KYORUGI", division: eventDivision, gender: eventGender, weightCategory: eventCategory, abbreviation: eventAbbreviation, name: eventName } },
      { type: "match-configurations", id: configId, attributes: { rules: "CONVENTIONAL", rounds: Number(pending?.rounds || 3), maxPenalties: Number(pending?.maxPenalties || 5), maxDifference: Number(pending?.maxDifference || 12), thresholds: { body: bodyThreshold, head: headThreshold }, timing: { round: roundTime, rest: restTime, injury: injuryTime }, goldenPoint: { enabled: false, time: "00:00" }, videoReplayQuota: { home: 0, away: 0 } } },
      { type: "competitors", id: homeCompetitorId, attributes: { competitorType: "ATHLETE", country: chongCountry, scoreboardName: chongName, printName: chongName, tvName: chongName }, relationships: { participant: { data: { type: "participants", id: homePartId } } } },
      { type: "competitors", id: awayCompetitorId, attributes: { competitorType: "ATHLETE", country: hongCountry, scoreboardName: hongName, printName: hongName, tvName: hongName }, relationships: { participant: { data: { type: "participants", id: awayPartId } } } },
      { type: "participants", id: homePartId, attributes: { licenseNumber: chongLicense, givenName: chongNameParts.givenName || "CHONG", familyName: chongNameParts.familyName, preferredGivenName: chongNameParts.givenName || "CHONG", preferredFamilyName: chongNameParts.familyName, scoreboardName: chongName, printName: chongName, tvName: chongName, gender: eventGender, country: chongCountry, mainRole: "ATHLETE" } },
      { type: "participants", id: awayPartId, attributes: { licenseNumber: hongLicense, givenName: hongNameParts.givenName || "HONG", familyName: hongNameParts.familyName, preferredGivenName: hongNameParts.givenName || "HONG", preferredFamilyName: hongNameParts.familyName, scoreboardName: hongName, printName: hongName, tvName: hongName, gender: eventGender, country: hongCountry, mainRole: "ATHLETE" } },
    ],
  };
}

export function normalizeUdpPayload(input: unknown): Record<string, unknown> {
  if (input && typeof input === "object" && !Buffer.isBuffer(input)) return input as Record<string, unknown>;
  return { value: input };
}

export function parseLiveState(input: unknown): Partial<DaedoLiveMatch> {
  if (!input || typeof input !== "object") return {};
  const value = input as Record<string, any>;
  const chong = value.chong || value.home || {};
  const hong = value.hong || value.away || {};
  return {
    tournamentName: String(value.tournamentName || value.competition || ""),
    chongName: String(value.chongName || chong.name || ""),
    hongName: String(value.hongName || hong.name || ""),
    chongScore: Number(value.chongScore ?? chong.score ?? 0),
    hongScore: Number(value.hongScore ?? hong.score ?? 0),
    chongGamJeom: Number(value.chongGamJeom ?? chong.gamJeom ?? 0),
    hongGamJeom: Number(value.hongGamJeom ?? hong.gamJeom ?? 0),
    round: Number(value.round || 1),
    secondsLeft: Number(value.secondsLeft ?? value.clock?.seconds ?? 0),
    clockRunning: Boolean(value.clockRunning ?? value.clock?.running),
    status: value.status === "LIVE" || value.status === "FINISHED" ? value.status : "READY",
  };
}