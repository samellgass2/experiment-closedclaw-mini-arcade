# Task Report: TASK_ID 186 (RUN_ID 340)

## Summary
Extended `README.md` with a detailed `Usage Guide` section for the mini arcade dashboard, covering tile management workflows, current game-launch behavior, and dashboard UI feedback features. Updated `STATUS.md` with a matching Task 186 record and acceptance mapping.

## Changes
- Updated `README.md`:
  - Added `## Usage Guide`
  - Documented how to add game tiles from `Catalog Controls`
  - Documented how to remove tiles from `Active Board`
  - Documented tile rearrangement with `Move Left`/`Move Right` and drag-drop insertion slots
  - Documented UI constraints (duplicate prevention, board capacity, disabled add controls)
  - Documented status/feedback UX (`dashboardStatus`, `Recent Actions`, tile/board pulse feedback)
  - Clarified current launch behavior: no direct in-dashboard play-route button in this implementation
  - Included score update hook usage via `window.__MINI_ARCADE_DASHBOARD__.setGameScore(tileId, score)`
- Updated `STATUS.md`:
  - Added `Task 186 Update (RUN_ID 340)`
  - Included evidence, verification, and acceptance mapping for the README usage guide addition

## Verification
Executed:
- `node --test tests/*.mjs`

Result:
- PASS: `tests/anomaly.logic.test.mjs`
- PASS: `tests/clicker.logic.test.mjs`
- PASS: `tests/color-match.logic.test.mjs`
- PASS: `tests/dashboard.logic.test.mjs`
- PASS: `tests/racing.controls.test.mjs`
- PASS: `tests/racing.logic.test.mjs`
- PASS: `tests/storage.score.test.mjs`

## Acceptance Coverage
1. `README.md` contains a `Usage Guide` section: PASS
2. Section explains dashboard interaction: PASS
3. Section explains launch behavior and relevant UI features: PASS
4. Instructions align with implementation and analyst/status records: PASS
5. README formatting remains consistent/readable: PASS
6. `STATUS.md` reflects the update: PASS
