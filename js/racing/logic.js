export const RACING_STATUS = {
  READY: "READY",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  OVER: "OVER"
};

export const RACING_DEFAULTS = {
  canvasWidth: 960,
  canvasHeight: 600,
  lapTarget: 3,
  maxSpeed: 480,
  reverseSpeed: 180,
  acceleration: 420,
  braking: 520,
  drag: 260,
  offTrackDrag: 600,
  steeringRate: 3.1,
  offTrackGripPenalty: 0.6,
  bestLapStorageKey: "mini-arcade-racing-best-lap"
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function readBestLapMs(storage, key) {
  if (!storage || typeof storage.getItem !== "function") {
    return null;
  }

  const raw = storage.getItem(key);
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function writeBestLapMs(storage, key, lapMs) {
  if (!storage || typeof storage.setItem !== "function") {
    return;
  }

  storage.setItem(key, String(Math.round(Math.max(0, lapMs))));
}

export function createRacingConfig(overrides = {}) {
  return {
    ...RACING_DEFAULTS,
    ...overrides,
    canvasWidth: Math.max(320, sanitizeNumber(overrides.canvasWidth, RACING_DEFAULTS.canvasWidth)),
    canvasHeight: Math.max(240, sanitizeNumber(overrides.canvasHeight, RACING_DEFAULTS.canvasHeight)),
    lapTarget: Math.max(1, Math.floor(sanitizeNumber(overrides.lapTarget, RACING_DEFAULTS.lapTarget))),
    maxSpeed: Math.max(80, sanitizeNumber(overrides.maxSpeed, RACING_DEFAULTS.maxSpeed)),
    reverseSpeed: Math.max(0, sanitizeNumber(overrides.reverseSpeed, RACING_DEFAULTS.reverseSpeed)),
    acceleration: Math.max(10, sanitizeNumber(overrides.acceleration, RACING_DEFAULTS.acceleration)),
    braking: Math.max(10, sanitizeNumber(overrides.braking, RACING_DEFAULTS.braking)),
    drag: Math.max(0, sanitizeNumber(overrides.drag, RACING_DEFAULTS.drag)),
    offTrackDrag: Math.max(0, sanitizeNumber(overrides.offTrackDrag, RACING_DEFAULTS.offTrackDrag)),
    steeringRate: Math.max(0.1, sanitizeNumber(overrides.steeringRate, RACING_DEFAULTS.steeringRate)),
    offTrackGripPenalty: clamp(
      sanitizeNumber(overrides.offTrackGripPenalty, RACING_DEFAULTS.offTrackGripPenalty),
      0.1,
      1
    )
  };
}

export function createDefaultTrack(width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadiusX = width * 0.4;
  const outerRadiusY = height * 0.38;
  const innerRadiusX = width * 0.24;
  const innerRadiusY = height * 0.21;

  const startAngle = -Math.PI / 2;
  const spawnRadiusX = (outerRadiusX + innerRadiusX) / 2;
  const spawnRadiusY = (outerRadiusY + innerRadiusY) / 2;

  return {
    centerX,
    centerY,
    outerRadiusX,
    outerRadiusY,
    innerRadiusX,
    innerRadiusY,
    startLine: {
      angle: startAngle,
      width: 40
    },
    spawnPoint: {
      x: centerX + Math.cos(startAngle) * spawnRadiusX,
      y: centerY + Math.sin(startAngle) * spawnRadiusY,
      heading: 0
    }
  };
}

function getDistanceToEllipseCenter(track, x, y, radiusX, radiusY) {
  const normalizedX = (x - track.centerX) / radiusX;
  const normalizedY = (y - track.centerY) / radiusY;
  return Math.sqrt((normalizedX * normalizedX) + (normalizedY * normalizedY));
}

export function isCarOnTrack(track, car) {
  const outerDistance = getDistanceToEllipseCenter(track, car.x, car.y, track.outerRadiusX, track.outerRadiusY);
  const innerDistance = getDistanceToEllipseCenter(track, car.x, car.y, track.innerRadiusX, track.innerRadiusY);
  return outerDistance <= 1 && innerDistance >= 1;
}

export function createRacingState(configOverrides = {}, runtime = {}) {
  const config = createRacingConfig(configOverrides);
  const storage = runtime.storage ?? (typeof window !== "undefined" ? window.localStorage : null);
  const track = createDefaultTrack(config.canvasWidth, config.canvasHeight);
  const bestLapMs = readBestLapMs(storage, config.bestLapStorageKey);

  return {
    config,
    storage,
    track,
    status: RACING_STATUS.READY,
    startedAtMs: null,
    endedAtMs: null,
    lastTickMs: null,
    elapsedMs: 0,
    completedLaps: 0,
    currentLapMs: 0,
    bestLapMs,
    lapTimesMs: [],
    finishReason: null,
    eventMessage: "Press Start Race to begin.",
    car: {
      x: track.spawnPoint.x,
      y: track.spawnPoint.y,
      heading: track.spawnPoint.heading,
      speed: 0,
      steer: 0,
      width: 22,
      length: 38,
      offTrack: false,
      crossedStartGate: false
    },
    input: {
      throttle: false,
      brake: false,
      steerLeft: false,
      steerRight: false
    }
  };
}

export function resetRacingState(state) {
  const track = state.track;

  state.status = RACING_STATUS.READY;
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.lastTickMs = null;
  state.elapsedMs = 0;
  state.completedLaps = 0;
  state.currentLapMs = 0;
  state.lapTimesMs = [];
  state.finishReason = null;
  state.eventMessage = "Press Start Race to begin.";

  state.car.x = track.spawnPoint.x;
  state.car.y = track.spawnPoint.y;
  state.car.heading = track.spawnPoint.heading;
  state.car.speed = 0;
  state.car.steer = 0;
  state.car.offTrack = false;
  state.car.crossedStartGate = false;

  return state;
}

export function setInputState(state, partialInput = {}) {
  state.input.throttle = Boolean(partialInput.throttle ?? state.input.throttle);
  state.input.brake = Boolean(partialInput.brake ?? state.input.brake);
  state.input.steerLeft = Boolean(partialInput.steerLeft ?? state.input.steerLeft);
  state.input.steerRight = Boolean(partialInput.steerRight ?? state.input.steerRight);
}

export function startRace(state, nowMs = 0) {
  resetRacingState(state);
  state.status = RACING_STATUS.RUNNING;
  state.startedAtMs = sanitizeNumber(nowMs, 0);
  state.lastTickMs = state.startedAtMs;
  state.eventMessage = "Race started. Complete three laps as fast as possible.";
  return state;
}

export function pauseRace(state) {
  if (state.status !== RACING_STATUS.RUNNING) {
    return { accepted: false, reason: "race-not-running" };
  }

  state.status = RACING_STATUS.PAUSED;
  state.eventMessage = "Race paused.";
  return { accepted: true };
}

export function resumeRace(state, nowMs = 0) {
  if (state.status !== RACING_STATUS.PAUSED) {
    return { accepted: false, reason: "race-not-paused" };
  }

  state.status = RACING_STATUS.RUNNING;
  state.lastTickMs = sanitizeNumber(nowMs, state.lastTickMs ?? 0);
  state.eventMessage = "Race resumed.";
  return { accepted: true };
}

export function finishRace(state, nowMs = 0, reason = "manual-stop") {
  state.status = RACING_STATUS.OVER;
  state.endedAtMs = sanitizeNumber(nowMs, state.lastTickMs ?? 0);
  state.finishReason = reason;
  state.eventMessage = reason === "lap-target-reached"
    ? "Race complete. Press Restart to run again."
    : "Race ended.";
  return state;
}

function applySteeringAndSpeed(state, dtSec) {
  const { car, input, config } = state;
  const steeringInput = (input.steerRight ? 1 : 0) - (input.steerLeft ? 1 : 0);
  const steeringGrip = car.offTrack ? config.offTrackGripPenalty : 1;
  car.steer = steeringInput;

  if (input.throttle && !input.brake) {
    car.speed += config.acceleration * dtSec;
  } else if (input.brake && !input.throttle) {
    if (car.speed > 0) {
      car.speed -= config.braking * dtSec;
    } else {
      car.speed -= config.acceleration * dtSec;
    }
  } else if (car.speed > 0) {
    car.speed -= config.drag * dtSec;
  } else if (car.speed < 0) {
    car.speed += config.drag * dtSec;
  }

  if (car.offTrack) {
    if (car.speed > 0) {
      car.speed -= config.offTrackDrag * dtSec;
    } else if (car.speed < 0) {
      car.speed += config.offTrackDrag * dtSec;
    }
  }

  if (Math.abs(car.speed) < 8) {
    car.speed = 0;
  }

  car.speed = clamp(car.speed, -config.reverseSpeed, config.maxSpeed);

  const turnStrength = (car.speed / config.maxSpeed) * config.steeringRate * steeringGrip;
  car.heading += steeringInput * turnStrength * dtSec;
}

function applyPosition(state, dtSec) {
  const { car } = state;

  car.x += Math.cos(car.heading) * car.speed * dtSec;
  car.y += Math.sin(car.heading) * car.speed * dtSec;

  car.offTrack = !isCarOnTrack(state.track, car);
}

function updateLapProgress(state) {
  const { car, track } = state;
  const deltaY = car.y - track.centerY;
  const nearStartX = Math.abs(car.x - track.centerX) <= track.startLine.width;

  if (deltaY < -track.innerRadiusY && nearStartX) {
    car.crossedStartGate = true;
  }

  const crossingFinish = deltaY >= -track.innerRadiusY && nearStartX && car.crossedStartGate;
  if (!crossingFinish) {
    return;
  }

  car.crossedStartGate = false;
  state.completedLaps += 1;
  state.lapTimesMs.push(state.currentLapMs);

  if (!state.bestLapMs || state.currentLapMs < state.bestLapMs) {
    state.bestLapMs = state.currentLapMs;
    writeBestLapMs(state.storage, state.config.bestLapStorageKey, state.bestLapMs);
  }

  state.eventMessage = `Lap ${state.completedLaps} completed in ${(state.currentLapMs / 1000).toFixed(2)}s.`;
  state.currentLapMs = 0;

  if (state.completedLaps >= state.config.lapTarget) {
    finishRace(state, state.lastTickMs, "lap-target-reached");
  }
}

export function tickRace(state, nowMs = 0) {
  if (state.status !== RACING_STATUS.RUNNING) {
    return state;
  }

  const safeNowMs = sanitizeNumber(nowMs, state.lastTickMs ?? 0);
  const dtMs = clamp(safeNowMs - (state.lastTickMs ?? safeNowMs), 0, 64);
  const dtSec = dtMs / 1000;

  state.lastTickMs = safeNowMs;
  state.elapsedMs += dtMs;
  state.currentLapMs += dtMs;

  applySteeringAndSpeed(state, dtSec);
  applyPosition(state, dtSec);
  updateLapProgress(state);

  return state;
}

export function getRacingSnapshot(state) {
  return {
    status: state.status,
    elapsedMs: state.elapsedMs,
    currentLapMs: state.currentLapMs,
    completedLaps: state.completedLaps,
    lapTarget: state.config.lapTarget,
    bestLapMs: state.bestLapMs,
    lapTimesMs: [...state.lapTimesMs],
    eventMessage: state.eventMessage,
    finishReason: state.finishReason,
    car: {
      x: state.car.x,
      y: state.car.y,
      heading: state.car.heading,
      speed: state.car.speed,
      steer: state.car.steer,
      offTrack: state.car.offTrack
    }
  };
}
