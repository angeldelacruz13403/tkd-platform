import { CompetitionMatch } from "./types";
import { db } from "./db";

export function mapCompetitionRow(row: any): CompetitionMatch {
  const metadata = row.match_metadata && typeof row.match_metadata === "object" ? row.match_metadata : {};
  const corner = metadata.corner === "HONG" || (!metadata.corner && String(row.system_type || "").endsWith(":HONG")) ? "HONG" : "CHONG";
  const athleteIsChong = corner === "CHONG";
  const winner = row.winner;
  const readRound = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    try {
      const parsed = JSON.parse(value);
      if (Number.isFinite(parsed?.athlete) && Number.isFinite(parsed?.opponent)) return parsed;
      if (Number.isFinite(parsed?.chong) && Number.isFinite(parsed?.hong)) {
        return athleteIsChong
          ? { athlete: parsed.chong, opponent: parsed.hong }
          : { athlete: parsed.hong, opponent: parsed.chong };
      }
    } catch {}
    return undefined;
  };
  const result = metadata.result || (winner === "PENDING" || !winner
    ? "WIN_POINTS"
    : (winner === corner ? "WIN_POINTS" : "LOSS_POINTS"));

  return {
    ...metadata,
    id: row.id,
    tournamentName: row.competition_name || metadata.tournamentName || "",
    tournamentId: row.tournament_id || metadata.tournamentId || null,
    isBye: Boolean(metadata.isBye || String(row.system_type || "").includes(":BYE")),
    isPlaceholder: Boolean(metadata.isPlaceholder || String(row.system_type || "").includes(":PENDING")),
    round: Number(metadata.round) || 0,
    tatamiNumber: Number(metadata.tatamiNumber) || 1,
    sourceMatchNumbers: Array.isArray(metadata.sourceMatchNumbers) ? metadata.sourceMatchNumbers.map(Number) : [],
    matchNumber: String(row.match_number || metadata.matchNumber || ""),
    phase: row.phase || metadata.phase || "PRELIMINARY",
    weightDivision: metadata.weightDivision || row.category || "",
    chongWtId: metadata.chongWtId || "",
    hongWtId: metadata.hongWtId || "",
    started: Boolean(row.started),
    lastUpdatedAt: row.last_updated_at || row.date,
    date: row.date,
    category: row.category || "SENIOR_M_68",
    athleteId: (athleteIsChong ? row.chong_athlete_id : row.hong_athlete_id) || "",
    athleteName: (athleteIsChong ? row.chong_name : row.hong_athlete_name) || "Por determinar",
    opponentAthleteId: (athleteIsChong ? row.hong_athlete_id : row.chong_athlete_id) || "",
    opponentName: (athleteIsChong ? row.hong_athlete_name : row.chong_name) || "Por determinar",
    opponentCountryClub: metadata.opponentCountryClub || row.hong_country || "",
    corner,
    round1Score: metadata.round1Score || readRound(row.round1_result) || { athlete: 0, opponent: 0 },
    round2Score: metadata.round2Score || readRound(row.round2_result) || { athlete: 0, opponent: 0 },
    round3Score: metadata.round3Score || readRound(row.round3_result),
    result,
    gamJeomsReceived: Number(metadata.gamJeomsReceived) || 0,
    pointsByTechnique: metadata.pointsByTechnique || {
      headKicks: Number(row.head_kicks) || 0,
      spinningHead: Number(row.spinning_head) || 0,
      bodyKicks: Number(row.body_kicks) || 0,
      spinningBody: Number(row.spinning_body) || 0,
      punches: Number(row.punches) || 0,
    },
    staminaDropInRound3: Boolean(row.stamina_drop_round3),
  } as CompetitionMatch;
}

