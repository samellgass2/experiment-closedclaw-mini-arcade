import {
  CLICKER_STATUS,
  createClickerState,
  finishClickerGame,
  getClickerSnapshot,
  pauseClickerGame,
  registerClick,
  resetClickerState,
  resumeClickerGame,
  startClickerGame,
  tickClickerGame
} from "./clicker/logic.js";
import {
  COLOR_MATCH_STATUS,
  createColorMatchState,
  finishColorMatchGame,
  getColorMatchSnapshot,
  setChannelValue,
  startColorMatchGame,
  startNextRound,
  submitRound
} from "./color-match/logic.js";
import {
  createRacingState,
  pauseRace,
  resumeRace,
  setInputState,
  startRace,
  tickRace
} from "./racing/logic.js";
import { createRacingRenderer } from "./racing/renderer.js";
import { createReleasedInputPatch, mapKeyboardEventCodeToInputPatch } from "./racing/controls.js";
import { BASE_CONFIG, GAME_STATE } from "./anomaly/constants.js";
import {
  applyCorrectSelection,
  applyRoundTimeout,
  applyWrongSelection,
  createGameState,
  resetRunState
} from "./anomaly/state.js";
import { createGridLayout, locateCellAt } from "./anomaly/components/grid.js";
import { evaluateSelectedCell } from "./anomaly/components/anomalyEvaluator.js";
import { generateRoundGrid } from "./anomaly/components/anomalyGenerator.js";
import { createTimer, pauseTimer, startTimer, tickTimer } from "./anomaly/components/timer.js";
import { renderGameFrame } from "./anomaly/renderer.js";

function nowMs() {
  return window.performance?.now?.() ?? Date.now();
}

