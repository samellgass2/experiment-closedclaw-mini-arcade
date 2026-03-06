import {
  FLAPPY_STATUS,
  createFlappyState,
  flapBird,
  getFlappySnapshot,
  resetFlappyState,
  startFlappyGame,
  stepFlappyGame
} from "./logic.js";

function createNode(tagName, className, textContent = "") {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  if (textContent) {
    node.textContent = textContent;
  }
  return node;
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#91d7ff");
  gradient.addColorStop(1, "#d8f7ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#f2d286";
  ctx.fillRect(0, height - 24, width, 24);

  ctx.fillStyle = "rgba(255, 255, 255, 0.52)";
  ctx.fillRect(0, 36, width, 2);
  ctx.fillRect(0, 86, width, 2);
}

function drawPipes(ctx, state) {
  ctx.fillStyle = "#4baf4f";
  ctx.strokeStyle = "#286834";
  ctx.lineWidth = 2;

  for (const pipe of state.pipes) {
    const gapTop = pipe.gapY - pipe.gapHeight / 2;
    const gapBottom = pipe.gapY + pipe.gapHeight / 2;

    ctx.fillRect(pipe.x, 0, pipe.width, gapTop);
    ctx.strokeRect(pipe.x, 0, pipe.width, gapTop);

    const bottomHeight = state.config.canvasHeight - gapBottom;
    ctx.fillRect(pipe.x, gapBottom, pipe.width, bottomHeight);
    ctx.strokeRect(pipe.x, gapBottom, pipe.width, bottomHeight);
  }
}

function drawBird(ctx, state) {
  ctx.save();
  ctx.translate(state.bird.x, state.bird.y);
  const normalizedVelocity = Math.max(-260, Math.min(320, state.bird.velocityY));
  ctx.rotate((normalizedVelocity / 320) * 0.8);

  ctx.fillStyle = "#f7cc39";
  ctx.strokeStyle = "#935e00";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(0, 0, state.bird.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2f2f2f";
  ctx.beginPath();
  ctx.arc(4, -3, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f58f1e";
  ctx.beginPath();
  ctx.moveTo(10, -2);
  ctx.lineTo(18, 0);
  ctx.lineTo(10, 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawOverlay(ctx, state) {
  if (state.status === FLAPPY_STATUS.RUNNING) {
    return;
  }

  ctx.fillStyle = "rgba(5, 15, 24, 0.36)";
  ctx.fillRect(0, 0, state.config.canvasWidth, state.config.canvasHeight);

  ctx.fillStyle = "#f9fdff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 18px 'Trebuchet MS', sans-serif";

  if (state.status === FLAPPY_STATUS.READY) {
    ctx.fillText("Press Space or Tap to Start", state.config.canvasWidth / 2, state.config.canvasHeight / 2 - 8);
    return;
  }

  ctx.fillText("Game Over", state.config.canvasWidth / 2, state.config.canvasHeight / 2 - 12);
  ctx.font = "500 14px 'Trebuchet MS', sans-serif";
  ctx.fillText("Press Restart to try again", state.config.canvasWidth / 2, state.config.canvasHeight / 2 + 14);
}

function renderFrame(ctx, state) {
  drawBackground(ctx, state.config.canvasWidth, state.config.canvasHeight);
  drawPipes(ctx, state);
  drawBird(ctx, state);
  drawOverlay(ctx, state);
}

function updatePanel(panel, snapshot) {
  panel.scoreValue.textContent = String(snapshot.score);
  panel.bestValue.textContent = String(snapshot.bestScore);
  panel.statusValue.textContent = snapshot.status;

  if (snapshot.status === FLAPPY_STATUS.RUNNING) {
    panel.actionButton.textContent = "Flap";
    return;
  }

  panel.actionButton.textContent = snapshot.status === FLAPPY_STATUS.OVER ? "Restart" : "Start";
}

function createShell(root, config) {
  root.innerHTML = "";

  const shell = createNode("div", "flappy-shell");
  const canvas = createNode("canvas", "flappy-canvas");
  canvas.width = config.canvasWidth;
  canvas.height = config.canvasHeight;
  canvas.setAttribute("aria-label", "Flappy Bird style game");

  const panel = createNode("div", "flappy-panel");

  const scoreLine = createNode("p", "flappy-stat");
  scoreLine.innerHTML = 'Score: <strong class="flappy-score-value">0</strong>';

  const bestLine = createNode("p", "flappy-stat");
  bestLine.innerHTML = 'Best: <strong class="flappy-best-value">0</strong>';

  const statusLine = createNode("p", "flappy-stat");
  statusLine.innerHTML = 'Status: <strong class="flappy-status-value">READY</strong>';

  const actionButton = createNode("button", "tile-button tile-button-secondary", "Start");
  actionButton.type = "button";

  panel.append(scoreLine, bestLine, statusLine, actionButton);
  shell.append(canvas, panel);
  root.append(shell);

  return {
    shell,
    canvas,
    actionButton,
    scoreValue: scoreLine.querySelector(".flappy-score-value"),
    bestValue: bestLine.querySelector(".flappy-best-value"),
    statusValue: statusLine.querySelector(".flappy-status-value")
  };
}

export function createFlappyGameWidget(options = {}) {
  const root = options.root;
  if (!(root instanceof HTMLElement)) {
    throw new Error("Flappy widget root element is required.");
  }

  const state = createFlappyState(options.config, {
    storage: options.storage
  });

  const ui = createShell(root, state.config);
  const ctx = ui.canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create 2D context for Flappy game widget.");
  }

  let frameId = null;
  let running = true;
  let lastFrameTimeMs = performance.now();

  function emitScore() {
    if (typeof options.onScoreChange === "function") {
      options.onScoreChange(state.score, state.bestScore);
    }
  }

  function applyFlapAction() {
    if (state.status === FLAPPY_STATUS.READY) {
      startFlappyGame(state);
    }
    flapBird(state);
    updatePanel(ui, getFlappySnapshot(state));
    renderFrame(ctx, state);
  }

  function handleActionClick() {
    if (state.status === FLAPPY_STATUS.OVER) {
      resetFlappyState(state);
      startFlappyGame(state);
      updatePanel(ui, getFlappySnapshot(state));
      renderFrame(ctx, state);
      emitScore();
      return;
    }

    applyFlapAction();
  }

  function handleKeyboard(event) {
    if (event.code !== "Space" && event.code !== "ArrowUp") {
      return;
    }

    event.preventDefault();
    applyFlapAction();
  }

  function frame(nowMs) {
    if (!running) {
      return;
    }

    const deltaMs = nowMs - lastFrameTimeMs;
    lastFrameTimeMs = nowMs;

    const beforeScore = state.score;
    stepFlappyGame(state, deltaMs);
    const snapshot = getFlappySnapshot(state);

    if (snapshot.score !== beforeScore || snapshot.status === FLAPPY_STATUS.OVER) {
      emitScore();
    }

    renderFrame(ctx, state);
    updatePanel(ui, snapshot);
    frameId = requestAnimationFrame(frame);
  }

  ui.actionButton.addEventListener("click", handleActionClick);
  ui.canvas.addEventListener("pointerdown", applyFlapAction);
  window.addEventListener("keydown", handleKeyboard);

  renderFrame(ctx, state);
  updatePanel(ui, getFlappySnapshot(state));
  emitScore();
  frameId = requestAnimationFrame(frame);

  return {
    getSnapshot: () => getFlappySnapshot(state),
    destroy() {
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      ui.actionButton.removeEventListener("click", handleActionClick);
      ui.canvas.removeEventListener("pointerdown", applyFlapAction);
      window.removeEventListener("keydown", handleKeyboard);
      root.innerHTML = "";
    }
  };
}

export * from "./logic.js";
