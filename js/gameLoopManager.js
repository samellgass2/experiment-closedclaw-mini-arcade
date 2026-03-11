const DEV_MODE =
  typeof window !== "undefined" &&
  (window.location?.hostname === "localhost" ||
    window.location?.hostname === "127.0.0.1" ||
    window.location?.hostname === "" ||
    window.location?.protocol === "file:");

let activeSession = null;

function devLog(level, message, details) {
  if (!DEV_MODE) {
    return;
  }

  const logger = console[level] || console.log;
  if (details !== undefined) {
    logger(`[game-loop-manager] ${message}`, details);
  } else {
    logger(`[game-loop-manager] ${message}`);
  }
}

function createSessionScope(gameId) {
  const cleanups = [];
  const rafIds = new Set();
  const intervalIds = new Set();
  const timeoutIds = new Set();
  let stopped = false;

  function registerCleanup(teardown, label = "cleanup") {
    if (typeof teardown !== "function") {
      return () => {};
    }

    cleanups.push({ teardown, label });
    return teardown;
  }

  function requestFrame(callback) {
    if (typeof callback !== "function") {
      throw new Error("requestFrame requires a callback.");
    }

    const rafId = window.requestAnimationFrame((timestamp) => {
      rafIds.delete(rafId);
      if (stopped) {
        return;
      }
      callback(timestamp);
    });

    rafIds.add(rafId);
    return rafId;
  }

  function cancelFrame(rafId) {
    if (!rafIds.has(rafId)) {
      return;
    }

    window.cancelAnimationFrame(rafId);
    rafIds.delete(rafId);
  }

  function setManagedInterval(callback, ms) {
    const intervalId = window.setInterval(() => {
      if (stopped) {
        return;
      }
      callback();
    }, ms);

    intervalIds.add(intervalId);
    return intervalId;
  }

  function clearManagedInterval(intervalId) {
    if (!intervalIds.has(intervalId)) {
      return;
    }

    window.clearInterval(intervalId);
    intervalIds.delete(intervalId);
  }

  function setManagedTimeout(callback, ms) {
    const timeoutId = window.setTimeout(() => {
      timeoutIds.delete(timeoutId);
      if (stopped) {
        return;
      }
      callback();
    }, ms);

    timeoutIds.add(timeoutId);
    return timeoutId;
  }

  function clearManagedTimeout(timeoutId) {
    if (!timeoutIds.has(timeoutId)) {
      return;
    }

    window.clearTimeout(timeoutId);
    timeoutIds.delete(timeoutId);
  }

  function listen(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== "function") {
      throw new Error(`Unable to bind event listener for ${type}.`);
    }

    target.addEventListener(type, handler, options);
    registerCleanup(() => target.removeEventListener(type, handler, options), `event:${type}`);
  }

  function stopScope(reason = "stop") {
    if (stopped) {
      return;
    }

    stopped = true;

    for (const rafId of rafIds) {
      window.cancelAnimationFrame(rafId);
    }
    rafIds.clear();

    for (const intervalId of intervalIds) {
      window.clearInterval(intervalId);
    }
    intervalIds.clear();

    for (const timeoutId of timeoutIds) {
      window.clearTimeout(timeoutId);
    }
    timeoutIds.clear();

    while (cleanups.length > 0) {
      const next = cleanups.pop();
      try {
        next.teardown();
      } catch (error) {
        devLog("warn", `Cleanup '${next.label}' failed while stopping ${gameId}.`, error);
      }
    }

    devLog("info", `Stopped scope for ${gameId} (${reason}).`);
  }

  return {
    gameId,
    registerCleanup,
    requestFrame,
    cancelFrame,
    setInterval: setManagedInterval,
    clearInterval: clearManagedInterval,
    setTimeout: setManagedTimeout,
    clearTimeout: clearManagedTimeout,
    listen,
    isStopped: () => stopped,
    stopScope
  };
}

export function getActiveGameLoop() {
  if (!activeSession) {
    return null;
  }

  return {
    gameId: activeSession.gameId,
    startedAtMs: activeSession.startedAtMs
  };
}

export function stopActiveGameLoop(reason = "manual-stop") {
  if (!activeSession) {
    return false;
  }

  const sessionToStop = activeSession;
  activeSession = null;

  try {
    if (typeof sessionToStop.teardown === "function") {
      sessionToStop.teardown();
    }
  } catch (error) {
    devLog("warn", `Runtime teardown threw for ${sessionToStop.gameId}.`, error);
  }

  sessionToStop.scope.stopScope(reason);
  devLog("info", `Stopped active game loop for ${sessionToStop.gameId}.`);
  return true;
}

export function startGameLoop(gameId, startFn) {
  if (typeof gameId !== "string" || gameId.trim().length === 0) {
    throw new Error("startGameLoop requires a non-empty gameId.");
  }
  if (typeof startFn !== "function") {
    throw new Error("startGameLoop requires a start function.");
  }

  const normalizedGameId = gameId.trim().toLowerCase();

  if (activeSession) {
    if (DEV_MODE) {
      devLog(
        "warn",
        `Starting ${normalizedGameId} while ${activeSession.gameId} is still active. Forcing teardown first.`
      );
    }
    stopActiveGameLoop(`switch-to-${normalizedGameId}`);
  }

  const scope = createSessionScope(normalizedGameId);
  let teardown = null;

  try {
    teardown = startFn(scope) ?? null;
  } catch (error) {
    scope.stopScope(`failed-start-${normalizedGameId}`);
    throw error;
  }

  activeSession = {
    gameId: normalizedGameId,
    scope,
    teardown,
    startedAtMs: Date.now()
  };

  devLog("info", `Started game loop for ${normalizedGameId}.`);
  return getActiveGameLoop();
}
