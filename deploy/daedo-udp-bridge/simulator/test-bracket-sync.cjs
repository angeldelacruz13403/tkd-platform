const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:http");
const dgram = require("node:dgram");
const { dirname, join, resolve } = require("node:path");

const bridgeRoot = resolve(dirname(__filename), "..");
const tsxCli = join(bridgeRoot, "node_modules", "tsx", "dist", "cli.mjs");
const apiKey = "LOCAL-BRACKET-TEST-KEY";
const tournamentId = "test-tournament-1";
const sourceId = "test-match-101";
const nextId = "test-match-102";

async function listen(server) {
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  return server.address().port;
}

async function freeUdpPort() {
  const socket = dgram.createSocket("udp4");
  await new Promise((resolvePromise, reject) => {
    socket.once("error", reject);
    socket.bind(0, "127.0.0.1", resolvePromise);
  });
  const port = socket.address().port;
  await new Promise((resolvePromise) => socket.close(resolvePromise));
  return port;
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

async function waitFor(check, label) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 40));
  }
  throw new Error(`Timeout esperando ${label}`);
}

function sendUdp(socket, host, port, packet) {
  return new Promise((resolvePromise, reject) => {
    socket.send(Buffer.from(JSON.stringify(packet)), port, host, (error) => error ? reject(error) : resolvePromise());
  });
}

