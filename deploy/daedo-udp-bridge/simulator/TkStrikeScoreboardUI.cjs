const { spawn } = require("node:child_process");
const dgram = require("node:dgram");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const loopback = "127.0.0.1";
let bridgeBase = option("--bridge", "http://127.0.0.1:5001").replace(/\/$/, "");
let udpHost = option("--udp-host", "127.0.0.1");
let udpPort = Number(option("--udp-port", "5000"));
let matDefault = option("--mat", "1");
const liveUrl = option("--live-url", "https://tkdcore.vercel.app/api/v1/integrations/daedo/live");
const uiDir = path.join(__dirname, "ui");
const allowedEvents = new Set([
  "RESUME", "TIMEOUT", "ROUNDCOUNTDOWN_CHANGE", "ROUND", "GAMJEOM", "POINT", "MATCH_FINISHED",
  "OT_BLUE_PUNCH_HIT", "OT_BLUE_BODY_HIT", "OT_BLUE_HEAD_HIT", "OT_BLUE_TURN_BODY_HIT", "OT_BLUE_TURN_HEAD_HIT",
  "OT_RED_PUNCH_HIT", "OT_RED_BODY_HIT", "OT_RED_HEAD_HIT", "OT_RED_TURN_BODY_HIT", "OT_RED_TURN_HEAD_HIT",
]);
let activeMatch = null;

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Access-Control-Allow-Origin": "null",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function sendText(response, status, value, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  response.end(value);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("La solicitud supera el limite local de 64 KB.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method || "GET"} ${url} devolvio HTTP ${response.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return { response, body };
}

async function getBridgeHealth() {
  try {
    const { body } = await fetchJson(`${bridgeBase}/health`, { signal: AbortSignal.timeout(2500) });
    return { ok: body?.ok === true, httpPort: body?.httpPort || 5001, udpPort: body?.udpPort || udpPort, bridgeBase };
  } catch (error) {
    return { ok: false, httpPort: 5001, udpPort, bridgeBase, error: error.message };
  }
}

async function getLive(mat) {
  try {
    const { body } = await fetchJson(mat ? `${liveUrl}${liveUrl.includes("?") ? "&" : "?"}mat=${encodeURIComponent(mat)}` : liveUrl, { signal: AbortSignal.timeout(4500) });
    return { ok: true, data: body?.data || null };
  } catch (error) {
    return { ok: false, data: null, error: error.message };
  }
}

async function getOvrMatches(mat) {
  const bridge = await getBridgeHealth();
  if (!bridge.ok) throw new Error(`Bridge no disponible en ${bridgeBase}.`);
  const url = new URL(`${bridgeBase}/api/ovr`);
  url.searchParams.set("mat", `${mat}/matches`);
  url.searchParams.set("filter[status]", "available");
  url.searchParams.set("filter[mat]", mat);
  url.searchParams.set("include", "homeCompetitor,homeCompetitor.participant,awayCompetitor,awayCompetitor.participant,event,matchConfiguration");
  const { body } = await fetchJson(url, { signal: AbortSignal.timeout(8000) });
  if (body?.errors?.length) throw new Error(body.errors.map((item) => item.detail || item.title || "Error OVR").join("; "));
  const resources = Array.isArray(body?.data) ? body.data : [body?.data].filter(Boolean);
  const included = body?.included || [];
  const related = (match, relationship) => {
    const id = match.relationships?.[relationship]?.data?.id;
    return included.find((resource) => resource.type === "competitors" && String(resource.id) === String(id));
  };
  const participantName = (competitor) => {
    const participantId = competitor?.relationships?.participant?.data?.id;
    const participant = included.find((resource) => resource.type === "participants" && String(resource.id) === String(participantId));
    return participant ? [participant.attributes?.givenName, participant.attributes?.familyName].filter(Boolean).join(" ") : "";
  };
  const eventIdFor = (match) => match.relationships?.event?.data?.id;
  return resources.map((match) => {
    const home = related(match, "homeCompetitor");
    const away = related(match, "awayCompetitor");
    const eventId = eventIdFor(match);
    const event = included.find((resource) => resource.type === "events" && String(resource.id) === String(eventId));
    return {
      id: String(match.id),
      number: String(match.attributes?.number || match.id),
      mat: String(match.attributes?.mat || mat),
      phase: String(match.attributes?.phase || "R64"),
      roundTime: String(match.attributes?.roundTime || "02:00"),
      category: String(event?.attributes?.weightCategory || event?.attributes?.name || "TKD"),
      chongName: String(home?.attributes?.scoreboardName || home?.attributes?.printName || participantName(home) || "CHONG"),
      hongName: String(away?.attributes?.scoreboardName || away?.attributes?.printName || participantName(away) || "HONG"),
      eventName: String(event?.attributes?.name || event?.attributes?.abbreviation || ""),
      source: body?.meta?.source || "OVR",
    };
  });
}

