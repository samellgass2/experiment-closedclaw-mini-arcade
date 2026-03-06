# Task Report: TASK_ID 125 (RUN_ID 205)

## Summary
Implemented core top-down racing mechanics so the player-controlled icon responds to keyboard input and moves reliably around the oval/circular track.

## Changes
- Reworked `js/racing/logic.js` to use track-relative simulation:
  - Added angle-based progression (`progressAngle`) and lane steering (`laneOffset`).
  - Derives car position/heading from ellipse geometry each frame.
  - Added lane-centering behavior, off-track drag handling, and deterministic lap crossing checks.
  - Extended snapshot with movement diagnostics (`laneOffset`, `progressAngle`, `angularVelocity`).
- Added `js/racing/controls.js` for keyboard-to-input mapping and full input release patch.
- Updated `js/game.js` to use controls module and release input when window focus is lost.
- Added `tests/racing.controls.test.mjs`.
- Expanded `tests/racing.logic.test.mjs` with movement/lap/steering assertions.
- Updated `STATUS.md` with Task 125 implementation and verification details.

## Verification
Executed:
`node tests/anomaly.logic.test.mjs && node tests/clicker.logic.test.mjs && node tests/color-match.logic.test.mjs && node tests/racing.controls.test.mjs && node tests/racing.logic.test.mjs`

Result:
- anomaly.logic.test: ok
- clicker.logic.test: ok
- color-match.logic.test: ok
- racing.controls.test: ok
- racing.logic.test: ok

## Acceptance
- Keyboard controls respond and map correctly to race input.
- Player icon advances around the track and can complete laps with deterministic race progression.
