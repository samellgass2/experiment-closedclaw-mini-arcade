import {
  CLICKER_STATUS,
  createClickerState,
  startClickerGame,
  pauseClickerGame,
  resumeClickerGame,
  tickClickerGame,
  registerClick,
  getClickerSnapshot,
  finishClickerGame
} from "./clicker/logic.js";

function queryRequiredElement(id) {
  const node = document.getElementById(id);

  if (!node) {
    throw new Error(`Missing required DOM node: ${id}`);
  }

  return node;
}

function createUIBindings() {
  return {
    canvas: queryRequiredElement("gameCanvas"),
    overlay: queryRequiredElement("overlay"),
    overlayTitle: queryRequiredElement("overlayTitle"),
    overlayMessage: queryRequiredElement("overlayMessage"),
    startButton: queryRequiredElement("startButton"),
    scoreValue: queryRequiredElement("scoreValue"),
    bestScoreValue: queryRequiredElement("bestScoreValue"),
    livesValue: queryRequiredElement("livesValue"),
    levelValue: queryRequiredElement("levelValue"),
    timeValue: queryRequiredElement("timeValue"),
    statusValue: queryRequiredElement("statusValue"),
    eventFeedValue: queryRequiredElement("eventFeedValue"),
    selectedCellLabel: queryRequiredElement("selectedCellLabel"),
    selectedTemperatureValue: queryRequiredElement("selectedTemperatureValue"),
    selectedLatencyValue: queryRequiredElement("selectedLatencyValue"),
    selectedErrorRateValue: queryRequiredElement("selectedErrorRateValue"),
    deviationTemperatureValue: queryRequiredElement("deviationTemperatureValue"),
    deviationLatencyValue: queryRequiredElement("deviationLatencyValue"),
    deviationErrorRateValue: queryRequiredElement("deviationErrorRateValue"),
    selectionVerdictValue: queryRequiredElement("selectionVerdictValue")
  };
}

