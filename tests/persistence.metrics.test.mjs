import assert from "node:assert/strict";

import {
  getGlobalHighScores,
  getRecentPlays,
  getTotalAttempts
} from "../js/persistence.js";

function createMemoryStorage() {
  return {
    map: new Map(),
    getItem(key) {
      return this.map.has(key) ? this.map.get(key) : null;
    },
    setItem(key, value) {
      this.map.set(key, String(value));
    }
  };
}

function testEmptyStorageReturnsSensibleDefaults() {
  const storage = createMemoryStorage();

  assert.deepEqual(getGlobalHighScores({ storage }), { perGame: [], overall: null });
  assert.deepEqual(getRecentPlays(5, { storage }), []);
  assert.equal(getTotalAttempts({ storage }), 0);
}

function testDerivesHighScoresFromScalarAndSummaryRecords() {
  const storage = createMemoryStorage();

  storage.setItem("anomaly-detector-best-score", "88");
  storage.setItem("clicker-best-score", "9");
  storage.setItem(
    "miniArcade.clicker.summary.v1",
    JSON.stringify({ bestScore: 34, attempts: 4, lastPlayedAt: "2026-03-10T01:02:03.000Z" })
  );

  const highScores = getGlobalHighScores({ storage });

  assert.deepEqual(highScores.perGame, [
    { gameId: "anomaly", gameName: "Anomaly Detector", highScore: 88 },
    { gameId: "clicker", gameName: "Combo Clicker", highScore: 34 }
  ]);
  assert.deepEqual(highScores.overall, {
    gameId: "anomaly",
    gameName: "Anomaly Detector",
    highScore: 88
  });
}

function testDerivesRecentPlaysAndAttemptsFromHistoryAndSummary() {
  const storage = createMemoryStorage();

  storage.setItem(
    "miniArcade.color-match.history.v1",
    JSON.stringify([
      { score: 19, playedAt: "2026-03-11T09:00:00.000Z" },
      { points: 12, completedAt: "2026-03-08T07:30:00.000Z" },
      { score: 7 }
    ])
  );
  storage.setItem(
    "miniArcade.clicker.summary.v1",
    JSON.stringify({ totalAttempts: 5, bestScore: 41, lastPlayedAt: "2026-03-12T10:00:00.000Z", lastScore: 16 })
  );

  const recent = getRecentPlays(2, { storage });

  assert.equal(recent.length, 2);
  assert.deepEqual(recent[0], {
    gameId: "clicker",
    gameName: "Combo Clicker",
    score: 41,
    playedAt: "2026-03-12T10:00:00.000Z"
  });
  assert.deepEqual(recent[1], {
    gameId: "color-match",
    gameName: "Color Match",
    score: 19,
    playedAt: "2026-03-11T09:00:00.000Z"
  });

  assert.equal(getTotalAttempts({ storage }), 7, "attempts should aggregate summary and history counts");
}

function testMalformedDataIsIgnoredSafely() {
  const storage = createMemoryStorage();
  storage.setItem("miniArcade.clicker.summary.v1", "{broken-json");
  storage.setItem("miniArcade.clicker.history.v1", JSON.stringify({ entries: "invalid" }));

  assert.deepEqual(getGlobalHighScores({ storage }), { perGame: [], overall: null });
  assert.deepEqual(getRecentPlays(3, { storage }), []);
  assert.equal(getTotalAttempts({ storage }), 0);
}

function run() {
  testEmptyStorageReturnsSensibleDefaults();
  testDerivesHighScoresFromScalarAndSummaryRecords();
  testDerivesRecentPlaysAndAttemptsFromHistoryAndSummary();
  testMalformedDataIsIgnoredSafely();
  console.log("persistence.metrics.test: ok");
}

run();
