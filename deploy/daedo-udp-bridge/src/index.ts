import dgram from "node:dgram";
import crypto from "node:crypto";
import http from "node:http";

const udpHost = process.env.DAEDO_UDP_HOST || "0.0.0.0";
const udpPort = Number(process.env.DAEDO_UDP_PORT || 5000);
const apiUrl = process.env.TKDCORE_EVENTS_URL || "https://tkdcore.vercel.app/api/v1/integrations/daedo/events";
const apiKey = process.env.DAEDO_API_KEY?.trim();
const mat = process.env.DAEDO_MAT || "1";
const encoding = process.env.DAEDO_RAW_ENCODING === "base64" ? "base64" : "hex";
const httpHost = process.env.DAEDO_HTTP_HOST || "127.0.0.1";
const httpPort = Number(process.env.DAEDO_HTTP_PORT || 5001);
const ovrUrl = process.env.TKDCORE_OVR_URL || "https://tkdcore.vercel.app/api/v1/integrations/daedo/ovr";
const ovrTestMode = process.env.DAEDO_OVR_TEST === "1";
const ovrResourceType = process.env.DAEDO_OVR_RESOURCE_TYPE || "matches";
const ovrPhase = process.env.DAEDO_OVR_PHASE || "R64";
const supportedOvrPhases = new Set(["R64", "R32", "SF", "R128", "F", "R16", "BRZ", "R256", "QF"]);
let localMatches: Record<string, any>[] = [];
let currentLocalTournament: Record<string, unknown> | null = null;

const tkStrikeEventPrefixes: Record<string, string> = { OLYMPIC: "OLY", SENIOR: "SEN", JUNIOR: "JUN", CADET: "CAD" };
const tkStrikeSensorThresholds: Record<string, number> = {
  SENIOR_M_54: 17, SENIOR_M_58: 18, SENIOR_M_63: 19, SENIOR_M_68: 20,
  SENIOR_M_74: 21, SENIOR_M_80: 22, SENIOR_M_87: 22, SENIOR_M_PLUS_87: 23,
  SENIOR_F_46: 15, SENIOR_F_49: 16, SENIOR_F_53: 17, SENIOR_F_57: 18,
  SENIOR_F_62: 19, SENIOR_F_67: 19, SENIOR_F_73: 20, SENIOR_F_PLUS_73: 21,
};

if (!apiKey) throw new Error("DAEDO_API_KEY es obligatorio");
const bridgeApiKey = apiKey;

const socket = dgram.createSocket("udp4");
let sequence = 0;

// TkStrike enforces a unique event abbreviation; matches from the same tournament/category must share one event/config, not one per match.
function slugify(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "na";
}

function normalizeOvrPhase(value: unknown): string {
  const phase = String(value || ovrPhase).trim().toUpperCase();
  if (phase === "PRELIM" || phase === "PRELIMINARY") return "R64";
  return supportedOvrPhases.has(phase) ? phase : "R64";
}

function normalizeOvrMatchNumber(value: unknown, matchId: string): string {
  const raw = String(value || matchId).trim();
  if (raw.length <= 15) return raw;
  const trailingNumber = raw.match(/(\d{1,15})$/)?.[1];
  return trailingNumber || `M${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 10)}`;
}

function getTkStrikeCategory(category: string) {
  const match = category.match(/^(OLYMPIC|SENIOR|JUNIOR|CADET)_([MF])_(PLUS_)?(\d+)$/);
  if (!match) return undefined;
  const [, ageDivision, gender, plus, weight] = match;
  const categoryPrefix = ageDivision === "SENIOR" ? "" : `${ageDivision} `;
  const weightCategory = `${categoryPrefix}${gender === "M" ? "M" : "W"} ${plus ? "+" : "-"}${weight}KG`;
  return {
    weightCategory,
    eventAbbreviation: `${tkStrikeEventPrefixes[ageDivision]}-${gender}${plus ? "+" : ""}${weight}`,
    eventGender: gender === "M" ? "MALE" : "FEMALE",
    division: ageDivision === "JUNIOR" ? "JUNIORS" : ageDivision === "CADET" ? "CADETS" : "SENIORS",
    bodyThreshold: tkStrikeSensorThresholds[category] || 20,
  };
}

