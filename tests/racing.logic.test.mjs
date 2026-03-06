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
  assert.equal(Number.isFinite(state.car.progressAngle), true);
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
  assert.equal(state.car.x > state.track.centerX, true, "car should move right from top spawn");

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

function testTrackProgressAndLapCompletion() {
  const storage = createMemoryStorage();
  const state = createRacingState({ lapTarget: 1, minLapMs: 1200 }, { storage });

  startRace(state, 0);
  setInputState(state, { throttle: true });

  for (let step = 1; step <= 250; step += 1) {
    tickRace(state, step * 32);
    if (state.status === RACING_STATUS.OVER) {
      break;
    }
  }

  assert.equal(state.completedLaps >= 1, true, "car should complete a lap while moving forward");
  assert.equal(state.status, RACING_STATUS.OVER, "race should finish when lap target is reached");
  assert.equal(state.finishReason, "lap-target-reached");
  assert.equal(state.bestLapMs > 0, true);
  assert.equal(storage.map.has(state.config.bestLapStorageKey), true);
}

function testSteeringMovesLaneOffset() {
  const state = createRacingState();

  startRace(state, 0);
  setInputState(state, { throttle: true, steerRight: true });

  for (let step = 1; step <= 30; step += 1) {
    tickRace(state, step * 32);
  }

  assert.equal(state.car.laneOffset > 0, true);

  setInputState(state, { steerRight: false, steerLeft: true });
  for (let step = 31; step <= 60; step += 1) {
    tickRace(state, step * 32);
  }

  assert.equal(state.car.laneOffset < 0.5, true);
}

function testLapTimeTrackingUpdatesInRealTime() {
  const state = createRacingState({ lapTarget: 2, minLapMs: 900 });

  startRace(state, 0);
  setInputState(state, { throttle: true });

  tickRace(state, 32);
  assert.equal(state.elapsedMs > 0, true, "elapsed race timer should advance every tick");
  assert.equal(state.currentLapMs > 0, true, "current lap timer should advance every tick");

  for (let step = 2; step <= 260 && state.completedLaps < 1; step += 1) {
    tickRace(state, step * 32);
  }

  assert.equal(state.completedLaps, 1, "first lap should eventually complete");
  assert.equal(state.lapTimesMs.length, 1, "lap time history should include completed lap");
  assert.equal(state.lastLapMs, state.lapTimesMs[0], "lastLapMs should mirror newest completed lap");

  const firstLapMs = state.lastLapMs;
  tickRace(state, 261 * 32);
  assert.equal(state.currentLapMs > 0, true, "new lap timer should restart and continue running");
  assert.equal(state.lastLapMs, firstLapMs, "last lap should remain available while next lap is in progress");
}

function testFinishAndSnapshot() {
  const storage = createMemoryStorage();
  const state = createRacingState({}, { storage });

  startRace(state, 0);
  finishRace(state, 2000, "manual-stop");

  const snapshot = getRacingSnapshot(state);
  assert.equal(snapshot.status, RACING_STATUS.OVER);
  assert.equal(snapshot.finishReason, "manual-stop");
  assert.equal(snapshot.lastLapMs, null);
  assert.equal(snapshot.lapTimesMs.length, 0);
  assert.equal(Number.isFinite(snapshot.car.angularVelocity), true);
}

function run() {
  testInitialState();
  testStartTickAndPauseResume();
  testTrackProgressAndLapCompletion();
  testSteeringMovesLaneOffset();
  testLapTimeTrackingUpdatesInRealTime();
  testFinishAndSnapshot();
  console.log("racing.logic.test: ok");
}

run();
