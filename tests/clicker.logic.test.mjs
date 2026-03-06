import assert from "node:assert/strict";

import {
  CLICKER_STATUS,
  createClickerState,
  startClickerGame,
  tickClickerGame,
  registerClick,
  pauseClickerGame,
  resumeClickerGame,
  finishClickerGame,
  resetClickerState,
  getClickerSnapshot
} from "../js/clicker/logic.js";

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

function testAutoStartAndScoreTracking() {
  const storage = createMemoryStorage();
  const state = createClickerState(
    {
      roundDurationMs: 5000,
      pointsPerClick: 2,
      comboWindowMs: 600,
      comboBonusCap: 3,
      autoStartOnClick: true,
      bestScoreStorageKey: "clicker-test-best"
    },
    { storage }
  );

  assert.equal(state.status, CLICKER_STATUS.READY);

  let result = registerClick(state, 1000);
  assert.equal(result.accepted, true);
  assert.equal(state.status, CLICKER_STATUS.RUNNING);
  assert.equal(state.totalClicks, 1);
  assert.equal(state.score, 2);

  result = registerClick(state, 1400);
  assert.equal(result.pointsAwarded, 3, "second click inside combo window gets bonus");
  assert.equal(state.score, 5);

  result = registerClick(state, 1700);
  assert.equal(result.pointsAwarded, 4, "third click adds larger combo bonus");
  assert.equal(state.score, 9);
  assert.equal(state.highestCombo, 3);

  tickClickerGame(state, 6500);
  assert.equal(state.status, CLICKER_STATUS.OVER);
  assert.equal(state.bestScore, 9);
  assert.equal(storage.getItem("clicker-test-best"), "9");
}

function testPauseResumeAndRejectedClicks() {
  const state = createClickerState({
    roundDurationMs: 4000,
    pointsPerClick: 1,
    comboBonusCap: 0,
    autoStartOnClick: false
  });

  const rejected = registerClick(state, 1000);
  assert.equal(rejected.accepted, false, "click should be rejected before start when auto-start disabled");

  startClickerGame(state, 1200);
  registerClick(state, 1400);
  assert.equal(state.score, 1);

  pauseClickerGame(state);
  assert.equal(state.status, CLICKER_STATUS.PAUSED);
  const pausedClick = registerClick(state, 1700);
  assert.equal(pausedClick.accepted, false, "click should be rejected while paused");

  resumeClickerGame(state, 1900);
  assert.equal(state.status, CLICKER_STATUS.RUNNING);
  registerClick(state, 2200);
  assert.equal(state.score, 2);

  finishClickerGame(state, 2600, "manual-stop");
  assert.equal(state.status, CLICKER_STATUS.OVER);
  assert.equal(state.finalReason, "manual-stop");

  const overClick = registerClick(state, 2800);
  assert.equal(overClick.accepted, false, "click should be rejected once game is over");
}

function testResetAndSnapshot() {
  const state = createClickerState({
    roundDurationMs: 10000,
    pointsPerClick: 5
  });

  startClickerGame(state, 0);
  registerClick(state, 50);
  registerClick(state, 80);

  const snapshot = getClickerSnapshot(state);
  assert.equal(snapshot.status, CLICKER_STATUS.RUNNING);
  assert.equal(snapshot.totalClicks, 2);
  assert.equal(snapshot.score >= 10, true);

  finishClickerGame(state, 1000, "manual-stop");
  resetClickerState(state);
  assert.equal(state.status, CLICKER_STATUS.READY);
  assert.equal(state.score, 0);
  assert.equal(state.totalClicks, 0);
  assert.equal(state.remainingMs, 10000);
}

function testCountdownTicksToZeroAndStopsGame() {
  const state = createClickerState({
    roundDurationMs: 3000,
    autoStartOnClick: false
  });

  startClickerGame(state, 100);
  assert.equal(state.status, CLICKER_STATUS.RUNNING);
  assert.equal(state.remainingMs, 3000);

  tickClickerGame(state, 600);
  assert.equal(state.remainingMs, 2500, "countdown should subtract elapsed tick time");
  assert.equal(state.status, CLICKER_STATUS.RUNNING);

  tickClickerGame(state, 2600);
  assert.equal(state.remainingMs, 500);
  assert.equal(state.status, CLICKER_STATUS.RUNNING);

  tickClickerGame(state, 3100);
  assert.equal(state.remainingMs, 0, "countdown should floor at zero");
  assert.equal(state.status, CLICKER_STATUS.OVER, "game should end when countdown reaches zero");
  assert.equal(state.finalReason, "time-expired");

  const rejectedAfterTimeout = registerClick(state, 3200);
  assert.equal(rejectedAfterTimeout.accepted, false, "clicks should be rejected after timeout");
  assert.equal(state.score, 0);
}

function testPausePreservesCountdownUntilResume() {
  const state = createClickerState({
    roundDurationMs: 5000,
    autoStartOnClick: false
  });

  startClickerGame(state, 0);
  tickClickerGame(state, 1000);
  assert.equal(state.remainingMs, 4000);

  pauseClickerGame(state);
  tickClickerGame(state, 3000);
  assert.equal(state.remainingMs, 4000, "countdown should not tick while paused");

  resumeClickerGame(state, 3500);
  tickClickerGame(state, 4500);
  assert.equal(state.remainingMs, 3000, "countdown should continue after resume from new tick baseline");
}

function run() {
  testAutoStartAndScoreTracking();
  testPauseResumeAndRejectedClicks();
  testResetAndSnapshot();
  testCountdownTicksToZeroAndStopsGame();
  testPausePreservesCountdownUntilResume();
  console.log("clicker.logic.test: ok");
}

run();