function formatSeconds(ms) {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

function createRuntimeShell(root, heading, bodyMarkup) {
  root.innerHTML = "";

  const shell = document.createElement("section");
  shell.className = "runtime-shell";

  const title = document.createElement("h2");
  title.className = "runtime-title";
  title.textContent = heading;

  const body = document.createElement("div");
  body.className = "runtime-body";
  body.innerHTML = bodyMarkup;

  shell.append(title, body);
  root.append(shell);

  return body;
}

function mountClickerRuntime({ root, game, onScoreChange, scope }) {
  const body = createRuntimeShell(
    root,
    game.name,
    `
      <p class="runtime-copy">Build combos before the round timer ends.</p>
      <div class="runtime-stat-grid">
        <p><strong>Status:</strong> <span data-role="status">READY</span></p>
        <p><strong>Score:</strong> <span data-role="score">0</span></p>
        <p><strong>Best:</strong> <span data-role="best">0</span></p>
        <p><strong>Time Left:</strong> <span data-role="time">30.0</span>s</p>
        <p><strong>Combo:</strong> <span data-role="combo">0</span></p>
        <p><strong>Clicks:</strong> <span data-role="clicks">0</span></p>
      </div>
      <div class="runtime-actions">
        <button type="button" data-action="start">Start</button>
        <button type="button" data-action="pause">Pause/Resume</button>
        <button type="button" data-action="restart">Restart</button>
      </div>
      <button type="button" class="runtime-primary" data-action="click">Click!</button>
    `
  );

  const statusEl = body.querySelector('[data-role="status"]');
  const scoreEl = body.querySelector('[data-role="score"]');
  const bestEl = body.querySelector('[data-role="best"]');
  const timeEl = body.querySelector('[data-role="time"]');
  const comboEl = body.querySelector('[data-role="combo"]');
  const clicksEl = body.querySelector('[data-role="clicks"]');

  const startBtn = body.querySelector('[data-action="start"]');
  const pauseBtn = body.querySelector('[data-action="pause"]');
  const restartBtn = body.querySelector('[data-action="restart"]');
  const clickBtn = body.querySelector('[data-action="click"]');

  const state = createClickerState();
  let lastPublishedScore = 0;

  function publishScore() {
    if (state.score !== lastPublishedScore) {
      lastPublishedScore = state.score;
      onScoreChange(state.score);
    }
  }

  function render() {
    const snapshot = getClickerSnapshot(state);
    statusEl.textContent = snapshot.status;
    scoreEl.textContent = String(snapshot.score);
    bestEl.textContent = String(snapshot.bestScore);
    timeEl.textContent = formatSeconds(snapshot.remainingMs);
    comboEl.textContent = String(snapshot.comboStreak);
    clicksEl.textContent = String(snapshot.totalClicks);

    clickBtn.disabled = snapshot.status === CLICKER_STATUS.OVER;
    publishScore();
  }

  scope.listen(startBtn, "click", () => {
    startClickerGame(state, nowMs());
    render();
  });

  scope.listen(pauseBtn, "click", () => {
    if (state.status === CLICKER_STATUS.RUNNING) {
      pauseClickerGame(state);
    } else if (state.status === CLICKER_STATUS.PAUSED) {
      resumeClickerGame(state, nowMs());
    }
    render();
  });

  scope.listen(restartBtn, "click", () => {
    finishClickerGame(state, nowMs(), "manual-restart");
    resetClickerState(state);
    render();
  });

  scope.listen(clickBtn, "click", () => {
    registerClick(state, nowMs());
    render();
  });

  scope.setInterval(() => {
    tickClickerGame(state, nowMs());
    render();
  }, 100);

  render();

  return () => {
    onScoreChange(state.score);
  };
}

function mountColorMatchRuntime({ root, game, onScoreChange, scope }) {
  const body = createRuntimeShell(
    root,
    game.name,
    `
      <p class="runtime-copy">Adjust RGB sliders, then submit each round for scoring.</p>
      <div class="runtime-stat-grid">
        <p><strong>Status:</strong> <span data-role="status">READY</span></p>
        <p><strong>Score:</strong> <span data-role="score">0</span></p>
        <p><strong>Best:</strong> <span data-role="best">0</span></p>
        <p><strong>Rounds:</strong> <span data-role="rounds">0 / 5</span></p>
        <p><strong>Session:</strong> <span data-role="session">0.0</span>s</p>
        <p><strong>Latest:</strong> <span data-role="latest">--</span></p>
      </div>
      <div class="runtime-slider-grid">
        <label>Red <input type="range" data-channel="red" min="0" max="255" value="128"></label>
        <label>Green <input type="range" data-channel="green" min="0" max="255" value="128"></label>
        <label>Blue <input type="range" data-channel="blue" min="0" max="255" value="128"></label>
      </div>
      <div class="runtime-actions">
        <button type="button" data-action="start">Start Match</button>
        <button type="button" data-action="submit">Submit Round</button>
        <button type="button" data-action="next">Next Round</button>
      </div>
    `
  );

  const state = createColorMatchState();
  const statusEl = body.querySelector('[data-role="status"]');
  const scoreEl = body.querySelector('[data-role="score"]');
  const bestEl = body.querySelector('[data-role="best"]');
  const roundsEl = body.querySelector('[data-role="rounds"]');
  const sessionEl = body.querySelector('[data-role="session"]');
  const latestEl = body.querySelector('[data-role="latest"]');

  const startBtn = body.querySelector('[data-action="start"]');
  const submitBtn = body.querySelector('[data-action="submit"]');
  const nextBtn = body.querySelector('[data-action="next"]');
  const sliders = Array.from(body.querySelectorAll("input[type='range'][data-channel]"));

  const sessionStartedMs = nowMs();
  let lastPublishedScore = 0;

  function publishScore() {
    if (state.score !== lastPublishedScore) {
      lastPublishedScore = state.score;
      onScoreChange(state.score);
    }
  }

  function syncSlidersFromRound() {
    const guess = state.currentRound?.guessColor;
    if (!guess) {
      return;
    }

    for (const slider of sliders) {
      const channel = slider.dataset.channel;
      if (channel && Object.prototype.hasOwnProperty.call(guess, channel)) {
        slider.value = String(guess[channel]);
      }
    }
  }

  function render() {
    const snapshot = getColorMatchSnapshot(state);
    statusEl.textContent = snapshot.status;
    scoreEl.textContent = String(snapshot.score);
    bestEl.textContent = String(snapshot.bestScore);
    roundsEl.textContent = `${snapshot.roundsPlayed} / ${state.config.roundsPerGame}`;
    sessionEl.textContent = formatSeconds(nowMs() - sessionStartedMs);

    if (snapshot.latestRoundResult?.accuracyPercent != null) {
      latestEl.textContent = `${snapshot.latestRoundResult.accuracyPercent.toFixed(1)}%`;
    } else {
      latestEl.textContent = "--";
    }

    submitBtn.disabled = snapshot.status !== COLOR_MATCH_STATUS.RUNNING;
    nextBtn.disabled = snapshot.status !== COLOR_MATCH_STATUS.ROUND_COMPLETE;

    for (const slider of sliders) {
      slider.disabled = snapshot.status !== COLOR_MATCH_STATUS.RUNNING;
    }

    publishScore();
  }

  scope.listen(startBtn, "click", () => {
    startColorMatchGame(state, { nowMs: nowMs() });
    syncSlidersFromRound();
    render();
  });

  scope.listen(submitBtn, "click", () => {
    submitRound(state, nowMs());
    render();
  });

  scope.listen(nextBtn, "click", () => {
    startNextRound(state, { nowMs: nowMs() });
    syncSlidersFromRound();
    render();
  });

  for (const slider of sliders) {
    scope.listen(slider, "input", () => {
      setChannelValue(state, slider.dataset.channel, Number(slider.value), nowMs());
      render();
    });
  }

  // Keep one managed timer active to make interval lifecycle visible for this game runtime.
  scope.setInterval(() => {
    render();
  }, 250);

  scope.registerCleanup(() => {
    if (state.status !== COLOR_MATCH_STATUS.OVER) {
      finishColorMatchGame(state, nowMs(), "unmounted");
    }
  }, "finish-color-match");

  render();
  return () => onScoreChange(state.score);
}

function mountRacingRuntime({ root, game, onScoreChange, scope }) {
  const body = createRuntimeShell(
    root,
    game.name,
    `
      <p class="runtime-copy">Use Arrow keys or WASD. Space toggles start/pause.</p>
      <div class="runtime-split">
        <canvas data-role="canvas" width="960" height="600" class="runtime-canvas"></canvas>
        <aside class="runtime-panel">
          <p><strong>Status:</strong> <span data-role="status">READY</span></p>
          <p><strong>Laps:</strong> <span data-role="lap">0 / 3</span></p>
          <p><strong>Total:</strong> <span data-role="timer">0.00s</span></p>
          <p><strong>Current Lap:</strong> <span data-role="current-lap">0.00s</span></p>
          <p><strong>Last Lap:</strong> <span data-role="last-lap">--</span></p>
          <p><strong>Best Lap:</strong> <span data-role="best-lap">--</span></p>
          <p><strong>Speed:</strong> <span data-role="speed">0 km/h</span></p>
          <p><strong>Track:</strong> <span data-role="track">ON TRACK</span></p>
          <p><strong>Event:</strong> <span data-role="event">Press Start Race to begin.</span></p>
          <ol data-role="lap-history" class="runtime-list"></ol>
          <div class="runtime-actions">
            <button type="button" data-action="start">Start Race</button>
            <button type="button" data-action="pause">Pause</button>
          </div>
        </aside>
      </div>
    `
  );

  const canvas = body.querySelector('[data-role="canvas"]');
  const state = createRacingState();
  const renderer = createRacingRenderer(canvas);

  const ui = {
    statusValue: body.querySelector('[data-role="status"]'),
    lapValue: body.querySelector('[data-role="lap"]'),
    timerValue: body.querySelector('[data-role="timer"]'),
    currentLapValue: body.querySelector('[data-role="current-lap"]'),
    lastLapValue: body.querySelector('[data-role="last-lap"]'),
    bestLapValue: body.querySelector('[data-role="best-lap"]'),
    speedValue: body.querySelector('[data-role="speed"]'),
    trackStateValue: body.querySelector('[data-role="track"]'),
    eventValue: body.querySelector('[data-role="event"]'),
    lapHistoryValue: body.querySelector('[data-role="lap-history"]'),
    startButton: body.querySelector('[data-action="start"]'),
    pauseButton: body.querySelector('[data-action="pause"]')
  };

  function mapRaceScore() {
    return (state.completedLaps * 1000) + Math.max(0, Math.round((state.bestLapMs ? 120000 - state.bestLapMs : 0) / 100));
  }

  function runFrame(timestamp) {
    tickRace(state, timestamp);
    renderer.render(state);
    renderer.updateHUD(state, ui);
    onScoreChange(mapRaceScore());

    if (!scope.isStopped()) {
      scope.requestFrame(runFrame);
    }
  }

  scope.listen(ui.startButton, "click", () => {
    startRace(state, nowMs());
    renderer.updateHUD(state, ui);
  });

  scope.listen(ui.pauseButton, "click", () => {
    if (state.status === "RUNNING") {
      pauseRace(state);
    } else {
      resumeRace(state, nowMs());
    }
    renderer.updateHUD(state, ui);
  });

  scope.listen(window, "keydown", (event) => {
    const patch = mapKeyboardEventCodeToInputPatch(event.code, true);
    if (patch) {
      event.preventDefault();
      setInputState(state, patch);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (state.status === "READY" || state.status === "OVER") {
        startRace(state, nowMs());
      } else if (state.status === "RUNNING") {
        pauseRace(state);
      } else {
        resumeRace(state, nowMs());
      }
    }
  });

  scope.listen(window, "keyup", (event) => {
    const patch = mapKeyboardEventCodeToInputPatch(event.code, false);
    if (!patch) {
      return;
    }
    event.preventDefault();
    setInputState(state, patch);
  });

  scope.registerCleanup(() => {
    setInputState(state, createReleasedInputPatch());
  }, "release-racing-input");

  scope.requestFrame(runFrame);
  return () => onScoreChange(mapRaceScore());
}

function mountAnomalyRuntime({ root, game, onScoreChange, scope }) {
  const body = createRuntimeShell(
    root,
    game.name,
    `
      <p class="runtime-copy">Select the anomalous tile before the timer expires.</p>
      <div class="runtime-split">
        <canvas data-role="canvas" width="640" height="640" class="runtime-canvas runtime-canvas-square"></canvas>
        <aside class="runtime-panel">
          <p><strong>Status:</strong> <span data-role="status">READY</span></p>
          <p><strong>Score:</strong> <span data-role="score">0</span></p>
          <p><strong>Best:</strong> <span data-role="best">0</span></p>
          <p><strong>Lives:</strong> <span data-role="lives">3</span></p>
          <p><strong>Level:</strong> <span data-role="level">1</span></p>
          <p><strong>Seconds:</strong> <span data-role="time">20</span></p>
          <p><strong>Event:</strong> <span data-role="event">Press Start Run to begin.</span></p>
          <div class="runtime-actions">
            <button type="button" data-action="start">Start Run</button>
            <button type="button" data-action="pause">Pause/Resume</button>
          </div>
        </aside>
      </div>
    `
  );

  const canvas = body.querySelector('[data-role="canvas"]');
  const ctx = canvas.getContext("2d");

  const ui = {
    status: body.querySelector('[data-role="status"]'),
    score: body.querySelector('[data-role="score"]'),
    best: body.querySelector('[data-role="best"]'),
    lives: body.querySelector('[data-role="lives"]'),
    level: body.querySelector('[data-role="level"]'),
    time: body.querySelector('[data-role="time"]'),
    event: body.querySelector('[data-role="event"]'),
    startButton: body.querySelector('[data-action="start"]'),
    pauseButton: body.querySelector('[data-action="pause"]')
  };

  const state = createGameState();
  const timer = createTimer();
  const layout = createGridLayout(BASE_CONFIG.rows, BASE_CONFIG.cols, canvas.width, canvas.height, BASE_CONFIG.tileGap);

  state.status = GAME_STATE.READY;
  state.currentRound = { level: state.level, score: state.score, variantStrength: BASE_CONFIG.anomalyHueOffset };

  function buildNextRound() {
    state.activeGrid = generateRoundGrid(state.currentRound, layout, BASE_CONFIG);
    state.selectedCellId = null;
  }

  function renderHUD() {
    ui.status.textContent = state.status.toUpperCase();
    ui.score.textContent = String(state.score);
    ui.best.textContent = String(state.bestScore);
    ui.lives.textContent = String(state.lives);
    ui.level.textContent = String(state.level);
    ui.time.textContent = String(state.remainingSeconds);
    ui.event.textContent = state.roundEvent;
    onScoreChange(state.score);
  }

  function startRun() {
    resetRunState(state);
    state.status = GAME_STATE.RUNNING;
    buildNextRound();
    startTimer(timer, nowMs());
    renderHUD();
  }

  function toGameOver(reason) {
    state.status = GAME_STATE.OVER;
    pauseTimer(timer);
    state.roundEvent = reason;
    renderHUD();
  }

  scope.listen(ui.startButton, "click", () => {
    startRun();
  });

  scope.listen(ui.pauseButton, "click", () => {
    if (state.status === GAME_STATE.RUNNING) {
      state.status = GAME_STATE.PAUSED;
      pauseTimer(timer);
    } else if (state.status === GAME_STATE.PAUSED) {
      state.status = GAME_STATE.RUNNING;
      startTimer(timer, nowMs());
    }
    renderHUD();
  });

  scope.listen(canvas, "click", (event) => {
    if (state.status !== GAME_STATE.RUNNING || !state.activeGrid) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const cell = locateCellAt(layout, x, y);

    if (!cell) {
      return;
    }

    state.selectedCellId = cell.id;
    const evaluation = evaluateSelectedCell(state.activeGrid, cell.id, BASE_CONFIG.dataset);

    const record = state.activeGrid.recordsByCellId[cell.id];
    state.lastSelection = {
      row: cell.row,
      col: cell.col,
      record,
      profile: evaluation.profile,
      isAnomaly: evaluation.isAnomaly
    };

    if (evaluation.isAnomaly) {
      applyCorrectSelection(state);
      if (state.status !== GAME_STATE.OVER) {
        buildNextRound();
        startTimer(timer, nowMs());
      }
    } else {
      applyWrongSelection(state);
      if (state.lives <= 0) {
        toGameOver("No lives left. Run ended.");
      }
    }

    renderHUD();
  });

  scope.setInterval(() => {
    tickTimer(timer, nowMs(), () => {
      if (state.status !== GAME_STATE.RUNNING) {
        return;
      }

      state.remainingSeconds = Math.max(0, state.remainingSeconds - 1);
      if (state.remainingSeconds > 0) {
        return;
      }

      applyRoundTimeout(state);
      if (state.lives <= 0) {
        toGameOver("Run timed out. No lives left.");
        return;
      }

      buildNextRound();
      startTimer(timer, nowMs());
    });

    renderHUD();
  }, 100);

  function renderFrame() {
    renderGameFrame(ctx, canvas, state);
    if (!scope.isStopped()) {
      scope.requestFrame(renderFrame);
    }
  }

  buildNextRound();
  renderHUD();
  scope.requestFrame(renderFrame);

  return () => {
    pauseTimer(timer);
    onScoreChange(state.score);
  };
}

function mountFlappyRuntime({ root, game, onScoreChange, scope }) {
  const body = createRuntimeShell(
    root,
    game.name,
    `
      <p class="runtime-copy">Flappy runtime placeholder with a managed animation loop.</p>
      <canvas data-role="canvas" width="720" height="320" class="runtime-canvas"></canvas>
    `
  );

  const canvas = body.querySelector('[data-role="canvas"]');
  const ctx = canvas.getContext("2d");
  const startedAt = nowMs();

  function frame(timestamp) {
    const elapsed = (timestamp - startedAt) / 1000;
    const birdY = 160 + Math.sin(elapsed * 3) * 56;

    ctx.fillStyle = "#87ceeb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#7fcf57";
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

    ctx.fillStyle = "#e94f37";
    ctx.beginPath();
    ctx.arc(180, birdY, 16, 0, Math.PI * 2);
    ctx.fill();

    onScoreChange(Math.floor(elapsed));

    if (!scope.isStopped()) {
      scope.requestFrame(frame);
    }
  }

  scope.requestFrame(frame);
  return () => onScoreChange(0);
}

function mountFallbackRuntime({ root, game }) {
  const body = createRuntimeShell(
    root,
    game.name,
    `<p class="runtime-copy">No runtime implementation is registered for <strong>${game.id}</strong>.</p>`
  );

  body.classList.add("runtime-fallback");
  return () => {};
}

const runtimeByGameId = {
  anomaly: mountAnomalyRuntime,
  clicker: mountClickerRuntime,
  "color-match": mountColorMatchRuntime,
  racing: mountRacingRuntime,
  flappy: mountFlappyRuntime
};

export function mountRuntimeForGame({ game, root, onScoreChange, scope }) {
  const mount = runtimeByGameId[game.id] ?? mountFallbackRuntime;
  return mount({ game, root, onScoreChange, scope });
}
