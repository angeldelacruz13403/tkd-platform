const assert = require("node:assert/strict");
const dgram = require("node:dgram");

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const bridgeBase = option("--bridge", "http://127.0.0.1:5001").replace(/\/$/, "");
const liveUrl = option("--live-url", "https://tkdcore.vercel.app/api/v1/integrations/daedo/live");
const udpHost = option("--udp-host", "127.0.0.1");
const udpPort = Number(option("--udp-port", "5000"));
const mat = option("--mat", "1");
const clockSeconds = Number(option("--clock-seconds", "120"));
const tickMs = Number(option("--tick-ms", "1000"));
const tournamentId = "TKSTRIKE-SIMULATOR";
const matchId = "TKSTRIKE-SIM-001";
const matchNumber = "SIM-001";
const timeoutMs = 15000;

function log(step, message) {
  console.log(`[${step}] ${message}`);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { Accept: "application/json", ...options.headers },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`${options.method || "GET"} ${url} -> HTTP ${response.status}: ${detail}`);
  }
  return { response, body };
}

async function readLive() {
  const { body } = await requestJson(liveUrl);
  return body?.data || null;
}

async function waitForLive(predicate, label) {
  const end = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < end) {
    last = await readLive();
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vercel no reflejo ${label} en ${timeoutMs / 1000}s. Ultimo estado: ${JSON.stringify(last)}`);
}

function sendUdp(socket, packet) {
  const bytes = Buffer.from(JSON.stringify(packet), "utf8");
  return new Promise((resolve, reject) => {
    socket.send(bytes, udpPort, udpHost, (error) => error ? reject(error) : resolve(bytes.length));
  });
}

function getResource(resources, type, id) {
  return resources.find((resource) => resource.type === type && String(resource.id) === String(id));
}

function formatClock(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.000`;
}

