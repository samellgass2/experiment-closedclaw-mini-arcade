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
  perfectAdjustmentBonus: 40,
  freeAdjustments: 5,
  adjustmentPenaltyStep: 6,
  maxAdjustmentPenalty: 150,
  fastRoundThresholdMs: 12000,
  maxSpeedBonus: 90,
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
    ),
    perfectAdjustmentBonus: sanitizeInteger(
      overrides.perfectAdjustmentBonus,
      COLOR_MATCH_DEFAULTS.perfectAdjustmentBonus,
      0
    ),
    freeAdjustments: sanitizeInteger(
      overrides.freeAdjustments,
      COLOR_MATCH_DEFAULTS.freeAdjustments,
      0
    ),
    adjustmentPenaltyStep: sanitizeInteger(
      overrides.adjustmentPenaltyStep,
      COLOR_MATCH_DEFAULTS.adjustmentPenaltyStep,
      0
    ),
    maxAdjustmentPenalty: sanitizeInteger(
      overrides.maxAdjustmentPenalty,
      COLOR_MATCH_DEFAULTS.maxAdjustmentPenalty,
      0
    ),
    fastRoundThresholdMs: sanitizeInteger(
      overrides.fastRoundThresholdMs,
      COLOR_MATCH_DEFAULTS.fastRoundThresholdMs,
      1
    ),
    maxSpeedBonus: sanitizeInteger(
      overrides.maxSpeedBonus,
      COLOR_MATCH_DEFAULTS.maxSpeedBonus,
      0
    )
  };
}

function createRoundState(state, targetColor, startedAtMs) {
  return {
    index: state.roundsPlayed + 1,
    startedAtMs: sanitizeNumber(startedAtMs, 0, 0),
    submittedAtMs: null,
    durationMs: 0,
    targetColor: copyColor(targetColor),
    guessColor: copyColor(state.config.startingGuess),
    adjustments: [],
    adjustmentCounts: { red: 0, green: 0, blue: 0 },
    totalAdjustments: 0,
    accuracyPercent: null,
    pointsAwarded: 0,
    scoreBreakdown: null,
    feedback: null
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

function calculateSpeedBonus(durationMs, config) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || config.fastRoundThresholdMs <= 0) {
    return 0;
  }

  const remaining = Math.max(0, config.fastRoundThresholdMs - durationMs);
  const ratio = remaining / config.fastRoundThresholdMs;
  return Math.round(ratio * config.maxSpeedBonus);
}

function calculateAdjustmentPenalty(totalAdjustments, config) {
  const extraAdjustments = Math.max(0, totalAdjustments - config.freeAdjustments);
  const rawPenalty = extraAdjustments * config.adjustmentPenaltyStep;
  return clamp(rawPenalty, 0, config.maxAdjustmentPenalty);
}

function calculateAdjustmentBonus(totalAdjustments, config) {
  return totalAdjustments === 0 ? config.perfectAdjustmentBonus : 0;
}

function resolveAccuracyBand(accuracyPercent, nearMatchThreshold) {
  if (accuracyPercent >= 100) {
    return "exact";
  }

  if (accuracyPercent >= nearMatchThreshold) {
    return "near";
  }

  if (accuracyPercent >= 80) {
    return "strong";
  }

  if (accuracyPercent >= 60) {
    return "fair";
  }

  return "off";
}

