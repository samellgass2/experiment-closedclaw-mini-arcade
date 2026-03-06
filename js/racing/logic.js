import { readScore, resolveStorage, writeScore } from "../storage/score.js";

export const RACING_STATUS = {
  READY: "READY",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  OVER: "OVER"
};

const TWO_PI = Math.PI * 2;

export const RACING_DEFAULTS = {
  canvasWidth: 960,
  canvasHeight: 600,
  lapTarget: 3,
  maxSpeed: 480,
  reverseSpeed: 180,
  acceleration: 420,
  braking: 520,
  drag: 260,
  offTrackDrag: 700,
  steeringRate: 3.1,
  offTrackGripPenalty: 0.6,
  laneShiftRate: 1.15,
  laneCenteringRate: 0.38,
  minLapMs: 1500,
  bestLapStorageKey: "mini-arcade-racing-best-lap"
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeAngle(angle) {
  const wrapped = angle % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

function crossedAngleForward(previousAngle, currentAngle, targetAngle) {
  const prev = normalizeAngle(previousAngle);
  const curr = normalizeAngle(currentAngle);
  const target = normalizeAngle(targetAngle);

  if (prev === curr) {
    return false;
  }

  if (curr > prev) {
    return target > prev && target <= curr;
  }

  return target > prev || target <= curr;
}

function readBestLapMs(storage, key) {
  const storedValue = readScore(storage, key, 0);
  return storedValue > 0 ? storedValue : null;
}

function writeBestLapMs(storage, key, lapMs) {
  const normalizedLap = Math.round(Math.max(0, lapMs));
  writeScore(storage, key, normalizedLap);
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
    laneShiftRate: Math.max(0.1, sanitizeNumber(overrides.laneShiftRate, RACING_DEFAULTS.laneShiftRate)),
    laneCenteringRate: Math.max(0, sanitizeNumber(overrides.laneCenteringRate, RACING_DEFAULTS.laneCenteringRate)),
    minLapMs: Math.max(500, sanitizeNumber(overrides.minLapMs, RACING_DEFAULTS.minLapMs)),
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
  const centerlineRadiusX = (outerRadiusX + innerRadiusX) / 2;
  const centerlineRadiusY = (outerRadiusY + innerRadiusY) / 2;
  const laneHalfWidthX = (outerRadiusX - innerRadiusX) / 2;
  const laneHalfWidthY = (outerRadiusY - innerRadiusY) / 2;

  return {
    centerX,
    centerY,
    outerRadiusX,
    outerRadiusY,
    innerRadiusX,
    innerRadiusY,
    centerlineRadiusX,
    centerlineRadiusY,
    laneHalfWidthX,
    laneHalfWidthY,
    startLine: {
      angle: startAngle,
      width: 40
    },
    spawnPoint: {
      heading: 0,
      progressAngle: startAngle,
      laneOffset: 0
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

function updateCarPoseFromTrack(track, car) {
  const laneX = track.centerlineRadiusX + (track.laneHalfWidthX * car.laneOffset);
  const laneY = track.centerlineRadiusY + (track.laneHalfWidthY * car.laneOffset);

  const safeLaneX = Math.max(8, laneX);
  const safeLaneY = Math.max(8, laneY);

  car.x = track.centerX + (Math.cos(car.progressAngle) * safeLaneX);
  car.y = track.centerY + (Math.sin(car.progressAngle) * safeLaneY);

  const tangentX = -Math.sin(car.progressAngle) * safeLaneX;
  const tangentY = Math.cos(car.progressAngle) * safeLaneY;

  car.heading = Math.atan2(tangentY, tangentX);
  car.offTrack = !isCarOnTrack(track, car);
}

export function createRacingState(configOverrides = {}, runtime = {}) {
  const config = createRacingConfig(configOverrides);
  const storage = resolveStorage(runtime.storage);
  const track = createDefaultTrack(config.canvasWidth, config.canvasHeight);
  const bestLapMs = readBestLapMs(storage, config.bestLapStorageKey);

  const state = {
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
    lastLapMs: null,
    bestLapMs,
    lapTimesMs: [],
    finishReason: null,
    eventMessage: "Press Start Race to begin.",
    car: {
      x: track.centerX,
      y: track.centerY,
      heading: track.spawnPoint.heading,
      speed: 0,
      steer: 0,
      width: 22,
      length: 38,
      offTrack: false,
      crossedStartGate: false,
      progressAngle: track.spawnPoint.progressAngle,
      laneOffset: track.spawnPoint.laneOffset,
      angularVelocity: 0
    },
    input: {
      throttle: false,
      brake: false,
      steerLeft: false,
      steerRight: false
    }
  };

  updateCarPoseFromTrack(track, state.car);
  return state;
}

export function resetRacingState(state) {
  const { track, car } = state;

  state.status = RACING_STATUS.READY;
  state.startedAtMs = null;
  state.endedAtMs = null;
  state.lastTickMs = null;
  state.elapsedMs = 0;
  state.completedLaps = 0;
  state.currentLapMs = 0;
  state.lastLapMs = null;
  state.lapTimesMs = [];
  state.finishReason = null;
  state.eventMessage = "Press Start Race to begin.";

  car.heading = track.spawnPoint.heading;
  car.speed = 0;
  car.steer = 0;
  car.offTrack = false;
  car.crossedStartGate = false;
  car.progressAngle = track.spawnPoint.progressAngle;
  car.laneOffset = track.spawnPoint.laneOffset;
  car.angularVelocity = 0;

  updateCarPoseFromTrack(track, car);
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

  const laneShift = steeringInput * config.laneShiftRate * steeringGrip * dtSec;
  if (laneShift !== 0) {
    car.laneOffset += laneShift;
  } else if (car.laneOffset !== 0) {
    const centerPull = config.laneCenteringRate * dtSec;
    if (Math.abs(car.laneOffset) <= centerPull) {
      car.laneOffset = 0;
    } else {
      car.laneOffset += car.laneOffset > 0 ? -centerPull : centerPull;
    }
  }

  // Allow small overshoot so off-track penalties can engage, then clamp hard.
  car.laneOffset = clamp(car.laneOffset, -1.25, 1.25);
}

function applyTrackMovement(state, dtSec) {
  const { car, track } = state;
  const laneRadiusX = Math.max(12, track.centerlineRadiusX + (track.laneHalfWidthX * car.laneOffset));
  const laneRadiusY = Math.max(12, track.centerlineRadiusY + (track.laneHalfWidthY * car.laneOffset));
  const radiusScale = Math.sqrt(laneRadiusX * laneRadiusY);

  const angularVelocity = radiusScale > 0 ? (car.speed / radiusScale) : 0;
  car.angularVelocity = angularVelocity;

  const previousAngle = car.progressAngle;
  car.progressAngle += angularVelocity * dtSec;

  updateCarPoseFromTrack(track, car);
  return previousAngle;
}

function updateLapProgress(state, previousAngle) {
  const { car, track, config } = state;

  if (car.speed <= 0) {
    return;
  }

  const crossedStart = crossedAngleForward(previousAngle, car.progressAngle, track.startLine.angle);
  if (!crossedStart || state.currentLapMs < config.minLapMs) {
    return;
  }

  const finishedLapMs = state.currentLapMs;

  state.completedLaps += 1;
  state.lastLapMs = finishedLapMs;
  state.lapTimesMs.push(finishedLapMs);

  if (!state.bestLapMs || finishedLapMs < state.bestLapMs) {
    state.bestLapMs = finishedLapMs;
    writeBestLapMs(state.storage, state.config.bestLapStorageKey, state.bestLapMs);
  }

  state.eventMessage = `Lap ${state.completedLaps} completed in ${(finishedLapMs / 1000).toFixed(2)}s.`;
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
  const previousAngle = applyTrackMovement(state, dtSec);
  updateLapProgress(state, previousAngle);

  return state;
}

export function getRacingSnapshot(state) {
  return {
    status: state.status,
    elapsedMs: state.elapsedMs,
    currentLapMs: state.currentLapMs,
    lastLapMs: state.lastLapMs,
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
      offTrack: state.car.offTrack,
      laneOffset: state.car.laneOffset,
      progressAngle: state.car.progressAngle,
      angularVelocity: state.car.angularVelocity
    }
  };
}