async function main() {
  assert.ok(Number.isInteger(clockSeconds) && clockSeconds >= 3 && clockSeconds <= 120, "--clock-seconds debe estar entre 3 y 120");
  assert.ok(Number.isInteger(tickMs) && tickMs >= 0 && tickMs <= 1000, "--tick-ms debe estar entre 0 y 1000");
  log("AVISO", "Esto enviara un combate sintetico por el bridge actual y cambiara el marcador en vivo a modo prueba.");
  log("AVISO", "Al terminar, vuelve a cargar un combate real en TkStrike para recuperar el marcador de competicion.");
  log("RELOJ", `Cuenta atras de ${formatClock(clockSeconds)} a 00:00.000; un paquete UDP por segundo.`);

  const health = await requestJson(`${bridgeBase}/health`);
  assert.equal(health.body?.ok, true, "el bridge local debe responder OK en /health");
  log("BRIDGE", `Activo en ${bridgeBase}; UDP ${udpHost}:${udpPort}.`);

  const previousLive = await readLive().catch(() => null);
  if (previousLive) log("LIVE ANTES", `${previousLive.matchId} ${previousLive.chongScore}-${previousLive.hongScore} ${previousLive.status}`);

  const match = {
    id: matchId,
    matchNumber,
    tournamentId,
    replaceTournamentQueue: true,
    tournamentName: "TKSTRIKE SIMULATOR - PRUEBA",
    category: "SENIOR_M_68",
    weightCategory: "M -68KG",
    athleteName: "SIM CHONG",
    athleteId: "sim-blue-001",
    opponentAthleteId: "sim-red-001",
    opponentName: "SIM HONG",
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

  const loaded = await requestJson(`${bridgeBase}/api/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([match]),
  });
  assert.equal(loaded.body?.success, true, "el bridge debe aceptar el combate simulado");
  log("COLA", `Combate ${matchId} cargado.`);

  const availableUrl = new URL(`${bridgeBase}/api/ovr`);
  availableUrl.searchParams.set("mat", `${mat}/matches`);
  availableUrl.searchParams.set("filter[status]", "available");
  availableUrl.searchParams.set("filter[mat]", mat);
  availableUrl.searchParams.set("include", "homeCompetitor,homeCompetitor.participant,awayCompetitor,awayCompetitor.participant,matchConfiguration,refereeAssignment,event");
  const ovrGet = await requestJson(availableUrl);
  const data = Array.isArray(ovrGet.body?.data) ? ovrGet.body.data : [ovrGet.body?.data].filter(Boolean);
  const simulatedMatch = data.find((resource) => resource.id === matchId);
  assert.ok(simulatedMatch, "el combate de prueba debe aparecer en la respuesta OVR");
  const included = ovrGet.body?.included || [];
  const homeId = simulatedMatch.relationships?.homeCompetitor?.data?.id;
  const awayId = simulatedMatch.relationships?.awayCompetitor?.data?.id;
  const home = getResource(included, "competitors", homeId);
  const away = getResource(included, "competitors", awayId);
  assert.ok(home, "OVR debe incluir el competidor CHONG");
  assert.ok(away, "OVR debe incluir el competidor HONG");
  assert.equal(home?.attributes?.scoreboardName, "SIM CHONG");
  assert.equal(away?.attributes?.scoreboardName, "SIM HONG");
  assert.ok(included.every((resource) => String(resource.id).length <= 25), "los IDs incluidos en OVR deben respetar el limite de TkStrike");
  const participantIds = [home, away].map((competitor) => competitor.relationships?.participant?.data?.id);
  const participants = participantIds.map((id) => getResource(included, "participants", id)).filter(Boolean);
  assert.equal(participants.length, 2, "OVR debe incluir los participantes enlazados a este combate");
  assert.ok(participants.every((participant) => String(participant.attributes.licenseNumber || "").length <= 25), "las licencias deben respetar el limite de TkStrike");
  log("OVR GET", `HTTP ${ovrGet.response.status}; match ${simulatedMatch.attributes.number}; competidores y participantes validos.`);

  for (const participant of participants) {
    const participantUrl = new URL(`${bridgeBase}/api/ovr`);
    participantUrl.searchParams.set("mat", `${mat}/participants/${participant.id}`);
    const response = await requestJson(participantUrl);
    assert.equal(response.body?.data?.id, participant.id, `TkStrike debe poder consultar participant ${participant.id}`);
  }
  log("OVR RELACIONES", "GET individual de los dos participantes: OK.");

  const loadedAction = {
    data: {
      type: "match-actions",
      id: matchId,
      attributes: {
        action: "MATCH_LOADED",
        matchId,
        mat: String(mat),
        tatamiNumber: Number(mat) || 1,
        tournamentName: match.tournamentName,
        athleteName: match.athleteName,
        opponentName: match.opponentName,
        corner: match.corner,
        phase: match.phase,
        round: 1,
      },
    },
  };
  const actionUrl = new URL(`${bridgeBase}/api/ovr`);
  actionUrl.searchParams.set("mat", `${mat}/matches/${matchId}/actions`);
  const actionResult = await requestJson(actionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loadedAction),
  });
  assert.equal(actionResult.response.status, 201, "OVR MATCH_LOADED debe reenviarse y aceptarse");
  const ready = await waitForLive((state) => state?.matchId === matchId && state?.lastEventType === "MATCH_LOADED", "MATCH_LOADED");
  log("OVR ACTION", `MATCH_LOADED aceptado; live READY ${ready.chongName} vs ${ready.hongName}.`);

  const eventPacket = (eventType, remaining, values = {}) => ({
    matchNumber,
    matchVMInternalId: matchId,
    matchCategoryName: match.category,
    matchCategoryGender: match.eventGender,
    matchSubCategoryName: match.division,
    eventType,
    roundNumber: 1,
    roundTimestampStr: formatClock(remaining),
    bluePoints: 0,
    redPoints: 0,
    bluePenalties: 0,
    redPenalties: 0,
    ...values,
  });
  const socket = dgram.createSocket("udp4");
  let live = ready;
  let bluePoints = 0;
  let redPoints = 0;
  let bluePenalties = 0;
  let redPenalties = 0;
  let packetCount = 0;

  async function sendAndVerify(packet, expectedType, options) {
    const previousEventAt = live.lastEventAt;
    const byteCount = await sendUdp(socket, packet);
    live = await waitForLive(
      (state) => state?.matchId === matchId && state?.lastEventType === expectedType && state?.lastEventAt !== previousEventAt,
      `${packet.eventType} (${expectedType})`,
    );
    assert.equal(live.secondsLeft, options.seconds, `el reloj debe mostrar ${options.seconds}s despues de ${packet.eventType}`);
    assert.equal(live.clockRunning, options.running, `clockRunning debe ser ${options.running} despues de ${packet.eventType}`);
    if (options.status) assert.equal(live.status, options.status, `el estado debe ser ${options.status}`);
    if (options.chongScore !== undefined) assert.equal(live.chongScore, options.chongScore);
    if (options.hongScore !== undefined) assert.equal(live.hongScore, options.hongScore);
    if (options.chongGamJeom !== undefined) assert.equal(live.chongGamJeom, options.chongGamJeom);
    if (options.hongGamJeom !== undefined) assert.equal(live.hongGamJeom, options.hongGamJeom);
    packetCount += 1;
    return byteCount;
  }

  try {
    await sendAndVerify(eventPacket("RESUME", clockSeconds), "MATCH", {
      seconds: clockSeconds, running: true, status: "LIVE", chongScore: 0, hongScore: 0,
    });
    log("RELOJ", `${formatClock(clockSeconds)}; cuenta atras iniciada.`);

    const pointAt = Math.max(1, Math.floor(clockSeconds * 0.75));
    const penaltyAt = Math.max(1, Math.floor(clockSeconds * 0.5));
    const startedAt = Date.now();
    const reportEvery = Math.max(1, Math.floor(clockSeconds / 12));

    for (let remaining = clockSeconds - 1; remaining >= 0; remaining -= 1) {
      const targetTime = startedAt + (clockSeconds - remaining) * tickMs;
      const delay = targetTime - Date.now();
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

      const clockPacket = eventPacket("ROUNDCOUNTDOWN_CHANGE", remaining, {
        roundNumber: 1,
        bluePoints,
        redPoints,
        bluePenalties,
        redPenalties,
      });
      await sendAndVerify(clockPacket, "ROUND", {
        seconds: remaining, running: true, status: "LIVE",
        chongScore: bluePoints, hongScore: redPoints,
        chongGamJeom: bluePenalties, hongGamJeom: redPenalties,
      });

      if (remaining === pointAt) {
        redPoints += 2;
        const pointPacket = eventPacket("OT_RED_HEAD_HIT", remaining, {
          bluePoints, redPoints, bluePenalties, redPenalties,
        });
        await sendAndVerify(pointPacket, "POINT", {
          seconds: remaining, running: true, status: "LIVE", chongScore: bluePoints, hongScore: redPoints,
        });
        log("PUNTO", `SIM HONG +2 en ${formatClock(remaining)}.`);
      }

      if (remaining === penaltyAt) {
        redPenalties += 1;
        const penaltyPacket = eventPacket("GAMJEOM", remaining, {
          bluePoints, redPoints, bluePenalties, redPenalties,
        });
        await sendAndVerify(penaltyPacket, "GAMJEOM", {
          seconds: remaining, running: true, status: "LIVE", hongScore: redPoints, hongGamJeom: redPenalties,
        });
        log("GAMJEOM", `SIM HONG +1 penalizacion en ${formatClock(remaining)}.`);
      }

      if (remaining % reportEvery === 0 || remaining === 0) log("RELOJ", `${formatClock(remaining)} (${packetCount} paquetes confirmados).`);
    }

    await sendAndVerify(eventPacket("TIMEOUT", 0, {
      roundNumber: 1, bluePoints, redPoints, bluePenalties, redPenalties,
    }), "CLOCK", {
      seconds: 0, running: false, status: "LIVE", chongScore: bluePoints, hongScore: redPoints,
    });
    await sendAndVerify(eventPacket("MATCH_FINISHED", 0, {
      roundNumber: 1, bluePoints, redPoints, bluePenalties, redPenalties, matchWinner: "RED",
    }), "MATCH", {
      seconds: 0, running: false, status: "FINISHED",
      chongScore: bluePoints, hongScore: redPoints,
      chongGamJeom: bluePenalties, hongGamJeom: redPenalties,
    });
  } finally {
    await new Promise((resolve) => socket.close(resolve));
  }

  assert.equal(live.matchId, matchId);
  assert.equal(live.chongName, match.athleteName);
  assert.equal(live.hongName, match.opponentName);
  assert.equal(live.chongScore, bluePoints);
  assert.equal(live.hongScore, redPoints);
  assert.equal(live.chongGamJeom, bluePenalties);
  assert.equal(live.hongGamJeom, redPenalties);
  assert.equal(live.round, 1);
  assert.equal(live.status, "FINISHED");
  assert.equal(live.winner, "HONG");
  assert.equal(live.winnerName, match.opponentName);
  assert.equal(live.secondsLeft, 0);
  assert.equal(live.clockRunning, false);

  const cleanup = await requestJson(`${bridgeBase}/api/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{
      id: `${matchId}-cleanup`,
      tournamentId,
      replaceTournamentQueue: true,
      isBye: true,
      matchNumber,
    }]),
  });
  assert.equal(cleanup.body?.success, true, "la cola local debe retirar solo el torneo de simulacion");

  console.log("");
  console.log("RESULTADO: OVR y UDP llegaron al marcador en vivo.");
  console.log(`Final: ${live.matchId} | ${live.chongName} ${live.chongScore}-${live.hongScore} ${live.hongName} | ganador ${live.winnerName} (${live.winner}) | penalizaciones ${live.chongGamJeom}-${live.hongGamJeom} | ronda ${live.round} | ${live.status}.`);
  console.log(`Reloj: ${clockSeconds}s -> 0s en ${clockSeconds} ticks de ${tickMs}ms; ${packetCount} paquetes UDP confirmados.`);
  console.log("Reloj, puntos, penalizacion, RESUME y final verificados en el endpoint live.");
  console.log("El combate sintetico se quito de la cola local. La fila de prueba queda como ultimo estado del marcador web; carga un combate real para reemplazarla.");
}

main().catch((error) => {
  console.error(`SIMULACION FALLIDA: ${error && error.message ? error.message : error}`);
  console.error("Comprueba que el bridge esta abierto en 127.0.0.1:5001 y escucha UDP en el puerto indicado.");
  process.exitCode = 1;
});
