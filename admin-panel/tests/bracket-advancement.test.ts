import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceWinnerInBracket, recordMatchFinished } from "../lib/bracket-advancement";
import { db } from "../lib/db";

const sourceMatch = {
  id: "source-101",
  tournamentId: "test-tournament",
  matchNumber: "101",
  athleteId: "ath-winner",
  athleteName: "Ganador Azul",
  opponentAthleteId: "ath-loser",
  opponentName: "Rival Rojo",
  corner: "CHONG",
  result: "WIN_POINTS",
  started: true,
  round1Score: { athlete: 8, opponent: 3 },
  round2Score: { athlete: 8, opponent: 3 },
} as any;

function addPendingNextRound() {
  const target = {
    id: "target-201",
    tournamentId: "test-tournament",
    matchNumber: "201",
    athleteId: "",
    athleteName: "Ganador combate 101",
    opponentAthleteId: "",
    opponentName: "Ganador combate 102",
    corner: "CHONG",
    sourceMatchNumbers: [101, 102],
    advancementSources: { athlete: 101, opponent: 102 },
    chongWtId: "PEND-101",
    hongWtId: "PEND-102",
    isPlaceholder: true,
    result: "WIN_POINTS",
    started: false,
  } as any;
  db.competitions.push(target);
  return target;
}

test("advances the points winner into the matching next-round slot", async () => {
  const initialLength = db.competitions.length;
  const target = addPendingNextRound();
  try {
    const result = await advanceWinnerInBracket(null, sourceMatch);
    const advanced = db.competitions.find((match) => match.id === target.id);

    assert.equal(result.matches.length, 1);
    assert.equal(advanced?.athleteId, "ath-winner");
    assert.equal(advanced?.athleteName, "Ganador Azul");
    assert.equal(advanced?.chongWtId, "ath-winner");
    assert.equal(advanced?.opponentAthleteId, "");
    assert.equal(advanced?.isPlaceholder, true);
  } finally {
    db.competitions.splice(initialLength);
  }
});

test("does not advance a generated 0-0 bout that has not started", async () => {
  const initialLength = db.competitions.length;
  addPendingNextRound();
  try {
    const unplayed = { ...sourceMatch, started: false, round1Score: { athlete: 0, opponent: 0 }, round2Score: { athlete: 0, opponent: 0 } };
    const result = await advanceWinnerInBracket(null, unplayed);

    assert.equal(result.matches.length, 0);
    assert.equal(db.competitions[initialLength].athleteId, "");
  } finally {
    db.competitions.splice(initialLength);
  }
});

test("reports when a finished live match has no persisted competition record", async () => {
  const result = await recordMatchFinished(null, {
    matchId: "unpersisted-live-match",
    chongScore: 0,
    hongScore: 2,
    winnerCorner: "HONG",
  });

  assert.equal(result.updatedMatch, null);
  assert.match(result.error || "", /no hay bracket que avanzar/);
});