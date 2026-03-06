import { BASE_CONFIG, GAME_STATE, STORAGE_KEY } from "./constants.js";
import { readScore, resolveStorage, writeScore } from "../storage/score.js";

function loadBestScore(storage) {
  return readScore(storage, STORAGE_KEY, 0);
}

function saveBestScore(storage, value) {
  writeScore(storage, STORAGE_KEY, value);
}

function createRoundSeed(level, score) {
  return {
    level,
    score,
    rows: BASE_CONFIG.rows,
    cols: BASE_CONFIG.cols,
    variantStrength: Math.max(4, BASE_CONFIG.anomalyHueOffset - Math.floor(level / 3))
  };
}

export function createGameState(runtime = {}) {
  const storage = resolveStorage(runtime.storage);
  const bestScore = loadBestScore(storage);

  return {
    storage,
    status: GAME_STATE.LOADING,
    score: 0,
    bestScore,
    lives: BASE_CONFIG.startingLives,
    level: 1,
    remainingSeconds: BASE_CONFIG.roundDurationSeconds,
    currentRound: createRoundSeed(1, 0),
    activeGrid: null,
    selectedCellId: null,
    lastSelection: null,
    roundEvent: "Start the run to begin anomaly checks.",
    debug: {
      roundsPlayed: 0,
      correctSelections: 0,
      wrongSelections: 0,
      timeoutCount: 0,
      currentStreak: 0,
      lastResult: "none"
    }
  };
}

export function updateBestScore(state) {
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    saveBestScore(state.storage, state.bestScore);
  }
}

export function resetRunState(state) {
  state.score = 0;
  state.lives = BASE_CONFIG.startingLives;
  state.level = 1;
  state.remainingSeconds = BASE_CONFIG.roundDurationSeconds;
  state.currentRound = createRoundSeed(1, 0);
  state.selectedCellId = null;
  state.lastSelection = null;
  state.roundEvent = "Run started. Find the tile with the anomalous dataset record.";
  state.activeGrid = null;
  state.debug.roundsPlayed = 0;
  state.debug.correctSelections = 0;
  state.debug.wrongSelections = 0;
  state.debug.timeoutCount = 0;
  state.debug.currentStreak = 0;
  state.debug.lastResult = "none";
}

export function applyCorrectSelection(state) {
  const streakMultiplier = Math.min(
    BASE_CONFIG.streakBonusCap,
    1 + Math.floor(state.debug.currentStreak / 3)
  );
  state.score += BASE_CONFIG.scorePerCorrect * streakMultiplier;
  state.debug.lastResult = "correct";
  state.debug.roundsPlayed += 1;
  state.debug.correctSelections += 1;
  state.debug.currentStreak += 1;

  const nextLevel = 1 + Math.floor(state.debug.roundsPlayed / BASE_CONFIG.levelUpEvery);
  state.level = Math.max(state.level, nextLevel);

  const nextDuration = BASE_CONFIG.roundDurationSeconds - (state.level - 1);
  state.remainingSeconds = Math.max(BASE_CONFIG.minRoundDuration, nextDuration);

  state.currentRound = createRoundSeed(state.level, state.score);
  state.roundEvent = "Correct selection. Round advanced and score awarded.";
  updateBestScore(state);
}

export function applyWrongSelection(state) {
  state.lives = Math.max(0, state.lives - 1);
  state.remainingSeconds = Math.max(0, state.remainingSeconds - BASE_CONFIG.timerPenaltyOnMiss);
  state.debug.lastResult = "wrong";
  state.debug.wrongSelections += 1;
  state.debug.currentStreak = 0;
  state.roundEvent = "Wrong tile selected. Life and time penalty applied.";
}

export function applyRoundTimeout(state) {
  state.lives = Math.max(0, state.lives - 1);
  state.debug.lastResult = "timeout";
  state.debug.timeoutCount += 1;
  state.debug.currentStreak = 0;
  state.remainingSeconds = BASE_CONFIG.roundDurationSeconds;
  state.roundEvent = "Round timed out. Life lost and timer reset.";
}
