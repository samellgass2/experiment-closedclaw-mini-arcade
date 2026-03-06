import { GAME_STATE, STATE_LABELS } from "./constants.js";

function formatRecordValue(value, decimals) {
  if (!Number.isFinite(value)) {
    return "--";
  }

  return value.toFixed(decimals);
}

function resetSelectionPanel(ui) {
  ui.selectedCellLabel.textContent = "No tile selected yet.";
  ui.selectedTemperatureValue.textContent = "--";
  ui.selectedLatencyValue.textContent = "--";
  ui.selectedErrorRateValue.textContent = "--";
  ui.deviationTemperatureValue.textContent = "--";
  ui.deviationLatencyValue.textContent = "--";
  ui.deviationErrorRateValue.textContent = "--";
  ui.selectionVerdictValue.textContent = "Awaiting selection";
  ui.selectionVerdictValue.classList.remove("is-correct", "is-wrong");
  ui.selectionVerdictValue.classList.add("is-pending");
}

function updateBaselinePanel(ui, state) {
  const baseline = state.activeGrid ? state.activeGrid.baseline : null;
  ui.baselineTemperatureValue.textContent = baseline
    ? `${formatRecordValue(baseline.temperature, 2)} C`
    : "--";
  ui.baselineLatencyValue.textContent = baseline
    ? `${formatRecordValue(baseline.latency, 1)} ms`
    : "--";
  ui.baselineErrorRateValue.textContent = baseline
    ? `${formatRecordValue(baseline.errorRate, 3)} %`
    : "--";
}

function updateSelectionPanel(ui, state) {
  if (!state.lastSelection) {
    resetSelectionPanel(ui);
    return;
  }

  const { row, col, record, profile, isAnomaly } = state.lastSelection;
  ui.selectedCellLabel.textContent = `Cell r${row + 1}:c${col + 1} selected`;
  ui.selectedTemperatureValue.textContent = `${formatRecordValue(record.temperature, 2)} C`;
  ui.selectedLatencyValue.textContent = `${formatRecordValue(record.latency, 1)} ms`;
  ui.selectedErrorRateValue.textContent = `${formatRecordValue(record.errorRate, 3)} %`;

  ui.deviationTemperatureValue.textContent = `${formatRecordValue(profile.temperature, 2)}x`;
  ui.deviationLatencyValue.textContent = `${formatRecordValue(profile.latency, 2)}x`;
  ui.deviationErrorRateValue.textContent = `${formatRecordValue(profile.errorRate, 2)}x`;

  ui.selectionVerdictValue.classList.remove("is-pending", "is-correct", "is-wrong");
  if (isAnomaly) {
    ui.selectionVerdictValue.textContent = "Anomaly Confirmed";
    ui.selectionVerdictValue.classList.add("is-correct");
  } else {
    ui.selectionVerdictValue.textContent = "Normal Record";
    ui.selectionVerdictValue.classList.add("is-wrong");
  }
}

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
  const baselineTemperatureValue = document.getElementById("baselineTemperatureValue");
  const baselineLatencyValue = document.getElementById("baselineLatencyValue");
  const baselineErrorRateValue = document.getElementById("baselineErrorRateValue");
  const selectedCellLabel = document.getElementById("selectedCellLabel");
  const selectedTemperatureValue = document.getElementById("selectedTemperatureValue");
  const selectedLatencyValue = document.getElementById("selectedLatencyValue");
  const selectedErrorRateValue = document.getElementById("selectedErrorRateValue");
  const deviationTemperatureValue = document.getElementById("deviationTemperatureValue");
  const deviationLatencyValue = document.getElementById("deviationLatencyValue");
  const deviationErrorRateValue = document.getElementById("deviationErrorRateValue");
  const selectionVerdictValue = document.getElementById("selectionVerdictValue");
  const eventFeedValue = document.getElementById("eventFeedValue");

  if (
    !canvas ||
    !scoreValue ||
    !bestScoreValue ||
    !livesValue ||
    !levelValue ||
    !timeValue ||
    !statusValue ||
    !overlay ||
    !overlayTitle ||
    !overlayMessage ||
    !startButton ||
    !baselineTemperatureValue ||
    !baselineLatencyValue ||
    !baselineErrorRateValue ||
    !selectedCellLabel ||
    !selectedTemperatureValue ||
    !selectedLatencyValue ||
    !selectedErrorRateValue ||
    !deviationTemperatureValue ||
    !deviationLatencyValue ||
    !deviationErrorRateValue ||
    !selectionVerdictValue ||
    !eventFeedValue
  ) {
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
    startButton,
    baselineTemperatureValue,
    baselineLatencyValue,
    baselineErrorRateValue,
    selectedCellLabel,
    selectedTemperatureValue,
    selectedLatencyValue,
    selectedErrorRateValue,
    deviationTemperatureValue,
    deviationLatencyValue,
    deviationErrorRateValue,
    selectionVerdictValue,
    eventFeedValue
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

  updateBaselinePanel(ui, state);
  updateSelectionPanel(ui, state);
  ui.eventFeedValue.textContent = state.roundEvent;
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
