const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { createServer } = require("node:http");
const dgram = require("node:dgram");
const { existsSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");

const simulatorDir = dirname(__filename);
const bridgeRoot = resolve(simulatorDir, "..");
const simulatorExe = join(simulatorDir, "TkStrike-Simulator.exe");
const tsxCli = join(bridgeRoot, "node_modules", "tsx", "dist", "cli.mjs");
const testApiKey = "E2E-LOCAL-TEST-KEY";
const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function listen(server) {
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  return server.address().port;
}

async function freeTcpPort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
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

async function waitFor(check, label, timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await wait(50);
  }
  throw new Error(`Timeout esperando ${label}`);
}

async function main() {
  if (!existsSync(simulatorExe)) throw new Error("No existe TkStrike-Simulator.exe; ejecuta npm run simulator:build.");
  if (!existsSync(tsxCli)) throw new Error("Falta tsx; ejecuta npm install en el bridge.");

  const events = [];
  const actions = [];
  let live = null;
  let authFailures = 0;
  const mockApi = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (url.pathname === "/live" && request.method === "GET") {
      sendJson(response, 200, { success: true, data: live });
      return;
    }
    if (request.headers["x-api-key"] !== testApiKey) {
      authFailures += 1;
      sendJson(response, 401, { success: false, error: "Unauthorized" });
      return;
    }

    if (url.pathname === "/events" && request.method === "POST") {
      const event = await readJson(request);
      events.push(event);
      live = {
        ...live,
        ...(event.state || {}),
        winnerName: event.state?.winner === "CHONG" ? event.state?.chongName
          : event.state?.winner === "HONG" ? event.state?.hongName
          : event.state?.winnerName,
        matchId: event.matchId || live?.matchId,
        mat: event.mat || live?.mat || "1",
        lastEventType: event.eventType,
        lastEventAt: event.receivedAt,
      };
      sendJson(response, 200, { success: true, accepted: true, eventId: event.eventId, live });
      return;
    }

    if (url.pathname === "/ovr/actions" && request.method === "POST") {
      const action = await readJson(request);
      actions.push(action);
      const attributes = action?.data?.attributes || {};
      if (attributes.action === "MATCH_LOADED") {
        live = {
          matchId: attributes.matchId,
          mat: attributes.mat || "1",
          tournamentName: attributes.tournamentName,
          chongName: attributes.corner === "HONG" ? attributes.opponentName : attributes.athleteName,
          hongName: attributes.corner === "HONG" ? attributes.athleteName : attributes.opponentName,
          chongScore: 0,
          hongScore: 0,
          chongGamJeom: 0,
          hongGamJeom: 0,
          round: 1,
          secondsLeft: 120,
          clockRunning: false,
          status: "READY",
          lastEventType: attributes.action,
          lastEventAt: new Date().toISOString(),
        };
      }
      sendJson(response, 201, { data: { type: "match-actions", id: action?.data?.id, attributes: { action: attributes.action, status: "ACCEPTED" } } });
      return;
    }

    sendJson(response, 404, { success: false, error: `${request.method} ${url.pathname} not implemented` });
  });

  const mockPort = await listen(mockApi);
  const httpPort = await freeTcpPort();
  const udpPort = await freeUdpPort();
  const bridgeHttp = `http://127.0.0.1:${httpPort}`;
  const mockBase = `http://127.0.0.1:${mockPort}`;
  let bridgeProcess;
  let simulatorProcess;
  let bridgeOutput = "";
  let simulatorOutput = "";

  try {
    bridgeProcess = spawn(process.execPath, [tsxCli, "src/index.ts"], {
      cwd: bridgeRoot,
      env: {
        ...process.env,
        DAEDO_API_KEY: testApiKey,
        DAEDO_UDP_HOST: "127.0.0.1",
        DAEDO_UDP_PORT: String(udpPort),
        DAEDO_HTTP_HOST: "127.0.0.1",
        DAEDO_HTTP_PORT: String(httpPort),
        DAEDO_MAT: "1",
        DAEDO_OVR_TEST: "0",
        TKDCORE_EVENTS_URL: `${mockBase}/events`,
        TKDCORE_OVR_URL: `${mockBase}/ovr`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    bridgeProcess.stdout.on("data", (chunk) => { bridgeOutput += chunk.toString(); });
    bridgeProcess.stderr.on("data", (chunk) => { bridgeOutput += chunk.toString(); });
    await waitFor(async () => {
      try { return (await fetch(`${bridgeHttp}/health`)).ok; } catch { return false; }
    }, "bridge /health");

    simulatorProcess = spawn(simulatorExe, [
      "--bridge", bridgeHttp,
      "--udp-host", "127.0.0.1",
      "--udp-port", String(udpPort),
      "--live-url", `${mockBase}/live`,
      "--mat", "1",
      "--clock-seconds", "3",
      "--tick-ms", "10",
    ], { stdio: ["ignore", "pipe", "pipe"] });
    simulatorProcess.stdout.on("data", (chunk) => { simulatorOutput += chunk.toString(); });
    simulatorProcess.stderr.on("data", (chunk) => { simulatorOutput += chunk.toString(); });
    const exitCode = await new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error("El simulador excedio 45 segundos.")), 45000);
      simulatorProcess.once("error", reject);
      simulatorProcess.once("exit", (code) => { clearTimeout(timer); resolvePromise(code); });
    });

    assert.equal(exitCode, 0, `simulador fallo:\n${simulatorOutput}\nbridge:\n${bridgeOutput.slice(-3000)}`);
    assert.equal(authFailures, 0, "todas las llamadas bridge->API simulada deben tener X-API-KEY");
    assert.ok(actions.some((action) => action?.data?.attributes?.action === "MATCH_LOADED"), "OVR MATCH_LOADED debe llegar al mock");
    assert.deepEqual(events.map((event) => event.eventType), ["MATCH", "ROUND", "POINT", "ROUND", "GAMJEOM", "ROUND", "CLOCK", "MATCH"]);
    assert.equal(live?.matchId, "TKSTRIKE-SIM-001");
    assert.equal(live?.lastEventType, "MATCH");
    assert.equal(live?.hongScore, 2);
    assert.equal(live?.hongGamJeom, 1);
    assert.equal(live?.status, "FINISHED");
    assert.equal(live?.winner, "HONG", "el simulador debe transmitir al vencedor por puntos");
    assert.equal(live?.winnerName, "SIM HONG", "el bridge debe conservar el nombre del ganador");
    console.log("E2E PASS: el .exe consulto OVR, cargo el combate y envio la secuencia UDP por el bridge actual.");
    console.log("Se uso una API local con clave ficticia; Vercel, Supabase y TkStrike real no fueron contactados.");
    if (simulatorOutput.includes("AVISOS DE MAPEADO")) console.log("E2E NOTE: el simulador detecto campos de estado/reloj que el bridge no proyecto completamente.");
    console.log(simulatorOutput.trim());
  } finally {
    if (simulatorProcess && simulatorProcess.exitCode === null) simulatorProcess.kill();
    if (bridgeProcess && bridgeProcess.exitCode === null) bridgeProcess.kill();
    await new Promise((resolvePromise) => mockApi.close(resolvePromise));
  }
}

main().catch((error) => {
  console.error(`E2E FAIL: ${error && error.message ? error.message : error}`);
  process.exitCode = 1;
});
