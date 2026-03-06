const KEY_TO_INPUT = {
  ArrowUp: "throttle",
  KeyW: "throttle",
  ArrowDown: "brake",
  KeyS: "brake",
  ArrowLeft: "steerLeft",
  KeyA: "steerLeft",
  ArrowRight: "steerRight",
  KeyD: "steerRight"
};

export function mapKeyboardEventCodeToInputPatch(code, pressed) {
  const inputKey = KEY_TO_INPUT[code];
  if (!inputKey) {
    return null;
  }

  return { [inputKey]: Boolean(pressed) };
}

export function createReleasedInputPatch() {
  return {
    throttle: false,
    brake: false,
    steerLeft: false,
    steerRight: false
  };
}
