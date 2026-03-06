import assert from "node:assert/strict";

import {
  DASHBOARD_STATUS,
  addDashboardTile,
  createDashboardState,
  getDashboardAvailableGames,
  getDashboardSnapshot,
  moveDashboardTile,
  rearrangeDashboardTiles,
  removeDashboardTile,
  updateDashboardTileScore
} from "../js/dashboard/logic.js";

function testCreateStateAndAvailability() {
  const state = createDashboardState({
    initialTileIds: ["racing", "clicker"],
    initialScores: {
      racing: 9
    }
  });

  assert.deepEqual(state.tileIds, ["racing", "clicker"]);
  const available = getDashboardAvailableGames(state);
  assert.equal(available.length, 2);
  assert.equal(available[0].id, "color-match");
  const snapshot = getDashboardSnapshot(state);
  assert.equal(snapshot.tiles[0].score, 9);
  assert.equal(snapshot.tiles[1].score, 0);
}

function testAddTile() {
  const state = createDashboardState({
    initialTileIds: ["racing"]
  });

  const addResult = addDashboardTile(state, "anomaly");
  assert.equal(addResult.accepted, true);
  assert.deepEqual(state.tileIds, ["racing", "anomaly"]);
  assert.equal(state.lastAction.status, DASHBOARD_STATUS.SUCCESS);

  const duplicateResult = addDashboardTile(state, "anomaly");
  assert.equal(duplicateResult.accepted, false);
  assert.equal(duplicateResult.reason, "duplicate-tile");
}

function testRemoveTile() {
  const state = createDashboardState({
    initialTileIds: ["racing", "clicker", "anomaly"]
  });

  const result = removeDashboardTile(state, "clicker");
  assert.equal(result.accepted, true);
  assert.deepEqual(state.tileIds, ["racing", "anomaly"]);

  const missing = removeDashboardTile(state, "color-match");
  assert.equal(missing.accepted, false);
  assert.equal(missing.reason, "tile-not-found");
}

function testRearrangeTiles() {
  const state = createDashboardState({
    initialTileIds: ["racing", "clicker", "color-match", "anomaly"]
  });

  const moved = rearrangeDashboardTiles(state, 0, 2);
  assert.equal(moved.accepted, true);
  assert.deepEqual(state.tileIds, ["clicker", "color-match", "racing", "anomaly"]);

  const noOp = rearrangeDashboardTiles(state, 1, 1);
  assert.equal(noOp.accepted, false);
  assert.equal(noOp.reason, "no-op");

  const outOfRange = rearrangeDashboardTiles(state, -1, 2);
  assert.equal(outOfRange.accepted, false);
  assert.equal(outOfRange.reason, "out-of-range");
}

function testDirectionalMoveAndSnapshot() {
  const state = createDashboardState({
    initialTileIds: ["racing", "clicker", "color-match"]
  });

  const leftEdge = moveDashboardTile(state, "racing", "left");
  assert.equal(leftEdge.accepted, false);
  assert.equal(leftEdge.reason, "edge-no-op");

  const moveRight = moveDashboardTile(state, "clicker", "right");
  assert.equal(moveRight.accepted, true);
  assert.deepEqual(state.tileIds, ["racing", "color-match", "clicker"]);

  const snapshot = getDashboardSnapshot(state);
  assert.equal(snapshot.tileCount, 3);
  assert.equal(snapshot.availableCount, 1);
  assert.equal(snapshot.tiles[1].id, "color-match");
  assert.equal(snapshot.tiles[1].position, 1);
  assert.equal(snapshot.tiles[1].score, 0);
}

function testUpdateTileScore() {
  const state = createDashboardState({
    initialTileIds: ["racing", "clicker"]
  });

  const updated = updateDashboardTileScore(state, "racing", 41.7);
  assert.equal(updated.accepted, true);
  assert.equal(updated.reason, "score-updated");
  assert.equal(updated.score, 41);

  const snapshot = getDashboardSnapshot(state);
  const racingTile = snapshot.tiles.find((tile) => tile.id === "racing");
  assert.equal(Boolean(racingTile), true);
  assert.equal(racingTile.score, 41);

  const missing = updateDashboardTileScore(state, "color-match", 10);
  assert.equal(missing.accepted, false);
  assert.equal(missing.reason, "tile-not-found");
}

function run() {
  testCreateStateAndAvailability();
  testAddTile();
  testRemoveTile();
  testRearrangeTiles();
  testDirectionalMoveAndSnapshot();
  testUpdateTileScore();
  console.log("dashboard.logic.test: ok");
}

run();
