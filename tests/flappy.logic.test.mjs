import assert from "node:assert/strict";

import {
  FLAPPY_STATUS,
  createFlappyState,
  flapBird,
  resetFlappyState,
  startFlappyGame,
  stepFlappyGame
} from "../js/flappy/logic.js";

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

function testFlapStartsGameAndAppliesImpulse() {
  const state = createFlappyState();
  assert.equal(state.status, FLAPPY_STATUS.READY);

  flapBird(state);
  assert.equal(state.status, FLAPPY_STATUS.RUNNING);
  assert.equal(state.bird.velocityY, state.config.jumpVelocity);
}

function testScoringWhenPipePassed() {
  const storage = createMemoryStorage();
  const state = createFlappyState({}, { storage });
  startFlappyGame(state);

  state.pipes.push({
    x: state.bird.x - state.config.pipeWidth - state.bird.radius - 2,
    width: state.config.pipeWidth,
    gapY: state.bird.y,
    gapHeight: state.config.canvasHeight,
    scored: false
  });

  stepFlappyGame(state, 16);

  assert.equal(state.score, 1);
  assert.equal(state.bestScore, 1);
  assert.equal(storage.getItem(state.config.bestScoreStorageKey), "1");
}

function testPipeCollisionEndsGame() {
  const state = createFlappyState();
  startFlappyGame(state);

  state.pipes.push({
    x: state.bird.x - state.bird.radius,
    width: state.config.pipeWidth,
    gapY: state.bird.y + state.config.pipeGapHeight,
    gapHeight: state.config.pipeGapHeight,
    scored: false
  });

  stepFlappyGame(state, 16);

  assert.equal(state.status, FLAPPY_STATUS.OVER);
  assert.equal(state.finalReason, "pipe-hit");
}

function testResetClearsRunState() {
  const state = createFlappyState();
  startFlappyGame(state);
  state.score = 4;
  state.pipes.push({
    x: 90,
    width: state.config.pipeWidth,
    gapY: 120,
    gapHeight: 80,
    scored: false
  });

  resetFlappyState(state);

  assert.equal(state.status, FLAPPY_STATUS.READY);
  assert.equal(state.score, 0);
  assert.equal(state.pipes.length, 0);
  assert.equal(state.finalReason, null);
}

function run() {
  testFlapStartsGameAndAppliesImpulse();
  testScoringWhenPipePassed();
  testPipeCollisionEndsGame();
  testResetClearsRunState();
  console.log("flappy.logic.test: ok");
}

run();