function createRoundFeedback(summary) {
  const { accuracyBand, adjustmentPenalty, speedBonus, totalAdjustments, durationMs } = summary;

  let headline = "Keep tuning";
  let detail = "Refine the channels and try to get closer.";

  if (accuracyBand === "exact") {
    headline = "Perfect match";
    detail = "All channels align exactly with the target color.";
  } else if (accuracyBand === "near") {
    headline = "Near match";
    detail = "You were very close. A tiny channel adjustment could perfect it.";
  } else if (accuracyBand === "strong") {
    headline = "Solid accuracy";
    detail = "Good alignment overall. Focus on the largest color gap next round.";
  } else if (accuracyBand === "fair") {
    headline = "On track";
    detail = "Some channels are close. Keep refining values to improve precision.";
  }

  const tags = [];
  if (speedBonus > 0) {
    tags.push(`Speed bonus +${speedBonus}`);
  }
  if (adjustmentPenalty > 0) {
    tags.push(`Adjustment penalty -${adjustmentPenalty}`);
  }
  if (!tags.length) {
    tags.push("Balanced round");
  }

  return {
    headline,
    detail,
    tags,
    adjustmentNote: `${totalAdjustments} adjustments`,
    durationNote: `${Math.round(durationMs)} ms`
  };
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
    performanceSummary: {
      averageAccuracy: 0,
      bestAccuracy: 0,
      currentNearStreak: 0,
      bestNearStreak: 0
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
  state.performanceSummary.averageAccuracy = 0;
  state.performanceSummary.bestAccuracy = 0;
  state.performanceSummary.currentNearStreak = 0;
  state.performanceSummary.bestNearStreak = 0;
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

export function calculateRoundScoreDetails(accuracyPercent, config, performance = {}) {
  const scoringConfig = { ...COLOR_MATCH_DEFAULTS, ...(config ?? {}) };
  const safeAccuracy = clamp(accuracyPercent, 0, 100);
  const basePoints = Math.round((safeAccuracy / 100) * scoringConfig.maxPointsPerRound);

  let accuracyBonus = 0;
  if (safeAccuracy >= 100) {
    accuracyBonus += scoringConfig.exactMatchBonus;
  } else if (safeAccuracy >= scoringConfig.nearMatchThreshold) {
    accuracyBonus += scoringConfig.nearMatchBonus;
  }

  const totalAdjustments = sanitizeInteger(
    performance.totalAdjustments,
    scoringConfig.freeAdjustments,
    0
  );
  const durationMs = sanitizeNumber(
    performance.durationMs,
    scoringConfig.fastRoundThresholdMs,
    0
  );

  const adjustmentBonus = calculateAdjustmentBonus(totalAdjustments, scoringConfig);
  const adjustmentPenalty = calculateAdjustmentPenalty(totalAdjustments, scoringConfig);
  const speedBonus = calculateSpeedBonus(durationMs, scoringConfig);

  const totalPoints = Math.max(
    0,
    basePoints + accuracyBonus + adjustmentBonus + speedBonus - adjustmentPenalty
  );

  return {
    points: totalPoints,
    breakdown: {
      basePoints,
      accuracyBonus,
      adjustmentBonus,
      speedBonus,
      adjustmentPenalty,
      totalAdjustments,
      durationMs
    }
  };
}

export function calculateRoundScore(accuracyPercent, config, performance = {}) {
  return calculateRoundScoreDetails(accuracyPercent, config, performance).points;
}

function updatePerformanceSummary(state, accuracyPercent) {
  const safeAccuracy = clamp(accuracyPercent, 0, 100);
  const previousRounds = state.roundsPlayed - 1;
  const previousAverage = state.performanceSummary.averageAccuracy;

  state.performanceSummary.averageAccuracy = previousRounds >= 0
    ? ((previousAverage * previousRounds) + safeAccuracy) / Math.max(1, state.roundsPlayed)
    : safeAccuracy;

  state.performanceSummary.bestAccuracy = Math.max(
    state.performanceSummary.bestAccuracy,
    safeAccuracy
  );

  if (safeAccuracy >= state.config.nearMatchThreshold) {
    state.performanceSummary.currentNearStreak += 1;
    state.performanceSummary.bestNearStreak = Math.max(
      state.performanceSummary.bestNearStreak,
      state.performanceSummary.currentNearStreak
    );
  } else {
    state.performanceSummary.currentNearStreak = 0;
  }
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

  const roundedTarget = sanitizeInteger(
    targetValue,
    state.currentRound.guessColor[channelName],
    Number.NEGATIVE_INFINITY
  );
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

  const submittedAtMs = sanitizeNumber(nowMs, 0, 0);
  const durationMs = Math.max(0, submittedAtMs - state.currentRound.startedAtMs);

  const accuracy = calculateAccuracyPercent(
    state.currentRound.targetColor,
    state.currentRound.guessColor,
    state.config.channelMax
  );
  const scoreResult = calculateRoundScoreDetails(accuracy, state.config, {
    totalAdjustments: state.currentRound.totalAdjustments,
    durationMs
  });
  const pointsAwarded = scoreResult.points;

  state.currentRound.accuracyPercent = accuracy;
  state.currentRound.pointsAwarded = pointsAwarded;
  state.currentRound.submittedAtMs = submittedAtMs;
  state.currentRound.durationMs = durationMs;

  const accuracyBand = resolveAccuracyBand(accuracy, state.config.nearMatchThreshold);
  const feedback = createRoundFeedback({
    accuracyBand,
    adjustmentPenalty: scoreResult.breakdown.adjustmentPenalty,
    speedBonus: scoreResult.breakdown.speedBonus,
    totalAdjustments: state.currentRound.totalAdjustments,
    durationMs
  });

  state.currentRound.scoreBreakdown = {
    ...scoreResult.breakdown,
    accuracyBand
  };
  state.currentRound.feedback = feedback;

  state.score += pointsAwarded;
  state.roundsPlayed += 1;
  state.roundHistory.push(state.currentRound);
  updatePerformanceSummary(state, accuracy);
  state.currentRound = null;

  if (state.roundsPlayed >= state.config.roundsPerGame) {
    finishColorMatchGame(state, submittedAtMs, "completed");
  } else {
    state.status = COLOR_MATCH_STATUS.ROUND_COMPLETE;
  }

  return {
    accepted: true,
    pointsAwarded,
    accuracyPercent: accuracy,
    totalScore: state.score,
    roundsPlayed: state.roundsPlayed,
    durationMs,
    feedback,
    scoreBreakdown: scoreResult.breakdown,
    accuracyBand
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

function mapRoundForSnapshot(round) {
  if (!round) {
    return null;
  }

  return {
    index: round.index,
    targetColor: copyColor(round.targetColor),
    guessColor: copyColor(round.guessColor),
    totalAdjustments: round.totalAdjustments,
    accuracyPercent: round.accuracyPercent,
    pointsAwarded: round.pointsAwarded,
    durationMs: round.durationMs,
    scoreBreakdown: round.scoreBreakdown ? { ...round.scoreBreakdown } : null,
    feedback: round.feedback
      ? {
          headline: round.feedback.headline,
          detail: round.feedback.detail,
          tags: [...round.feedback.tags],
          adjustmentNote: round.feedback.adjustmentNote,
          durationNote: round.feedback.durationNote
        }
      : null
  };
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
    performanceSummary: {
      averageAccuracy: state.performanceSummary.averageAccuracy,
      bestAccuracy: state.performanceSummary.bestAccuracy,
      currentNearStreak: state.performanceSummary.currentNearStreak,
      bestNearStreak: state.performanceSummary.bestNearStreak
    },
    currentRound: mapRoundForSnapshot(state.currentRound),
    latestRoundResult: mapRoundForSnapshot(state.roundHistory[state.roundHistory.length - 1] ?? null)
  };
}