export function toCompetitionRow(match: any, tournamentId: string | null) {
  const corner = match.corner === "HONG" ? "HONG" : "CHONG";
  const athleteIsChong = corner === "CHONG";
  const result = String(match.result || "WIN_POINTS");
  const loss = result.startsWith("LOSS");
  const winner = match.isPlaceholder || result === "PENDING" ? "PENDING" : loss ? (corner === "CHONG" ? "HONG" : "CHONG") : corner;
  const points = match.pointsByTechnique || {};
  return {
    id: match.id,
    competition_name: match.tournamentName || "",
    tournament_id: tournamentId,
    date: match.date || new Date().toISOString(),
    category: match.category || match.weightDivision || "SENIOR_M_68",
    chong_athlete_id: athleteIsChong ? match.athleteId || null : match.opponentAthleteId || null,
    chong_name: (athleteIsChong ? match.athleteName : match.opponentName) || "Por determinar",
    hong_athlete_id: athleteIsChong ? match.opponentAthleteId || null : match.athleteId || null,
    hong_athlete_name: (athleteIsChong ? match.opponentName : match.athleteName) || "Por determinar",
    hong_country: (match.opponentCountryClub || "").slice(0, 10),
    chong_score: Number(match.chongScore) || 0,
    hong_score: Number(match.hongScore) || 0,
    chong_gamjeom: Number(match.chongGamJeom) || 0,
    hong_gamjeom: Number(match.hongGamJeom) || 0,
    winner,
    head_kicks: Number(points.headKicks) || 0,
    spinning_head: Number(points.spinningHead) || 0,
    body_kicks: Number(points.bodyKicks) || 0,
    spinning_body: Number(points.spinningBody) || 0,
    punches: Number(points.punches) || 0,
    stamina_drop_round3: Boolean(match.staminaDropInRound3),
    match_number: String(match.matchNumber || ""),
    phase: match.phase || "PRELIMINARY",
    system_type: match.isPlaceholder ? "TKD_GLOBAL_HUB:PENDING"
      : match.isBye ? "TKD_GLOBAL_HUB:BYE"
      : `${String(match.systemType || "TKD_GLOBAL_HUB").slice(0, 30)}:${corner}`,
    round1_result: JSON.stringify({ chong: athleteIsChong ? match.round1Score?.athlete || 0 : match.round1Score?.opponent || 0, hong: athleteIsChong ? match.round1Score?.opponent || 0 : match.round1Score?.athlete || 0 }),
    round2_result: JSON.stringify({ chong: athleteIsChong ? match.round2Score?.athlete || 0 : match.round2Score?.opponent || 0, hong: athleteIsChong ? match.round2Score?.opponent || 0 : match.round2Score?.athlete || 0 }),
    round3_result: match.round3Score ? JSON.stringify({ chong: athleteIsChong ? match.round3Score.athlete || 0 : match.round3Score.opponent || 0, hong: athleteIsChong ? match.round3Score.opponent || 0 : match.round3Score.athlete || 0 }) : null,
    started: Boolean(match.started),
    last_updated_at: new Date().toISOString(),
    match_metadata: { ...match, corner, result },
  };
}

export function isMissingMetadataColumn(error: any) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * Automatically advances the winner of a match to the next bracket round.
 */