function applyConfig(body) {
  const http = Number(body.httpPort), udp = Number(body.udpPort);
  if (Number.isInteger(http) && http > 0 && http < 65536) bridgeBase = `http://127.0.0.1:${http}`;
  if (Number.isInteger(udp) && udp > 0 && udp < 65536) udpPort = udp;
}

async function apiStatus(mat) {
  const [bridge, live] = await Promise.all([getBridgeHealth(), getLive(mat)]);
  return { bridge, live, config: { httpPort: Number(new URL(bridgeBase).port), udpPort }, matchLoaded: Boolean(activeMatch), activeMatch };
}

function sendUdp(packet) {
  const socket = dgram.createSocket("udp4");
  return new Promise((resolve, reject) => {
    socket.once("error", (error) => {
      socket.close();
      reject(error);
    });
    socket.send(Buffer.from(JSON.stringify(packet), "utf8"), udpPort, udpHost, (error, bytes) => {
      socket.close();
      if (error) reject(error);
      else resolve(bytes);
    });
  });
}

async function loadMatch(body) {
  const chongName = String(body.chongName || "").trim().slice(0, 40);
  const hongName = String(body.hongName || "").trim().slice(0, 40);
  const matchNumber = String(body.matchNumber || "101").trim().slice(0, 15);
  const mat = String(body.mat || matDefault).trim().slice(0, 3);
  if (!chongName || !hongName) throw new Error("Escribe el nombre de ambos competidores.");
  const bridge = await getBridgeHealth();
  if (!bridge.ok) throw new Error(`Bridge no disponible en ${bridgeBase}. Comprueba que INICIAR-TKSTRIKE.ps1 siga abierto.`);

  const id = `GUI-${Date.now()}`;
  const match = {
    id,
    matchNumber,
    tournamentId: "TKSTRIKE-SCOREBOARD-UI",
    replaceTournamentQueue: true,
    tournamentName: "TKSTRIKE GUI - PRUEBA",
    category: "SENIOR_M_68",
    weightDivision: "SENIOR_M_68",
    weightCategory: "M -68KG",
    athleteName: chongName,
    athleteId: "sim-blue-001",
    opponentAthleteId: "sim-red-001",
    opponentName: hongName,
    corner: "CHONG",
    eventAbbreviation: "SIM-M68",
    eventGender: "MALE",
    rounds: 3,
    roundTime: "02:00",
    restTime: "01:00",
    injuryTime: "01:00",
    bodyThreshold: 0,
    headThreshold: 0,
    division: "SENIORS",
    maxDifference: 12,
    maxPenalties: 5,
    phase: "R64",
    tatamiNumber: Number(mat) || 1,
  };

  await fetchJson(`${bridgeBase}/api/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([match]),
  });

  const collection = new URL(`${bridgeBase}/api/ovr`);
  collection.searchParams.set("mat", `${mat}/matches`);
  collection.searchParams.set("filter[status]", "available");
  collection.searchParams.set("filter[mat]", mat);
  collection.searchParams.set("include", "homeCompetitor,homeCompetitor.participant,awayCompetitor,awayCompetitor.participant,matchConfiguration,event");
  const { body: ovr } = await fetchJson(collection);
  const resources = Array.isArray(ovr?.data) ? ovr.data : [ovr?.data].filter(Boolean);
  if (!resources.some((resource) => resource.id === id)) throw new Error("El bridge no devolvio el combate por OVR.");

  activeMatch = {
    id,
    matchNumber,
    tournamentId: match.tournamentId,
    chongName,
    hongName,
    mat,
    phase: match.phase,
    category: match.category,
  };
  const liveEnd = Date.now() + 7000;
  let live = null;
  while (Date.now() < liveEnd) {
    const response = await getLive();
    live = response.data;
    if (response.ok && live?.matchId === id && live?.lastEventType === "MATCH_LOADED") break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { match: activeMatch, ovrResource: resources.find((resource) => resource.id === id), live };
}

async function loadOvrMatch(body) {
  const mat = String(body.mat || matDefault).trim().slice(0, 3);
  const matchId = String(body.matchId || "").trim();
  if (!matchId) throw new Error("Selecciona un combate recibido por OVR.");
  const matches = await getOvrMatches(mat);
  const selected = matches.find((match) => match.id === matchId);
  if (!selected) throw new Error("Ese combate ya no aparece en la cola OVR. Actualiza la lista.");

  const actionUrl = new URL(`${bridgeBase}/api/ovr`);
  actionUrl.searchParams.set("mat", `${mat}/matches/${selected.id}/actions`);
  const before = await getLive();
  const action = {
    data: {
      type: "match-actions",
      id: selected.id,
      attributes: {
        action: "MATCH_LOADED",
        matchId: selected.id,
        mat: selected.mat,
        tatamiNumber: Number(selected.mat) || 1,
        tournamentName: selected.eventName || "TKD OVR",
        athleteName: selected.chongName,
        opponentName: selected.hongName,
        corner: "CHONG",
        phase: selected.phase,
        round: 1,
      },
    },
  };
  const { response, body: result } = await fetchJson(actionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
    signal: AbortSignal.timeout(10000),
  });
  if (response.status !== 201 && result?.data?.attributes?.status !== "ACCEPTED") {
    throw new Error("El bridge no confirmo MATCH_LOADED por OVR.");
  }

  activeMatch = {
    id: selected.id,
    matchNumber: selected.number,
    tournamentId: "OVR-RECEIVED",
    chongName: selected.chongName,
    hongName: selected.hongName,
    mat: selected.mat,
    phase: selected.phase,
    category: selected.category,
  };
  let live = null;
  const end = Date.now() + 7000;
  while (Date.now() < end) {
    const current = await getLive();
    live = current.data;
    if (current.ok && live?.matchId === selected.id && live?.lastEventType === "MATCH_LOADED" && live.lastEventAt !== before.data?.lastEventAt) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { match: activeMatch, action: result, live };
}

async function sendEvent(body) {
  if (!activeMatch) throw new Error("Primero carga un combate en el bridge.");
  const bridge = await getBridgeHealth();
  if (!bridge.ok) throw new Error(`Bridge no disponible en ${bridgeBase}.`);
  const eventType = String(body.eventType || "").toUpperCase();
  if (!allowedEvents.has(eventType)) throw new Error(`Tipo de evento no permitido: ${eventType}`);
  const packet = {
    matchNumber: activeMatch.matchNumber,
    matchVMInternalId: activeMatch.id,
    matchCategoryName: activeMatch.category,
    matchCategoryGender: "MALE",
    matchSubCategoryName: "SENIORS",
    eventType,
    roundNumber: Math.max(1, Math.min(3, Number(body.roundNumber) || 1)),
    roundTimestampStr: String(body.roundTimestampStr || "02:00.000").slice(0, 16),
    bluePoints: Math.max(0, Number(body.bluePoints) || 0),
    redPoints: Math.max(0, Number(body.redPoints) || 0),
    bluePenalties: Math.max(0, Number(body.bluePenalties) || 0),
    redPenalties: Math.max(0, Number(body.redPenalties) || 0),
    eventAddPoints: Boolean(body.eventAddPoints),
    eventRemovePoints: Boolean(body.eventRemovePoints),
    ...(body.matchWinner ? { matchWinner: body.matchWinner } : {}),
  };
  const bytes = await sendUdp(packet);
  return { sent: true, bytes, packet };
}

async function readRequestJson(request, response) {
  try { return await readBody(request); }
  catch (error) {
    sendJson(response, 400, { error: error.message });
    return null;
  }
}

function serveAsset(request, response, pathname) {
  const relative = pathname === "/" ? "index.html" : decodeURIComponent(pathname.replace(/^\//, ""));
  const assetPath = path.resolve(uiDir, relative);
  if (!assetPath.startsWith(path.resolve(uiDir) + path.sep) && assetPath !== path.resolve(uiDir, "index.html")) {
    sendText(response, 403, "Forbidden");
    return;
  }
  if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
    sendText(response, 404, "Not found");
    return;
  }
  const extension = path.extname(assetPath).toLowerCase();
  const contentType = extension === ".html" ? "text/html; charset=utf-8"
    : extension === ".css" ? "text/css; charset=utf-8"
    : extension === ".js" ? "text/javascript; charset=utf-8"
    : "application/octet-stream";
  sendText(response, 200, fs.readFileSync(assetPath), contentType);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || loopback}`);
  try {
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "Access-Control-Allow-Origin": "null", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
      response.end();
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/status") {
      sendJson(response, 200, await apiStatus(url.searchParams.get("mat") || ""));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/config") {
      const body = await readRequestJson(request, response);
      if (!body) return;
      applyConfig(body);
      sendJson(response, 200, { bridgeBase, udpPort });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/ovr-matches") {
      try { sendJson(response, 200, { matches: await getOvrMatches(String(url.searchParams.get("mat") || matDefault)) }); }
      catch (error) { sendJson(response, 502, { error: error.message }); }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/load-match") {
      const body = await readRequestJson(request, response);
      if (!body) return;
      try { sendJson(response, 200, await loadMatch(body)); }
      catch (error) { sendJson(response, 502, { error: error.message }); }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/load-ovr-match") {
      const body = await readRequestJson(request, response);
      if (!body) return;
      try { sendJson(response, 200, await loadOvrMatch(body)); }
      catch (error) { sendJson(response, 502, { error: error.message }); }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/udp") {
      const body = await readRequestJson(request, response);
      if (!body) return;
      try { sendJson(response, 200, await sendEvent(body)); }
      catch (error) { sendJson(response, 502, { error: error.message }); }
      return;
    }
    if (request.method === "GET") {
      serveAsset(request, response, url.pathname);
      return;
    }
    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Internal error" });
  }
});

async function listenAvailable(startPort) {
  for (let port = startPort; port <= startPort + 20; port += 1) {
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => { server.removeListener("listening", onListening); reject(error); };
        const onListening = () => { server.removeListener("error", onError); resolve(); };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, loopback);
      });
      return port;
    } catch (error) {
      if (error.code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error(`No hay puertos libres entre ${startPort} y ${startPort + 20}.`);
}

(async () => {
  try {
    const port = await listenAvailable(Number(option("--port", "5177")));
    const url = `http://${loopback}:${port}`;
    console.log(`TKStrike Match Control disponible en ${url}`);
    console.log(`Bridge: ${bridgeBase}; UDP destino: ${udpHost}:${udpPort}; Vercel live: ${liveUrl}`);
    if (!args.includes("--no-open") && process.platform === "win32") {
      spawn("cmd.exe", ["/c", "start", "", url], { windowsHide: true, stdio: "ignore" }).unref();
    }
  } catch (error) {
    console.error(`No se pudo iniciar la interfaz: ${error.message}`);
    process.exitCode = 1;
  }
})();

process.on("SIGINT", () => server.close(() => process.exit(0)));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
