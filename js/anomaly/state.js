import { BASE_CONFIG, GAME_STATE, STORAGE_KEY } from "./constants.js";

function loadBestScore() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function saveBestScore(value) {
  window.localStorage.setItem(STORAGE_KEY, String(value));
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

export function createGameState() {
  const bestScore = loadBestScore();

  return {
    status: GAME_STATE.LOADING,
    score: 0,
    bestScore,
    lives: BASE_CONFIG.startingLives,
    level: 1,
    remainingSeconds: BASE_CONFIG.roundDurationSeconds,
    currentRound: createRoundSeed(1, 0),
    activeGrid: null,
    selectedCellId: null,
    debug: {
      roundsPlayed: 0,
      lastResult: "none"
    }
  };
}

export function updateBestScore(state) {
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    saveBestScore(state.bestScore);
  }
}

export function resetRunState(state) {
  state.score = 0;
  state.lives = BASE_CONFIG.startingLives;
  state.level = 1;
  state.remainingSeconds = BASE_CONFIG.roundDurationSeconds;
  state.currentRound = createRoundSeed(1, 0);
  state.selectedCellId = null;
  state.activeGrid = null;
  state.debug.roundsPlayed = 0;
  state.debug.lastResult = "none";
}

export function applyCorrectSelection(state) {
  state.score += 10;
  state.debug.lastResult = "correct";
  state.debug.roundsPlayed += 1;

  const nextLevel = 1 + Math.floor(state.debug.roundsPlayed / BASE_CONFIG.levelUpEvery);
  state.level = Math.max(state.level, nextLevel);

  const nextDuration = BASE_CONFIG.roundDurationSeconds - (state.level - 1);
  state.remainingSeconds = Math.max(BASE_CONFIG.minRoundDuration, nextDuration);

  state.currentRound = createRoundSeed(state.level, state.score);
  updateBestScore(state);
}

export function applyWrongSelection(state) {
  state.lives = Math.max(0, state.lives - 1);
  state.remainingSeconds = Math.max(0, state.remainingSeconds - BASE_CONFIG.timerPenaltyOnMiss);
  state.debug.lastResult = "wrong";
}

export function applyRoundTimeout(state) {
  state.lives = Math.max(0, state.lives - 1);
  state.debug.lastResult = "timeout";
  state.remainingSeconds = BASE_CONFIG.roundDurationSeconds;
}
