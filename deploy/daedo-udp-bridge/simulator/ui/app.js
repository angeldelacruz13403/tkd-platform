(async () => {
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    bridgeLight: $("#bridge-light"), bridgeState: $("#bridge-state"),
    vercelLight: $("#vercel-light"), vercelState: $("#vercel-state"),
    chongInput: $("#chong-name"), hongInput: $("#hong-name"), matchInput: $("#match-number"), matInput: $("#mat-number"),
    load: $("#load-match"), ovrMatch: $("#ovr-match"), refreshOvr: $("#refresh-ovr"), loadOvr: $("#load-ovr"),
    blueName: $("#blue-name"), redName: $("#red-name"), blueScore: $("#blue-score"), redScore: $("#red-score"),
    bluePenalties: $("#blue-penalties"), redPenalties: $("#red-penalties"), matchId: $("#match-id-label"),
    clock: $("#clock"), meter: $("#clock-meter-fill"), clockState: $("#clock-state"), clockStateLight: $("#clock-state-light"), clockPacket: $("#clock-packet"),
    start: $("#clock-start"), pause: $("#clock-pause"), round: $("#round-number"), roundLabel: $("#round-label"),
    roundPrev: $("#round-prev"), roundNext: $("#round-next"), reset: $("#round-reset"), finish: $("#finish-match"), message: $("#action-message"),
    winnerBanner: $("#winner-banner"), winnerName: $("#winner-name"), winnerScore: $("#winner-score"),
    liveEvent: $("#live-event"), liveMatch: $("#live-match"), liveScore: $("#live-score"), liveClock: $("#live-clock"), liveStatus: $("#live-status"),
    eventList: $("#event-list"), feedCount: $("#feed-count"), toast: $("#toast"),
  };

  const state = {
    match: null,
    blue: { score: 0, penalties: 0 },
    red: { score: 0, penalties: 0 },
    round: 1,
    maxRounds: 3,
    seconds: 120,
    running: false,
    finished: false,
    winner: null,
    busy: false,
    timer: null,
    clockDeadline: 0,
    eventCount: 0,
    live: null,
    roundLabel: "R64",
    ovrMatches: [],
  };

  const roundNames = ["R64", "R32", "R16", "QF", "SF", "F"];
  const pointNames = { PUNCH: "PUÑO", BODY: "CUERPO", HEAD: "CABEZA", TURN_BODY: "GIRO CUERPO", TURN_HEAD: "GIRO CABEZA" };
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

  function clockText(seconds, fractions = false) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}${fractions ? ".000" : ""}`;
  }

  function showToast(message, isError = false) {
    ui.toast.textContent = message;
    ui.toast.classList.toggle("toast--error", isError);
    ui.toast.classList.add("toast--show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => ui.toast.classList.remove("toast--show"), 2600);
  }

  function winnerByPoints() {
    if (state.blue.score > state.red.score) return "BLUE";
    if (state.red.score > state.blue.score) return "RED";
    if (state.blue.penalties < state.red.penalties) return "BLUE";
    if (state.red.penalties < state.blue.penalties) return "RED";
    return null;
  }

  function render() {
    const match = state.match;
    ui.blueName.textContent = match?.chongName || ui.chongInput.value || "CHONG";
    ui.redName.textContent = match?.hongName || ui.hongInput.value || "HONG";
    ui.blueScore.value = state.blue.score;
    ui.redScore.value = state.red.score;
    ui.bluePenalties.textContent = state.blue.penalties;
    ui.redPenalties.textContent = state.red.penalties;
    ui.matchId.textContent = match ? `${match.matchNumber} · ${match.id}` : "SIN CARGAR";
    ui.clock.textContent = clockText(state.seconds);
    ui.clock.classList.toggle("clock--running", state.running);
    ui.clock.classList.toggle("clock--finished", state.seconds === 0);
    ui.meter.style.transform = `scaleX(${Math.max(0, Math.min(1, state.seconds / 120))})`;
    ui.round.textContent = state.round;
    ui.roundLabel.textContent = state.roundLabel;
    const winnerCorner = state.winner === "BLUE" ? "CHONG" : "HONG";
    const winnerName = state.winner === "BLUE" ? match?.chongName : match?.hongName;
    ui.clockState.textContent = state.finished ? `FINALIZADO · ${winnerCorner}` : state.running ? "LIVE" : state.seconds === 0 ? "TIMEOUT" : match ? "READY" : "SIN COMBATE";
    ui.clockStateLight.parentElement.classList.toggle("clock-state--live", state.running);
    ui.clockStateLight.parentElement.classList.toggle("clock-state--finished", state.seconds === 0);
    ui.clockPacket.textContent = state.eventCount ? `${state.eventCount} EVENTOS` : "SIN PAQUETES";
    ui.start.disabled = !match || state.running || state.busy || state.finished || state.seconds === 0;
    ui.pause.disabled = !match || !state.running || state.busy || state.finished;
    ui.reset.disabled = !match || state.busy || state.finished;
    ui.finish.disabled = !match || state.busy || state.finished;
    ui.finish.textContent = state.finished ? "COMBATE FINALIZADO" : "FINALIZAR COMBATE";
    ui.roundPrev.disabled = !match || state.busy || state.finished || state.round <= 1;
    ui.roundNext.disabled = !match || state.busy || state.finished || state.round >= state.maxRounds;
    ui.load.disabled = state.busy;
    ui.refreshOvr.disabled = state.busy;
    ui.loadOvr.disabled = state.busy || !ui.ovrMatch.value;
    document.querySelectorAll("[data-side], .score-actions button").forEach((button) => {
      if (button.matches("[data-points], .score-minus, .penalty-button")) button.disabled = !match || state.busy || state.finished || (button.classList.contains("score-minus") && state[button.dataset.side].score <= 0) || (button.classList.contains("penalty-button") && state[button.dataset.side].penalties >= 5);
    });
    ui.winnerBanner.hidden = !state.finished;
    ui.winnerBanner.classList.toggle("winner-banner--blue", state.winner === "BLUE");
    ui.winnerBanner.classList.toggle("winner-banner--red", state.winner === "RED");
    ui.winnerName.textContent = winnerName || winnerCorner;
    ui.winnerScore.textContent = `${state.blue.score}–${state.red.score} puntos · Gam-jeom ${state.blue.penalties}–${state.red.penalties}`;

    const live = state.live;
    ui.liveEvent.textContent = live?.lastEventType || "--";
    ui.liveMatch.textContent = live?.matchId || "--";
    ui.liveScore.textContent = live ? `${live.chongScore ?? 0} – ${live.hongScore ?? 0}` : "--";
    ui.liveClock.textContent = live && Number.isFinite(Number(live.secondsLeft)) ? clockText(Number(live.secondsLeft)) : "--";
    ui.liveStatus.textContent = live?.status || "--";
    ui.liveClock.classList.toggle("live-clock--stale", Boolean(match && live?.matchId === match.id && live.secondsLeft !== state.seconds));
  }

  async function api(path, options = {}) {
    const response = await fetch(path, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  function setMessage(text, type = "") {
    ui.message.textContent = text;
    ui.message.className = `action-message${type ? ` action-message--${type}` : ""}`;
  }

  function addLog(name, detail, okay = true) {
    const empty = ui.eventList.querySelector(".feed-empty");
    if (empty) empty.remove();
    const item = document.createElement("li");
    const label = document.createElement("span");
    const time = document.createElement("span");
    label.textContent = okay ? name : `${name} · ERROR`;
    time.textContent = detail || new Date().toLocaleTimeString("es-ES", { hour12: false });
    item.append(label, time);
    ui.eventList.prepend(item);
    while (ui.eventList.children.length > 18) ui.eventList.lastElementChild.remove();
    state.eventCount += 1;
    ui.feedCount.textContent = String(state.eventCount);
  }

  const cfgHttp = document.querySelector("#cfg-http");
  const cfgUdp = document.querySelector("#cfg-udp");
  let cfgLoaded = false;
  async function saveConfig() {
    await api("/api/config", { method: "POST", body: JSON.stringify({ httpPort: cfgHttp.value, udpPort: cfgUdp.value }) });
    setMessage(`Puertos aplicados: HTTP ${cfgHttp.value} / UDP ${cfgUdp.value}`, "ok");
    refreshStatus();
  }
  cfgHttp.addEventListener("change", () => saveConfig().catch((e) => setMessage(e.message, "error")));
  cfgUdp.addEventListener("change", () => saveConfig().catch((e) => setMessage(e.message, "error")));

  async function refreshStatus() {
    try {
      const result = await api(`/api/status?mat=${encodeURIComponent(ui.matInput.value)}`);
      if (!cfgLoaded && result.config) {
        cfgHttp.value = result.config.httpPort;
        cfgUdp.value = result.config.udpPort;
        cfgLoaded = true;
      }
      ui.bridgeLight.parentElement.classList.toggle("connection--up", result.bridge?.ok === true);
      ui.bridgeLight.parentElement.classList.toggle("connection--down", result.bridge?.ok !== true);
      ui.bridgeState.textContent = result.bridge?.ok ? `Bridge ${result.bridge.httpPort}/UDP ${result.bridge.udpPort}` : "Bridge desconectado";
      state.bridgeConnected = result.bridge?.ok === true;
      ui.vercelLight.parentElement.classList.toggle("connection--up", Boolean(result.live?.data));
      ui.vercelLight.parentElement.classList.toggle("connection--down", !result.live?.data);
      ui.vercelState.textContent = result.live?.data ? "Marcador Vercel conectado" : "Marcador sin estado";
      state.live = result.live?.data || null;
      render();
    } catch (error) {
      ui.bridgeLight.parentElement.classList.add("connection--down");
      ui.bridgeState.textContent = "Bridge sin respuesta";
      state.bridgeConnected = false;
      ui.vercelLight.parentElement.classList.add("connection--down");
      ui.vercelState.textContent = "Vercel sin respuesta";
      setMessage(error.message, "error");
    }
  }

  async function emit(eventType, extra = {}) {
    if (!state.match) throw new Error("Carga un combate antes de enviar eventos.");
    const packet = {
      eventType,
      matchNumber: state.match.matchNumber,
      matchVMInternalId: state.match.id,
      matchCategoryName: state.match.category,
      matchCategoryGender: "MALE",
      matchSubCategoryName: "SENIORS",
      roundNumber: state.round,
      roundTimestampStr: clockText(state.seconds, true),
      bluePoints: state.blue.score,
      redPoints: state.red.score,
      bluePenalties: state.blue.penalties,
      redPenalties: state.red.penalties,
      ...extra,
    };
    const result = await api("/api/udp", { method: "POST", body: JSON.stringify(packet) });
    addLog(eventType, `${clockText(state.seconds)} · ${state.blue.score}-${state.red.score}`, true);
    ui.clockPacket.textContent = `${state.eventCount} EVENTOS`;
    setMessage(result.sent ? "UDP enviado al bridge; estado remoto en actualización." : "No se confirmó el envío UDP.", result.sent ? "ok" : "error");
    return result;
  }

  function getLiveWinner(live) {
    if (live?.winner === "CHONG" || live?.winner === "HONG") return live.winner;
    const chongScore = Number(live?.chongScore) || 0;
    const hongScore = Number(live?.hongScore) || 0;
    if (chongScore > hongScore) return "CHONG";
    if (hongScore > chongScore) return "HONG";
    const chongGamJeom = Number(live?.chongGamJeom) || 0;
    const hongGamJeom = Number(live?.hongGamJeom) || 0;
    if (chongGamJeom < hongGamJeom) return "CHONG";
    if (hongGamJeom < chongGamJeom) return "HONG";
    return null;
  }

  async function waitForRemoteFinish(expectedWinner, previousEventAt) {
    const deadline = Date.now() + 9000;
    while (Date.now() < deadline) {
      try {
        const result = await api("/api/status", { signal: AbortSignal.timeout(4000) });
        const live = result.live?.data;
        const eventChanged = !previousEventAt || live?.lastEventAt !== previousEventAt;
        const scoresMatch = Number(live?.chongScore) === state.blue.score && Number(live?.hongScore) === state.red.score;
        const penaltiesMatch = Number(live?.chongGamJeom) === state.blue.penalties && Number(live?.hongGamJeom) === state.red.penalties;
        if (live?.matchId === state.match.id && live.status === "FINISHED" && eventChanged && scoresMatch && penaltiesMatch && getLiveWinner(live) === expectedWinner) {
          state.live = live;
          return true;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return false;
  }

  async function withBusy(action) {
    if (state.busy) return;
    state.busy = true;
    render();
    try {
      await action();
    } catch (error) {
      setMessage(error.message, "error");
      showToast(error.message, true);
      addLog("ENVÍO", error.message, false);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function loadMatch() {
    await withBusy(async () => {
      clearTimeout(state.timer);
      state.running = false;
      state.clockDeadline = 0;
      const payload = {
        chongName: ui.chongInput.value.trim() || "CHONG",
        hongName: ui.hongInput.value.trim() || "HONG",
        matchNumber: ui.matchInput.value.trim() || "101",
        mat: ui.matInput.value,
      };
      const result = await api("/api/load-match", { method: "POST", body: JSON.stringify(payload) });
      state.match = result.match;
      state.blue = { score: 0, penalties: 0 };
      state.red = { score: 0, penalties: 0 };
      state.finished = false;
      state.winner = null;
      state.round = 1;
      state.seconds = 120;
      state.roundLabel = result.match.phase;
      state.live = result.live || state.live;
      setMessage(`Combate ${result.match.matchNumber} cargado por OVR.`, "ok");
      showToast("OVR: combate cargado y enviado al marcador.");
      addLog("MATCH_LOADED", `${result.match.matchNumber} · ${result.match.chongName} / ${result.match.hongName}`);
    });
  }

  async function refreshOvrMatches() {
    await withBusy(async () => {
      const selectedId = ui.ovrMatch.value;
      const mat = encodeURIComponent(ui.matInput.value);
      const result = await api(`/api/ovr-matches?mat=${mat}`);
      state.ovrMatches = result.matches || [];
      ui.ovrMatch.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = state.ovrMatches.length ? "Selecciona un combate de OVR" : "No hay combates disponibles en OVR";
      ui.ovrMatch.append(placeholder);
      for (const match of state.ovrMatches) {
        const option = document.createElement("option");
        option.value = match.id;
        option.textContent = `${match.number} · ${match.chongName} vs ${match.hongName} · ${match.phase}`;
        ui.ovrMatch.append(option);
      }
      if (state.ovrMatches.some((match) => match.id === selectedId)) ui.ovrMatch.value = selectedId;
      else if (state.ovrMatches.length) ui.ovrMatch.value = state.ovrMatches[0].id;
      ui.loadOvr.disabled = !ui.ovrMatch.value;
      setMessage(`${state.ovrMatches.length} combate(s) recibido(s) desde OVR.`, "ok");
      showToast(`${state.ovrMatches.length} combate(s) disponibles por OVR.`);
    });
  }

  async function loadOvrMatch() {
    await withBusy(async () => {
      const matchId = ui.ovrMatch.value;
      if (!matchId) throw new Error("Primero actualiza OVR y selecciona un combate.");
      clearTimeout(state.timer);
      state.running = false;
      state.clockDeadline = 0;
      const result = await api("/api/load-ovr-match", {
        method: "POST",
        body: JSON.stringify({ matchId, mat: ui.matInput.value }),
      });
      state.match = result.match;
      state.blue = { score: 0, penalties: 0 };
      state.red = { score: 0, penalties: 0 };
      state.finished = false;
      state.winner = null;
      state.round = 1;
      state.maxRounds = 3;
      state.seconds = 120;
      state.roundLabel = result.match.phase;
      state.live = result.live || state.live;
      setMessage(`Combate ${result.match.matchNumber} recibido de OVR y cargado.`, "ok");
      showToast("OVR MATCH_LOADED recibido por Vercel.");
      addLog("OVR MATCH_LOADED", `${result.match.matchNumber} · ${result.match.chongName} / ${result.match.hongName}`);
    });
  }

  function queueClockTick() {
    clearTimeout(state.timer);
    const nextBoundary = state.clockDeadline - Math.max(0, state.seconds - 1) * 1000;
    state.timer = setTimeout(() => {
      if (!state.running) return;
      state.seconds = Math.max(0, Math.ceil((state.clockDeadline - Date.now()) / 1000));
      render();
      withBusy(async () => {
        await emit("ROUNDCOUNTDOWN_CHANGE");
        if (state.seconds === 0) {
          state.running = false;
          state.clockDeadline = 0;
          await emit("TIMEOUT");
          showToast("Fin del tiempo de round.");
        } else {
          queueClockTick();
        }
      });
    }, Math.max(0, nextBoundary - Date.now()));
  }

  ui.load.addEventListener("click", loadMatch);
  ui.refreshOvr.addEventListener("click", refreshOvrMatches);
  ui.loadOvr.addEventListener("click", loadOvrMatch);
  ui.ovrMatch.addEventListener("change", render);
  ui.matInput.addEventListener("change", refreshOvrMatches);
  ui.start.addEventListener("click", () => withBusy(async () => {
    if (!state.match || state.seconds <= 0) return;
    state.clockDeadline = Date.now() + state.seconds * 1000;
    await emit("RESUME");
    state.running = true;
    setMessage("Reloj en marcha.", "ok");
    queueClockTick();
    render();
  }));
  ui.pause.addEventListener("click", () => withBusy(async () => {
    clearTimeout(state.timer);
    state.running = false;
    state.clockDeadline = 0;
    await emit("TIMEOUT");
    setMessage("Reloj pausado.", "ok");
    render();
  }));
  ui.reset.addEventListener("click", () => withBusy(async () => {
    clearTimeout(state.timer);
    state.running = false;
    state.clockDeadline = 0;
    state.seconds = 120;
    await emit("ROUND");
    setMessage("Reloj reiniciado a 2:00.", "ok");
    render();
  }));
  ui.roundPrev.addEventListener("click", () => withBusy(async () => {
    clearTimeout(state.timer);
    state.running = false;
    state.clockDeadline = 0;
    state.round = Math.max(1, state.round - 1);
    state.seconds = 120;
    await emit("ROUND");
    setMessage(`Ronda ${state.round} seleccionada.`, "ok");
    render();
  }));
  ui.roundNext.addEventListener("click", () => withBusy(async () => {
    clearTimeout(state.timer);
    state.running = false;
    state.clockDeadline = 0;
    state.round = Math.min(state.maxRounds, state.round + 1);
    state.seconds = 120;
    await emit("ROUND");
    setMessage(`Ronda ${state.round} iniciada.`, "ok");
    state.clockDeadline = Date.now() + state.seconds * 1000;
    await emit("RESUME");
    state.running = true;
    queueClockTick();
    render();
  }));
  ui.finish.addEventListener("click", () => withBusy(async () => {
    const winner = winnerByPoints();
    if (!winner) throw new Error("El marcador y los Gam-jeom están empatados; suma puntos o resuelve el combate antes de finalizar.");
    clearTimeout(state.timer);
    state.running = false;
    state.clockDeadline = 0;
    const previousEventAt = state.live?.lastEventAt;
    await emit("MATCH_FINISHED", { matchWinner: winner });
    state.finished = true;
    state.winner = winner;
    const winnerName = winner === "BLUE" ? state.match.chongName : state.match.hongName;
    setMessage(`Ganador: ${winnerName} (${state.blue.score}–${state.red.score}). Esperando confirmación web...`, "ok");
    render();
    const remoteConfirmed = await waitForRemoteFinish(winner === "BLUE" ? "CHONG" : "HONG", previousEventAt);
    setMessage(remoteConfirmed
      ? `Vercel confirmó el resultado. Ganador: ${winnerName} (${state.blue.score}–${state.red.score}).`
      : `Resultado local: ${winnerName} (${state.blue.score}–${state.red.score}). Vercel aún no confirmó la actualización.`, remoteConfirmed ? "ok" : "error");
    addLog(remoteConfirmed ? "RESULTADO WEB" : "RESULTADO PENDIENTE", winnerName, remoteConfirmed);
    showToast(`Ganador: ${winnerName}`);
    render();
  }));

  document.querySelectorAll(".score-actions button").forEach((button) => button.addEventListener("click", () => withBusy(async () => {
    const side = button.dataset.side;
    const points = Number(button.dataset.points);
    state[side].score += points;
    render();
    await emit(`OT_${side === "blue" ? "BLUE" : "RED"}_${button.dataset.kind}_HIT`, { eventAddPoints: true });
    showToast(`+${points} para ${side === "blue" ? "CHONG" : "HONG"}`);
  })));

  document.querySelectorAll(".score-minus").forEach((button) => button.addEventListener("click", () => withBusy(async () => {
    const side = button.dataset.side;
    if (state[side].score < 1) return;
    state[side].score -= 1;
    render();
    await emit("POINT", { eventRemovePoints: true });
    showToast(`−1 a ${side === "blue" ? "CHONG" : "HONG"}`);
  })));

  document.querySelectorAll(".penalty-button").forEach((button) => button.addEventListener("click", () => withBusy(async () => {
    const side = button.dataset.side;
    const opponent = side === "blue" ? "red" : "blue";
    state[side].penalties += 1;
    state[opponent].score += 1;
    render();
    await emit("GAMJEOM");
    showToast(`Gam-jeom a ${side === "blue" ? "CHONG" : "HONG"}; +1 al rival.`);
  })));

  [ui.chongInput, ui.hongInput].forEach((input) => input.addEventListener("input", render));
  setInterval(refreshStatus, 1200);
  await refreshStatus();
  await refreshOvrMatches();
  render();
})();