function formatCountdown(remainingMs) {
  const safeRemaining = Math.max(0, remainingMs);
  const wholeSeconds = Math.floor(safeRemaining / 1000);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  const tenths = Math.floor((safeRemaining % 1000) / 100);

  if (minutes > 0) {
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${seconds}.${tenths}s`;
}

function renderOverlay(ui, title, message, actionLabel) {
  ui.overlayTitle.textContent = title;
  ui.overlayMessage.textContent = message;
  ui.startButton.textContent = actionLabel;
  ui.overlay.classList.add("visible");
}

function hideOverlay(ui) {
  ui.overlay.classList.remove("visible");
}

function updateReadoutCards(ui, snapshot, clickResult = null) {
  ui.selectedCellLabel.textContent = `Total clicks: ${snapshot.totalClicks}`;
  ui.selectedTemperatureValue.textContent = String(snapshot.score);
  ui.selectedLatencyValue.textContent = String(snapshot.comboStreak);
  ui.selectedErrorRateValue.textContent = String(snapshot.highestCombo);

  ui.deviationTemperatureValue.textContent = clickResult ? `+${clickResult.pointsAwarded}` : "--";
  ui.deviationLatencyValue.textContent = `Clicks: ${snapshot.totalClicks}`;
  ui.deviationErrorRateValue.textContent = `Best combo: ${snapshot.highestCombo}`;

  if (!clickResult) {
    ui.selectionVerdictValue.textContent = "Awaiting click";
    ui.selectionVerdictValue.classList.remove("is-correct", "is-wrong");
    ui.selectionVerdictValue.classList.add("is-pending");
    return;
  }

  if (clickResult.accepted) {
    ui.selectionVerdictValue.textContent = `Click accepted (+${clickResult.pointsAwarded})`;
    ui.selectionVerdictValue.classList.remove("is-pending", "is-wrong");
    ui.selectionVerdictValue.classList.add("is-correct");
    return;
  }

  ui.selectionVerdictValue.textContent = "Click ignored (game not running)";
  ui.selectionVerdictValue.classList.remove("is-pending", "is-correct");
  ui.selectionVerdictValue.classList.add("is-wrong");
}

function updateHUD(ui, state, clickResult = null) {
  const snapshot = getClickerSnapshot(state);

  ui.scoreValue.textContent = String(snapshot.score);
  ui.bestScoreValue.textContent = String(snapshot.bestScore);
  ui.livesValue.textContent = String(snapshot.totalClicks);
  ui.levelValue.textContent = String(snapshot.highestCombo);
  ui.timeValue.textContent = formatCountdown(snapshot.remainingMs);
  ui.statusValue.textContent = state.status;

  if (state.status === CLICKER_STATUS.READY) {
    ui.eventFeedValue.textContent = "Ready. Start the round or click the board to auto-start.";
  } else if (state.status === CLICKER_STATUS.RUNNING) {
    ui.eventFeedValue.textContent = `Keep clicking. Combo streak: ${snapshot.comboStreak}.`;
  } else if (state.status === CLICKER_STATUS.PAUSED) {
    ui.eventFeedValue.textContent = "Paused. Press P or Start to resume.";
  } else {
    ui.eventFeedValue.textContent = `Round complete (${snapshot.finalReason ?? "finished"}). Final score: ${snapshot.score}.`;
  }

  updateReadoutCards(ui, snapshot, clickResult);
}

function drawClickTarget(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.14;
  for (let i = 0; i < 8; i += 1) {
    const radius = 16 + i * 14;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 42px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("CLICK", width / 2, height / 2 - 10);
  ctx.font = "500 18px system-ui";
  ctx.fillText("Tap anywhere in this board", width / 2, height / 2 + 24);
}

const ui = createUIBindings();
const state = createClickerState({
  roundDurationMs: 30000,
  pointsPerClick: 1,
  comboWindowMs: 750,
  comboBonusCap: 5,
  autoStartOnClick: true,
  bestScoreStorageKey: "mini-arcade-clicker-best"
});

let animationFrame = 0;
let hasShownRoundCompleteOverlay = false;

function beginRound(now) {
  startClickerGame(state, now);
  hasShownRoundCompleteOverlay = false;
  hideOverlay(ui);
  updateHUD(ui, state);
}

function endRound(now, reason) {
  if (hasShownRoundCompleteOverlay) {
    updateHUD(ui, state);
    return;
  }

  if (state.status !== CLICKER_STATUS.OVER) {
    finishClickerGame(state, now, reason);
  }

  hasShownRoundCompleteOverlay = true;
  updateHUD(ui, state);
  renderOverlay(
    ui,
    "Round Complete",
    `Final score ${state.score}. Best ${state.bestScore}. Click restart for another run.`,
    "Restart"
  );
}

function handleCanvasClick() {
  const now = performance.now();
  const clickResult = registerClick(state, now);
  updateHUD(ui, state, clickResult);

  if (state.status === CLICKER_STATUS.OVER) {
    endRound(now, state.finalReason ?? "time-expired");
  }
}

function handleStartButton() {
  if (state.status === CLICKER_STATUS.RUNNING) {
    return;
  }

  if (state.status === CLICKER_STATUS.PAUSED) {
    resumeClickerGame(state, performance.now());
    hasShownRoundCompleteOverlay = false;
    hideOverlay(ui);
    updateHUD(ui, state);
    return;
  }

  beginRound(performance.now());
}

function handleKeyDown(event) {
  if (event.code === "Enter") {
    event.preventDefault();
    handleStartButton();
    return;
  }

  if (event.code === "KeyP") {
    event.preventDefault();

    if (state.status === CLICKER_STATUS.RUNNING) {
      pauseClickerGame(state);
      updateHUD(ui, state);
      renderOverlay(ui, "Paused", "Press P or Start to continue.", "Resume");
      return;
    }

    if (state.status === CLICKER_STATUS.PAUSED) {
      resumeClickerGame(state, performance.now());
      hasShownRoundCompleteOverlay = false;
      hideOverlay(ui);
      updateHUD(ui, state);
    }

    return;
  }

  if (event.code === "KeyR") {
    event.preventDefault();
    endRound(performance.now(), "manual-stop");
  }
}

function gameLoop(now) {
  tickClickerGame(state, now);

  if (state.status === CLICKER_STATUS.OVER) {
    endRound(now, state.finalReason ?? "time-expired");
  } else {
    updateHUD(ui, state);
  }

  animationFrame = window.requestAnimationFrame(gameLoop);
}

function initialize() {
  ui.canvas.width = 640;
  ui.canvas.height = 640;
  drawClickTarget(ui.canvas);

  renderOverlay(
    ui,
    "Clicker Challenge",
    "Score as many points as possible before time expires. Each click increases score.",
    "Start Game"
  );

  updateHUD(ui, state);

  ui.canvas.addEventListener("pointerdown", handleCanvasClick);
  ui.startButton.addEventListener("click", handleStartButton);
  window.addEventListener("keydown", handleKeyDown);

  animationFrame = window.requestAnimationFrame(gameLoop);
}

window.addEventListener("beforeunload", () => {
  window.cancelAnimationFrame(animationFrame);
});

initialize();
