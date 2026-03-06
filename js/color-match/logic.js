export const COLOR_MATCH_STATUS = {
  READY: "READY",
  RUNNING: "RUNNING",
  ROUND_COMPLETE: "ROUND_COMPLETE",
  OVER: "OVER"
};

export const COLOR_MATCH_DEFAULTS = {
  roundsPerGame: 5,
  channelMin: 0,
  channelMax: 255,
  startingGuess: { red: 128, green: 128, blue: 128 },
  maxPointsPerRound: 1000,
  nearMatchThreshold: 95,
  nearMatchBonus: 50,
  exactMatchBonus: 150,
  bestScoreStorageKey: "color-match-best-score"
};

function sanitizeNumber(value, fallback, min = Number.NEGATIVE_INFINITY) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, value);
}

function sanitizeInteger(value, fallback, min = Number.NEGATIVE_INFINITY) {
  return Math.floor(sanitizeNumber(value, fallback, min));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function resolveChannelName(channel) {
  if (channel === "r" || channel === "red") {
    return "red";
  }

  if (channel === "g" || channel === "green") {
    return "green";
  }

  if (channel === "b" || channel === "blue") {
    return "blue";
  }

  return null;
}

function normalizeColorCandidate(candidate, fallback, min, max) {
  const safe = candidate && typeof candidate === "object" ? candidate : {};
  return {
    red: clamp(sanitizeInteger(safe.red, fallback.red, min), min, max),
    green: clamp(sanitizeInteger(safe.green, fallback.green, min), min, max),
    blue: clamp(sanitizeInteger(safe.blue, fallback.blue, min), min, max)
  };
}

function copyColor(color) {
  return { red: color.red, green: color.green, blue: color.blue };
}

function readBestScore(storage, key) {
  if (!storage || typeof storage.getItem !== "function") {
    return 0;
  }

  const rawValue = storage.getItem(key);
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function writeBestScore(storage, key, score) {
  if (!storage || typeof storage.setItem !== "function") {
    return;
  }

  storage.setItem(key, String(Math.max(0, Math.floor(score))));
}

function randomChannelValue(randomFn, min, max) {
  const value = Number.isFinite(randomFn?.()) ? randomFn() : Math.random();
  return clamp(Math.round(min + value * (max - min)), min, max);
}

export function createColorMatchConfig(overrides = {}) {
  const roundsPerGame = sanitizeInteger(
    overrides.roundsPerGame,
    COLOR_MATCH_DEFAULTS.roundsPerGame,
    1
  );
  const channelMin = sanitizeInteger(
    overrides.channelMin,
    COLOR_MATCH_DEFAULTS.channelMin,
    0
  );
  const channelMax = Math.max(
    channelMin,
    sanitizeInteger(overrides.channelMax, COLOR_MATCH_DEFAULTS.channelMax, channelMin)
  );

  const startingGuess = normalizeColorCandidate(
    overrides.startingGuess,
    COLOR_MATCH_DEFAULTS.startingGuess,
    channelMin,
    channelMax
  );

  return {
    ...COLOR_MATCH_DEFAULTS,
    ...overrides,
    roundsPerGame,
    channelMin,
    channelMax,
    startingGuess,
    maxPointsPerRound: sanitizeInteger(
      overrides.maxPointsPerRound,
      COLOR_MATCH_DEFAULTS.maxPointsPerRound,
      1
    ),
    nearMatchThreshold: clamp(
      sanitizeNumber(overrides.nearMatchThreshold, COLOR_MATCH_DEFAULTS.nearMatchThreshold, 0),
      0,
      100
    ),
    nearMatchBonus: sanitizeInteger(
      overrides.nearMatchBonus,
      COLOR_MATCH_DEFAULTS.nearMatchBonus,
      0
    ),
    exactMatchBonus: sanitizeInteger(
      overrides.exactMatchBonus,
      COLOR_MATCH_DEFAULTS.exactMatchBonus,
      0
    )
  };
}

function createRoundState(state, targetColor, startedAtMs) {
  return {
    index: state.roundsPlayed + 1,
    startedAtMs: sanitizeNumber(startedAtMs, 0, 0),
    submittedAtMs: null,
    targetColor: copyColor(targetColor),
    guessColor: copyColor(state.config.startingGuess),
    adjustments: [],
    adjustmentCounts: { red: 0, green: 0, blue: 0 },
    totalAdjustments: 0,
    accuracyPercent: null,
    pointsAwarded: 0
  };
}

function createRandomTargetColor(state) {
  return {
    red: randomChannelValue(state.random, state.config.channelMin, state.config.channelMax),
    green: randomChannelValue(state.random, state.config.channelMin, state.config.channelMax),
    blue: randomChannelValue(state.random, state.config.channelMin, state.config.channelMax)
  };
}

function finalizeBestScore(state) {
  if (state.score <= state.bestScore) {
    return;
  }

  state.bestScore = state.score;
  writeBestScore(state.storage, state.config.bestScoreStorageKey, state.bestScore);
}

export function createColorMatchState(configOverrides = {}, runtime = {}) {
  const config = createColorMatchConfig(configOverrides);
  const storage = runtime.storage ?? (typeof window !== "undefined" ? window.localStorage : null);

  return {
    config,
    storage,
    random: typeof runtime.random === "function" ? runtime.random : Math.random,
    status: COLOR_MATCH_STATUS.READY,
    score: 0,
    bestScore: readBestScore(storage, config.bestScoreStorageKey),
    roundsPlayed: 0,
    currentRound: null,
    roundHistory: [],
    inputSummary: {
      totalAdjustments: 0,
      redAdjustments: 0,
      greenAdjustments: 0,
      blueAdjustments: 0
    },
    startedAtMs: null,
    endedAtMs: null,
    finalReason: null
  };
}

export function resetColorMatchState(state) {
  state.status = COLOR_MATCH_STATUS.READY;
  state.score = 0;
  state.roundsPlayed = 0;
  state.currentRound = null;
  state.roundHistory = [];
  state.inputSummary.totalAdjustments = 0;
  state.inputSummary.redAdjustments = 0;
  state.inputSummary.greenAdjustments = 0;
  state.inputSummary.blueAdjustments = 0;
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.finalReason = null;
  return state;
}

export function calculateColorDistance(targetColor, guessColor) {
  const dr = targetColor.red - guessColor.red;
  const dg = targetColor.green - guessColor.green;
  const db = targetColor.blue - guessColor.blue;
  return Math.sqrt((dr * dr) + (dg * dg) + (db * db));
}

export function calculateAccuracyPercent(targetColor, guessColor, channelMax = 255) {
  const maxDistance = Math.sqrt(3 * (channelMax * channelMax));
  const distance = calculateColorDistance(targetColor, guessColor);
  const normalized = maxDistance > 0 ? Math.max(0, 1 - (distance / maxDistance)) : 0;
  return normalized * 100;
}

export function calculateRoundScore(accuracyPercent, config) {
  const safeAccuracy = clamp(accuracyPercent, 0, 100);
  const basePoints = Math.round((safeAccuracy / 100) * config.maxPointsPerRound);
  let bonus = 0;

  if (safeAccuracy >= 100) {
    bonus += config.exactMatchBonus;
  } else if (safeAccuracy >= config.nearMatchThreshold) {
    bonus += config.nearMatchBonus;
  }

  return basePoints + bonus;
}

export function startColorMatchGame(state, options = {}) {
  resetColorMatchState(state);
  state.startedAtMs = sanitizeNumber(options.nowMs, 0, 0);
  return startNextRound(state, options);
}

export function startNextRound(state, options = {}) {
  if (state.roundsPlayed >= state.config.roundsPerGame) {
    return finishColorMatchGame(state, options.nowMs, "round-limit-reached");
  }

  const fallbackTarget = createRandomTargetColor(state);
  const targetColor = normalizeColorCandidate(
    options.targetColor,
    fallbackTarget,
    state.config.channelMin,
    state.config.channelMax
  );

  state.currentRound = createRoundState(state, targetColor, options.nowMs);
  state.status = COLOR_MATCH_STATUS.RUNNING;
  state.finalReason = null;
  state.endedAtMs = null;
  return state;
}

function recordAdjustment(state, round, channelName, previousValue, nextValue, rawValue, nowMs, mode) {
  const entry = {
    step: round.adjustments.length + 1,
    channel: channelName,
    mode,
    previousValue,
    nextValue,
    rawValue,
    changed: previousValue !== nextValue,
    atMs: sanitizeNumber(nowMs, 0, 0)
  };

  round.adjustments.push(entry);
  round.totalAdjustments += 1;
  round.adjustmentCounts[channelName] += 1;
  state.inputSummary.totalAdjustments += 1;
  state.inputSummary[`${channelName}Adjustments`] += 1;

  return entry;
}

function applyChannelChange(state, channel, targetValue, nowMs, mode, rawValue) {
  if (state.status !== COLOR_MATCH_STATUS.RUNNING || !state.currentRound) {
    return { accepted: false, reason: "round-not-running" };
  }

  const channelName = resolveChannelName(channel);
  if (!channelName) {
    return { accepted: false, reason: "invalid-channel" };
  }

  const roundedTarget = sanitizeInteger(targetValue, state.currentRound.guessColor[channelName], Number.NEGATIVE_INFINITY);
  const clampedTarget = clamp(roundedTarget, state.config.channelMin, state.config.channelMax);
  const previousValue = state.currentRound.guessColor[channelName];
  state.currentRound.guessColor[channelName] = clampedTarget;

  const adjustment = recordAdjustment(
    state,
    state.currentRound,
    channelName,
    previousValue,
    clampedTarget,
    rawValue,
    nowMs,
    mode
  );

  return {
    accepted: true,
    adjustment,
    guessColor: copyColor(state.currentRound.guessColor)
  };
}

export function setChannelValue(state, channel, value, nowMs = 0) {
  return applyChannelChange(state, channel, value, nowMs, "set", value);
}

export function adjustChannelValue(state, channel, delta, nowMs = 0) {
  const channelName = resolveChannelName(channel);
  const baseValue = state.currentRound?.guessColor?.[channelName];
  const nextValue = sanitizeNumber(baseValue, 0, 0) + sanitizeNumber(delta, 0);
  return applyChannelChange(state, channel, nextValue, nowMs, "delta", delta);
}

export function submitRound(state, nowMs = 0) {
  if (state.status !== COLOR_MATCH_STATUS.RUNNING || !state.currentRound) {
    return { accepted: false, reason: "round-not-running" };
  }

  const accuracy = calculateAccuracyPercent(
    state.currentRound.targetColor,
    state.currentRound.guessColor,
    state.config.channelMax
  );
  const pointsAwarded = calculateRoundScore(accuracy, state.config);

  state.currentRound.accuracyPercent = accuracy;
  state.currentRound.pointsAwarded = pointsAwarded;
  state.currentRound.submittedAtMs = sanitizeNumber(nowMs, 0, 0);

  state.score += pointsAwarded;
  state.roundsPlayed += 1;
  state.roundHistory.push(state.currentRound);
  state.currentRound = null;

  if (state.roundsPlayed >= state.config.roundsPerGame) {
    finishColorMatchGame(state, nowMs, "completed");
  } else {
    state.status = COLOR_MATCH_STATUS.ROUND_COMPLETE;
  }

  return {
    accepted: true,
    pointsAwarded,
    accuracyPercent: accuracy,
    totalScore: state.score,
    roundsPlayed: state.roundsPlayed
  };
}

export function finishColorMatchGame(state, nowMs = 0, reason = "manual-stop") {
  state.status = COLOR_MATCH_STATUS.OVER;
  state.currentRound = null;
  state.endedAtMs = sanitizeNumber(nowMs, 0, 0);
  state.finalReason = reason;
  finalizeBestScore(state);
  return state;
}

export function getColorMatchSnapshot(state) {
  return {
    status: state.status,
    score: state.score,
    bestScore: state.bestScore,
    roundsPlayed: state.roundsPlayed,
    roundsRemaining: Math.max(0, state.config.roundsPerGame - state.roundsPlayed),
    finalReason: state.finalReason,
    inputSummary: { ...state.inputSummary },
    currentRound: state.currentRound
      ? {
          index: state.currentRound.index,
          targetColor: copyColor(state.currentRound.targetColor),
          guessColor: copyColor(state.currentRound.guessColor),
          totalAdjustments: state.currentRound.totalAdjustments
        }
      : null
  };
}
