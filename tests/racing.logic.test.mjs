import assert from "node:assert/strict";

import {
  RACING_STATUS,
  createRacingState,
  startRace,
  tickRace,
  setInputState,
  pauseRace,
  resumeRace,
  finishRace,
  getRacingSnapshot
} from "../js/racing/logic.js";

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

function testInitialState() {
  const state = createRacingState();

  assert.equal(state.status, RACING_STATUS.READY);
  assert.equal(state.completedLaps, 0);
  assert.equal(state.car.speed, 0);
  assert.equal(state.eventMessage, "Press Start Race to begin.");
  assert.equal(Number.isFinite(state.track.centerX), true);
}

function testStartTickAndPauseResume() {
  const state = createRacingState();

  startRace(state, 1000);
  assert.equal(state.status, RACING_STATUS.RUNNING);

  setInputState(state, { throttle: true });
  tickRace(state, 1040);
  tickRace(state, 1080);
  assert.equal(state.elapsedMs > 0, true);
  assert.equal(state.car.speed > 0, true);

  const pauseResult = pauseRace(state);
  assert.equal(pauseResult.accepted, true);
  assert.equal(state.status, RACING_STATUS.PAUSED);

  const speedAtPause = state.car.speed;
  tickRace(state, 1200);
  assert.equal(state.car.speed, speedAtPause, "tick should not update while paused");

  const resumeResult = resumeRace(state, 1300);
  assert.equal(resumeResult.accepted, true);
  assert.equal(state.status, RACING_STATUS.RUNNING);
}

function testFinishAndSnapshot() {
  const storage = createMemoryStorage();
  const state = createRacingState({}, { storage });

  startRace(state, 0);
  finishRace(state, 2000, "manual-stop");

  const snapshot = getRacingSnapshot(state);
  assert.equal(snapshot.status, RACING_STATUS.OVER);
  assert.equal(snapshot.finishReason, "manual-stop");
  assert.equal(snapshot.lapTimesMs.length, 0);
}

function run() {
  testInitialState();
  testStartTickAndPauseResume();
  testFinishAndSnapshot();
  console.log("racing.logic.test: ok");
}

run();
