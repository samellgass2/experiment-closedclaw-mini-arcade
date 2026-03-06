import assert from "node:assert/strict";

import { BASE_CONFIG } from "../js/anomaly/constants.js";
import {
  createGameState,
  resetRunState,
  applyCorrectSelection,
  applyWrongSelection,
  applyRoundTimeout
} from "../js/anomaly/state.js";
import { createGridLayout } from "../js/anomaly/components/grid.js";
import { generateRoundGrid } from "../js/anomaly/components/anomalyGenerator.js";
import { evaluateSelectedCell } from "../js/anomaly/components/anomalyEvaluator.js";

globalThis.window = {
  localStorage: {
    store: new Map(),
    getItem(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    setItem(key, value) {
      this.store.set(key, String(value));
    }
  }
};

function testStateScoringAndLifeTracking() {
  const state = createGameState();
  resetRunState(state);

  applyCorrectSelection(state);
  assert.equal(state.score, BASE_CONFIG.scorePerCorrect);
  assert.equal(state.debug.currentStreak, 1);
  assert.equal(state.debug.correctSelections, 1);

  applyCorrectSelection(state);
  applyCorrectSelection(state);
  applyCorrectSelection(state);
  assert.equal(state.debug.roundsPlayed, 4);
  assert.equal(state.level, 2);

  const beforeWrong = state.remainingSeconds;
  applyWrongSelection(state);
  assert.equal(state.lives, BASE_CONFIG.startingLives - 1);
  assert.equal(state.remainingSeconds, Math.max(0, beforeWrong - BASE_CONFIG.timerPenaltyOnMiss));
  assert.equal(state.debug.wrongSelections, 1);
  assert.equal(state.debug.currentStreak, 0);

  applyRoundTimeout(state);
  assert.equal(state.lives, BASE_CONFIG.startingLives - 2);
  assert.equal(state.debug.timeoutCount, 1);
  assert.equal(state.remainingSeconds, BASE_CONFIG.roundDurationSeconds);
}

function testRoundGenerationAndEvaluation() {
  const layout = createGridLayout(
    BASE_CONFIG.rows,
    BASE_CONFIG.cols,
    BASE_CONFIG.canvasSize,
    BASE_CONFIG.canvasSize,
    BASE_CONFIG.tileGap
  );

  for (let i = 0; i < 100; i += 1) {
    const grid = generateRoundGrid(
      {
        level: 1 + (i % 5),
        score: i * BASE_CONFIG.scorePerCorrect,
        rows: BASE_CONFIG.rows,
        cols: BASE_CONFIG.cols,
        variantStrength: Math.max(4, BASE_CONFIG.anomalyHueOffset - Math.floor(i / 5))
      },
      layout,
      BASE_CONFIG
    );

    assert.ok(grid.anomalyCellId, "round should include anomaly cell id");
    assert.equal(grid.cells.length, layout.cells.length);

    const selected = evaluateSelectedCell(grid, grid.anomalyCellId, BASE_CONFIG.dataset);
    assert.equal(selected.isAnomaly, true, "anomaly cell should evaluate as anomaly");

    const normalCell = grid.cells.find((cell) => cell.id !== grid.anomalyCellId);
    assert.ok(normalCell, "should find at least one non-anomaly cell");
    const normalEval = evaluateSelectedCell(grid, normalCell.id, BASE_CONFIG.dataset);
    assert.equal(normalEval.isAnomaly, false, "normal cell should not evaluate as anomaly");
  }
}

function run() {
  testStateScoringAndLifeTracking();
  testRoundGenerationAndEvaluation();
  console.log("anomaly.logic.test: ok");
}

run();
