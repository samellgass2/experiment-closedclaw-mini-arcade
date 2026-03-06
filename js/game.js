import { BASE_CONFIG, GAME_STATE } from "./anomaly/constants.js";
import {
  createGameState,
  resetRunState,
  applyCorrectSelection,
  applyWrongSelection,
  applyRoundTimeout,
  updateBestScore
} from "./anomaly/state.js";
import { createGridLayout, locateCellAt } from "./anomaly/components/grid.js";
import { generateRoundGrid } from "./anomaly/components/anomalyGenerator.js";
import { evaluateSelectedCell } from "./anomaly/components/anomalyEvaluator.js";
import { createTimer, startTimer, pauseTimer, tickTimer } from "./anomaly/components/timer.js";
import { createUIBindings, updateHUD, showOverlay, hideOverlay } from "./anomaly/ui.js";
import { renderGameFrame } from "./anomaly/renderer.js";

const ui = createUIBindings();
const state = createGameState();
const timer = createTimer();

let animationFrame = 0;

const layout = createGridLayout(
  BASE_CONFIG.rows,
  BASE_CONFIG.cols,
  BASE_CONFIG.canvasSize,
  BASE_CONFIG.canvasSize,
  BASE_CONFIG.tileGap
);

function createRound() {
  state.selectedCellId = null;
  state.activeGrid = generateRoundGrid(state.currentRound, layout, BASE_CONFIG);
  state.roundEvent = `Round ${state.debug.roundsPlayed + 1}: find the record that deviates from baseline.`;
  updateHUD(ui, state);
}

function setStatus(nextStatus) {
  state.status = nextStatus;
  updateHUD(ui, state);
}

function startNewRun() {
  resetRunState(state);
  createRound();
  setStatus(GAME_STATE.RUNNING);
  hideOverlay(ui);
  startTimer(timer, performance.now());
}

function pauseToggle() {
  if (state.status === GAME_STATE.RUNNING) {
    setStatus(GAME_STATE.PAUSED);
    state.roundEvent = "Run paused. Resume to continue searching for the anomaly.";
    pauseTimer(timer);
    updateHUD(ui, state);
    showOverlay(ui, "Paused", "Press P to resume or R to restart.", "Resume");
    return;
  }

  if (state.status === GAME_STATE.PAUSED) {
    setStatus(GAME_STATE.RUNNING);
    state.roundEvent = "Run resumed. Locate the anomalous dataset record.";
    updateHUD(ui, state);
    hideOverlay(ui);
    startTimer(timer, performance.now());
  }
}

function endRun() {
  pauseTimer(timer);
  setStatus(GAME_STATE.OVER);
  updateBestScore(state);
  state.roundEvent = `Run complete. Final score ${state.score}, best score ${state.bestScore}.`;
  updateHUD(ui, state);

  showOverlay(
    ui,
    "Run Complete",
    `Final score: ${state.score}. Press restart to play again.`,
    "Restart"
  );
}

function applyRoundSuccess() {
  applyCorrectSelection(state);
  createRound();
}

function applyRoundFailure() {
  applyWrongSelection(state);

  if (state.lives <= 0) {
    endRun();
  }

  updateHUD(ui, state);
}

function handleTimeout() {
  applyRoundTimeout(state);

  if (state.lives <= 0) {
    endRun();
    return;
  }

  createRound();
}

function processSelection(pointerX, pointerY) {
  if (state.status !== GAME_STATE.RUNNING || !state.activeGrid) {
    return;
  }

  const selectedCell = locateCellAt(layout, pointerX, pointerY);
  if (!selectedCell) {
    return;
  }

  state.selectedCellId = selectedCell.id;

  const evaluation = evaluateSelectedCell(state.activeGrid, selectedCell.id, BASE_CONFIG.dataset);
  const selectedRecord = state.activeGrid.recordsByCellId[selectedCell.id];
  state.lastSelection = {
    cellId: selectedCell.id,
    row: selectedCell.row,
    col: selectedCell.col,
    record: selectedRecord,
    profile: evaluation.profile,
    isAnomaly: evaluation.isAnomaly
  };

  if (evaluation.isAnomaly) {
    applyRoundSuccess();
    return;
  }

  applyRoundFailure();
}

function onCanvasPointerDown(event) {
  const rect = ui.canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * ui.canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * ui.canvas.height;

  processSelection(x, y);
}

function onStartButton() {
  if (state.status === GAME_STATE.PAUSED) {
    pauseToggle();
    return;
  }

  startNewRun();
}

function onKeyDown(event) {
  if (event.code === "Enter") {
    event.preventDefault();

    if (state.status === GAME_STATE.PAUSED) {
      pauseToggle();
      return;
    }

    if (state.status !== GAME_STATE.RUNNING) {
      startNewRun();
    }

    return;
  }

  if (event.code === "KeyP") {
    event.preventDefault();
    pauseToggle();
    return;
  }

  if (event.code === "KeyR") {
    event.preventDefault();
    startNewRun();
  }
}

function tick(now) {
  tickTimer(timer, now, () => {
    state.remainingSeconds -= 1;

    if (state.remainingSeconds <= 0) {
      handleTimeout();
      return;
    }

    updateHUD(ui, state);
  });

  renderGameFrame(ui.ctx, ui.canvas, state);
  animationFrame = window.requestAnimationFrame(tick);
}

function initialize() {
  ui.canvas.width = BASE_CONFIG.canvasSize;
  ui.canvas.height = BASE_CONFIG.canvasSize;

  createRound();
  setStatus(GAME_STATE.READY);
  showOverlay(
    ui,
    "Anomaly Detector",
    "Click start and find the outlier record each round. Wrong picks cost lives and time.",
    "Start Game"
  );
  state.roundEvent = "Ready. Press Start Game to begin anomaly detection.";
  updateHUD(ui, state);

  ui.canvas.addEventListener("pointerdown", onCanvasPointerDown);
  ui.startButton.addEventListener("click", onStartButton);
  window.addEventListener("keydown", onKeyDown);

  animationFrame = window.requestAnimationFrame(tick);
}

window.addEventListener("beforeunload", () => {
  window.cancelAnimationFrame(animationFrame);
});

initialize();
