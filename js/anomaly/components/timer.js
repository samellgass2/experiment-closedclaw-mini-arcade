export function createTimer() {
  return {
    active: false,
    previousTick: 0,
    elapsedCarry: 0
  };
}

export function startTimer(timer, now) {
  timer.active = true;
  timer.previousTick = now;
  timer.elapsedCarry = 0;
}

export function pauseTimer(timer) {
  timer.active = false;
}

export function tickTimer(timer, now, onTick) {
  if (!timer.active) {
    return;
  }

  const delta = Math.max(0, now - timer.previousTick);
  timer.previousTick = now;
  timer.elapsedCarry += delta;

  const stepMs = 1000;
  while (timer.elapsedCarry >= stepMs) {
    timer.elapsedCarry -= stepMs;
    onTick();
  }
}
