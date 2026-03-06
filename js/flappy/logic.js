import { readScore, resolveStorage, writeScore } from "../storage/score.js";

export const FLAPPY_STATUS = {
  READY: "READY",
  RUNNING: "RUNNING",
  OVER: "OVER"
};

export const FLAPPY_DEFAULTS = {
  canvasWidth: 420,
  canvasHeight: 260,
  gravity: 1250,
  jumpVelocity: -360,
  pipeSpeed: 160,
  pipeWidth: 56,
  pipeGapHeight: 88,
  pipeSpawnIntervalMs: 1250,
  minPipeGapY: 64,
  maxPipeGapY: 196,
  birdX: 116,
  birdY: 130,
  birdRadius: 12,
  bestScoreStorageKey: "flappy-best-score"
};

function sanitizeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeInteger(value, fallback, min = Number.NEGATIVE_INFINITY) {
  return Math.max(min, Math.floor(sanitizeNumber(value, fallback)));
}

export function createFlappyConfig(overrides = {}) {
  const canvasWidth = sanitizeInteger(overrides.canvasWidth, FLAPPY_DEFAULTS.canvasWidth, 240);
  const canvasHeight = sanitizeInteger(overrides.canvasHeight, FLAPPY_DEFAULTS.canvasHeight, 180);
  const minPipeGapY = sanitizeInteger(overrides.minPipeGapY, FLAPPY_DEFAULTS.minPipeGapY, 24);
  const maxPipeGapY = sanitizeInteger(
    overrides.maxPipeGapY,
    FLAPPY_DEFAULTS.maxPipeGapY,
    minPipeGapY + 1
  );

  return {
    ...FLAPPY_DEFAULTS,
    ...overrides,
    canvasWidth,
    canvasHeight,
    gravity: sanitizeNumber(overrides.gravity, FLAPPY_DEFAULTS.gravity),
    jumpVelocity: sanitizeNumber(overrides.jumpVelocity, FLAPPY_DEFAULTS.jumpVelocity),
    pipeSpeed: sanitizeNumber(overrides.pipeSpeed, FLAPPY_DEFAULTS.pipeSpeed),
    pipeWidth: sanitizeInteger(overrides.pipeWidth, FLAPPY_DEFAULTS.pipeWidth, 24),
    pipeGapHeight: sanitizeInteger(overrides.pipeGapHeight, FLAPPY_DEFAULTS.pipeGapHeight, 40),
    pipeSpawnIntervalMs: sanitizeInteger(
      overrides.pipeSpawnIntervalMs,
      FLAPPY_DEFAULTS.pipeSpawnIntervalMs,
      250
    ),
    minPipeGapY,
    maxPipeGapY,
    birdX: sanitizeInteger(overrides.birdX, FLAPPY_DEFAULTS.birdX, 32),
    birdY: sanitizeInteger(overrides.birdY, FLAPPY_DEFAULTS.birdY, 24),
    birdRadius: sanitizeInteger(overrides.birdRadius, FLAPPY_DEFAULTS.birdRadius, 6)
  };
}

export function createFlappyState(configOverrides = {}, runtime = {}) {
  const config = createFlappyConfig(configOverrides);
  const storage = resolveStorage(runtime.storage);

  return {
    config,
    storage,
    status: FLAPPY_STATUS.READY,
    score: 0,
    bestScore: readScore(storage, config.bestScoreStorageKey, 0),
    elapsedMs: 0,
    spawnedPipeCount: 0,
    bird: {
      x: config.birdX,
      y: config.birdY,
      velocityY: 0,
      radius: config.birdRadius
    },
    pipes: [],
    nextPipeInMs: config.pipeSpawnIntervalMs,
    finalReason: null
  };
}

function finalizeGame(state, reason) {
  state.status = FLAPPY_STATUS.OVER;
  state.finalReason = reason;
  state.bird.velocityY = 0;

  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    writeScore(state.storage, state.config.bestScoreStorageKey, state.bestScore);
  }
}

function createPipeAtX(state, x, randomValue) {
  const { config } = state;
  const normalizedRandom = clamp(sanitizeNumber(randomValue, Math.random()), 0, 1);
  const gapY = Math.round(config.minPipeGapY + normalizedRandom * (config.maxPipeGapY - config.minPipeGapY));

  return {
    x,
    width: config.pipeWidth,
    gapY,
    gapHeight: config.pipeGapHeight,
    scored: false
  };
}

