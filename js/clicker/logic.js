export const CLICKER_STATUS = {
  READY: "READY",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  OVER: "OVER"
};

export const CLICKER_DEFAULTS = {
  roundDurationMs: 30000,
  pointsPerClick: 1,
  comboWindowMs: 800,
  comboBonusCap: 4,
  autoStartOnClick: true,
  bestScoreStorageKey: "clicker-best-score"
};

function sanitizeNumber(value, fallback, min = Number.NEGATIVE_INFINITY) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, value);
}

function readBestScore(storage, key) {
  if (!storage || typeof storage.getItem !== "function") {
    return 0;
  }

  const raw = storage.getItem(key);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function writeBestScore(storage, key, value) {
  if (!storage || typeof storage.setItem !== "function") {
    return;
  }

  storage.setItem(key, String(Math.max(0, Math.floor(value))));
}

export function createClickerConfig(overrides = {}) {
  return {
    ...CLICKER_DEFAULTS,
    ...overrides,
    roundDurationMs: sanitizeNumber(overrides.roundDurationMs, CLICKER_DEFAULTS.roundDurationMs, 1000),
    pointsPerClick: sanitizeNumber(overrides.pointsPerClick, CLICKER_DEFAULTS.pointsPerClick, 1),
    comboWindowMs: sanitizeNumber(overrides.comboWindowMs, CLICKER_DEFAULTS.comboWindowMs, 0),
    comboBonusCap: sanitizeNumber(overrides.comboBonusCap, CLICKER_DEFAULTS.comboBonusCap, 0)
  };
}

export function createClickerState(configOverrides = {}, runtime = {}) {
  const config = createClickerConfig(configOverrides);
  const storage = runtime.storage ?? (typeof window !== "undefined" ? window.localStorage : null);

  return {
    config,
    storage,
    status: CLICKER_STATUS.READY,
    score: 0,
    bestScore: readBestScore(storage, config.bestScoreStorageKey),
    totalClicks: 0,
    comboStreak: 0,
    highestCombo: 0,
    remainingMs: config.roundDurationMs,
    startedAtMs: null,
    endedAtMs: null,
    lastTickAtMs: null,
    lastClickAtMs: null,
    finalReason: null,
    debug: {
      acceptedClicks: 0,
      rejectedClicks: 0,
      pauses: 0,
      resumes: 0
    }
  };
}

function awardClickScore(state, clickTimestampMs) {
  const { pointsPerClick, comboWindowMs, comboBonusCap } = state.config;
  const inComboWindow =
    Number.isFinite(state.lastClickAtMs) &&
    clickTimestampMs - state.lastClickAtMs <= comboWindowMs;

  state.comboStreak = inComboWindow ? state.comboStreak + 1 : 1;
  state.highestCombo = Math.max(state.highestCombo, state.comboStreak);

  const comboBonus = Math.min(comboBonusCap, Math.max(0, state.comboStreak - 1));
  const pointsAwarded = pointsPerClick + comboBonus;

  state.totalClicks += 1;
  state.score += pointsAwarded;
  state.lastClickAtMs = clickTimestampMs;
  state.debug.acceptedClicks += 1;

  return {
    accepted: true,
    pointsAwarded,
    comboStreak: state.comboStreak,
    score: state.score,
    totalClicks: state.totalClicks
  };
}

function toOverState(state, endedAtMs, reason) {
  state.status = CLICKER_STATUS.OVER;
  state.endedAtMs = endedAtMs;
  state.remainingMs = 0;
  state.finalReason = reason;

  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    writeBestScore(state.storage, state.config.bestScoreStorageKey, state.bestScore);
  }
}

export function resetClickerState(state) {
  state.status = CLICKER_STATUS.READY;
  state.score = 0;
  state.totalClicks = 0;
  state.comboStreak = 0;
  state.highestCombo = 0;
  state.remainingMs = state.config.roundDurationMs;
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.lastTickAtMs = null;
  state.lastClickAtMs = null;
  state.finalReason = null;
  state.debug.acceptedClicks = 0;
  state.debug.rejectedClicks = 0;
  state.debug.pauses = 0;
  state.debug.resumes = 0;

  return state;
}

export function startClickerGame(state, nowMs) {
  const normalizedNow = sanitizeNumber(nowMs, 0, 0);

  if (state.status === CLICKER_STATUS.RUNNING) {
    return state;
  }

  if (state.status === CLICKER_STATUS.OVER) {
    resetClickerState(state);
  }

  state.status = CLICKER_STATUS.RUNNING;
  state.startedAtMs = normalizedNow;
  state.lastTickAtMs = normalizedNow;
  state.endedAtMs = null;
  state.finalReason = null;

  return state;
}

export function pauseClickerGame(state) {
  if (state.status !== CLICKER_STATUS.RUNNING) {
    return state;
  }

  state.status = CLICKER_STATUS.PAUSED;
  state.debug.pauses += 1;
  return state;
}

export function resumeClickerGame(state, nowMs) {
  if (state.status !== CLICKER_STATUS.PAUSED) {
    return state;
  }

  state.status = CLICKER_STATUS.RUNNING;
  state.lastTickAtMs = sanitizeNumber(nowMs, state.lastTickAtMs ?? 0, 0);
  state.debug.resumes += 1;
  return state;
}

export function tickClickerGame(state, nowMs) {
  if (state.status !== CLICKER_STATUS.RUNNING) {
    return state;
  }

  const normalizedNow = sanitizeNumber(nowMs, state.lastTickAtMs ?? 0, 0);
  const lastTick = state.lastTickAtMs ?? normalizedNow;
  const elapsedSinceLastTick = Math.max(0, normalizedNow - lastTick);

  state.remainingMs = Math.max(0, state.remainingMs - elapsedSinceLastTick);
  state.lastTickAtMs = normalizedNow;

  if (state.remainingMs <= 0) {
    toOverState(state, normalizedNow, "time-expired");
  }

  return state;
}

export function registerClick(state, nowMs) {
  const normalizedNow = sanitizeNumber(nowMs, 0, 0);

  if (state.status === CLICKER_STATUS.READY && state.config.autoStartOnClick) {
    startClickerGame(state, normalizedNow);
  }

  tickClickerGame(state, normalizedNow);

  if (state.status !== CLICKER_STATUS.RUNNING) {
    state.debug.rejectedClicks += 1;
    return {
      accepted: false,
      pointsAwarded: 0,
      comboStreak: state.comboStreak,
      score: state.score,
      totalClicks: state.totalClicks
    };
  }

  return awardClickScore(state, normalizedNow);
}

export function finishClickerGame(state, nowMs = 0, reason = "manual-stop") {
  if (state.status === CLICKER_STATUS.OVER) {
    return state;
  }

  const normalizedNow = sanitizeNumber(nowMs, 0, 0);
  toOverState(state, normalizedNow, reason);
  return state;
}

export function getClickerSnapshot(state) {
  return {
    status: state.status,
    score: state.score,
    bestScore: state.bestScore,
    totalClicks: state.totalClicks,
    comboStreak: state.comboStreak,
    highestCombo: state.highestCombo,
    remainingMs: state.remainingMs,
    finalReason: state.finalReason
  };
}