async function main() {
  const apiKeyFailures = [];
  const liveServer = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (request.headers["x-api-key"] !== apiKey) {
      apiKeyFailures.push(`${request.method} ${url.pathname}`);
      sendJson(response, 401, { success: false, error: "Unauthorized" });
      return;
    }
    if (url.pathname === "/events" && request.method === "POST") {
      const event = await readJson(request);
      const live = { ...event.state, matchId: event.matchId, lastEventType: event.eventType };
      sendJson(response, 200, {
        success: true,
        accepted: true,
        live,
        updatedMatch: {
          id: sourceId,
          tournamentId,
          matchNumber: "101",
          started: true,
          result: "LOSS_POINTS",
        },
        advancedMatches: [{
          id: nextId,
          tournamentId,
          matchNumber: "102",
          phase: "F",
          started: false,
          corner: "CHONG",
          athleteId: "winner-red",
          athleteName: "HONG Winner",
          opponentAthleteId: "finalist-blue",
          opponentName: "Finalist Blue",
          chongWtId: "winner-red",
          hongWtId: "",
          isPlaceholder: false,
          isBye: false,
          sourceMatchNumbers: [101],
          advancementSources: { athlete: undefined },
        }],
      });
      return;
    }
    if (url.pathname === "/ovr/actions" && request.method === "POST") {
      const action = await readJson(request);
      sendJson(response, 201, { data: { type: "match-actions", id: action?.data?.id, attributes: { status: "ACCEPTED" } } });
      return;
    }
    sendJson(response, 404, { error: `${request.method} ${url.pathname} not implemented` });
  });

  const apiPort = await listen(liveServer);
  const httpPort = await (async () => {
    const server = createServer();
    const port = await listen(server);
    await new Promise((resolvePromise) => server.close(resolvePromise));
    return port;
  })();
  const udpPort = await freeUdpPort();
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const bridgeBase = `http://127.0.0.1:${httpPort}`;
  const sourceMatch = {
    id: sourceId,
    tournamentId,
    tournamentName: "Final Test Cup",
    matchNumber: "101",
    tatamiNumber: 1,
    category: "SENIOR_M_68",
    phase: "SF",
    athleteId: "blue-loser",
    athleteName: "Blue Loser",
    opponentAthleteId: "red-winner",
    opponentName: "HONG Winner",
    corner: "CHONG",
    started: false,
    replaceTournamentQueue: true,
  };
  const nextMatch = {
    id: nextId,
    tournamentId,
    tournamentName: "Final Test Cup",
    matchNumber: "102",
    tatamiNumber: 1,
    category: "SENIOR_M_54",
    weightDivision: "SENIOR_M_54",
    phase: "F",
    athleteId: "",
    athleteName: "Ganador combate 101",
    opponentAthleteId: "finalist-blue",
    opponentName: "Finalist Blue",
    corner: "CHONG",
    started: false,
    isPlaceholder: true,
    sourceMatchNumbers: [101],
    chongWtId: "PEND-101",
    hongWtId: "",
  };
  let bridgeProcess;
  let bridgeOutput = "";
  const udpSocket = dgram.createSocket("udp4");

  try {
    bridgeProcess = spawn(process.execPath, [tsxCli, "src/index.ts"], {
      cwd: bridgeRoot,
      env: {
        ...process.env,
        DAEDO_API_KEY: apiKey,
        DAEDO_UDP_HOST: "127.0.0.1",
        DAEDO_UDP_PORT: String(udpPort),
        DAEDO_HTTP_HOST: "127.0.0.1",
        DAEDO_HTTP_PORT: String(httpPort),
        DAEDO_MAT: "1",
        TKDCORE_EVENTS_URL: `${apiBase}/events`,
        TKDCORE_OVR_URL: `${apiBase}/ovr/actions`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    bridgeProcess.stdout.on("data", (chunk) => { bridgeOutput += chunk.toString(); });
    bridgeProcess.stderr.on("data", (chunk) => { bridgeOutput += chunk.toString(); });
    await waitFor(async () => {
      try { return (await fetch(`${bridgeBase}/health`)).ok; } catch { return false; }
    }, "bridge /health");

    const loadResponse = await fetch(`${bridgeBase}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([sourceMatch, nextMatch]),
    });
    assert.equal(loadResponse.status, 200, "bridge debe cargar combate y placeholder del torneo");

    await sendUdp(udpSocket, "127.0.0.1", udpPort, {
      matchNumber: "101",
      matchVMInternalId: sourceId,
      eventType: "MATCH_FINISHED",
      matchWinner: "RED",
      bluePoints: 0,
      redPoints: 5,
      bluePenalties: 0,
      redPenalties: 0,
      roundNumber: 3,
    });

    let ovr;
    await waitFor(async () => {
      try {
        const response = await fetch(`${bridgeBase}/api/ovr?mat=1/matches&filter[status]=available&filter[mat]=1`);
        ovr = await response.json();
        return Array.isArray(ovr.data) && ovr.data.some((match) => match.id === nextId);
      } catch { return false; }
    }, "siguiente combate disponible por OVR");

    assert.deepEqual(apiKeyFailures, [], "las peticiones del bridge deben usar la clave configurada");
    assert.equal(ovr.data.length, 1, "el combate terminado no debe seguir apareciendo como disponible");
    assert.equal(ovr.data[0].attributes.number, "102");
    const included = ovr.included || [];
    const homeId = ovr.data[0].relationships.homeCompetitor.data.id;
    const awayId = ovr.data[0].relationships.awayCompetitor.data.id;
    assert.equal(included.find((resource) => resource.id === homeId)?.attributes.scoreboardName, "HONG Winner");
    assert.equal(included.find((resource) => resource.id === awayId)?.attributes.scoreboardName, "Finalist Blue");
    const event = included.find((resource) => resource.type === "events");
    const configuration = included.find((resource) => resource.type === "match-configurations");
    assert.equal(event?.attributes.weightCategory, "M -54KG", "TkStrike recibe la división oficial seleccionada");
    assert.equal(event?.attributes.abbreviation, "SEN-M54", "la abreviatura se deriva del peso seleccionado");
    assert.equal(event?.attributes.gender, "MALE", "el género se deriva de la categoría");
    assert.deepEqual(configuration?.attributes.thresholds, { body: 17, head: 5 }, "se envían los umbrales de la división");
    console.log("BRACKET SYNC PASS: OVR conserva la división oficial -54 kg, su abreviatura, género y umbrales.");

    const seniorCategories = [
      { code: "SENIOR_M_54", label: "M -54KG", abbreviation: "SEN-M54", gender: "MALE", body: 17 },
      { code: "SENIOR_M_58", label: "M -58KG", abbreviation: "SEN-M58", gender: "MALE", body: 18 },
      { code: "SENIOR_M_63", label: "M -63KG", abbreviation: "SEN-M63", gender: "MALE", body: 19 },
      { code: "SENIOR_M_68", label: "M -68KG", abbreviation: "SEN-M68", gender: "MALE", body: 20 },
      { code: "SENIOR_M_74", label: "M -74KG", abbreviation: "SEN-M74", gender: "MALE", body: 21 },
      { code: "SENIOR_M_80", label: "M -80KG", abbreviation: "SEN-M80", gender: "MALE", body: 22 },
      { code: "SENIOR_M_87", label: "M -87KG", abbreviation: "SEN-M87", gender: "MALE", body: 22 },
      { code: "SENIOR_M_PLUS_87", label: "M +87KG", abbreviation: "SEN-M+87", gender: "MALE", body: 23 },
      { code: "SENIOR_F_46", label: "W -46KG", abbreviation: "SEN-F46", gender: "FEMALE", body: 15 },
      { code: "SENIOR_F_49", label: "W -49KG", abbreviation: "SEN-F49", gender: "FEMALE", body: 16 },
      { code: "SENIOR_F_53", label: "W -53KG", abbreviation: "SEN-F53", gender: "FEMALE", body: 17 },
      { code: "SENIOR_F_57", label: "W -57KG", abbreviation: "SEN-F57", gender: "FEMALE", body: 18 },
      { code: "SENIOR_F_62", label: "W -62KG", abbreviation: "SEN-F62", gender: "FEMALE", body: 19 },
      { code: "SENIOR_F_67", label: "W -67KG", abbreviation: "SEN-F67", gender: "FEMALE", body: 19 },
      { code: "SENIOR_F_73", label: "W -73KG", abbreviation: "SEN-F73", gender: "FEMALE", body: 20 },
      { code: "SENIOR_F_PLUS_73", label: "W +73KG", abbreviation: "SEN-F+73", gender: "FEMALE", body: 21 },
    ];
    const seniorTournamentId = "tkstrike-senior-categories-test";
    const seniorMatches = seniorCategories.map((category, index) => ({
      id: `senior-category-${index + 1}`,
      matchNumber: `S${String(index + 1).padStart(2, "0")}`,
      tournamentId: seniorTournamentId,
      tournamentName: "TkStrike Senior Categories Test",
      tatamiNumber: 1,
      category: category.code,
      phase: "R64",
      athleteId: `senior-blue-${index + 1}`,
      athleteName: "Senior Blue",
      opponentAthleteId: `senior-red-${index + 1}`,
      opponentName: "Senior Red",
      corner: "CHONG",
      started: false,
      ...(index === 0 ? { replaceTournamentQueue: true } : {}),
    }));
    const seniorLoad = await fetch(`${bridgeBase}/api/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(seniorMatches),
    });
    assert.equal(seniorLoad.status, 200, "el bridge debe aceptar las 16 divisiones senior");
    const seniorOvrResponse = await fetch(`${bridgeBase}/api/ovr?mat=1/matches&filter[status]=available&filter[mat]=1`);
    const seniorOvr = await seniorOvrResponse.json();
    assert.equal(seniorOvrResponse.status, 200);
    for (const [index, category] of seniorCategories.entries()) {
      const match = seniorOvr.data.find((resource) => resource.id === `senior-category-${index + 1}`);
      assert.ok(match, `OVR debe incluir ${category.code}`);
      const eventId = match.relationships.event.data.id;
      const eventResource = seniorOvr.included.find((resource) => resource.type === "events" && resource.id === eventId);
      assert.equal(eventResource?.attributes.weightCategory, category.label, `${category.code}: etiqueta exacta de TkStrike`);
      assert.equal(eventResource?.attributes.abbreviation, category.abbreviation, `${category.code}: abreviatura`);
      assert.equal(eventResource?.attributes.gender, category.gender, `${category.code}: género`);
      assert.equal(eventResource?.attributes.division, "SENIORS", `${category.code}: contest`);
      const configurationId = match.relationships.matchConfiguration.data.id;
      const configurationResource = seniorOvr.included.find((resource) => resource.type === "match-configurations" && resource.id === configurationId);
      assert.deepEqual(configurationResource?.attributes.thresholds, { body: category.body, head: 5 }, `${category.code}: niveles Body/Head`);
    }
    console.log("SENIOR CATEGORIES PASS: las 16 divisiones, etiquetas TkStrike y niveles Body/Head coinciden con la tabla.");
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nBridge logs:\n${bridgeOutput.slice(-5000)}`);
  } finally {
    await new Promise((resolvePromise) => udpSocket.close(resolvePromise));
    if (bridgeProcess && bridgeProcess.exitCode === null) bridgeProcess.kill();
    await new Promise((resolvePromise) => liveServer.close(resolvePromise));
  }
}

main().catch((error) => {
  console.error(`BRACKET SYNC FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});