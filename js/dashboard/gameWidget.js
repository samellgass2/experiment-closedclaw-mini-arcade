import { createFlappyGameWidget } from "../flappy/index.js";
import { createClickerState, registerClick, startClickerGame, tickClickerGame } from "../clicker/logic.js";
import {
  COLOR_MATCH_STATUS,
  createColorMatchState,
  setChannelValue,
  startColorMatchGame,
  startNextRound,
  submitRound
} from "../color-match/logic.js";
import { createRacingState, setInputState, startRace, tickRace } from "../racing/logic.js";
import { GAME_STATE } from "../anomaly/constants.js";
import { applyCorrectSelection, applyWrongSelection, createGameState, resetRunState } from "../anomaly/state.js";

function el(tag, text = "") {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function mountBasic(root, title, draw) {
  root.innerHTML = "";
  const host = el("div");
  host.className = "tile-game-host";
  const heading = el("h3", title);
  heading.className = "tile-title";
  const status = el("p");
  status.className = "tile-summary";
  const controls = el("div");
  controls.className = "tile-controls";
  host.append(heading, status, controls);
  root.append(host);
  return { status, controls, refresh: () => draw(status, controls) };
}

function clicker(root, onScoreChange) {
  const s = createClickerState();
  const ui = mountBasic(root, "Combo Clicker", (status) => {
    status.textContent = `Score ${s.score} | Best ${s.bestScore} | Clicks ${s.totalClicks} | ${s.status}`;
  });
  const start = el("button", "Start");
  start.className = "tile-button tile-button-secondary";
  const tap = el("button", "Tap");
  tap.className = "tile-button tile-button-secondary";
  start.onclick = () => { startClickerGame(s, performance.now()); ui.refresh(); };
  tap.onclick = () => { tickClickerGame(s, performance.now()); registerClick(s, performance.now()); onScoreChange(s.score); ui.refresh(); };
  ui.controls.append(start, tap); ui.refresh();
}

function racing(root, onScoreChange) {
  const s = createRacingState();
  const ui = mountBasic(root, "Top-Down Racing", (status) => {
    status.textContent = `Laps ${s.completedLaps}/${s.config.lapTarget} | Speed ${Math.max(0, s.car.speed).toFixed(0)} | ${s.status}`;
  });
  const start = el("button", "Start Race");
  start.className = "tile-button tile-button-secondary";
  const step = el("button", "Throttle + Step");
  step.className = "tile-button tile-button-secondary";
  start.onclick = () => { startRace(s, performance.now()); ui.refresh(); };
  step.onclick = () => { setInputState(s, { throttle: true }); tickRace(s, performance.now() + 64); setInputState(s, { throttle: false }); onScoreChange(s.completedLaps); ui.refresh(); };
  ui.controls.append(start, step); ui.refresh();
}

function colorMatch(root, onScoreChange) {
  const s = createColorMatchState();
  startColorMatchGame(s, { nowMs: performance.now() });
  const ui = mountBasic(root, "Color Match", (status) => {
    status.textContent = `Score ${s.score} | Round ${s.roundsPlayed + (s.currentRound ? 1 : 0)} | ${s.status}`;
  });
  ["red", "green", "blue"].forEach((ch) => {
    const slider = el("input");
    slider.type = "range"; slider.min = "0"; slider.max = "255"; slider.value = "128";
    slider.oninput = () => { setChannelValue(s, ch, Number(slider.value), performance.now()); ui.refresh(); };
    ui.controls.append(slider);
  });
  const submit = el("button", "Submit");
  submit.className = "tile-button tile-button-secondary";
  submit.onclick = () => { submitRound(s, performance.now()); onScoreChange(s.score); ui.refresh(); };
  const next = el("button", "Next");
  next.className = "tile-button tile-button-secondary";
  next.onclick = () => { if (s.status === COLOR_MATCH_STATUS.ROUND_COMPLETE) startNextRound(s, { nowMs: performance.now() }); if (s.status === COLOR_MATCH_STATUS.OVER) startColorMatchGame(s, { nowMs: performance.now() }); ui.refresh(); };
  ui.controls.append(submit, next); ui.refresh();
}

function anomaly(root, onScoreChange) {
  const s = createGameState();
  resetRunState(s); s.status = GAME_STATE.RUNNING;
  const ui = mountBasic(root, "Anomaly Detector", (status) => {
    status.textContent = `Score ${s.score} | Lives ${s.lives} | Level ${s.level} | ${s.status}`;
  });
  const mark = el("button", "Mark Anomaly"); mark.className = "tile-button tile-button-secondary";
  mark.onclick = () => { applyCorrectSelection(s); onScoreChange(s.score); ui.refresh(); };
  const miss = el("button", "Miss"); miss.className = "tile-button tile-button-danger";
  miss.onclick = () => { applyWrongSelection(s); if (s.lives <= 0) s.status = GAME_STATE.OVER; ui.refresh(); };
  ui.controls.append(mark, miss); ui.refresh();
}

export function createDashboardGameWidget(tileId, options = {}) {
  const root = options.root;
  if (!(root instanceof HTMLElement)) throw new Error("Dashboard game widget root is required.");
  const onScoreChange = typeof options.onScoreChange === "function" ? options.onScoreChange : () => {};
  if (tileId === "flappy") return createFlappyGameWidget({ root, onScoreChange });
  if (tileId === "clicker") clicker(root, onScoreChange);
  if (tileId === "racing") racing(root, onScoreChange);
  if (tileId === "color-match") colorMatch(root, onScoreChange);
  if (tileId === "anomaly") anomaly(root, onScoreChange);
  return { destroy() { root.innerHTML = ""; } };
}
