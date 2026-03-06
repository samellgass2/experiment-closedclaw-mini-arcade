import {
  COLOR_MATCH_STATUS,
  createColorMatchState,
  startColorMatchGame,
  startNextRound,
  setChannelValue,
  adjustChannelValue,
  submitRound,
  getColorMatchSnapshot
} from "./color-match/logic.js";

function queryRequiredElement(id) {
  const node = document.getElementById(id);

  if (!node) {
    throw new Error(`Missing required DOM node: ${id}`);
  }

  return node;
}

function createUIBindings() {
  return {
    overlay: queryRequiredElement("overlay"),
    overlayTitle: queryRequiredElement("overlayTitle"),
    overlayMessage: queryRequiredElement("overlayMessage"),
    startButton: queryRequiredElement("startButton"),
    submitRoundButton: queryRequiredElement("submitRoundButton"),
    nextRoundButton: queryRequiredElement("nextRoundButton"),
    restartButton: queryRequiredElement("restartButton"),
    scoreValue: queryRequiredElement("scoreValue"),
    bestScoreValue: queryRequiredElement("bestScoreValue"),
    roundValue: queryRequiredElement("roundValue"),
    roundMetaValue: queryRequiredElement("roundMetaValue"),
    adjustmentsValue: queryRequiredElement("adjustmentsValue"),
    averageAccuracyValue: queryRequiredElement("averageAccuracyValue"),
    streakValue: queryRequiredElement("streakValue"),
    accuracyValue: queryRequiredElement("accuracyValue"),
    statusValue: queryRequiredElement("statusValue"),
    eventFeedValue: queryRequiredElement("eventFeedValue"),
    targetSwatch: queryRequiredElement("targetSwatch"),
    guessSwatch: queryRequiredElement("guessSwatch"),
    targetRgbValue: queryRequiredElement("targetRgbValue"),
    guessRgbValue: queryRequiredElement("guessRgbValue"),
    selectedCellLabel: queryRequiredElement("selectedCellLabel"),
    selectedTemperatureValue: queryRequiredElement("selectedTemperatureValue"),
    selectedLatencyValue: queryRequiredElement("selectedLatencyValue"),
    selectedErrorRateValue: queryRequiredElement("selectedErrorRateValue"),
    scoreBreakdownValue: queryRequiredElement("scoreBreakdownValue"),
    deviationTemperatureValue: queryRequiredElement("deviationTemperatureValue"),
    deviationLatencyValue: queryRequiredElement("deviationLatencyValue"),
    deviationErrorRateValue: queryRequiredElement("deviationErrorRateValue"),
    selectionVerdictValue: queryRequiredElement("selectionVerdictValue"),
    feedbackDetailValue: queryRequiredElement("feedbackDetailValue"),
    feedbackTagsValue: queryRequiredElement("feedbackTagsValue"),
    redRange: queryRequiredElement("redRange"),
    greenRange: queryRequiredElement("greenRange"),
    blueRange: queryRequiredElement("blueRange"),
    redInput: queryRequiredElement("redInput"),
    greenInput: queryRequiredElement("greenInput"),
    blueInput: queryRequiredElement("blueInput"),
    redDownButton: queryRequiredElement("redDownButton"),
    redUpButton: queryRequiredElement("redUpButton"),
    greenDownButton: queryRequiredElement("greenDownButton"),
    greenUpButton: queryRequiredElement("greenUpButton"),
    blueDownButton: queryRequiredElement("blueDownButton"),
    blueUpButton: queryRequiredElement("blueUpButton")
  };
}

function sanitizeColorValue(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(255, parsed));
}

function toRgbString(color) {
  return `RGB(${color.red}, ${color.green}, ${color.blue})`;
}

