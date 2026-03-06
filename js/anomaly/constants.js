export const STORAGE_KEY = "anomaly-detector-best-score";

export const GAME_STATE = {
  LOADING: "loading",
  READY: "ready",
  RUNNING: "running",
  PAUSED: "paused",
  OVER: "over"
};

export const STATE_LABELS = {
  [GAME_STATE.LOADING]: "Loading",
  [GAME_STATE.READY]: "Ready",
  [GAME_STATE.RUNNING]: "Running",
  [GAME_STATE.PAUSED]: "Paused",
  [GAME_STATE.OVER]: "Game Over"
};

export const BASE_CONFIG = {
  canvasSize: 640,
  startingLives: 3,
  roundDurationSeconds: 20,
  rows: 6,
  cols: 6,
  tileGap: 8,
  baseHue: 145,
  anomalyHueOffset: 16,
  levelUpEvery: 4,
  minRoundDuration: 7,
  timerPenaltyOnMiss: 2
};
