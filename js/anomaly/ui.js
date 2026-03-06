import { GAME_STATE, STATE_LABELS } from "./constants.js";

export function createUIBindings() {
  const canvas = document.getElementById("gameCanvas");
  const scoreValue = document.getElementById("scoreValue");
  const bestScoreValue = document.getElementById("bestScoreValue");
  const livesValue = document.getElementById("livesValue");
  const levelValue = document.getElementById("levelValue");
  const timeValue = document.getElementById("timeValue");
  const statusValue = document.getElementById("statusValue");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayMessage = document.getElementById("overlayMessage");
  const startButton = document.getElementById("startButton");

  if (!canvas || !scoreValue || !bestScoreValue || !livesValue || !levelValue || !timeValue || !statusValue || !overlay || !overlayTitle || !overlayMessage || !startButton) {
    throw new Error("Missing required DOM nodes for anomaly detector startup.");
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to initialize game canvas context.");
  }

  return {
    canvas,
    ctx,
    scoreValue,
    bestScoreValue,
    livesValue,
    levelValue,
    timeValue,
    statusValue,
    overlay,
    overlayTitle,
    overlayMessage,
    startButton
  };
}

export function updateHUD(ui, state) {
  ui.scoreValue.textContent = String(state.score);
  ui.bestScoreValue.textContent = String(state.bestScore);
  ui.livesValue.textContent = String(state.lives);
  ui.levelValue.textContent = String(state.level);
  ui.timeValue.textContent = String(state.remainingSeconds);

  ui.statusValue.textContent = STATE_LABELS[state.status] || state.status;
  ui.statusValue.classList.remove("is-loading", "is-ready", "is-running", "is-paused", "is-over");
  ui.statusValue.classList.add(`is-${state.status}`);

  if (state.remainingSeconds <= 5 && state.status === GAME_STATE.RUNNING) {
    ui.timeValue.style.color = "var(--warning)";
  } else {
    ui.timeValue.style.color = "";
  }
}

export function showOverlay(ui, title, message, actionLabel) {
  ui.overlayTitle.textContent = title;
  ui.overlayMessage.textContent = message;
  ui.startButton.textContent = actionLabel;
  ui.overlay.classList.add("visible");
}

export function hideOverlay(ui) {
  ui.overlay.classList.remove("visible");
}