function toCssColor(color) {
  return `rgb(${color.red}, ${color.green}, ${color.blue})`;
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

function updateStatusClass(ui, status) {
  ui.statusValue.classList.remove("is-ready", "is-running", "is-round-complete", "is-over");

  if (status === COLOR_MATCH_STATUS.READY) {
    ui.statusValue.classList.add("is-ready");
  } else if (status === COLOR_MATCH_STATUS.RUNNING) {
    ui.statusValue.classList.add("is-running");
  } else if (status === COLOR_MATCH_STATUS.ROUND_COMPLETE) {
    ui.statusValue.classList.add("is-round-complete");
  } else {
    ui.statusValue.classList.add("is-over");
  }
}

function updateColorSwatches(ui, snapshot) {
  const currentRound = snapshot.currentRound;
  if (!currentRound) {
    ui.targetSwatch.style.background = "linear-gradient(135deg, #f0f0f0, #dbdbdb)";
    ui.guessSwatch.style.background = "linear-gradient(135deg, #f0f0f0, #dbdbdb)";
    ui.targetRgbValue.textContent = "RGB(--, --, --)";
    return;
  }

  ui.targetSwatch.style.background = toCssColor(currentRound.targetColor);
  ui.guessSwatch.style.background = toCssColor(currentRound.guessColor);
  ui.targetRgbValue.textContent = toRgbString(currentRound.targetColor);
  ui.guessRgbValue.textContent = toRgbString(currentRound.guessColor);
}

function updateInputsFromRound(ui, snapshot) {
  const currentRound = snapshot.currentRound;
  if (!currentRound) {
    return;
  }

  const values = {
    red: currentRound.guessColor.red,
    green: currentRound.guessColor.green,
    blue: currentRound.guessColor.blue
  };

  ui.redRange.value = String(values.red);
  ui.redInput.value = String(values.red);
  ui.greenRange.value = String(values.green);
  ui.greenInput.value = String(values.green);
  ui.blueRange.value = String(values.blue);
  ui.blueInput.value = String(values.blue);
}

function setControlsEnabled(ui, enabled) {
  const controls = [
    ui.submitRoundButton,
    ui.redRange,
    ui.greenRange,
    ui.blueRange,
    ui.redInput,
    ui.greenInput,
    ui.blueInput,
    ui.redDownButton,
    ui.redUpButton,
    ui.greenDownButton,
    ui.greenUpButton,
    ui.blueDownButton,
    ui.blueUpButton
  ];

  for (const control of controls) {
    control.disabled = !enabled;
  }
}

function summarizeScoreBreakdown(result) {
  if (!result?.scoreBreakdown) {
    return "--";
  }

  const {
    basePoints,
    accuracyBonus,
    adjustmentBonus,
    speedBonus,
    adjustmentPenalty
  } = result.scoreBreakdown;
  return `Base ${basePoints} + Bonus ${accuracyBonus + adjustmentBonus + speedBonus} - Penalty ${adjustmentPenalty}`;
}

function updateFeedback(ui, snapshot, lastSubmitResult) {
  ui.selectedErrorRateValue.textContent = String(snapshot.score);
  ui.deviationTemperatureValue.textContent = String(snapshot.inputSummary.totalAdjustments);
  ui.deviationLatencyValue.textContent = `${snapshot.inputSummary.redAdjustments} / ${snapshot.inputSummary.greenAdjustments} / ${snapshot.inputSummary.blueAdjustments}`;

  if (snapshot.currentRound) {
    ui.deviationErrorRateValue.textContent = toRgbString(snapshot.currentRound.guessColor);
  } else {
    ui.deviationErrorRateValue.textContent = "RGB(--, --, --)";
  }

  const latestResult = snapshot.latestRoundResult ?? lastSubmitResult;

  if (!latestResult) {
    ui.selectedCellLabel.textContent = "Submit a guess to score points.";
    ui.selectedTemperatureValue.textContent = "--";
    ui.selectedLatencyValue.textContent = "--";
    ui.scoreBreakdownValue.textContent = "--";
    ui.selectionVerdictValue.textContent = "Awaiting input";
    ui.selectionVerdictValue.classList.remove("is-correct", "is-wrong");
    ui.selectionVerdictValue.classList.add("is-pending");
    ui.feedbackDetailValue.textContent = "Submit a round to view scoring feedback.";
    ui.feedbackTagsValue.textContent = "Balanced round";
    return;
  }

  ui.selectedCellLabel.textContent = `Round ${latestResult.index ?? lastSubmitResult?.roundIndex ?? snapshot.roundsPlayed} submitted.`;
  ui.selectedTemperatureValue.textContent = `${latestResult.accuracyPercent.toFixed(2)}%`;
  ui.selectedLatencyValue.textContent = String(latestResult.pointsAwarded);
  ui.scoreBreakdownValue.textContent = summarizeScoreBreakdown(latestResult);
  ui.feedbackDetailValue.textContent = latestResult.feedback?.detail ?? "Review your adjustments and try again.";
  ui.feedbackTagsValue.textContent = latestResult.feedback?.tags?.join(" | ") ?? "Balanced round";

  if (latestResult.pointsAwarded > 0) {
    ui.selectionVerdictValue.textContent = latestResult.feedback?.headline
      ? `${latestResult.feedback.headline}: +${latestResult.pointsAwarded}`
      : `Scored +${latestResult.pointsAwarded}`;
    ui.selectionVerdictValue.classList.remove("is-pending", "is-wrong");
    ui.selectionVerdictValue.classList.add("is-correct");
  } else {
    ui.selectionVerdictValue.textContent = "Submit unavailable";
    ui.selectionVerdictValue.classList.remove("is-pending", "is-correct");
    ui.selectionVerdictValue.classList.add("is-wrong");
  }
}

function updateHUD(ui, state, lastSubmitResult = null) {
  const snapshot = getColorMatchSnapshot(state);
  const roundsTotal = state.config.roundsPerGame;
  const currentRoundIndex = snapshot.currentRound ? snapshot.currentRound.index : snapshot.roundsPlayed;

  ui.scoreValue.textContent = String(snapshot.score);
  ui.bestScoreValue.textContent = String(snapshot.bestScore);
  ui.roundValue.textContent = `${currentRoundIndex} / ${roundsTotal}`;
  ui.roundMetaValue.textContent = `Rounds remaining: ${snapshot.roundsRemaining}`;
  ui.adjustmentsValue.textContent = String(snapshot.inputSummary.totalAdjustments);
  ui.averageAccuracyValue.textContent = `${snapshot.performanceSummary.averageAccuracy.toFixed(1)}%`;
  ui.streakValue.textContent = `${snapshot.performanceSummary.currentNearStreak} (best ${snapshot.performanceSummary.bestNearStreak})`;
  ui.accuracyValue.textContent = lastSubmitResult
    ? `${lastSubmitResult.accuracyPercent.toFixed(1)}%`
    : snapshot.latestRoundResult
      ? `${snapshot.latestRoundResult.accuracyPercent.toFixed(1)}%`
      : "--";
  ui.statusValue.textContent = snapshot.status;

  updateStatusClass(ui, snapshot.status);
  updateColorSwatches(ui, snapshot);
  updateInputsFromRound(ui, snapshot);
  updateFeedback(ui, snapshot, lastSubmitResult);

  if (snapshot.status === COLOR_MATCH_STATUS.READY) {
    ui.eventFeedValue.textContent = "Ready. Press Start Game to begin.";
  } else if (snapshot.status === COLOR_MATCH_STATUS.RUNNING) {
    ui.eventFeedValue.textContent = "Adjust RGB controls, then submit your guess.";
  } else if (snapshot.status === COLOR_MATCH_STATUS.ROUND_COMPLETE) {
    const latest = snapshot.latestRoundResult;
    const headline = latest?.feedback?.headline ?? "Round complete";
    ui.eventFeedValue.textContent = `${headline}. Review your score breakdown and continue to the next round.`;
  } else {
    ui.eventFeedValue.textContent = `Game over (${snapshot.finalReason ?? "completed"}). Final score: ${snapshot.score}.`;
  }

  const roundRunning = snapshot.status === COLOR_MATCH_STATUS.RUNNING;
  const roundComplete = snapshot.status === COLOR_MATCH_STATUS.ROUND_COMPLETE;
  setControlsEnabled(ui, roundRunning);
  ui.nextRoundButton.disabled = !roundComplete;
}

const ui = createUIBindings();
const state = createColorMatchState({
  roundsPerGame: 5,
  bestScoreStorageKey: "mini-arcade-color-match-best"
});

let lastSubmitResult = null;

function beginGame() {
  startColorMatchGame(state, { nowMs: performance.now() });
  lastSubmitResult = null;
  hideOverlay(ui);
  updateHUD(ui, state, lastSubmitResult);
}

function handleStartButton() {
  if (state.status === COLOR_MATCH_STATUS.READY || state.status === COLOR_MATCH_STATUS.OVER) {
    beginGame();
    return;
  }

  if (state.status === COLOR_MATCH_STATUS.ROUND_COMPLETE) {
    startNextRound(state, { nowMs: performance.now() });
    lastSubmitResult = null;
    hideOverlay(ui);
    updateHUD(ui, state, lastSubmitResult);
  }
}

function applyChannelInput(channel, rawValue) {
  const safeValue = sanitizeColorValue(rawValue, 128);
  const result = setChannelValue(state, channel, safeValue, performance.now());
  if (!result.accepted) {
    return;
  }

  lastSubmitResult = null;
  updateHUD(ui, state, lastSubmitResult);
}

function applyChannelDelta(channel, delta) {
  const result = adjustChannelValue(state, channel, delta, performance.now());
  if (!result.accepted) {
    return;
  }

  lastSubmitResult = null;
  updateHUD(ui, state, lastSubmitResult);
}

function handleSubmitRound() {
  const roundIndex = state.currentRound ? state.currentRound.index : state.roundsPlayed;
  const submission = submitRound(state, performance.now());
  if (!submission.accepted) {
    updateHUD(ui, state, lastSubmitResult);
    return;
  }

  lastSubmitResult = {
    index: roundIndex,
    pointsAwarded: submission.pointsAwarded,
    accuracyPercent: submission.accuracyPercent,
    scoreBreakdown: submission.scoreBreakdown,
    feedback: submission.feedback
  };

  updateHUD(ui, state, lastSubmitResult);

  if (state.status === COLOR_MATCH_STATUS.ROUND_COMPLETE) {
    renderOverlay(
      ui,
      `Round ${roundIndex} Complete`,
      `Accuracy ${submission.accuracyPercent.toFixed(1)}%. Points +${submission.pointsAwarded}.`,
      "Start Next Round"
    );
    return;
  }

  if (state.status === COLOR_MATCH_STATUS.OVER) {
    renderOverlay(
      ui,
      "Game Complete",
      `Final score ${state.score}. Best score ${state.bestScore}.`,
      "Play Again"
    );
  }
}

function handleNextRound() {
  if (state.status !== COLOR_MATCH_STATUS.ROUND_COMPLETE) {
    return;
  }

  startNextRound(state, { nowMs: performance.now() });
  lastSubmitResult = null;
  hideOverlay(ui);
  updateHUD(ui, state, lastSubmitResult);
}

function handleRestartGame() {
  beginGame();
}

function handleKeyDown(event) {
  if (event.code === "Enter") {
    event.preventDefault();

    if (state.status === COLOR_MATCH_STATUS.RUNNING) {
      handleSubmitRound();
    } else if (state.status === COLOR_MATCH_STATUS.ROUND_COMPLETE) {
      handleNextRound();
    } else {
      handleStartButton();
    }

    return;
  }

  if (state.status !== COLOR_MATCH_STATUS.RUNNING) {
    return;
  }

  if (event.code === "KeyR") {
    event.preventDefault();
    applyChannelDelta("red", 5);
  } else if (event.code === "KeyF") {
    event.preventDefault();
    applyChannelDelta("red", -5);
  } else if (event.code === "KeyG") {
    event.preventDefault();
    applyChannelDelta("green", 5);
  } else if (event.code === "KeyH") {
    event.preventDefault();
    applyChannelDelta("green", -5);
  } else if (event.code === "KeyB") {
    event.preventDefault();
    applyChannelDelta("blue", 5);
  } else if (event.code === "KeyN") {
    event.preventDefault();
    applyChannelDelta("blue", -5);
  }
}

function bindChannelInputs() {
  ui.redRange.addEventListener("input", (event) => applyChannelInput("red", event.target.value));
  ui.greenRange.addEventListener("input", (event) => applyChannelInput("green", event.target.value));
  ui.blueRange.addEventListener("input", (event) => applyChannelInput("blue", event.target.value));

  ui.redInput.addEventListener("change", (event) => applyChannelInput("red", event.target.value));
  ui.greenInput.addEventListener("change", (event) => applyChannelInput("green", event.target.value));
  ui.blueInput.addEventListener("change", (event) => applyChannelInput("blue", event.target.value));

  ui.redDownButton.addEventListener("click", () => applyChannelDelta("red", -5));
  ui.redUpButton.addEventListener("click", () => applyChannelDelta("red", 5));
  ui.greenDownButton.addEventListener("click", () => applyChannelDelta("green", -5));
  ui.greenUpButton.addEventListener("click", () => applyChannelDelta("green", 5));
  ui.blueDownButton.addEventListener("click", () => applyChannelDelta("blue", -5));
  ui.blueUpButton.addEventListener("click", () => applyChannelDelta("blue", 5));
}

function initialize() {
  bindChannelInputs();
  ui.startButton.addEventListener("click", handleStartButton);
  ui.submitRoundButton.addEventListener("click", handleSubmitRound);
  ui.nextRoundButton.addEventListener("click", handleNextRound);
  ui.restartButton.addEventListener("click", handleRestartGame);
  window.addEventListener("keydown", handleKeyDown);

  renderOverlay(
    ui,
    "Color Match Challenge",
    "Start the game, adjust RGB values to match the target color, and submit each round.",
    "Start Game"
  );
  updateHUD(ui, state, lastSubmitResult);
}

initialize();
