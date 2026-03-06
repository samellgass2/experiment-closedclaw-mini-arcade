import {
  RACING_STATUS,
  createRacingState,
  startRace,
  pauseRace,
  resumeRace,
  resetRacingState,
  tickRace,
  finishRace,
  setInputState,
  getRacingSnapshot
} from "./racing/logic.js";
import { createRacingRenderer } from "./racing/renderer.js";
import { createReleasedInputPatch, mapKeyboardEventCodeToInputPatch } from "./racing/controls.js";

function queryRequiredElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required DOM node: ${id}`);
  }
  return element;
}

function createUIBindings() {
  const canvas = queryRequiredElement("raceCanvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("raceCanvas must be a canvas element");
  }

  return {
    canvas,
    startButton: queryRequiredElement("startRaceButton"),
    pauseButton: queryRequiredElement("pauseRaceButton"),
    resetButton: queryRequiredElement("resetRaceButton"),
    statusValue: queryRequiredElement("statusValue"),
    lapValue: queryRequiredElement("lapValue"),
    timerValue: queryRequiredElement("timerValue"),
    currentLapValue: queryRequiredElement("currentLapValue"),
    bestLapValue: queryRequiredElement("bestLapValue"),
    speedValue: queryRequiredElement("speedValue"),
    trackStateValue: queryRequiredElement("trackStateValue"),
    eventValue: queryRequiredElement("eventValue")
  };
}

function createGameController(ui) {
  const state = createRacingState({
    canvasWidth: ui.canvas.width,
    canvasHeight: ui.canvas.height,
    lapTarget: 3,
    bestLapStorageKey: "mini-arcade-top-down-racing-best-lap"
  });
  const renderer = createRacingRenderer(ui.canvas);

  let rafId = null;

  function render() {
    renderer.render(state);
    renderer.updateHUD(state, ui);
  }

  function startOrRestartRace() {
    startRace(state, performance.now());
    render();
  }

  function togglePause() {
    if (state.status === RACING_STATUS.RUNNING) {
      pauseRace(state);
    } else if (state.status === RACING_STATUS.PAUSED) {
      resumeRace(state, performance.now());
    }

    render();
  }

  function resetRace() {
    if (state.status === RACING_STATUS.RUNNING || state.status === RACING_STATUS.PAUSED) {
      finishRace(state, performance.now(), "manual-reset");
    }

    resetRacingState(state);
    render();
  }

  function onKeyDown(event) {
    if (event.repeat) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (state.status === RACING_STATUS.READY || state.status === RACING_STATUS.OVER) {
        startOrRestartRace();
      } else {
        togglePause();
      }
      return;
    }

    const patch = mapKeyboardEventCodeToInputPatch(event.code, true);
    if (patch) {
      event.preventDefault();
      setInputState(state, patch);
    }
  }

  function onKeyUp(event) {
    const patch = mapKeyboardEventCodeToInputPatch(event.code, false);
    if (patch) {
      event.preventDefault();
      setInputState(state, patch);
    }
  }

  function releaseAllInput() {
    setInputState(state, createReleasedInputPatch());
  }

  function bindEvents() {
    ui.startButton.addEventListener("click", startOrRestartRace);
    ui.pauseButton.addEventListener("click", togglePause);
    ui.resetButton.addEventListener("click", resetRace);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAllInput);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        releaseAllInput();
      }
    });
  }

  function frame(nowMs) {
    tickRace(state, nowMs);
    render();
    rafId = window.requestAnimationFrame(frame);
  }

  function startLoop() {
    if (rafId !== null) {
      return;
    }

    rafId = window.requestAnimationFrame(frame);
  }

  function getSnapshot() {
    return getRacingSnapshot(state);
  }

  return {
    bindEvents,
    startLoop,
    render,
    getSnapshot
  };
}

function initialize() {
  const ui = createUIBindings();
  const controller = createGameController(ui);

  controller.bindEvents();
  controller.render();
  controller.startLoop();

  window.__TOP_DOWN_RACING__ = {
    getSnapshot: controller.getSnapshot
  };
}

initialize();