export async function advanceWinnerInBracket(client: any, sourceMatch: CompetitionMatch) {
  const sourceMatchNumber = Number(sourceMatch.matchNumber);
  const tournamentId = sourceMatch.tournamentId;
  const winnerIsAthlete = !String(sourceMatch.result).startsWith("LOSS");
  const winnerId = winnerIsAthlete ? sourceMatch.athleteId : sourceMatch.opponentAthleteId || "";
  const winnerName = winnerIsAthlete ? sourceMatch.athleteName : sourceMatch.opponentName;
  const hasReportedScore = [sourceMatch.round1Score, sourceMatch.round2Score, sourceMatch.round3Score]
    .some((score) => Number(score?.athlete) + Number(score?.opponent) > 0);
  const defaultUnplayedResult = sourceMatch.result === "WIN_POINTS" && !sourceMatch.started && !hasReportedScore;
  if (!tournamentId || !Number.isFinite(sourceMatchNumber) || !winnerId || String(sourceMatch.result) === "PENDING" || defaultUnplayedResult) {
    return { matches: [] as CompetitionMatch[], error: "" };
  }

  let targets: CompetitionMatch[];
  if (client) {
    const { data, error } = await client.from("competition_matches").select("*").eq("tournament_id", tournamentId);
    if (error) return { matches: [] as CompetitionMatch[], error: error.message };
    targets = (data || []).map(mapCompetitionRow);
  } else {
    targets = db.competitions.filter((match) => match.tournamentId === tournamentId);
  }

  const pendingToken = `PEND-${sourceMatchNumber}`;
  const advancedMatches: CompetitionMatch[] = [];
  for (const target of targets) {
    if (target.id === sourceMatch.id || target.started || !target.sourceMatchNumbers?.includes(sourceMatchNumber)) continue;
    const winnerSlot = target.advancementSources?.athlete === sourceMatchNumber ? "athlete"
      : target.advancementSources?.opponent === sourceMatchNumber ? "opponent"
      : target.chongWtId === pendingToken ? (target.corner === "CHONG" ? "athlete" : "opponent")
      : target.hongWtId === pendingToken ? (target.corner === "HONG" ? "athlete" : "opponent")
      : null;
    if (!winnerSlot) continue;

    const winnerIsTargetAthlete = winnerSlot === "athlete";
    const fillsChong = target.chongWtId === pendingToken;
    const fillsHong = target.hongWtId === pendingToken;
    const chongWtId = fillsChong ? winnerId : target.chongWtId;
    const hongWtId = fillsHong ? winnerId : target.hongWtId;
    const advanced = {
      ...target,
      ...(winnerIsTargetAthlete
        ? { athleteId: winnerId, athleteName: winnerName }
        : { opponentAthleteId: winnerId, opponentName: winnerName }),
      chongWtId,
      hongWtId,
      advancementSources: {
        ...target.advancementSources,
        [winnerSlot]: undefined,
      },
      isPlaceholder: String(chongWtId || "").startsWith("PEND-") || String(hongWtId || "").startsWith("PEND-"),
      lastUpdatedAt: new Date().toISOString(),
    } as CompetitionMatch;

    let persisted = advanced;
    if (client) {
      const row = toCompetitionRow(advanced, tournamentId);
      let { data, error } = await client.from("competition_matches").upsert(row).select("*").single();
      if (error && isMissingMetadataColumn(error)) {
        const { match_metadata: _metadata, ...legacyRow } = row;
        const fallback = await client.from("competition_matches").upsert(legacyRow).select("*").single();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) return { matches: advancedMatches, error: error.message };
      persisted = mapCompetitionRow(data);
    }

    const targetIndex = db.competitions.findIndex((match) => match.id === persisted.id);
    if (targetIndex >= 0) db.competitions[targetIndex] = persisted;
    else db.competitions.unshift(persisted);
    advancedMatches.push(persisted);
    console.info(`[BRACKET ADVANCED] Ganador ${winnerName} (${winnerId}) del combate #${sourceMatchNumber} clasificado al combate #${persisted.matchNumber}`);
  }
  return { matches: advancedMatches, error: "" };
}

/**
 * Handles match completion by points or decision, updates match result, and advances the bracket.
 */
