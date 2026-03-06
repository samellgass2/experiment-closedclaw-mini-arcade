(() => {
  "use strict";

  const STORAGE_KEY = "flappy-wing-best-score";

  const GAME_STATE = {
    READY: "ready",
    RUNNING: "running",
    PAUSED: "paused",
    OVER: "over"
  };

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const scoreValue = document.getElementById("scoreValue");
  const bestScoreValue = document.getElementById("bestScoreValue");
  const statusValue = document.getElementById("statusValue");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayMessage = document.getElementById("overlayMessage");
  const startButton = document.getElementById("startButton");

  if (!canvas || !ctx || !scoreValue || !bestScoreValue || !statusValue || !overlay || !overlayTitle || !overlayMessage || !startButton) {
    throw new Error("Missing required DOM nodes for game startup.");
  }

  const config = {
    gravity: 1600,
    flapVelocity: -420,
    pipeIntervalMs: 1450,
    pipeSpeed: 160,
    pipeWidth: 68,
    pipeGap: 160,
    minPipeTop: 90,
    floorHeight: 90,
    cloudSpeed: 16,
    cloudCount: 4,
    collisionPadding: 5
  };

  const game = {
    state: GAME_STATE.READY,
    score: 0,
    bestScore: loadBestScore(),
    bird: null,
    pipes: [],
    clouds: [],
    lastTime: 0,
    spawnAccumulator: 0,
    animationFrame: 0
  };

  function loadBestScore() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }

  function saveBestScore(bestScore) {
    window.localStorage.setItem(STORAGE_KEY, String(bestScore));
  }

  function createBird() {
    return {
      x: canvas.width * 0.28,
      y: canvas.height * 0.45,
      width: 34,
      height: 24,
      velocityY: 0,
      rotation: 0,
      wingPhase: 0
    };
  }

  function initializeClouds() {
    const clouds = [];
    for (let index = 0; index < config.cloudCount; index += 1) {
      clouds.push({
        x: Math.random() * canvas.width,
        y: 60 + Math.random() * (canvas.height * 0.35),
        width: 65 + Math.random() * 45,
        height: 24 + Math.random() * 18,
        offset: Math.random() * Math.PI * 2
      });
    }
    return clouds;
  }

  function resetRunState() {
    game.score = 0;
    game.spawnAccumulator = 0;
    game.pipes = [];
    game.bird = createBird();
    game.clouds = initializeClouds();
    updateScoreUI();
  }

  function spawnPipePair() {
    const maxTop = canvas.height - config.floorHeight - config.pipeGap - config.minPipeTop;
    const topHeight = Math.max(config.minPipeTop, Math.random() * maxTop + config.minPipeTop);

    game.pipes.push({
      x: canvas.width + config.pipeWidth,
      width: config.pipeWidth,
      topHeight,
      bottomY: topHeight + config.pipeGap,
      passed: false
    });
  }

  function flap() {
    if (game.state === GAME_STATE.READY) {
      startGame();
    }

    if (game.state !== GAME_STATE.RUNNING) {
      return;
    }

    game.bird.velocityY = config.flapVelocity;
  }

  function startGame() {
    if (game.state === GAME_STATE.RUNNING) {
      return;
    }

    resetRunState();
    setState(GAME_STATE.RUNNING);
    hideOverlay();
  }

  function pauseToggle() {
    if (game.state === GAME_STATE.RUNNING) {
      setState(GAME_STATE.PAUSED);
      showOverlay("Paused", "Press P to resume or R to restart.", "Resume");
      return;
    }

    if (game.state === GAME_STATE.PAUSED) {
      setState(GAME_STATE.RUNNING);
      hideOverlay();
    }
  }

  function restartGame() {
    resetRunState();
    setState(GAME_STATE.READY);
    showOverlay("Flappy Wing", "Press Space, click, or tap to start.", "Start Game");
  }

  function endGame() {
    setState(GAME_STATE.OVER);
    updateBestScore();
    showOverlay("Game Over", "Press R to restart and try again.", "Play Again");
  }

  function updateBestScore() {
    if (game.score > game.bestScore) {
      game.bestScore = game.score;
      saveBestScore(game.bestScore);
    }
    bestScoreValue.textContent = String(game.bestScore);
  }

  function showOverlay(title, message, buttonLabel) {
    overlayTitle.textContent = title;
    overlayMessage.textContent = message;
    startButton.textContent = buttonLabel;
    overlay.classList.add("visible");
  }

  function hideOverlay() {
    overlay.classList.remove("visible");
  }

  function setState(nextState) {
    game.state = nextState;
    statusValue.textContent = nextState;
    statusValue.classList.remove("is-ready", "is-running", "is-paused", "is-over");
    statusValue.classList.add(`is-${nextState}`);
  }

  function updateScoreUI() {
    scoreValue.textContent = String(game.score);
    bestScoreValue.textContent = String(game.bestScore);
  }

  function updateRunning(deltaSeconds) {
    const bird = game.bird;
    bird.velocityY += config.gravity * deltaSeconds;
    bird.y += bird.velocityY * deltaSeconds;
    bird.rotation = Math.max(-0.5, Math.min(1.25, bird.velocityY / 450));
    bird.wingPhase += deltaSeconds * 20;

    game.spawnAccumulator += deltaSeconds * 1000;
    if (game.spawnAccumulator >= config.pipeIntervalMs) {
      game.spawnAccumulator -= config.pipeIntervalMs;
      spawnPipePair();
    }

    for (const cloud of game.clouds) {
      cloud.x -= config.cloudSpeed * deltaSeconds;
      if (cloud.x + cloud.width < 0) {
        cloud.x = canvas.width + Math.random() * 120;
        cloud.y = 60 + Math.random() * (canvas.height * 0.35);
      }
      cloud.offset += deltaSeconds;
    }

    for (let index = game.pipes.length - 1; index >= 0; index -= 1) {
      const pipe = game.pipes[index];
      pipe.x -= config.pipeSpeed * deltaSeconds;

      if (!pipe.passed && bird.x > pipe.x + pipe.width) {
        pipe.passed = true;
        game.score += 1;
        updateScoreUI();
      }

      if (pipe.x + pipe.width < -4) {
        game.pipes.splice(index, 1);
      }
    }

    if (detectCollision()) {
      endGame();
    }
  }

  function detectCollision() {
    const bird = game.bird;
    const padding = config.collisionPadding;

    const left = bird.x - bird.width / 2 + padding;
    const right = bird.x + bird.width / 2 - padding;
    const top = bird.y - bird.height / 2 + padding;
    const bottom = bird.y + bird.height / 2 - padding;

    const floorTop = canvas.height - config.floorHeight;
    if (bottom >= floorTop || top <= 0) {
      return true;
    }

    for (const pipe of game.pipes) {
      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + pipe.width;
      const inPipeRange = right >= pipeLeft && left <= pipeRight;

      if (!inPipeRange) {
        continue;
      }

      const hitsTop = top <= pipe.topHeight;
      const hitsBottom = bottom >= pipe.bottomY;
      if (hitsTop || hitsBottom) {
        return true;
      }
    }

    return false;
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#84d9ff");
    gradient.addColorStop(1, "#d9f3ff");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const cloud of game.clouds) {
      const wave = Math.sin(cloud.offset) * 4;
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      roundRect(cloud.x, cloud.y + wave, cloud.width, cloud.height, 12, true);
      roundRect(cloud.x + 16, cloud.y - 8 + wave, cloud.width * 0.58, cloud.height, 12, true);
    }

    ctx.fillStyle = "#6ac261";
    ctx.fillRect(0, canvas.height - config.floorHeight, canvas.width, config.floorHeight);

    ctx.fillStyle = "#499944";
    for (let x = 0; x < canvas.width + 15; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - config.floorHeight);
      ctx.lineTo(x + 7.5, canvas.height - config.floorHeight - 10);
      ctx.lineTo(x + 15, canvas.height - config.floorHeight);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPipes() {
    for (const pipe of game.pipes) {
      const capHeight = 20;

      ctx.fillStyle = "#59b74b";
      ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
      ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, canvas.height - pipe.bottomY - config.floorHeight);

      ctx.fillStyle = "#4b953f";
      ctx.fillRect(pipe.x - 4, pipe.topHeight - capHeight, pipe.width + 8, capHeight);
      ctx.fillRect(pipe.x - 4, pipe.bottomY, pipe.width + 8, capHeight);
    }
  }

  function drawBird() {
    const bird = game.bird;
    if (!bird) {
      return;
    }

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    ctx.fillStyle = "#ffd34f";
    roundRect(-bird.width / 2, -bird.height / 2, bird.width, bird.height, 10, true);

    const wingLift = Math.sin(bird.wingPhase) * 5;
    ctx.fillStyle = "#ffb030";
    roundRect(-7, -4 + wingLift, 16, 10, 6, true);

    ctx.fillStyle = "#ffffff";
    roundRect(4, -8, 10, 10, 5, true);
    ctx.fillStyle = "#102235";
    roundRect(9, -4, 4, 4, 2, true);

    ctx.fillStyle = "#f47c2d";
    ctx.beginPath();
    ctx.moveTo(17, -2);
    ctx.lineTo(27, 1);
    ctx.lineTo(17, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawFrame() {
    drawBackground();
    drawPipes();
    drawBird();

    if (game.state === GAME_STATE.READY) {
      drawCenterText("Press Space to Flap", "#1f4f70");
    }
  }

  function drawCenterText(text, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = "600 22px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(text, canvas.width / 2, canvas.height * 0.2);
    ctx.restore();
  }

  function roundRect(x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fill) {
      ctx.fill();
    }
  }

  function gameLoop(timestamp) {
    if (!game.lastTime) {
      game.lastTime = timestamp;
    }

    const deltaSeconds = Math.min((timestamp - game.lastTime) / 1000, 0.033);
    game.lastTime = timestamp;

    if (game.state === GAME_STATE.RUNNING) {
      updateRunning(deltaSeconds);
    }

    drawFrame();
    game.animationFrame = window.requestAnimationFrame(gameLoop);
  }

  function onPointerAction(event) {
    if (event.target === startButton) {
      if (game.state === GAME_STATE.PAUSED) {
        pauseToggle();
      } else {
        startGame();
      }
      return;
    }

    flap();
  }

  function onKeyAction(event) {
    if (event.code === "Space") {
      event.preventDefault();
      flap();
      return;
    }

    if (event.code === "KeyP") {
      event.preventDefault();
      pauseToggle();
      return;
    }

    if (event.code === "KeyR") {
      event.preventDefault();
      restartGame();
    }
  }

  function initialize() {
    resetRunState();
    setState(GAME_STATE.READY);
    showOverlay("Flappy Wing", "Press Space, click, or tap to start.", "Start Game");
    updateScoreUI();

    canvas.addEventListener("pointerdown", onPointerAction);
    startButton.addEventListener("click", onPointerAction);
    window.addEventListener("keydown", onKeyAction);

    game.animationFrame = window.requestAnimationFrame(gameLoop);
  }

  window.addEventListener("beforeunload", () => {
    window.cancelAnimationFrame(game.animationFrame);
  });

  initialize();
})();
