import assert from "node:assert/strict";

import {
  COLOR_MATCH_STATUS,
  createColorMatchState,
  startColorMatchGame,
  startNextRound,
  setChannelValue,
  adjustChannelValue,
  submitRound,
  finishColorMatchGame,
  getColorMatchSnapshot,
  calculateAccuracyPercent,
  calculateRoundScore,
  calculateRoundScoreDetails
} from "../js/color-match/logic.js";

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

function testInputTrackingAndClamping() {
  const state = createColorMatchState(
    {
      roundsPerGame: 2,
      startingGuess: { red: 100, green: 100, blue: 100 }
    },
    { random: () => 0.25 }
  );

  startColorMatchGame(state, {
    nowMs: 500,
    targetColor: { red: 120, green: 130, blue: 140 }
  });

  assert.equal(state.status, COLOR_MATCH_STATUS.RUNNING);
  assert.equal(state.currentRound.index, 1);

  let result = setChannelValue(state, "red", 260, 550);
  assert.equal(result.accepted, true);
  assert.equal(state.currentRound.guessColor.red, 255, "set value should clamp to channel max");
  assert.equal(state.currentRound.totalAdjustments, 1);

  result = adjustChannelValue(state, "g", -500, 650);
  assert.equal(result.accepted, true);
  assert.equal(state.currentRound.guessColor.green, 0, "delta should clamp to channel min");
  assert.equal(state.currentRound.totalAdjustments, 2);

  result = setChannelValue(state, "blue", 145, 700);
  assert.equal(result.accepted, true);
  assert.equal(state.currentRound.guessColor.blue, 145);
  assert.equal(state.currentRound.totalAdjustments, 3);

  assert.equal(state.inputSummary.totalAdjustments, 3);
  assert.equal(state.inputSummary.redAdjustments, 1);
  assert.equal(state.inputSummary.greenAdjustments, 1);
  assert.equal(state.inputSummary.blueAdjustments, 1);
}

function testScoreAccuracyOrdering() {
  const config = {
    maxPointsPerRound: 1000,
    nearMatchThreshold: 95,
    nearMatchBonus: 50,
    exactMatchBonus: 150
  };

  const target = { red: 140, green: 90, blue: 210 };
  const exactGuess = { red: 140, green: 90, blue: 210 };
  const nearGuess = { red: 138, green: 95, blue: 214 };
  const weakGuess = { red: 30, green: 220, blue: 40 };

  const exactAccuracy = calculateAccuracyPercent(target, exactGuess, 255);
  const nearAccuracy = calculateAccuracyPercent(target, nearGuess, 255);
  const weakAccuracy = calculateAccuracyPercent(target, weakGuess, 255);

  const exactScore = calculateRoundScore(exactAccuracy, config);
  const nearScore = calculateRoundScore(nearAccuracy, config);
  const weakScore = calculateRoundScore(weakAccuracy, config);
  const fastFewAdjustments = calculateRoundScoreDetails(exactAccuracy, config, {
    totalAdjustments: 0,
    durationMs: 1200
  });
  const slowManyAdjustments = calculateRoundScoreDetails(exactAccuracy, config, {
    totalAdjustments: 24,
    durationMs: 20000
  });

  assert.equal(exactAccuracy, 100);
  assert.equal(exactScore, 1150, "exact match should include exact bonus");
  assert.equal(nearAccuracy > weakAccuracy, true, "near guess should be more accurate than weak guess");
  assert.equal(nearScore > weakScore, true, "higher accuracy should award more points");
  assert.equal(
    fastFewAdjustments.points > slowManyAdjustments.points,
    true,
    "faster rounds with fewer adjustments should score higher"
  );
  assert.equal(
    fastFewAdjustments.breakdown.speedBonus > 0,
    true,
    "speed bonus should apply for quick rounds"
  );
  assert.equal(
    slowManyAdjustments.breakdown.adjustmentPenalty > 0,
    true,
    "adjustment penalty should apply for heavy input churn"
  );
}

