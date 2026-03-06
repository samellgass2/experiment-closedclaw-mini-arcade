import assert from "node:assert/strict";

import {
  createReleasedInputPatch,
  mapKeyboardEventCodeToInputPatch
} from "../js/racing/controls.js";

function testKeyboardMapping() {
  assert.deepEqual(mapKeyboardEventCodeToInputPatch("ArrowUp", true), { throttle: true });
  assert.deepEqual(mapKeyboardEventCodeToInputPatch("KeyW", false), { throttle: false });
  assert.deepEqual(mapKeyboardEventCodeToInputPatch("ArrowLeft", true), { steerLeft: true });
  assert.deepEqual(mapKeyboardEventCodeToInputPatch("KeyD", false), { steerRight: false });
  assert.equal(mapKeyboardEventCodeToInputPatch("KeyQ", true), null);
}

function testReleasedPatch() {
  assert.deepEqual(createReleasedInputPatch(), {
    throttle: false,
    brake: false,
    steerLeft: false,
    steerRight: false
  });
}

function run() {
  testKeyboardMapping();
  testReleasedPatch();
  console.log("racing.controls.test: ok");
}

run();
