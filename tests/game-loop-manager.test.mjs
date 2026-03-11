import assert from "node:assert/strict";

function createWindowMock() {
  let nextRafId = 1;
  let nextIntervalId = 1;
  let nextTimeoutId = 1;
  const rafCallbacks = new Map();
  const intervalCallbacks = new Map();
  const timeoutCallbacks = new Map();

  return {
    location: {
      hostname: "localhost",
      protocol: "http:"
    },
    requestAnimationFrame(callback) {
      const rafId = nextRafId++;
      rafCallbacks.set(rafId, callback);
      return rafId;
    },
    cancelAnimationFrame(rafId) {
      rafCallbacks.delete(rafId);
    },
    setInterval(callback) {
      const intervalId = nextIntervalId++;
      intervalCallbacks.set(intervalId, callback);
      return intervalId;
    },
    clearInterval(intervalId) {
      intervalCallbacks.delete(intervalId);
    },
    setTimeout(callback) {
      const timeoutId = nextTimeoutId++;
      timeoutCallbacks.set(timeoutId, callback);
      return timeoutId;
    },
    clearTimeout(timeoutId) {
      timeoutCallbacks.delete(timeoutId);
    },
    triggerAnimationFrame(rafId, timestamp = 0) {
      const callback = rafCallbacks.get(rafId);
      if (typeof callback !== "function") {
        return false;
      }
      callback(timestamp);
      return true;
    },
    triggerInterval(intervalId) {
      const callback = intervalCallbacks.get(intervalId);
      if (typeof callback !== "function") {
        return false;
      }
      callback();
      return true;
    },
    triggerTimeout(timeoutId) {
      const callback = timeoutCallbacks.get(timeoutId);
      if (typeof callback !== "function") {
        return false;
      }
      callback();
      return true;
    },
    stats() {
      return {
        rafCount: rafCallbacks.size,
        intervalCount: intervalCallbacks.size,
        timeoutCount: timeoutCallbacks.size
      };
    }
  };
}

async function loadManagerWithWindow(windowMock) {
  globalThis.window = windowMock;
  const nonce = `${Date.now()}-${Math.random()}`;
  return import(`../js/gameLoopManager.js?test=${nonce}`);
}

async function testStopsManagedResources() {
  const windowMock = createWindowMock();
  const manager = await loadManagerWithWindow(windowMock);
  let teardownCount = 0;

  manager.startGameLoop("clicker", (scope) => {
    scope.requestFrame(() => {});
    scope.setInterval(() => {}, 50);
    scope.setTimeout(() => {}, 100);
    return () => {
      teardownCount += 1;
    };
  });

  assert.deepEqual(windowMock.stats(), { rafCount: 1, intervalCount: 1, timeoutCount: 1 });
  assert.equal(manager.stopActiveGameLoop("test-stop"), true);
  assert.equal(teardownCount, 1);
  assert.equal(manager.getActiveGameLoop(), null);
  assert.deepEqual(windowMock.stats(), { rafCount: 0, intervalCount: 0, timeoutCount: 0 });
}

async function testSwitchingGamesStopsPreviousLoop() {
  const windowMock = createWindowMock();
  const manager = await loadManagerWithWindow(windowMock);
  let firstTickCount = 0;
  let firstTeardownCount = 0;
  let firstIntervalId = null;

  manager.startGameLoop("racing", (scope) => {
    firstIntervalId = scope.setInterval(() => {
      firstTickCount += 1;
    }, 16);
    return () => {
      firstTeardownCount += 1;
    };
  });

  assert.equal(windowMock.triggerInterval(firstIntervalId), true);
  assert.equal(firstTickCount, 1);

  manager.startGameLoop("flappy", (scope) => {
    scope.requestFrame(() => {});
    return () => {};
  });

  assert.equal(firstTeardownCount, 1);
  assert.equal(windowMock.triggerInterval(firstIntervalId), false);
  assert.equal(firstTickCount, 1);

  const active = manager.getActiveGameLoop();
  assert.equal(active.gameId, "flappy");
  assert.equal(active.managedResources.intervals, 0);
  assert.equal(windowMock.stats().intervalCount, 0);

  manager.stopActiveGameLoop("test-cleanup");
}

async function testStoppedScopeRejectsLateRegistrations() {
  const windowMock = createWindowMock();
  const manager = await loadManagerWithWindow(windowMock);
  let savedScope = null;
  let callbackRuns = 0;

  manager.startGameLoop("anomaly", (scope) => {
    savedScope = scope;
    return () => {};
  });

  manager.stopActiveGameLoop("before-late-calls");
  const intervalId = savedScope.setInterval(() => {
    callbackRuns += 1;
  }, 10);
  const timeoutId = savedScope.setTimeout(() => {
    callbackRuns += 1;
  }, 10);
  const rafId = savedScope.requestFrame(() => {
    callbackRuns += 1;
  });

  assert.equal(intervalId, null);
  assert.equal(timeoutId, null);
  assert.equal(rafId, null);
  assert.deepEqual(windowMock.stats(), { rafCount: 0, intervalCount: 0, timeoutCount: 0 });
  assert.equal(callbackRuns, 0);
}

async function run() {
  await testStopsManagedResources();
  await testSwitchingGamesStopsPreviousLoop();
  await testStoppedScopeRejectsLateRegistrations();
  console.log("game-loop-manager.test: ok");
}

await run();