export async function recordMatchFinished(
  client: any,
  params: {
    matchId: string;
    tournamentName?: string;
    chongScore: number;
    hongScore: number;
    chongGamJeom?: number;
    hongGamJeom?: number;
    winnerCorner?: "CHONG" | "HONG";
    round?: number;
  }
): Promise<{ updatedMatch: CompetitionMatch | null; advancedMatches: CompetitionMatch[]; error?: string }> {
  const { matchId, chongScore, hongScore, chongGamJeom = 0, hongGamJeom = 0 } = params;
  if (!matchId) return { updatedMatch: null, advancedMatches: [] };

  let existingRow: any = null;
  if (client) {
    const { data: byId } = await client.from("competition_matches").select("*").eq("id", matchId).maybeSingle();
    if (byId) {
      existingRow = byId;
    } else {
      const { data: byNumber } = await client.from("competition_matches").select("*").eq("match_number", matchId).order("date", { ascending: false }).limit(1).maybeSingle();
      if (byNumber) {
        existingRow = byNumber;
      } else {
        const cleanNumber = String(matchId).match(/(\d+)$/)?.[1];
        if (cleanNumber) {
          let byCleanQuery = client.from("competition_matches").select("*").eq("match_number", cleanNumber);
          if (params.tournamentName) byCleanQuery = byCleanQuery.eq("competition_name", params.tournamentName);
          const { data: byClean } = await byCleanQuery.order("date", { ascending: false }).limit(1).maybeSingle();
          if (byClean) existingRow = byClean;
        }
      }
    }
  }

  let sourceMatch: CompetitionMatch | null = existingRow ? mapCompetitionRow(existingRow) : null;
  if (!sourceMatch) {
    const memMatch = db.competitions.find((m) => m.id === matchId || String(m.matchNumber) === matchId || (String(m.matchNumber) === String(matchId).match(/\d+/)?.[0]));
    if (memMatch) sourceMatch = memMatch;
  }

  if (!sourceMatch) {
    const error = `No existe un registro persistido para el combate ${matchId}; el marcador en vivo se actualizó, pero no hay bracket que avanzar.`;
    console.warn(`[MATCH FINISHED] ${error}`);
    return { updatedMatch: null, advancedMatches: [], error };
  }

  // Determine winner corner
  let winnerCorner = params.winnerCorner;
  if (!winnerCorner) {
    if (chongScore > hongScore) winnerCorner = "CHONG";
    else if (hongScore > chongScore) winnerCorner = "HONG";
    else if (chongGamJeom < hongGamJeom) winnerCorner = "CHONG";
    else if (hongGamJeom < chongGamJeom) winnerCorner = "HONG";
    else winnerCorner = "CHONG";
  }

  const athleteIsChong = sourceMatch.corner === "CHONG";
  const winnerIsAthlete = winnerCorner === "CHONG" ? athleteIsChong : !athleteIsChong;
  const result = winnerIsAthlete ? "WIN_POINTS" : "LOSS_POINTS";

  const updatedMatch: CompetitionMatch = {
    ...sourceMatch,
    started: true,
    result,
    round1Score: {
      athlete: athleteIsChong ? chongScore : hongScore,
      opponent: athleteIsChong ? hongScore : chongScore,
    },
    round2Score: {
      athlete: athleteIsChong ? chongScore : hongScore,
      opponent: athleteIsChong ? hongScore : chongScore,
    },
    round3Score: {
      athlete: athleteIsChong ? chongScore : hongScore,
      opponent: athleteIsChong ? hongScore : chongScore,
    },
    gamJeomsReceived: athleteIsChong ? chongGamJeom : hongGamJeom,
    lastUpdatedAt: new Date().toISOString(),
  };

  let persistedMatch = updatedMatch;
  if (client) {
    const tournamentId = sourceMatch.tournamentId || (existingRow as any)?.tournament_id || null;
    const row = toCompetitionRow(updatedMatch, tournamentId);
    let { data, error } = await client.from("competition_matches").upsert(row).select("*").single();
    if (error && isMissingMetadataColumn(error)) {
      const { match_metadata: _metadata, ...legacyRow } = row;
      const fallback = await client.from("competition_matches").upsert(legacyRow).select("*").single();
      data = fallback.data;
      error = fallback.error;
    }
    if (error) {
      console.error(`[MATCH FINISH PERSIST ERROR] ${error.message}`);
      return { updatedMatch: null, advancedMatches: [], error: error.message };
    }
    persistedMatch = mapCompetitionRow(data);
  }

  const memIdx = db.competitions.findIndex((m) => m.id === persistedMatch.id);
  if (memIdx >= 0) db.competitions[memIdx] = persistedMatch;
  else db.competitions.unshift(persistedMatch);

  console.info(`[MATCH FINISHED] Combate #${persistedMatch.matchNumber} finalizado. Vencedor: ${winnerCorner} (${result}). Chong: ${chongScore} - Hong: ${hongScore}`);

  // Automatically advance winner in bracket!
  const advancement = await advanceWinnerInBracket(client, persistedMatch);
  return { updatedMatch: persistedMatch, advancedMatches: advancement.matches, error: advancement.error };
}