async function forwardOvrAction(action: Record<string, any>): Promise<{ status: number; body: string }> {
  const target = new URL(`${ovrUrl.replace(/\/$/, "")}/actions`);
  const response = await fetch(target, {
    method: "POST",
    headers: { "X-API-KEY": bridgeApiKey, "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  return { status: response.status, body: await response.text() };
}

async function projectLoadedMatchToScoreboard(match: Record<string, any>) {
  const action = {
    data: {
      type: "match-actions",
      id: String(match.id),
      attributes: {
        action: "MATCH_LOADED",
        matchId: String(match.id),
        mat: String(match.tatamiNumber || mat),
        tatamiNumber: Number(match.tatamiNumber || mat),
        tournamentName: String(match.tournamentName || "Campeonato TKD"),
        athleteName: String(match.athleteName || ""),
        opponentName: String(match.opponentName || ""),
        corner: String(match.corner || "CHONG"),
        phase: normalizeOvrPhase(match.phase),
        round: 1,
      },
    },
  };
  try {
    const result = await forwardOvrAction(action);
    console.info(`[TKSTRIKE SCOREBOARD] MATCH_LOADED match=${match.matchNumber || match.id} status=${result.status}`);
  } catch (error) {
    console.warn(`[TKSTRIKE SCOREBOARD] No se pudo proyectar el combate al marcador: ${error instanceof Error ? error.message : "error de red"}`);
  }
}

function classify(payload: Buffer): "POINT" | "GAMJEOM" | "CLOCK" | "ROUND" | "MATCH" | "UNKNOWN" {
  // Conservative default: until the official TkStrike packet schema is known,
  // never classify proprietary bytes as points automatically.
  try {
    const text = payload.toString("utf8").toLowerCase();
    if (text.includes("gamjeom")) return "GAMJEOM";
    if (text.includes("point") || text.includes("score")) return "POINT";
    if (text.includes("clock") || text.includes("time")) return "CLOCK";
    if (text.includes("round") || text.includes("round")) return "ROUND";
    if (text.includes("match")) return "MATCH";
  } catch { /* binary packet */ }
  return "UNKNOWN";
}

function parseGen1UdpPacket(payload: Buffer): { eventType: "POINT" | "GAMJEOM" | "CLOCK" | "ROUND" | "MATCH"; state?: Record<string, unknown> } | null {
  const fields = payload.toString("utf8").replace(/[\r\n]+/g, "").trim().split(";").map((field) => field.trim());
  const packetType = fields[0]?.toLowerCase();
  if (!packetType || fields.length < 2) return null;

  const state: Record<string, unknown> = {};
  const valueAfter = (key: string) => {
    const index = fields.indexOf(key);
    if (index < 0 || index + 1 >= fields.length) return undefined;
    const value = Number(fields[index + 1]);
    return Number.isFinite(value) ? value : undefined;
  };
  const clockSeconds = (value: string | undefined) => {
    if (!value) return undefined;
    const clock = value.match(/^(\d{1,3}):(\d{2})$/);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
    const seconds = Number(value);
    return Number.isFinite(seconds) ? seconds : undefined;
  };

  switch (packetType) {
    case "sc1": {
      const chongScore = valueAfter("sc1");
      const hongScore = valueAfter("sc2");
      if (chongScore !== undefined) state.chongScore = chongScore;
      if (hongScore !== undefined) state.hongScore = hongScore;
      return { eventType: "POINT", state: Object.keys(state).length ? state : undefined };
    }
    case "wg1": {
      const chongGamJeom = valueAfter("wg1");
      const hongGamJeom = valueAfter("wg2");
      if (chongGamJeom !== undefined) state.chongGamJeom = chongGamJeom;
      if (hongGamJeom !== undefined) state.hongGamJeom = hongGamJeom;
      return { eventType: "GAMJEOM", state: Object.keys(state).length ? state : undefined };
    }
    case "rnd": {
      const round = Number(fields[1]);
      if (Number.isFinite(round)) state.round = round;
      return { eventType: "ROUND", state: Object.keys(state).length ? state : undefined };
    }
    case "clk":
    case "brk":
    case "ij0":
    case "to1":
    case "to2": {
      const secondsLeft = clockSeconds(fields[1]);
      if (secondsLeft !== undefined) state.secondsLeft = secondsLeft;
      if (fields[2]) {
        state.clockRunning = fields[2].toLowerCase() === "start";
        if (state.clockRunning) state.status = "LIVE";
      }
      return { eventType: "CLOCK", state: Object.keys(state).length ? state : undefined };
    }
    case "pre":
    case "rdy":
    case "mch":
      state.status = "READY";
      return { eventType: "MATCH", state };
    case "wmh":
    case "win":
      state.status = "FINISHED";
      state.clockRunning = false;
      return { eventType: "MATCH", state };
    case "pt1":
    case "pt2":
      return { eventType: "POINT" };
    default:
      return null;
  }
}

function parseClockSeconds(value: unknown): number | undefined {
  const match = String(value || "").trim().match(/^(\d{1,3}):([0-5]?\d)(?:\.(\d+))?$/);
  if (!match) return undefined;
  const wholeSeconds = Number(match[1]) * 60 + Number(match[2]);
  const fractionalSeconds = match[3] ? Number(`0.${match[3]}`) : 0;
  return Math.ceil(wholeSeconds + fractionalSeconds);
}

function parseGen1JsonEvent(value: Record<string, any>): { eventType: "POINT" | "GAMJEOM" | "CLOCK" | "ROUND" | "MATCH" | "UNKNOWN"; state?: Record<string, unknown> } {
  const eventName = String(value.eventType || "").toUpperCase();
  const state: Record<string, unknown> = {};
  const copyNumber = (source: string, target: string) => {
    const number = value[source] == null ? undefined : Number(value[source]);
    if (number !== undefined && Number.isFinite(number)) state[target] = number;
  };
  copyNumber("bluePoints", "chongScore");
  copyNumber("redPoints", "hongScore");
  copyNumber("bluePenalties", "chongGamJeom");
  copyNumber("redPenalties", "hongGamJeom");
  copyNumber("roundNumber", "round");
  const secondsLeft = parseClockSeconds(value.roundTimestampStr);
  if (secondsLeft !== undefined) state.secondsLeft = secondsLeft;
  if (/RESUME|ROUNDCOUNTDOWN_CHANGE|MATCH_START/.test(eventName)) {
    state.clockRunning = true;
    state.status = "LIVE";
  } else if (/TIMEOUT|PAUSE|STOP|BREAK|REST/.test(eventName)) {
    state.clockRunning = false;
  }
  if (value.matchWinner || eventName === "MATCH_FINISHED") {
    state.status = "FINISHED";
    state.clockRunning = false;
    if (value.matchWinner) {
      const winnerUpper = String(value.matchWinner).toUpperCase();
      state.winner = (winnerUpper === "RED" || winnerUpper === "HONG") ? "HONG" : "CHONG";
    }
    if (value.winnerName) state.winnerName = value.winnerName;
  }

  const eventType = /GAM.?JEOM|PENALT/.test(eventName) ? "GAMJEOM"
    : /CLOCK|TIME|REST|BREAK/.test(eventName) ? "CLOCK"
    : /ROUND|PERIOD/.test(eventName) ? "ROUND"
    : /POINT|SCORE|HIT/.test(eventName) || value.eventAddPoints || value.eventRemovePoints ? "POINT"
    : eventName ? "MATCH" : "UNKNOWN";
  return { eventType, state: Object.keys(state).length ? state : undefined };
}

function applyBracketUpdates(result: Record<string, any>) {
  const updates = [result.updatedMatch, ...(Array.isArray(result.advancedMatches) ? result.advancedMatches : [])]
    .filter((match) => match && match.id && match.tournamentId);
  const activeTournamentIds = new Set(localMatches.map((match) => String(match.tournamentId || "")).filter(Boolean));
  let applied = 0;

  for (const update of updates) {
    if (!activeTournamentIds.has(String(update.tournamentId))) continue;
    const index = localMatches.findIndex((match) => String(match.id) === String(update.id));
    if (index < 0) continue;
    localMatches[index] = {
      ...localMatches[index],
      ...update,
      phase: normalizeOvrPhase(update.phase || localMatches[index].phase),
    };
    applied += 1;
  }

  return { received: updates.length, applied };
}

async function forward(message: Buffer, remote: dgram.RemoteInfo) {
  const eventId = crypto.createHash("sha256").update(message).digest("hex").slice(0, 32);
  let state: Record<string, unknown> | undefined;
  try {
    const parsed = JSON.parse(message.toString("utf8"));
    if (parsed && typeof parsed === "object") state = parsed as Record<string, unknown>;
  } catch { /* TkStrike binary packets remain raw until their protocol is confirmed. */ }
  const gen1Packet = state ? null : parseGen1UdpPacket(message);
  const gen1JsonEvent = state ? parseGen1JsonEvent(state) : null;
  const gen1SelectedMatch = state
    ? localMatches.find((match) =>
      (state?.matchVMInternalId && String(match.id) === String(state.matchVMInternalId)) ||
      (state?.matchNumber && String(match.matchNumber) === String(state.matchNumber))
    )
    : undefined;
  const selectedMatch = gen1SelectedMatch || (localMatches.length === 1 ? localMatches[0] : undefined);
  const parsedState = gen1JsonEvent?.state || gen1Packet?.state || state;
  const scoreboardState: Record<string, unknown> | undefined = selectedMatch
    ? {
      ...(parsedState || {}),
      tournamentName: String(selectedMatch.tournamentName || ""),
      chongName: String(selectedMatch.corner === "HONG" ? selectedMatch.opponentName || "" : selectedMatch.athleteName || ""),
      hongName: String(selectedMatch.corner === "HONG" ? selectedMatch.athleteName || "" : selectedMatch.opponentName || ""),
    }
    : parsedState;
  const event = {
    eventId: `${eventId}-${sequence++}`,
    receivedAt: new Date().toISOString(),
    source: { ip: remote.address, port: remote.port, protocol: "udp" },
    payload: { byteLength: message.length, ...(state?.matchWinner ? { matchWinner: state.matchWinner } : {}) },
    raw: {
      encoding,
      value: encoding === "base64" ? message.toString("base64") : message.toString("hex"),
    },
    mat,
    matchId: (state?.matchVMInternalId as string) || (state?.matchId as string) || (state?.matchNumber as string) || gen1SelectedMatch?.id || localMatches[0]?.id,
    eventType: gen1Packet?.eventType || gen1JsonEvent?.eventType || classify(message),
    state: scoreboardState,
  };

  console.info("[TKSTRIKE UDP]", JSON.stringify({
    eventId: event.eventId,
    eventType: event.eventType,
    source: event.source,
    rawHex: message.toString("hex"),
    bytes: message.length,
  }));

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": bridgeApiKey },
    body: JSON.stringify(event),
  });
  const responseText = await response.text();
  if (!response.ok) {
    console.error("[TKSTRIKE FORWARD ERROR]", response.status, responseText);
    return;
  }

  let responseBody: Record<string, any> = {};
  try { responseBody = responseText ? JSON.parse(responseText) : {}; } catch {}
  const isFinished = String((event.state as any)?.status || "").toUpperCase() === "FINISHED" || Boolean((event.payload as any)?.matchWinner);
  if (isFinished) {
    const queueUpdate = applyBracketUpdates(responseBody);
    console.info("[TKSTRIKE BRACKET SYNC]", JSON.stringify({
      matchId: event.matchId,
      winner: (responseBody.live as any)?.winner,
      received: queueUpdate.received,
      applied: queueUpdate.applied,
      advancementError: responseBody.advancementError || null,
    }));
  }
  console.info("[TKSTRIKE FORWARDED]", response.status, JSON.stringify({ eventType: event.eventType, matchId: event.matchId }));
}

socket.on("message", (message, remote) => {
  void forward(message, remote).catch((error) => console.error("[TKSTRIKE BRIDGE ERROR]", error));
});
socket.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[TKSTRIKE UDP] El puerto ${udpPort} ya está ocupado. Ya existe otro puente activo.`);
    return;
  }
  console.error("[TKSTRIKE UDP SOCKET ERROR]", error);
});
socket.bind(udpPort, udpHost, () => console.info(`[TKSTRIKE UDP] Escuchando en ${udpHost}:${udpPort}; reenviando a ${apiUrl}`));

const httpServer = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  console.info(`[TKSTRIKE HTTP IN] ${request.method} ${request.url}`);
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-KEY",
  };
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/health") {
    response.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, udpPort, httpPort, mat, matchesLoaded: localMatches.length, tournamentLoaded: Boolean(currentLocalTournament) }));
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/match") {
    let body = "";
    request.on("data", (chunk) => { body += chunk.toString(); });
    request.on("end", () => {
      try {
        const parsed = JSON.parse(body);
        const requestedMatches: Record<string, any>[] = Array.isArray(parsed) ? parsed : [parsed];
        const invalidMatches = requestedMatches.filter((match) =>
          !match.isBye && !match.isPlaceholder &&
          (!String(match.athleteId || "").trim() || !String(match.opponentAthleteId || "").trim())
        );
        if (invalidMatches.length > 0) {
          response.writeHead(400, { ...corsHeaders, "Content-Type": "application/json" });
          response.end(JSON.stringify({
            success: false,
            error: "TkStrike requiere una ficha de atleta válida para ambos participantes.",
            invalidMatchNumbers: invalidMatches.map((match) => String(match.matchNumber || match.id || "")),
          }));
          return;
        }
        const replaceTournamentId = requestedMatches.find((match) => match.replaceTournamentQueue && match.tournamentId)?.tournamentId;
        if (replaceTournamentId) {
          localMatches = localMatches.filter((match) => match.tournamentId !== replaceTournamentId);
          console.info(`[TKSTRIKE MATCH QUEUE] Reemplazando combates del torneo ${replaceTournamentId}`);
        }
        const ignoredByes = requestedMatches.filter((match) => match.isBye).length;
        const incoming = requestedMatches
          .filter((match) => !match.isBye)
          .map((match): Record<string, any> => {
            const { replaceTournamentQueue: _replace, ...bout } = match;
            return { ...bout, phase: normalizeOvrPhase(bout.phase) };
          });
        if (ignoredByes) console.info(`[TKSTRIKE MATCH QUEUE] Ignorando ${ignoredByes} BYE: no son combates TkStrike`);
        for (const match of incoming) {
          const index = localMatches.findIndex((m) => m.id === match.id);
          if (index >= 0) localMatches[index] = match;
          else localMatches.push(match);
        }
        console.info("[TKSTRIKE MATCH LOADED]", JSON.stringify(incoming), `(total en cola: ${localMatches.length})`);
        const firstReadyBout = incoming.find((match) => !match.isPlaceholder && !match.isBye && match.athleteId && match.opponentAthleteId);
        if (firstReadyBout) void projectLoadedMatchToScoreboard(firstReadyBout);
        response.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: true, matches: localMatches }));
      } catch {
        response.writeHead(400, { ...corsHeaders, "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: false, error: "JSON de combate no válido" }));
      }
    });
    return;
  }

  if (request.method === "DELETE" && requestUrl.pathname === "/api/match") {
    localMatches = [];
    console.info("[TKSTRIKE MATCH QUEUE] Cola de combates vaciada");
    response.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
    response.end(JSON.stringify({ success: true }));
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/tournament") {
    let body = "";
    request.on("data", (chunk) => { body += chunk.toString(); });
    request.on("end", () => {
      try {
        currentLocalTournament = JSON.parse(body);
        console.info("[TKSTRIKE TOURNAMENT LOADED]", JSON.stringify(currentLocalTournament));
        response.writeHead(200, { ...corsHeaders, "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: true, tournament: currentLocalTournament }));
      } catch {
        response.writeHead(400, { ...corsHeaders, "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: false, error: "JSON de competición no válido" }));
      }
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname.startsWith("/api/ovr")) {
    let body = "";
    request.on("data", (chunk) => { body += chunk.toString(); });
    request.on("end", async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const actionAttributes = parsed?.data?.attributes || parsed?.attributes || parsed || {};
        const actionName = String(actionAttributes.action || "MATCH_LOADED");
        const isAction = requestUrl.pathname.includes("/actions") || parsed?.data?.type === "match-actions" || Boolean(actionAttributes.action);
        const matPath = String(requestUrl.searchParams.get("mat") || mat);
        const matSegments = matPath.split("/").filter(Boolean);
        const matchesIndex = matSegments.indexOf("matches");
        const pathMatchId = matchesIndex >= 0 ? matSegments[matchesIndex + 1] : "";
        const matchId = String(actionAttributes.matchId || actionAttributes.match?.id || pathMatchId || parsed?.data?.relationships?.match?.data?.id || parsed?.data?.id || "");
        const selectedMatch = localMatches.find((match) => match.id === matchId || String(match.matchNumber) === matchId);
        const target = new URL(ovrUrl);
        const configuredPath = target.pathname.replace(/\/$/, "");
        target.pathname = isAction ? `${configuredPath}/actions` : configuredPath;
        target.searchParams.set("mat", requestUrl.searchParams.get("mat") || String(selectedMatch?.tatamiNumber || mat));
        for (const [key, value] of requestUrl.searchParams) {
          if (key.startsWith("filter[")) target.searchParams.set(key, value);
        }

        let forwardedBody = parsed;
        if (isAction) {
          forwardedBody = {
            ...parsed,
            data: {
              ...(parsed?.data || {}),
              type: "match-actions",
              id: String(parsed?.data?.id || selectedMatch?.id || matchId || Date.now()),
              attributes: {
                ...actionAttributes,
                action: actionName,
                matchId: selectedMatch?.id || matchId || undefined,
                mat: String(selectedMatch?.tatamiNumber || actionAttributes.mat || mat),
                tatamiNumber: Number(selectedMatch?.tatamiNumber || actionAttributes.tatamiNumber || mat),
                tournamentName: selectedMatch?.tournamentName || actionAttributes.tournamentName,
                athleteName: selectedMatch?.athleteName || actionAttributes.athleteName,
                opponentName: selectedMatch?.opponentName || actionAttributes.opponentName,
                corner: selectedMatch?.corner || actionAttributes.corner,
                phase: normalizeOvrPhase(selectedMatch?.phase || actionAttributes.phase),
              },
            },
          };
        }

        const upstream = await fetch(target, {
          method: "POST",
          headers: { "X-API-KEY": bridgeApiKey, "Content-Type": "application/json" },
          body: JSON.stringify(forwardedBody),
        });
        const upstreamBody = await upstream.text();
        console.info(`[TKSTRIKE OVR ACTION] ${actionName} match=${selectedMatch?.matchNumber || matchId || "unknown"} status=${upstream.status}`);
        response.writeHead(upstream.status, { ...corsHeaders, "Content-Type": upstream.headers.get("content-type") || "application/json", "Cache-Control": "no-store" });
        response.end(upstreamBody);
      } catch (error) {
        console.error("[TKSTRIKE OVR ACTION ERROR]", error);
        response.writeHead(502, { ...corsHeaders, "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: false, error: "No se pudo reenviar la acción de TkStrike al marcador." }));
      }
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname.startsWith("/api/ovr")) {
    let body = "";
    request.on("data", (chunk) => { body += chunk.toString(); });
    request.on("end", async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const actionAttributes = parsed?.data?.attributes || parsed?.attributes || parsed || {};
        const actionName = String(actionAttributes.action || "MATCH_LOADED");
        const isAction = requestUrl.pathname.includes("/actions") || parsed?.data?.type === "match-actions" || Boolean(actionAttributes.action);
        const matPath = String(requestUrl.searchParams.get("mat") || mat);
        const matSegments = matPath.split("/").filter(Boolean);
        const matchSegmentIndex = matSegments.indexOf("matches");
        const pathMatchId = matchSegmentIndex >= 0 ? matSegments[matchSegmentIndex + 1] : "";
        const requestedMatchId = String(
          actionAttributes.matchId ||
          actionAttributes.match?.id ||
          pathMatchId ||
          parsed?.data?.relationships?.match?.data?.id ||
          parsed?.data?.id ||
          ""
        );
        const selectedMatch = localMatches.find((match) => match.id === requestedMatchId || String(match.matchNumber) === requestedMatchId);
        const target = new URL(ovrUrl);
        const basePath = target.pathname.replace(/\/$/, "");
        target.pathname = isAction ? `${basePath}/actions` : basePath;
        target.searchParams.set("mat", requestUrl.searchParams.get("mat") || String(selectedMatch?.tatamiNumber || mat));
        for (const [key, value] of requestUrl.searchParams) {
          if (key.startsWith("filter[")) target.searchParams.set(key, value);
        }

        const actionBody = isAction ? {
          ...parsed,
          data: {
            ...(parsed?.data || {}),
            type: "match-actions",
            id: String(parsed?.data?.id || selectedMatch?.id || requestedMatchId || Date.now()),
            attributes: {
              ...actionAttributes,
              action: actionName,
              matchId: selectedMatch?.id || requestedMatchId || undefined,
              mat: String(selectedMatch?.tatamiNumber || actionAttributes.mat || mat),
              tatamiNumber: Number(selectedMatch?.tatamiNumber || actionAttributes.tatamiNumber || mat),
              tournamentName: selectedMatch?.tournamentName || actionAttributes.tournamentName,
              athleteName: selectedMatch?.athleteName || actionAttributes.athleteName,
              opponentName: selectedMatch?.opponentName || actionAttributes.opponentName,
              corner: selectedMatch?.corner || actionAttributes.corner,
              phase: normalizeOvrPhase(selectedMatch?.phase || actionAttributes.phase),
            },
          },
        } : parsed;

        const upstream = await fetch(target, {
          method: "POST",
          headers: { "X-API-KEY": bridgeApiKey, "Content-Type": "application/json" },
          body: JSON.stringify(actionBody),
        });
        const upstreamBody = await upstream.text();
        console.info(`[TKSTRIKE OVR POST] ${isAction ? actionName : "POST"} match=${selectedMatch?.matchNumber || requestedMatchId || "unknown"} status=${upstream.status}`);
        response.writeHead(upstream.status, { ...corsHeaders, "Content-Type": upstream.headers.get("content-type") || "application/json", "Cache-Control": "no-store" });
        response.end(upstreamBody);
      } catch (error) {
        console.error("[TKSTRIKE OVR POST ERROR]", error);
        response.writeHead(502, { ...corsHeaders, "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: false, error: "No se pudo reenviar la acción OVR a Vercel." }));
      }
    });
    return;
  }

  if ((request.method === "GET" || request.method === "POST") && requestUrl.pathname.startsWith("/api/ovr")) {
    const isCollectionRequest = requestUrl.searchParams.has("filter[mat]") || requestUrl.searchParams.has("filter[status]") || /\/api\/ovr\/matches\/?$/.test(requestUrl.pathname);
    if (ovrTestMode) {
      const testMat = requestUrl.searchParams.get("mat") || mat;
      const testResponse = {
        jsonapi: { version: "1.0" },
        meta: { mat: testMat, source: "tkdcore-local-ovr-test", schemaVersion: "1.0" },
        links: { self: request.url },
        data: {
          type: ovrResourceType,
          id: "ovr-test-match",
          attributes: {
            status: "available",
            mat: Number(testMat) || 1,
            number: "OVR-TEST-001",
            phase: ovrPhase,
            round: 1,
            roundTime: "02:00",
          },
          relationships: {
            homeCompetitor: { data: { type: "competitors", id: "test-home" } },
            awayCompetitor: { data: { type: "competitors", id: "test-away" } },
            session: { data: null },
            event: { data: { type: "events", id: "test-event" } },
            refereeAssignment: { data: null },
            results: { data: [] },
            matchConfiguration: { data: { type: "match-configurations", id: "test-config" } },
          },
        },
        included: [
          { type: "competitors", id: "test-home", attributes: { scoreboardName: "TEST CHONG", printName: "TEST CHONG", tvName: "TEST CHONG", country: "ESP" } },
          { type: "competitors", id: "test-away", attributes: { scoreboardName: "TEST HONG", printName: "TEST HONG", tvName: "TEST HONG", country: "ESP" } },
          { type: "match-configurations", id: "test-config", attributes: { rules: "CONVENTIONAL", rounds: 3, timing: { round: "02:00", rest: "01:00", injury: "01:00" }, thresholds: { body: 20, head: 5 }, videoReplayQuota: { home: 0, away: 0 }, goldenPoint: { enabled: false, time: "00:00" }, maxDifference: 12, maxPenalties: 5 } },
          { type: "events", id: "test-event", attributes: { abbreviation: "SEN-M68", weightCategory: "M -68KG", division: "SENIORS", gender: "MALE", name: "Senior Masculino -68 kg", discipline: "KYORUGI" } },
        ],
      };
      if (isCollectionRequest) testResponse.data = [testResponse.data] as any;
      console.info("[TKSTRIKE OVR TEST]", JSON.stringify(testResponse));
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(testResponse));
      return;
    }
    if (localMatches.length > 0) {
      // TkStrike embeds the real resource path inside the "mat" query value, e.g. "1/matches", "1/participants/<id>".
      const rawMat = requestUrl.searchParams.get("mat") || mat;
      const matSegments = rawMat.split("/").filter(Boolean);
      const localMat = matSegments[0] || mat;
      const requestedType = matSegments[1] || (requestUrl.pathname.includes("/matches") ? "matches" : undefined);
      const requestedSubId = matSegments[2];
      const requestedId = requestedSubId || requestUrl.pathname.match(/\/matches\/([^/?]+)/)?.[1];
      const buildResource = (m: Record<string, any>) => {
        const id = String(m.id || `local-${localMatches.indexOf(m)}`);
        const weightDivision = String(m.weightDivision || m.category || "SENIOR_M_68");
        const tkStrikeCategory = getTkStrikeCategory(weightDivision);
        const eventAbbreviation = String(m.eventAbbreviation || tkStrikeCategory?.eventAbbreviation || weightDivision);
        const eventKey = slugify(`${m.tournamentName}-${eventAbbreviation}`);
        const eventId = `event-${crypto.createHash("sha256").update(eventKey).digest("hex").slice(0, 12)}`;
        const configId = `config-${crypto.createHash("sha256").update(eventKey).digest("hex").slice(0, 12)}`;
        const matchKey = crypto.createHash("sha256").update(id).digest("hex").slice(0, 12);
        const homeCompetitorId = `home-${matchKey}`;
        const awayCompetitorId = `away-${matchKey}`;
        const homeParticipantId = homeCompetitorId;
        const awayParticipantId = awayCompetitorId;
        const athleteIsHong = String(m.corner || "CHONG").toUpperCase() === "HONG";
        const chongName = String(athleteIsHong ? m.opponentName || "" : m.athleteName || "");
        const hongName = String(athleteIsHong ? m.athleteName || "" : m.opponentName || "");
        const chongNameParts = chongName.trim().split(/\s+/).filter(Boolean);
        const hongNameParts = hongName.trim().split(/\s+/).filter(Boolean);
        const chongSourceId = String((athleteIsHong ? m.opponentAthleteId : m.athleteId) || "").trim();
        const hongSourceId = String((athleteIsHong ? m.athleteId : m.opponentAthleteId) || "").trim();
        const toLicense = (sourceId: string, side: string) => sourceId.length > 0 && sourceId.length <= 25
          ? sourceId
          : `${sourceId ? "A" : "P"}-${crypto.createHash("sha256").update(sourceId || `${id}:${side}`).digest("hex").slice(0, 22)}`;
        const chongLicense = toLicense(chongSourceId, "home");
        const hongLicense = toLicense(hongSourceId, "away");
        const eventGender = String(m.eventGender || tkStrikeCategory?.eventGender || "MALE");
        const eventDivision = String(m.division || tkStrikeCategory?.division || "SENIORS");
        const eventCategory = String(m.weightCategory || tkStrikeCategory?.weightCategory || weightDivision);
        const eventWeightLabel = eventCategory.replace(/^(?:(?:OLYMPIC|JUNIOR|CADET)\s+)?[MW]\s*/i, "").replace(/KG$/i, " kg");
        const eventName = `${eventDivision === "SENIORS" ? "Senior" : eventDivision} ${eventGender === "FEMALE" ? "Femenino" : "Masculino"} ${eventWeightLabel}`;
        const bodyThreshold = Number(m.bodyThreshold) || tkStrikeCategory?.bodyThreshold || 20;
        const headThreshold = Number(m.headThreshold) || 5;
        const config = {
          rules: "CONVENTIONAL",
          rounds: Number(m.rounds || 3),
          timing: { round: m.roundTime || "02:00", rest: m.restTime || "01:00", injury: m.injuryTime || "01:00" },
          thresholds: { body: bodyThreshold, head: headThreshold },
          videoReplayQuota: { home: 0, away: 0 },
          goldenPoint: { enabled: false, time: "00:00" },
          maxDifference: Number(m.maxDifference || 12),
          maxPenalties: Number(m.maxPenalties || 5),
        };
        return {
          resource: {
            type: "matches",
            id,
            attributes: { status: "available", mat: Number(m.tatamiNumber || localMat) || 1, number: normalizeOvrMatchNumber(m.matchNumber, id), phase: normalizeOvrPhase(m.phase), round: 1, roundTime: String(m.roundTime || "02:00") },
            relationships: { homeCompetitor: { data: { type: "competitors", id: homeCompetitorId } }, awayCompetitor: { data: { type: "competitors", id: awayCompetitorId } }, session: { data: null }, event: { data: { type: "events", id: eventId } }, refereeAssignment: { data: null }, results: { data: [] }, matchConfiguration: { data: { type: "match-configurations", id: configId } } },
          },
          included: [
            { type: "competitors", id: homeCompetitorId, attributes: { scoreboardName: chongName || "CHONG", printName: chongName || "CHONG", tvName: chongName || "CHONG", country: m.chongCountry || "ESP" }, relationships: { participant: { data: { type: "participants", id: homeParticipantId } } } },
            { type: "competitors", id: awayCompetitorId, attributes: { scoreboardName: hongName || "HONG", printName: hongName || "HONG", tvName: hongName || "HONG", country: m.hongCountry || "ESP" }, relationships: { participant: { data: { type: "participants", id: awayParticipantId } } } },
            { type: "participants", id: homeParticipantId, attributes: { licenseNumber: chongLicense, givenName: chongNameParts[0] || chongName || "CHONG", familyName: chongNameParts.slice(1).join(" "), preferredGivenName: chongNameParts[0] || chongName || "CHONG", preferredFamilyName: chongNameParts.slice(1).join(" "), scoreboardName: chongName || "CHONG", printName: chongName || "CHONG", tvName: chongName || "CHONG", country: m.chongCountry || "ESP", gender: eventGender, mainRole: "ATHLETE" } },
            { type: "participants", id: awayParticipantId, attributes: { licenseNumber: hongLicense, givenName: hongNameParts[0] || hongName || "HONG", familyName: hongNameParts.slice(1).join(" "), preferredGivenName: hongNameParts[0] || hongName || "HONG", preferredFamilyName: hongNameParts.slice(1).join(" "), scoreboardName: hongName || "HONG", printName: hongName || "HONG", tvName: hongName || "HONG", country: m.hongCountry || "ESP", gender: eventGender, mainRole: "ATHLETE" } },
            { type: "match-configurations", id: configId, attributes: config },
            { type: "events", id: eventId, attributes: { abbreviation: eventAbbreviation, weightCategory: eventCategory, division: eventDivision, gender: eventGender, name: eventName, discipline: "KYORUGI" } },
          ],
        };
      };
      const statusFilter = String(requestUrl.searchParams.get("filter[status]") || "").toLowerCase();
      const matFilter = String(requestUrl.searchParams.get("filter[mat]") || "");
      const matchesForResponse = localMatches.filter((match) => {
        if (matFilter && String(match.tatamiNumber || localMat) !== matFilter) return false;
        if (statusFilter !== "available") return true;
        return !match.isBye && !match.isPlaceholder && !match.started && Boolean(match.athleteId) && Boolean(match.opponentAthleteId);
      });
      const built = matchesForResponse.map(buildResource);
      const dedupedIncluded: Record<string, any>[] = [];
      const seenIncluded = new Set<string>();
      for (const item of built.flatMap((b) => b.included)) {
        const key = `${item.type}:${item.id}`;
        if (seenIncluded.has(key)) continue;
        seenIncluded.add(key);
        dedupedIncluded.push(item);
      }

      // TkStrike fetches related resources (participants, events, match-configurations, competitors) as separate
      // GET requests by type+id instead of trusting the "included" array, so each type must be served on its own.
      if (requestedType && requestedType !== "matches") {
        const found = requestedId
          ? dedupedIncluded.find((item) => item.type === requestedType && String(item.id) === requestedId)
          : undefined;
        const collection = dedupedIncluded.filter((item) => item.type === requestedType);
        const data = requestedId ? found : collection;
        if (!data || (Array.isArray(data) && data.length === 0)) {
          response.writeHead(404, { ...corsHeaders, "Content-Type": "application/json" });
          response.end(JSON.stringify({ ok: false, error: `Recurso ${requestedType}/${requestedId || ""} no encontrado en la cola local` }));
          return;
        }
        response.writeHead(200, { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(JSON.stringify({ jsonapi: { version: "1.0" }, meta: { mat: localMat, source: "tkdcore-local-ovr", schemaVersion: "1.0" }, links: { self: request.url }, data }));
        return;
      }

      const matchIdFilter = requestUrl.pathname.match(/\/matches\/([^/?]+)/)?.[1];
      const targetMatches = matchIdFilter ? built.filter((b) => b.resource.id === matchIdFilter) : built;
      const localResponse = {
        jsonapi: { version: "1.0" },
        meta: { mat: localMat, source: "tkdcore-local-ovr", schemaVersion: "1.0" },
        links: { self: request.url },
        data: isCollectionRequest || !matchIdFilter ? targetMatches.map((b) => b.resource) : targetMatches[0]?.resource,
        included: dedupedIncluded,
      };
      if (!localResponse.data) {
        response.writeHead(404, { ...corsHeaders, "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: false, error: "Combate no encontrado en la cola local" }));
        return;
      }
      response.writeHead(200, { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(localResponse));
      return;
    }
    const target = new URL(ovrUrl);
    target.searchParams.set("mat", requestUrl.searchParams.get("mat") || mat);
    for (const [key, value] of requestUrl.searchParams) {
      if (key.startsWith("filter[")) target.searchParams.set(key, value);
    }
    console.info(`[TKSTRIKE OVR] Solicitud ${request.method} ${target}`);
    const upstream = await fetch(target, { headers: { "X-API-KEY": bridgeApiKey } });
    const upstreamBody = await upstream.text();
    console.info(`[TKSTRIKE OVR] Respuesta ${upstream.status}: ${upstreamBody}`);
    response.writeHead(upstream.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    try {
      const normalized = JSON.parse(upstreamBody);
        const requestedResourceType = String(requestUrl.searchParams.get("mat") || mat).split("/").filter(Boolean)[1];
        const isMatchResource = !requestedResourceType || requestedResourceType === "matches";
        const normalizeGen2Resource = (resource: any) => {
          const attributes = resource?.attributes;
          if (!attributes || typeof attributes !== "object") return;
          if (resource.type === "events" && attributes.discipline === "TAEKWONDO") attributes.discipline = "KYORUGI";
          if (resource.type === "match-configurations" && !attributes.rules) attributes.rules = "CONVENTIONAL";
          if (resource.type === "competitors") {
            attributes.competitorType ||= "ATHLETE";
            attributes.printName ||= attributes.scoreboardName || "";
            attributes.printInitialName ||= attributes.printName;
            attributes.tvName ||= attributes.scoreboardName || "";
            attributes.tvInitialName ||= attributes.tvName;
          }
          if (resource.type === "participants") {
            attributes.preferredGivenName ||= attributes.givenName || "";
            attributes.preferredFamilyName ||= attributes.familyName || "";
            attributes.scoreboardName ||= [attributes.preferredGivenName, attributes.preferredFamilyName].filter(Boolean).join(" ");
            attributes.printName ||= attributes.scoreboardName;
            attributes.printInitialName ||= attributes.printName;
            attributes.tvName ||= attributes.scoreboardName;
            attributes.tvInitialName ||= attributes.tvName;
          }
        };
      if (normalized?.data && typeof normalized.data === "object") {
        if (Array.isArray(normalized.data)) {
            for (const resource of normalized.data) {
              if (isMatchResource) resource.type = ovrResourceType;
              normalizeGen2Resource(resource);
            }
        } else {
            if (isMatchResource) normalized.data.type = ovrResourceType;
            normalizeGen2Resource(normalized.data);
            if (isCollectionRequest && isMatchResource) normalized.data = [normalized.data];
        }
      }
        if (Array.isArray(normalized?.included)) normalized.included.forEach(normalizeGen2Resource);
      response.end(JSON.stringify(normalized));
    } catch {
      response.end(upstreamBody);
    }
    return;
  }

  response.writeHead(404, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: false, error: "Not found" }));
});
httpServer.listen(httpPort, httpHost, () => console.info(`[TKSTRIKE OVR] URL local: http://${httpHost}:${httpPort}/api/ovr?mat=${mat}`));
httpServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[TKSTRIKE OVR] El puerto ${httpPort} ya está ocupado. Usa el puente que ya está abierto.`);
    return;
  }
  console.error("[TKSTRIKE HTTP ERROR]", error);
});

function shutdown() {
  httpServer.close();
  socket.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