export function resetFlappyState(state) {
  state.status = FLAPPY_STATUS.READY;
  state.score = 0;
  state.elapsedMs = 0;
  state.spawnedPipeCount = 0;
  state.bird.y = state.config.birdY;
  state.bird.velocityY = 0;
  state.pipes = [];
  state.nextPipeInMs = state.config.pipeSpawnIntervalMs;
  state.finalReason = null;
  return state;
}

export function startFlappyGame(state) {
  if (state.status === FLAPPY_STATUS.RUNNING) {
    return state;
  }

  if (state.status === FLAPPY_STATUS.OVER) {
    resetFlappyState(state);
  }

  state.status = FLAPPY_STATUS.RUNNING;
  state.finalReason = null;
  return state;
}

export function flapBird(state) {
  if (state.status === FLAPPY_STATUS.OVER) {
    resetFlappyState(state);
  }

  if (state.status === FLAPPY_STATUS.READY) {
    startFlappyGame(state);
  }

  if (state.status === FLAPPY_STATUS.RUNNING) {
    state.bird.velocityY = state.config.jumpVelocity;
  }

  return state;
}

function detectPipeCollision(state, pipe) {
  const birdLeft = state.bird.x - state.bird.radius;
  const birdRight = state.bird.x + state.bird.radius;
  const birdTop = state.bird.y - state.bird.radius;
  const birdBottom = state.bird.y + state.bird.radius;

  const pipeLeft = pipe.x;
  const pipeRight = pipe.x + pipe.width;

  if (birdRight <= pipeLeft || birdLeft >= pipeRight) {
    return false;
  }

  const gapTop = pipe.gapY - pipe.gapHeight / 2;
  const gapBottom = pipe.gapY + pipe.gapHeight / 2;

  return birdTop < gapTop || birdBottom > gapBottom;
}

function spawnPipesIfNeeded(state, elapsedMs, randomFn) {
  state.nextPipeInMs -= elapsedMs;
  if (state.nextPipeInMs > 0) {
    return;
  }

  while (state.nextPipeInMs <= 0) {
    state.pipes.push(
      createPipeAtX(
        state,
        state.config.canvasWidth + state.config.pipeWidth,
        Number.isFinite(randomFn?.()) ? randomFn() : Math.random()
      )
    );
    state.nextPipeInMs += state.config.pipeSpawnIntervalMs;
    state.spawnedPipeCount += 1;
  }
}

export function stepFlappyGame(state, deltaMs, randomFn = Math.random) {
  if (state.status !== FLAPPY_STATUS.RUNNING) {
    return state;
  }

  const elapsedMs = clamp(sanitizeNumber(deltaMs, 0), 0, 50);
  const dt = elapsedMs / 1000;

  state.elapsedMs += elapsedMs;
  state.bird.velocityY += state.config.gravity * dt;
  state.bird.y += state.bird.velocityY * dt;

  const floorY = state.config.canvasHeight - state.bird.radius;
  const ceilingY = state.bird.radius;

  if (state.bird.y <= ceilingY) {
    state.bird.y = ceilingY;
    finalizeGame(state, "ceiling-hit");
    return state;
  }

  if (state.bird.y >= floorY) {
    state.bird.y = floorY;
    finalizeGame(state, "ground-hit");
    return state;
  }

  for (const pipe of state.pipes) {
    pipe.x -= state.config.pipeSpeed * dt;
  }

  state.pipes = state.pipes.filter((pipe) => pipe.x + pipe.width >= -4);

  for (const pipe of state.pipes) {
    if (!pipe.scored && pipe.x + pipe.width < state.bird.x - state.bird.radius) {
      pipe.scored = true;
      state.score += 1;
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
        writeScore(state.storage, state.config.bestScoreStorageKey, state.bestScore);
      }
    }

    if (detectPipeCollision(state, pipe)) {
      finalizeGame(state, "pipe-hit");
      return state;
    }
  }

  spawnPipesIfNeeded(state, elapsedMs, randomFn);
  return state;
}

export function getFlappySnapshot(state) {
  return {
    status: state.status,
    score: state.score,
    bestScore: state.bestScore,
    finalReason: state.finalReason,
    birdY: state.bird.y,
    pipeCount: state.pipes.length,
    elapsedMs: state.elapsedMs
  };
}
