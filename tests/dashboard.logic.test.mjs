import assert from "node:assert/strict";

import {
  DASHBOARD_TILE_TYPE,
  DASHBOARD_STATUS,
  addDashboardTile,
  createDashboardState,
  getDashboardAvailableGames,
  getDashboardSnapshot,
  moveDashboardTile,
  repositionDashboardTile,
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

function testRepositionTileByInsertionIndex() {
  const state = createDashboardState({
    initialTileIds: ["racing", "clicker", "color-match", "anomaly"]
  });

  const moveForward = repositionDashboardTile(state, "clicker", 4);
  assert.equal(moveForward.accepted, true);
  assert.deepEqual(state.tileIds, ["racing", "color-match", "anomaly", "clicker"]);
  assert.equal(moveForward.toIndex, 3);

  const moveBackward = repositionDashboardTile(state, "anomaly", 0);
  assert.equal(moveBackward.accepted, true);
  assert.deepEqual(state.tileIds, ["anomaly", "racing", "color-match", "clicker"]);
  assert.equal(moveBackward.toIndex, 0);

  const noOp = repositionDashboardTile(state, "racing", 2);
  assert.equal(noOp.accepted, false);
  assert.equal(noOp.reason, "no-op");

  const outOfRange = repositionDashboardTile(state, "clicker", 5);
  assert.equal(outOfRange.accepted, false);
  assert.equal(outOfRange.reason, "out-of-range");
}

function testDirectionalMoveAndSnapshot() {
  const catalog = [
    {
      id: "global-high-scores",
      name: "Global High Scores",
      description: "Stats tile",
      difficulty: "All Modes",
      mode: "Stats",
      tileType: "stats",
      isStatsTile: true
    },
    ...createDashboardState().catalog
  ];

  const state = createDashboardState({
    catalog,
    initialTileIds: ["global-high-scores", "racing", "clicker", "color-match"]
  });

  const leftEdge = moveDashboardTile(state, "global-high-scores", "up");
  assert.equal(leftEdge.accepted, false);
  assert.equal(leftEdge.reason, "edge-no-op");

  const moveRight = moveDashboardTile(state, "racing", "right");
  assert.equal(moveRight.accepted, true);
  assert.deepEqual(state.tileIds, ["global-high-scores", "clicker", "racing", "color-match"]);

  const moveDown = moveDashboardTile(state, "global-high-scores", "down");
  assert.equal(moveDown.accepted, true);
  assert.deepEqual(state.tileIds, ["clicker", "global-high-scores", "racing", "color-match"]);

  const snapshot = getDashboardSnapshot(state);
  assert.equal(snapshot.tileCount, 4);
  assert.equal(snapshot.availableCount, 1);
  assert.equal(snapshot.tiles[1].id, "global-high-scores");
  assert.equal(snapshot.tiles[1].position, 1);
  assert.equal(snapshot.tiles[1].score, 0);
  assert.equal(snapshot.tiles[1].tileType, DASHBOARD_TILE_TYPE.STATS);
  assert.equal(snapshot.tiles[2].tileType, DASHBOARD_TILE_TYPE.GAME);
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
  testRepositionTileByInsertionIndex();
  testDirectionalMoveAndSnapshot();
  testUpdateTileScore();
  console.log("dashboard.logic.test: ok");
}

run();