function testRoundSubmissionProgressionAndBestScore() {
  const storage = createMemoryStorage();
  const state = createColorMatchState(
    {
      roundsPerGame: 2,
      startingGuess: { red: 0, green: 0, blue: 0 },
      bestScoreStorageKey: "color-match-test-best"
    },
    { storage, random: () => 0.5 }
  );

  startColorMatchGame(state, {
    nowMs: 1000,
    targetColor: { red: 0, green: 0, blue: 0 }
  });
  const firstRound = submitRound(state, 1200);
  assert.equal(firstRound.accepted, true);
  assert.equal(
    firstRound.pointsAwarded,
    1279,
    "perfect, fast, zero-adjustment rounds should include performance bonuses"
  );
  assert.equal(firstRound.feedback.headline, "Perfect match");
  assert.equal(firstRound.accuracyBand, "exact");
  assert.equal(state.status, COLOR_MATCH_STATUS.ROUND_COMPLETE);
  assert.equal(state.roundsPlayed, 1);

  startNextRound(state, {
    nowMs: 1300,
    targetColor: { red: 255, green: 255, blue: 255 }
  });
  setChannelValue(state, "red", 255, 1310);
  setChannelValue(state, "green", 0, 1320);
  setChannelValue(state, "blue", 0, 1330);
  adjustChannelValue(state, "green", 10, 1332);
  adjustChannelValue(state, "green", -10, 1334);
  adjustChannelValue(state, "blue", 10, 1336);
  adjustChannelValue(state, "blue", -10, 1338);
  adjustChannelValue(state, "red", -5, 1340);
  adjustChannelValue(state, "red", 5, 1342);
  const secondRound = submitRound(state, 1400);

  assert.equal(secondRound.accepted, true);
  assert.equal(secondRound.scoreBreakdown.adjustmentPenalty > 0, true);
  assert.equal(state.status, COLOR_MATCH_STATUS.OVER, "state should end after configured round count");
  assert.equal(state.finalReason, "completed");
  assert.equal(storage.getItem("color-match-test-best"), String(state.score), "best score should persist at game end");
}

function testRejectionWhenRoundNotRunning() {
  const state = createColorMatchState({ roundsPerGame: 1 });
  assert.equal(setChannelValue(state, "red", 10).accepted, false);
  assert.equal(adjustChannelValue(state, "green", 10).accepted, false);
  assert.equal(submitRound(state).accepted, false);

  startColorMatchGame(state, { targetColor: { red: 128, green: 128, blue: 128 } });
  submitRound(state, 100);
  assert.equal(setChannelValue(state, "red", 20).accepted, false, "inputs should be rejected after completion");
  assert.equal(state.status, COLOR_MATCH_STATUS.OVER);
}

function testSnapshotShape() {
  const state = createColorMatchState({ roundsPerGame: 1 });
  startColorMatchGame(state, { targetColor: { red: 10, green: 20, blue: 30 } });
  setChannelValue(state, "r", 11, 10);
  const snapshot = getColorMatchSnapshot(state);

  assert.equal(snapshot.status, COLOR_MATCH_STATUS.RUNNING);
  assert.equal(snapshot.currentRound.index, 1);
  assert.equal(snapshot.currentRound.targetColor.red, 10);
  assert.equal(snapshot.currentRound.guessColor.red, 11);
  assert.equal(snapshot.currentRound.totalAdjustments, 1);
  assert.equal(snapshot.performanceSummary.averageAccuracy, 0);
  assert.equal(snapshot.latestRoundResult, null);

  finishColorMatchGame(state, 99, "manual-stop");
  const overSnapshot = getColorMatchSnapshot(state);
  assert.equal(overSnapshot.status, COLOR_MATCH_STATUS.OVER);
  assert.equal(overSnapshot.currentRound, null);
}

function testBestScoreLoadsFromStorageOnNewSession() {
  const storage = createMemoryStorage();
  const config = {
    roundsPerGame: 1,
    bestScoreStorageKey: "color-match-session-best"
  };

  const first = createColorMatchState(config, { storage });
  startColorMatchGame(first, {
    nowMs: 1000,
    targetColor: { red: 128, green: 128, blue: 128 }
  });
  submitRound(first, 1100);

  const second = createColorMatchState(config, { storage });
  assert.equal(second.bestScore, first.score, "best score should be restored on next session");
}

function run() {
  testInputTrackingAndClamping();
  testScoreAccuracyOrdering();
  testRoundSubmissionProgressionAndBestScore();
  testRejectionWhenRoundNotRunning();
  testSnapshotShape();
  testBestScoreLoadsFromStorageOnNewSession();
  console.log("color-match.logic.test: ok");
}

run();
